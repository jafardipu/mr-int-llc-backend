/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import StripeService from '@app/class/string.class.js';
import { PAYMENT_STATUS, type Prisma } from '../../../../generated/prisma/index.js';

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

const createPayment = async (
  userId: string,
  payload: { orderId: string; paymentMethod?: string },
) => {
  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
    include: { payment: true, user: true },
  });
  if (!order || order.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found');
  }
  if (order.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized');
  }
  if (order.payment?.status === PAYMENT_STATUS.paid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Order is already paid');
  }

  let customerId = order.user.customerId;
  if (!customerId) {
    const customer = await StripeService.createCustomer(
      order.user.email,
      order.user.name || 'Customer',
    );
    customerId = customer?.id ?? null;
    if (customerId) {
      await prisma.user.update({
        where: { id: userId },
        data: { customerId },
      });
    }
  }

  const intent = await StripeService.createPaymentIntent(order.total, 'usd', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId,
  });

  const payment = await prisma.payment.upsert({
    where: { orderId: order.id },
    update: {
      amount: order.total,
      transactionId: intent?.id,
      paymentMethod: payload.paymentMethod || 'card',
      status: PAYMENT_STATUS.pending,
    },
    create: {
      userId,
      orderId: order.id,
      amount: order.total,
      transactionId: intent?.id,
      paymentMethod: payload.paymentMethod || 'card',
      status: PAYMENT_STATUS.pending,
    },
    include: paymentInclude,
  });

  return {
    payment,
    clientSecret: intent?.client_secret,
    paymentIntentId: intent?.id,
  };
};

const confirmPayment = async (paymentIntentId: string) => {
  const intent = await StripeService.retrievePaymentIntent(paymentIntentId);
  if (!intent) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Payment intent not found');
  }

  const payment = await prisma.payment.findFirst({
    where: { transactionId: paymentIntentId },
  });
  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');
  }

  if (intent.status === 'succeeded') {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PAYMENT_STATUS.paid,
        paidAt: new Date(),
      },
      include: paymentInclude,
    });
    await prisma.order.update({
      where: { id: payment.orderId },
      data: { status: 'processing' },
    });
    return updated;
  }

  return payment;
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
  getAllPayments,
  getPaymentById,
};
