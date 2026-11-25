/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import config from '@app/config/index.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import StripeService from '@app/class/string.class.js';
import { notificationQueue } from '@app/redis/index.js';
import { notifyAdmins } from '../notification/notification.service.js';
import {
  ensureStripeCustomer,
  isCheckoutSessionId,
  MIN_CARD_AMOUNT_CENTS,
  toCents,
} from './payment.utils.js';
import {
  isWholesaleFeePayment,
  wholesaleFeeService,
} from '../wholesaleFee/wholesaleFee.service.js';
import {
  OrderStatus,
  PAYMENT_STATUS,
  type Prisma,
} from '../../../../generated/prisma/index.js';

const paymentInclude = {
  order: {
    include: {
      items: { include: { product: { include: { images: true } } } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          profile: true,
          phoneNumber: true,
        },
      },
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profile: true,
      phoneNumber: true,
    },
  },
} satisfies Prisma.PaymentInclude;

// The fields we read from a Stripe PaymentIntent (API object or webhook payload).
type PaymentIntentLike = {
  id: string;
  status: string;
  amount: number;
  metadata?: Record<string, string> | null;
};

// The fields we read from a Stripe Checkout Session (API object or webhook payload).
type CheckoutSessionLike = {
  id: string;
  status: string | null;
  payment_status: string;
  amount_total: number | null;
  payment_intent: string | { id: string } | null;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
};

// Statuses in which a PaymentIntent (old flow) can still be paid.
const OPEN_INTENT_STATUSES = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
]);

const PROCESSING_MESSAGE =
  'A payment for this order is still processing. Try again in a few minutes.';

// While unpaid, Payment.transactionId holds the Checkout Session id (cs_...).
// Once paid it holds the PaymentIntent id (pi_...), which refunds use.
const isStripeIntentId = (id?: string | null): id is string =>
  typeof id === 'string' && id.startsWith('pi_');

const isObjectId = (id?: string | null): id is string =>
  typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);

const sessionOrderId = (session: CheckoutSessionLike) =>
  session.metadata?.orderId ?? session.client_reference_id;

const sessionPaymentIntentId = (session: CheckoutSessionLike) =>
  typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);

// Sessions and intents created by this backend carry the orderId in metadata.
// Looking up by orderId (not transactionId) also finds the payment when the
// customer paid through an older session for the same order.
const findPayment = (orderId: string | null | undefined, transactionId: string) =>
  isObjectId(orderId)
    ? prisma.payment.findUnique({ where: { orderId }, include: paymentInclude })
    : prisma.payment.findFirst({
        where: { transactionId },
        include: paymentInclude,
      });

const refundQuietly = async (paymentIntentId: string, reason: string) => {
  try {
    await StripeService.refund(paymentIntentId);
  } catch (error) {
    // Usually means it was already refunded by an earlier delivery of the same event.
    console.error(`[payments] Refund of ${paymentIntentId} (${reason}) failed:`, error);
  }
};

/**
 * Records a succeeded PaymentIntent. Safe to call more than once for the same
 * intent (confirm-payment, webhook retries and the order jobs all call it).
 * Returns null when the intent does not belong to an order in this system.
 */
const markPaymentSucceeded = async (intent: PaymentIntentLike) => {
  if (intent.status !== 'succeeded') return null;

  const payment = await findPayment(intent.metadata?.orderId, intent.id);
  if (!payment) return null;

  if (intent.amount !== toCents(payment.amount)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Paid amount does not match the order total',
    );
  }

  if (
    payment.status === PAYMENT_STATUS.paid ||
    payment.status === PAYMENT_STATUS.refunded
  ) {
    // A second payment was made for an order that is already settled.
    if (payment.transactionId !== intent.id) {
      await refundQuietly(intent.id, 'duplicate payment');
    }
    return payment;
  }

  if (payment.order.status === OrderStatus.cancelled) {
    // Paid after the order was cancelled (for example, it expired): give it back.
    await StripeService.refund(intent.id);
    return prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PAYMENT_STATUS.refunded,
        transactionId: intent.id,
        paidAt: new Date(),
      },
      include: paymentInclude,
    });
  }

  const { count } = await prisma.payment.updateMany({
    where: { id: payment.id, status: { not: PAYMENT_STATUS.paid } },
    data: {
      status: PAYMENT_STATUS.paid,
      paidAt: new Date(),
      transactionId: intent.id,
    },
  });

  if (count > 0) {
    await prisma.order.updateMany({
      where: { id: payment.orderId, status: OrderStatus.pending },
      data: { status: OrderStatus.processing },
    });

    await notificationQueue.add('new_notification', {
      data: {
        receiverId: payment.userId,
        orderId: payment.orderId,
        message: 'Payment received',
        description: `We received your payment for order ${payment.order.orderNumber}.`,
      },
    });
    await notifyAdmins({
      orderId: payment.orderId,
      message: 'Order paid',
      description: `Order ${payment.order.orderNumber} has been paid.`,
    });
  }

  return prisma.payment.findUnique({
    where: { id: payment.id },
    include: paymentInclude,
  });
};

