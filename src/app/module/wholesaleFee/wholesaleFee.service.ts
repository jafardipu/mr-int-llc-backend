import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import config from '@app/config/index.js';
import StripeService from '@app/class/string.class.js';
import { notificationQueue } from '@app/redis/index.js';
import { notifyAdmins } from '../notification/notification.service.js';
import { PAYMENT_STATUS, Role } from '../../../../generated/prisma/index.js';
import {
  ensureStripeCustomer,
  isCheckoutSessionId,
  MIN_CARD_AMOUNT_CENTS,
  toCents,
} from '../payment/payment.utils.js';
import { isWholesaleFeeDue } from './wholesaleFee.utils.js';
import { getPricing } from '../contents/content.pricing.js';

// metadata.type on the Stripe session and PaymentIntent, so the shared
// webhook can tell a wholesale fee from an order payment.
const FEE_PAYMENT_TYPE = 'wholesale_fee';
const CURRENCY = 'usd';
const PROCESSING_MESSAGE =
  'Your wholesale fee payment is still processing. Try again in a few minutes.';

type CheckoutSessionLike = {
  id: string;
  status: string | null;
  payment_status: string;
  amount_total: number | null;
  payment_intent: string | { id: string } | null;
  metadata: Record<string, string> | null;
};

type PaymentIntentLike = {
  id: string;
  status: string;
  amount: number;
  metadata?: Record<string, string> | null;
};

type FeeRecord = {
  status: PAYMENT_STATUS;
  amount: number;
  paidAt: Date | null;
} | null;

const feeSelect = { status: true, amount: true, paidAt: true } as const;

const isObjectId = (id?: string | null): id is string =>
  typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);

export const isWholesaleFeePayment = (object: {
  metadata?: Record<string, string> | null;
}) => object.metadata?.type === FEE_PAYMENT_TYPE;

/**
 * What the website needs to know about an account's fee. An unpaid fee shows
 * the current price (the admin can change it); a paid one shows what was paid.
 */
const feeStateOf = (
  user: { role: string; wholesaleFee?: FeeRecord },
  currentFee: number,
) => {
  const fee = user.wholesaleFee ?? null;
  return {
    required: isWholesaleFeeDue(user),
    status: fee?.status ?? null,
    amount: !fee ? null : fee.status === PAYMENT_STATUS.paid ? fee.amount : currentFee,
    currency: CURRENCY,
    paidAt: fee?.paidAt ?? null,
  };
};

/** Public: the fee a new wholesale account pays, from the admin-set prices. */
const getFeeInfo = async () => {
  const { wholesaleAccountFee: amount } = await getPricing();
  return { enabled: amount > 0, amount, currency: CURRENCY };
};

const getFeeState = async (userId: string) => {
  const [user, pricing] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, wholesaleFee: { select: feeSelect } },
    }),
    getPricing(),
  ]);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  return feeStateOf(user, pricing.wholesaleAccountFee);
};

/**
 * Runs at sign-up, and again when an unverified account signs up again.
 * A wholesale sign-up owes the current fee; switching to retail drops an
 * unpaid fee. A paid fee is never changed.
 */
const syncSignupFee = async (user: { id: string; role: string }) => {
  const existing = await prisma.wholesaleFee.findUnique({
    where: { userId: user.id },
  });
  if (existing?.status === PAYMENT_STATUS.paid) return;

  const { wholesaleAccountFee: amount } = await getPricing();
  if (user.role !== Role.wholesale || amount <= 0) {
    if (existing) await prisma.wholesaleFee.delete({ where: { id: existing.id } });
    return;
  }

  await prisma.wholesaleFee.upsert({
    where: { userId: user.id },
    create: { userId: user.id, amount, status: PAYMENT_STATUS.pending },
    update: { amount, status: PAYMENT_STATUS.pending },
  });
};

const refundQuietly = async (paymentIntentId: string, reason: string) => {
  try {
    await StripeService.refund(paymentIntentId);
  } catch (error) {
    // Usually means an earlier delivery of the same event already refunded it.
    console.error(`[wholesale-fee] Refund of ${paymentIntentId} (${reason}) failed:`, error);
  }
};

/** Records a successful fee payment. Safe to call more than once. */
const recordFeePaid = async (input: {
  paymentIntentId: string;
  amountCents: number;
  feeId: string | undefined;
  userId: string | undefined;
}) => {
  const include = { user: { select: { name: true, email: true } } } as const;
  const fee = isObjectId(input.feeId)
    ? await prisma.wholesaleFee.findUnique({ where: { id: input.feeId }, include })
    : isObjectId(input.userId)
      ? await prisma.wholesaleFee.findUnique({ where: { userId: input.userId }, include })
      : null;
  if (!fee) {
    // The record is gone because the admin turned the fee off while this
    // customer was paying: nothing is owed, so give the money back.
    await refundQuietly(input.paymentIntentId, 'fee no longer owed');
    return null;
  }

  if (input.amountCents !== toCents(fee.amount)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Paid amount does not match the wholesale account fee',
    );
  }

  if (fee.status === PAYMENT_STATUS.paid) {
    // Paid twice (for example in two browser tabs): give the second one back.
    if (fee.transactionId && fee.transactionId !== input.paymentIntentId) {
      await refundQuietly(input.paymentIntentId, 'duplicate payment');
    }
    return fee;
  }

  const { count } = await prisma.wholesaleFee.updateMany({
    where: { id: fee.id, status: { not: PAYMENT_STATUS.paid } },
    data: {
      status: PAYMENT_STATUS.paid,
      paidAt: new Date(),
      transactionId: input.paymentIntentId,
    },
  });

  if (count > 0) {
    await notificationQueue.add('new_notification', {
      data: {
        receiverId: fee.userId,
        message: 'Wholesale account activated',
        description:
          'We received your wholesale account fee. Your wholesale account is now active.',
      },
    });
    await notifyAdmins({
      message: 'New wholesale account',
      description: `${fee.user.name || fee.user.email} paid the $${fee.amount.toFixed(2)} wholesale account fee.`,
    });
  }

  return prisma.wholesaleFee.findUnique({ where: { id: fee.id } });
};

