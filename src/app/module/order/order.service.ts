/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import generateCryptoString from '@app/utils/generateCryptoString.js';
import { resolveUnitPrice } from '../product/product.utils.js';
import { notificationQueue } from '@app/redis/index.js';
import { notifyAdmins } from '../notification/notification.service.js';
import {
  CustomerType,
  OrderStatus,
  type Prisma,
} from '../../../../generated/prisma/index.js';
import { promoCodeService } from '../promoCode/promoCode.service.js';

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

const checkout = async (
  userId: string,
  role: string,
  payload: {
    addressId: string;
    notes?: string;
    shippingFee?: number;
    tax?: number;
    discount?: number;
    promoCode?: string;
  },
) => {
  if (role !== 'retail' && role !== 'wholesale') {
    throw new AppError(httpStatus.FORBIDDEN, 'Only customers can checkout');
  }

  const address = await prisma.address.findFirst({
    where: { id: payload.addressId, userId, isDeleted: false },
  });
  if (!address) throw new AppError(httpStatus.NOT_FOUND, 'Address not found');

  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } },
  });
  if (!cart || cart.items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Cart is empty');
  }

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
    const unitPrice = resolveUnitPrice(product, role);
    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      quantity: item.quantity,
      unitPrice,
      total: unitPrice * item.quantity,
    };
  });

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const shippingFee = Number(payload.shippingFee || 0);
  const tax = Number(payload.tax || 0);
  const appliedPromo = await promoCodeService.applyPromoForCheckout({
    userId,
    role,
    subtotal,
    ...(payload.promoCode ? { code: payload.promoCode } : {}),
    ...(payload.discount !== undefined
      ? { manualDiscount: Number(payload.discount || 0) }
      : {}),
  });
  const discount = appliedPromo.discount;
  const total = Math.max(subtotal + shippingFee + tax - discount, 0);

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

const updateOrderStatus = async (id: string, status: OrderStatus) => {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found');
  }

  if (status === OrderStatus.cancelled && order.status !== OrderStatus.cancelled) {
    const items = await prisma.orderItem.findMany({ where: { orderId: id } });
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
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

export const orderService = {
  checkout,
  getMyOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
};