// Records a paid Checkout Session through its PaymentIntent. Idempotent.
const markCheckoutSessionPaid = async (session: CheckoutSessionLike) => {
  const paymentIntentId = sessionPaymentIntentId(session);
  if (session.payment_status !== 'paid' || !paymentIntentId) return null;

  const orderId = sessionOrderId(session);
  return markPaymentSucceeded({
    id: paymentIntentId,
    status: 'succeeded',
    amount: session.amount_total ?? 0,
    metadata: orderId ? { orderId } : null,
  });
};

// One-line breakdown shown under the order name on the Stripe Checkout page.
const describeOrder = (order: {
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  items: { quantity: number }[];
}) => {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const parts = [
    `${itemCount} item${itemCount === 1 ? '' : 's'}`,
    `Subtotal $${order.subtotal.toFixed(2)}`,
  ];
  if (order.discount > 0) parts.push(`Discount -$${order.discount.toFixed(2)}`);
  if (order.shippingFee > 0) parts.push(`Shipping $${order.shippingFee.toFixed(2)}`);
  if (order.tax > 0) parts.push(`Tax $${order.tax.toFixed(2)}`);
  return parts.join(' · ');
};

/**
 * Creates (or reuses) a Stripe Checkout Session for an order and returns its
 * hosted payment page URL. The frontend redirects the customer to `checkoutUrl`.
 */
const createPayment = async (
  userId: string,
  payload: { orderId: string; paymentMethod?: string },
) => {
  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
    include: { payment: true, user: true, items: true },
  });
  if (!order || order.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found');
  }
  if (order.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized');
  }
  if (order.status === OrderStatus.cancelled) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This order has been cancelled');
  }
  if (order.payment?.status === PAYMENT_STATUS.paid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Order is already paid');
  }
  if (toCents(order.total) < MIN_CARD_AMOUNT_CENTS) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Order total is below the $0.50 minimum for card payments',
    );
  }

  const clientUrl = config.client_Url?.replace(/\/+$/, '');
  if (!clientUrl) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'CLIENT_URL is not configured',
    );
  }

  // Reuse the order's open session so repeated clicks don't create new ones.
  const existingId = order.payment?.transactionId;
  if (isCheckoutSessionId(existingId)) {
    const existing = await StripeService.retrieveCheckoutSession(existingId);
    if (existing?.payment_status === 'paid') {
      await markCheckoutSessionPaid(existing);
      throw new AppError(httpStatus.BAD_REQUEST, 'Order is already paid');
    }
    if (existing?.status === 'complete') {
      throw new AppError(httpStatus.CONFLICT, PROCESSING_MESSAGE);
    }
    if (
      existing?.status === 'open' &&
      existing.url &&
      existing.amount_total === toCents(order.total)
    ) {
      return {
        payment: await prisma.payment.findUnique({
          where: { orderId: order.id },
          include: paymentInclude,
        }),
        checkoutUrl: existing.url,
        sessionId: existing.id,
      };
    }
  }

  const customerId = await ensureStripeCustomer(order.user);
  const metadata = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId,
  };

  // One line for the whole order, so Stripe charges exactly order.total
  // (discount, shipping and tax are already included in it).
  const session = await StripeService.createCheckoutSession({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: toCents(order.total),
          product_data: {
            name: `Order ${order.orderNumber}`,
            description: describeOrder(order),
          },
        },
      },
    ],
    ...(customerId
      ? { customer: customerId }
      : { customer_email: order.user.email }),
    client_reference_id: order.id,
    metadata,
    // Copied onto the PaymentIntent so refunds and payment_intent.* events
    // can be traced back to the order.
    payment_intent_data: { metadata },
    success_url: `${clientUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&orderId=${order.id}`,
    cancel_url: `${clientUrl}/checkout/cancel?orderId=${order.id}`,
  });
  if (!session?.url) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      'Stripe did not return a checkout URL',
    );
  }

  const payment = await prisma.payment.upsert({
    where: { orderId: order.id },
    update: {
      amount: order.total,
      transactionId: session.id,
      paymentMethod: payload.paymentMethod || 'card',
      status: PAYMENT_STATUS.pending,
    },
    create: {
      userId,
      orderId: order.id,
      amount: order.total,
      transactionId: session.id,
      paymentMethod: payload.paymentMethod || 'card',
      status: PAYMENT_STATUS.pending,
    },
    include: paymentInclude,
  });

  return {
    payment,
    checkoutUrl: session.url,
    sessionId: session.id,
  };
};