const markPaidFromSession = async (session: CheckoutSessionLike) => {
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  if (session.payment_status !== 'paid' || !paymentIntentId) return null;

  return recordFeePaid({
    paymentIntentId,
    amountCents: session.amount_total ?? 0,
    feeId: session.metadata?.feeId,
    userId: session.metadata?.userId,
  });
};

const markPaidFromIntent = async (intent: PaymentIntentLike) => {
  if (intent.status !== 'succeeded') return null;
  return recordFeePaid({
    paymentIntentId: intent.id,
    amountCents: intent.amount,
    feeId: intent.metadata?.feeId,
    userId: intent.metadata?.userId,
  });
};

/**
 * Creates (or reuses) a Stripe Checkout Session for the account's fee. The
 * website redirects the customer to `checkoutUrl`.
 */
const createCheckout = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wholesaleFee: true },
  });
  const fee = user?.wholesaleFee;
  if (!user || user.role !== Role.wholesale || !fee) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This account has no wholesale account fee to pay',
    );
  }
  if (fee.status === PAYMENT_STATUS.paid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'The wholesale account fee is already paid');
  }

  // Always charge the current price from the admin-set contents prices.
  const { wholesaleAccountFee: amount } = await getPricing();
  if (amount <= 0) {
    // The fee was turned off after this account signed up: nothing is owed.
    await prisma.wholesaleFee.delete({ where: { id: fee.id } });
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This account has no wholesale account fee to pay',
    );
  }
  const amountCents = toCents(amount);
  if (amountCents < MIN_CARD_AMOUNT_CENTS) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'The wholesale account fee is below the $0.50 minimum for card payments',
    );
  }

  const clientUrl = config.client_Url?.replace(/\/+$/, '');
  if (!clientUrl) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'CLIENT_URL is not configured');
  }

  // Reuse the open session so repeated clicks don't create new ones.
  if (isCheckoutSessionId(fee.sessionId)) {
    const existing = await StripeService.retrieveCheckoutSession(fee.sessionId);
    if (existing?.payment_status === 'paid') {
      await markPaidFromSession(existing);
      throw new AppError(httpStatus.BAD_REQUEST, 'The wholesale account fee is already paid');
    }
    if (existing?.status === 'complete') {
      throw new AppError(httpStatus.CONFLICT, PROCESSING_MESSAGE);
    }
    if (existing?.status === 'open' && existing.url && existing.amount_total === amountCents) {
      return { checkoutUrl: existing.url, sessionId: existing.id, amount, currency: CURRENCY };
    }
    // Opened at an older price: close it so it can't be paid alongside the new one.
    if (existing?.status === 'open') {
      await StripeService.expireCheckoutSession(existing.id);
    }
  }

  const customerId = await ensureStripeCustomer(user);
  const metadata = { type: FEE_PAYMENT_TYPE, feeId: fee.id, userId: user.id };

  const session = await StripeService.createCheckoutSession({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: amountCents,
          product_data: {
            name: 'Wholesale account fee',
            description: 'One-time fee to activate your wholesale account',
          },
        },
      },
    ],
    ...(customerId ? { customer: customerId } : { customer_email: user.email }),
    client_reference_id: fee.id,
    metadata,
    // Copied onto the PaymentIntent so payment_intent.* events and refunds
    // can be traced back to the fee.
    payment_intent_data: { metadata },
    success_url: `${clientUrl}/wholesale-fee/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/wholesale-fee/cancel`,
  });
  if (!session?.url) {
    throw new AppError(httpStatus.BAD_GATEWAY, 'Stripe did not return a checkout URL');
  }

  // `amount` is what this session charges; the payment is checked against it.
  await prisma.wholesaleFee.update({
    where: { id: fee.id },
    data: { sessionId: session.id, amount },
  });

  return { checkoutUrl: session.url, sessionId: session.id, amount, currency: CURRENCY };
};

/**
 * Called by the website's success page with the `session_id` Stripe adds to
 * the success URL. Records the payment if Stripe says it is paid, so the
 * account unlocks even before the webhook arrives.
 */
const confirmCheckout = async (userId: string, sessionId?: string) => {
  if (!isCheckoutSessionId(sessionId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'A valid session_id is required');
  }
  const session = await StripeService.retrieveCheckoutSession(sessionId);
  if (!session || !isWholesaleFeePayment(session) || session.metadata?.userId !== userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Wholesale fee payment not found');
  }
  if (session.payment_status === 'paid') await markPaidFromSession(session);
  return getFeeState(userId);
};

export const wholesaleFeeService = {
  getFeeInfo,
  getFeeState,
  syncSignupFee,
  createCheckout,
  confirmCheckout,
  markPaidFromSession,
  markPaidFromIntent,
};
