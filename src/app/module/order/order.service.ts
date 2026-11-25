/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import config from '@app/config/index.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import generateCryptoString from '@app/utils/generateCryptoString.js';
import { resolveUnitPrice } from '../product/product.utils.js';
import { getActiveBannerDiscounts } from '../banner/banner.discount.js';
import { getPricing } from '../contents/content.pricing.js';
import { notificationQueue } from '@app/redis/index.js';
import { notifyAdmins } from '../notification/notification.service.js';
import {
  CustomerType,
  OrderStatus,
  PAYMENT_STATUS,
  type Prisma,
} from '../../../../generated/prisma/index.js';
import { promoCodeService } from '../promoCode/promoCode.service.js';
import { paymentService } from '../payment/payment.service.js';

const orderInclude = {
  items: { include: { product: { include: { images: true } } } },
  address: true,
  payment: true,
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
} satisfies Prisma.OrderInclude;

const roundMoney = (value: number) => Math.round(value * 100) / 100;

/**
 * Prices the current cart. This is the single source of truth for order
 * amounts: the checkout summary and checkout itself both use it, and nothing
 * price-related is read from the client except the promo code.
 */
const priceCart = async (userId: string, role: string, promoCode?: string) => {
  if (role !== 'retail' && role !== 'wholesale') {
    throw new AppError(httpStatus.FORBIDDEN, 'Only customers can checkout');
  }

  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } },
  });
  if (!cart || cart.items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Cart is empty');
  }

  // Loaded fresh on every call so checkout charges the price at this moment.
  const discounts = await getActiveBannerDiscounts();
  const lineItems = cart.items.map(item => {
    const product = item.product;
    if (product.isDeleted || product.status !== 'active') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `${product.name} is no longer available`,
      );
    }
    const minQty = role === 'wholesale' ? product.wholesaleMinQty : 1;
    if (item.quantity < minQty) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `${product.name} requires a minimum quantity of ${minQty}`,
      );
    }
    if (item.quantity > product.stock) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Insufficient stock for ${product.name}`,
      );
    }
    const unitPrice = resolveUnitPrice(product, role, discounts);
    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      quantity: item.quantity,
      unitPrice,
      total: roundMoney(unitPrice * item.quantity),
    };
  });

  const subtotal = roundMoney(
    lineItems.reduce((sum, item) => sum + item.total, 0),
  );
  const appliedPromo = await promoCodeService.applyPromoForCheckout({
    userId,
    role,
    subtotal,
    ...(promoCode ? { code: promoCode } : {}),
  });
  const discount = roundMoney(appliedPromo.discount);
  // Shipping and tax come from the admin-edited prices on the contents record.
  const pricing = await getPricing();
  const shippingFee = roundMoney(pricing.shippingFee);
  const tax = roundMoney(((subtotal - discount) * pricing.taxRate) / 100);
  const total = roundMoney(Math.max(subtotal - discount + shippingFee + tax, 0));

  return {
    cart,
    lineItems,
    subtotal,
    discount,
    shippingFee,
    tax,
    total,
    appliedPromo,
  };
};

const getCheckoutSummary = async (
  userId: string,
  role: string,
  promoCode?: string,
) => {
  const priced = await priceCart(userId, role, promoCode);
  return {
    items: priced.lineItems,
    subtotal: priced.subtotal,
    discount: priced.discount,
    promoCode: priced.appliedPromo.promoCode,
    shippingFee: priced.shippingFee,
    tax: priced.tax,
    total: priced.total,
  };
};

const checkout = async (
  userId: string,
  role: string,
  payload: {
    addressId: string;
    notes?: string;
    promoCode?: string;
  },
) => {
  const { cart, lineItems, subtotal, discount, shippingFee, tax, total, appliedPromo } =
    await priceCart(userId, role, payload.promoCode);

  const address = await prisma.address.findFirst({
    where: { id: payload.addressId, userId, isDeleted: false },
  });
  if (!address) throw new AppError(httpStatus.NOT_FOUND, 'Address not found');

  const order = await prisma.$transaction(async tx => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateCryptoString(8, 'MRI-'),
        userId,
        addressId: address.id,
        customerType: role as CustomerType,
        status: OrderStatus.pending,
        subtotal,
        shippingFee,
        tax,
        discount,
        total,
        notes: payload.notes ?? null,
        promoCodeId: appliedPromo.promoCodeId,
        promoCode: appliedPromo.promoCode,
        items: { create: lineItems },
        payment: {
          create: {
            userId,
            amount: total,
            status: 'pending',
            // MongoDB unique index treats multiple null transactionId as duplicates.
            transactionId: `PENDING-${generateCryptoString(16)}`,
          },
        },
      },
      include: orderInclude,
    });

    if (appliedPromo.promoCodeId) {
      await promoCodeService.redeemPromoOnOrder({
        tx,
        promoCodeId: appliedPromo.promoCodeId,
        userId,
        orderId: created.id,
        discount,
      });
    }

    for (const item of cart.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return created;
  });

  await notificationQueue.add('new_notification', {
    data: {
      receiverId: userId,
      orderId: order.id,
      message: 'Order placed',
      description: `Your order ${order.orderNumber} has been placed successfully.`,
    },
  });

  await notifyAdmins({
    orderId: order.id,
    message: 'New order placed',
    description: `${order.user?.name || 'A customer'} placed order ${order.orderNumber}.`,
  });

  return order;
};

const getMyOrders = async (userId: string, query: Record<string, any>) => {
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;
  const where: Prisma.OrderWhereInput = { userId, isDeleted: false };

  if (searchTerm) {
    where.OR = [{ orderNumber: { contains: searchTerm } }];
  }
  if (Object.keys(filtersData).length > 0) {
    where.AND = Object.entries(filtersData).map(([key, value]) => ({
      [key]: { equals: value },
    }));
  }

  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);
  const orderBy: Prisma.OrderOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'desc' }];

  const data = await prisma.order.findMany({
    where,
    skip,
    take: limit,
    orderBy,
    include: orderInclude,
  });
  const total = await prisma.order.count({ where });
  return { data, meta: { page, limit, total } };
};

const RECENT_ORDER_LIMIT = 5;
const ACTIVE_ORDER_STATUSES = [OrderStatus.pending, OrderStatus.processing];

// Summary for the customer's dashboard page: order counts plus the latest orders.
const getMyDashboard = async (userId: string) => {
  const where: Prisma.OrderWhereInput = { userId, isDeleted: false };

  const [totalOrders, activeOrders, recent] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({
      where: { ...where, status: { in: ACTIVE_ORDER_STATUSES } },
    }),
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: RECENT_ORDER_LIMIT,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        total: true,
        payment: { select: { status: true } },
        items: {
          orderBy: { id: 'asc' },
          select: {
            name: true,
            quantity: true,
            product: { select: { images: { select: { url: true, isPrimary: true } } } },
          },
        },
      },
    }),
  ]);

  const recentOrders = recent.map(order => {
    const firstItem = order.items[0];
    const images = firstItem?.product.images ?? [];
    // Falls back to the product's first image when none is marked primary.
    const image = (images.find(img => img.isPrimary) ?? images[0])?.url ?? null;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      status: order.status,
      paymentStatus: order.payment?.status ?? null,
      total: order.total,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      image,
      firstItemName: firstItem?.name ?? null,
    };
  });

  return { stats: { totalOrders, activeOrders }, recentOrders };
};

const getAllOrders = async (query: Record<string, any>) => {
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;
  const where: Prisma.OrderWhereInput = { isDeleted: false };

  if (searchTerm) {
    where.OR = [
      { orderNumber: { contains: searchTerm } },
      { user: { is: { email: { contains: searchTerm } } } },
      { user: { is: { name: { contains: searchTerm } } } },
    ];
  }
  if (Object.keys(filtersData).length > 0) {
    where.AND = Object.entries(filtersData).map(([key, value]) => ({
      [key]: { equals: value },
    }));
  }

  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);
  const orderBy: Prisma.OrderOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'desc' }];

  const data = await prisma.order.findMany({
    where,
    skip,
    take: limit,
    orderBy,
    include: orderInclude,
  });
  const total = await prisma.order.count({ where });
  return { data, meta: { page, limit, total } };
};

const getOrderById = async (id: string, userId?: string, isAdmin = false) => {
  const result = await prisma.order.findUnique({
    where: { id },
    include: orderInclude,
  });
  if (!result || result.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found');
  }
  if (!isAdmin && result.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized');
  }
  return result;
};

type CancelledBy = 'admin' | 'customer' | 'system';

/**
 * Cancels an order: refunds or voids the payment, puts the items back in stock
 * and gives the promo code use back. Only admins may cancel a paid order.
 */
const cancelOrder = async (orderId: string, cancelledBy: CancelledBy) => {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing || existing.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found');
  }
  if (existing.status === OrderStatus.cancelled) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Order is already cancelled');
  }

  // Record payments Stripe took but we never confirmed (for example, a missed webhook).
  const paymentStatus = await paymentService.syncPaymentWithStripe(orderId);
  if (paymentStatus === PAYMENT_STATUS.paid && cancelledBy !== 'admin') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This order has already been paid. Please contact support to cancel it.',
    );
  }

  // Settle the money first, so a failed refund leaves the order unchanged.
  const releasedAs = await paymentService.releasePayment(orderId);

  // Claim the cancellation atomically so stock and promo usage are released once.
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: { not: OrderStatus.cancelled } },
    data: { status: OrderStatus.cancelled },
  });
  if (count === 0) {
    throw new AppError(httpStatus.CONFLICT, 'Order is already cancelled');
  }

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, promoRedemption: true },
  });

  await prisma.$transaction(async tx => {
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
    if (order.promoRedemption) {
      await tx.promoRedemption.delete({
        where: { id: order.promoRedemption.id },
      });
      await tx.promoCode.update({
        where: { id: order.promoRedemption.promoCodeId },
        data: { usedCount: { decrement: 1 } },
      });
    }
  });

  const refundNote =
    releasedAs === PAYMENT_STATUS.refunded ? ' Your payment has been refunded.' : '';
  const descriptions: Record<CancelledBy, string> = {
    admin: `Your order ${order.orderNumber} has been cancelled.${refundNote}`,
    customer: `You cancelled order ${order.orderNumber}.${refundNote}`,
    system: `Order ${order.orderNumber} was cancelled because it was not paid in time.${refundNote}`,
  };

  await notificationQueue.add('new_notification', {
    data: {
      receiverId: order.userId,
      orderId: order.id,
      message: 'Order cancelled',
      description: descriptions[cancelledBy],
    },
  });
  if (cancelledBy === 'customer') {
    await notifyAdmins({
      orderId: order.id,
      message: 'Order cancelled by customer',
      description: `The customer cancelled order ${order.orderNumber}.`,
    });
  }

  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: orderInclude,
  });
};

const cancelMyOrder = async (id: string, userId: string) => {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found');
  }
  if (order.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized');
  }
  if (order.status !== OrderStatus.pending) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Only orders awaiting payment can be cancelled. Please contact support.',
    );
  }
  return cancelOrder(id, 'customer');
};

const updateOrderStatus = async (id: string, status: OrderStatus) => {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found');
  }

  if (status === OrderStatus.cancelled) {
    return cancelOrder(id, 'admin');
  }
  if (order.status === OrderStatus.cancelled) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Cancelled orders cannot be reopened',
    );
  }

  const result = await prisma.order.update({
    where: { id },
    data: { status },
    include: orderInclude,
  });

  await notificationQueue.add('new_notification', {
    data: {
      receiverId: order.userId,
      orderId: order.id,
      message: 'Order updated',
      description: `Your order ${order.orderNumber} is now ${status}.`,
    },
  });

  return result;
};

/**
 * Cancels pending orders older than UNPAID_ORDER_EXPIRY_HOURS so their stock is
 * released. Orders that turn out to be paid on Stripe are recorded as paid instead.
 */
const expireUnpaidOrders = async () => {
  const hours = config.checkout.unpaid_order_expiry_hours;
  if (hours <= 0) return { checked: 0, expired: 0 };

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const stale = await prisma.order.findMany({
    where: {
      status: OrderStatus.pending,
      isDeleted: false,
      createdAt: { lt: cutoff },
    },
    select: { id: true, orderNumber: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  let expired = 0;
  for (const order of stale) {
    try {
      await cancelOrder(order.id, 'system');
      expired++;
    } catch (error) {
      console.error(
        `[order-expiry] Skipped ${order.orderNumber}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return { checked: stale.length, expired };
};

export const orderService = {
  getCheckoutSummary,
  checkout,
  getMyOrders,
  getMyDashboard,
  getAllOrders,
  getOrderById,
  cancelMyOrder,
  updateOrderStatus,
  expireUnpaidOrders,
};