/**
 * Called by the frontend's success page with the `session_id` Stripe adds to the
 * success URL. Also accepts a PaymentIntent id from the old flow.
 */
const confirmPayment = async (transactionId?: string) => {
  if (isCheckoutSessionId(transactionId)) {
    const session = await StripeService.retrieveCheckoutSession(transactionId);
    if (!session) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Checkout session not found');
    }
    const payment =
      session.payment_status === 'paid'
        ? await markCheckoutSessionPaid(session)
        : await findPayment(sessionOrderId(session), session.id);
    if (!payment) throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');
    return payment;
  }

  if (isStripeIntentId(transactionId)) {
    const intent = await StripeService.retrievePaymentIntent(transactionId);
    if (!intent) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Payment intent not found');
    }
    const payment =
      intent.status === 'succeeded'
        ? await markPaymentSucceeded(intent)
        : await findPayment(intent.metadata?.orderId, intent.id);
    if (!payment) throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');
    return payment;
  }

  throw new AppError(httpStatus.BAD_REQUEST, 'A valid sessionId is required');
};

const handleWebhook = async (rawBody?: Buffer, signature?: string) => {
  const webhookSecret = config.stripe.webhook_secret;
  if (!webhookSecret) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'STRIPE_WEBHOOK_SECRET is not configured',
    );
  }
  if (!rawBody || !signature) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Missing Stripe signature');
  }

  let event;
  try {
    event = StripeService.constructWebhookEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Stripe signature');
  }

  // Wholesale account fees are told apart by metadata.type; everything else is
  // an order payment. Sessions and intents from other apps on the same Stripe
  // account are ignored.
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      if (isWholesaleFeePayment(event.data.object)) {
        await wholesaleFeeService.markPaidFromSession(event.data.object);
      } else {
        await markCheckoutSessionPaid(event.data.object);
      }
      break;
    case 'payment_intent.succeeded':
      if (isWholesaleFeePayment(event.data.object)) {
        await wholesaleFeeService.markPaidFromIntent(event.data.object);
      } else {
        await markPaymentSucceeded(event.data.object);
      }
      break;
  }

  return { received: true, type: event.type };
};

/**
 * Checks Stripe before an order is cancelled, so a payment that succeeded but
 * was never confirmed (missed webhook) is recorded instead of ignored.
 * Returns the payment status after syncing, or null when there is no payment.
 */
const syncPaymentWithStripe = async (orderId: string) => {
  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) return null;
  if (payment.status !== PAYMENT_STATUS.pending) return payment.status;

  if (isCheckoutSessionId(payment.transactionId)) {
    const session = await StripeService.retrieveCheckoutSession(
      payment.transactionId,
    );
    if (session?.payment_status === 'paid') {
      await markCheckoutSessionPaid(session);
      return PAYMENT_STATUS.paid;
    }
    if (session?.status === 'complete') {
      throw new AppError(httpStatus.CONFLICT, PROCESSING_MESSAGE);
    }
  } else if (isStripeIntentId(payment.transactionId)) {
    const intent = await StripeService.retrievePaymentIntent(
      payment.transactionId,
    );
    if (intent?.status === 'succeeded') {
      await markPaymentSucceeded(intent);
      return PAYMENT_STATUS.paid;
    }
    if (intent?.status === 'processing') {
      throw new AppError(httpStatus.CONFLICT, PROCESSING_MESSAGE);
    }
  }

  return payment.status;
};

/**
 * Settles the money for an order that is about to be cancelled: refunds a paid
 * order, or closes the open Checkout Session so it can no longer be paid.
 * Returns the resulting payment status, or null when there is no payment.
 */
const releasePayment = async (orderId: string) => {
  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) return null;

  if (payment.status === PAYMENT_STATUS.paid) {
    if (!isStripeIntentId(payment.transactionId)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'No Stripe payment found to refund for this order',
      );
    }
    await StripeService.refund(payment.transactionId);
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PAYMENT_STATUS.refunded },
    });
    return PAYMENT_STATUS.refunded;
  }

  if (payment.status !== PAYMENT_STATUS.pending) return payment.status;

  // Paid in the moment between the sync and now: refund it.
  const refundLatePayment = async (paymentIntentId: string) => {
    await StripeService.refund(paymentIntentId);
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PAYMENT_STATUS.refunded,
        transactionId: paymentIntentId,
        paidAt: new Date(),
      },
    });
    return PAYMENT_STATUS.refunded;
  };

  if (isCheckoutSessionId(payment.transactionId)) {
    const session = await StripeService.retrieveCheckoutSession(
      payment.transactionId,
    );
    const paidIntentId = session ? sessionPaymentIntentId(session) : null;
    if (session?.payment_status === 'paid' && paidIntentId) {
      return refundLatePayment(paidIntentId);
    }
    if (session?.status === 'complete') {
      throw new AppError(httpStatus.CONFLICT, PROCESSING_MESSAGE);
    }
    if (session?.status === 'open') {
      await StripeService.expireCheckoutSession(payment.transactionId);
    }
  } else if (isStripeIntentId(payment.transactionId)) {
    const intent = await StripeService.retrievePaymentIntent(
      payment.transactionId,
    );
    if (intent?.status === 'succeeded') {
      return refundLatePayment(intent.id);
    }
    if (intent?.status === 'processing') {
      throw new AppError(httpStatus.CONFLICT, PROCESSING_MESSAGE);
    }
    if (intent && OPEN_INTENT_STATUSES.has(intent.status)) {
      await StripeService.cancelPaymentIntent(intent.id);
    }
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: PAYMENT_STATUS.canceled },
  });
  return PAYMENT_STATUS.canceled;
};

const getAllPayments = async (query: Record<string, any>) => {
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;
  const where: Prisma.PaymentWhereInput = {};

  if (searchTerm) {
    where.OR = [
      { transactionId: { contains: searchTerm } },
      { order: { is: { orderNumber: { contains: searchTerm } } } },
    ];
  }
  if (Object.keys(filtersData).length > 0) {
    where.AND = Object.entries(filtersData).map(([key, value]) => ({
      [key]: { equals: value },
    }));
  }

  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);
  const orderBy: Prisma.PaymentOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'desc' }];

  const data = await prisma.payment.findMany({
    where,
    skip,
    take: limit,
    orderBy,
    include: paymentInclude,
  });
  const total = await prisma.payment.count({ where });
  const revenue = await prisma.payment.aggregate({
    where: { ...where, status: PAYMENT_STATUS.paid },
    _sum: { amount: true },
  });

  return {
    data,
    meta: { page, limit, total },
    revenue: revenue._sum.amount || 0,
  };
};

const getPaymentById = async (id: string) => {
  const result = await prisma.payment.findUnique({
    where: { id },
    include: paymentInclude,
  });
  if (!result) throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');
  return result;
};

export const paymentService = {
  createPayment,
  confirmPayment,
  handleWebhook,
  markPaymentSucceeded,
  syncPaymentWithStripe,
  releasePayment,
  getAllPayments,
  getPaymentById,
};
