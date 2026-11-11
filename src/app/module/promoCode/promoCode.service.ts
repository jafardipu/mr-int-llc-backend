/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import {
  CustomerType,
  PromoDiscountType,
  type Prisma,
  type PromoCode,
} from '../../../../generated/prisma/index.js';

type PromoInput = {
  code: string;
  description?: string | null;
  discountType: PromoDiscountType | 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  perUserLimit?: number;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  isActive?: boolean;
  customerType?: CustomerType | 'retail' | 'wholesale' | null;
};

const normalizeCode = (code: string) => code.trim().toUpperCase();

const toDateOrNull = (value?: Date | string | null) => {
  if (value === undefined || value === null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date provided');
  }
  return date;
};

const calculateDiscountAmount = (promo: PromoCode, subtotal: number) => {
  let discount = 0;
  if (promo.discountType === PromoDiscountType.percentage) {
    discount = (subtotal * promo.discountValue) / 100;
    if (promo.maxDiscount != null) {
      discount = Math.min(discount, promo.maxDiscount);
    }
  } else {
    discount = promo.discountValue;
  }
  return Math.min(Math.max(discount, 0), subtotal);
};

const assertPromoUsable = async (
  promo: PromoCode,
  options: {
    userId?: string;
    role?: string;
    subtotal?: number;
  } = {},
) => {
  const now = new Date();
  if (promo.isDeleted || !promo.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Promo code is not active');
  }
  if (promo.startsAt && promo.startsAt > now) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Promo code is not active yet');
  }
  if (promo.expiresAt && promo.expiresAt < now) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Promo code has expired');
  }
  if (promo.usageLimit != null && promo.usedCount >= promo.usageLimit) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Promo code usage limit reached');
  }
  if (
    promo.customerType &&
    options.role &&
    promo.customerType !== options.role
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Promo code is only valid for ${promo.customerType} customers`,
    );
  }
  const subtotal = Number(options.subtotal ?? 0);
  if (subtotal < promo.minOrderAmount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Minimum order amount for this promo is ${promo.minOrderAmount}`,
    );
  }
  if (options.userId) {
    const userUses = await prisma.promoRedemption.count({
      where: { promoCodeId: promo.id, userId: options.userId },
    });
    if (userUses >= promo.perUserLimit) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'You have already used this promo code the maximum number of times',
      );
    }
  }
};

const createPromoCode = async (payload: PromoInput) => {
  const code = normalizeCode(payload.code);
  const existing = await prisma.promoCode.findFirst({ where: { code } });
  if (existing && !existing.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Promo code already exists');
  }

  const data: Prisma.PromoCodeUncheckedCreateInput = {
    code,
    description: payload.description ?? null,
    discountType: payload.discountType as PromoDiscountType,
    discountValue: payload.discountValue,
    minOrderAmount: payload.minOrderAmount ?? 0,
    maxDiscount: payload.maxDiscount ?? null,
    usageLimit: payload.usageLimit ?? null,
    perUserLimit: payload.perUserLimit ?? 1,
    startsAt: toDateOrNull(payload.startsAt),
    expiresAt: toDateOrNull(payload.expiresAt),
    isActive: payload.isActive ?? true,
    customerType: (payload.customerType as CustomerType | null) ?? null,
    isDeleted: false,
    usedCount: 0,
  };

  if (existing?.isDeleted) {
    return prisma.promoCode.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.promoCode.create({ data });
};

const getAllPromoCodes = async (query: Record<string, any>) => {
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;
  const where: Prisma.PromoCodeWhereInput = { isDeleted: false };

  if (searchTerm) {
    where.OR = ['code', 'description'].map(field => ({
      [field]: { contains: String(searchTerm) },
    }));
  }

  if (Object.keys(filtersData).length > 0) {
    where.AND = Object.entries(filtersData).map(([key, value]) => ({
      [key]: {
        equals: value === 'true' ? true : value === 'false' ? false : value,
      },
    }));
  }

  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);
  const orderBy: Prisma.PromoCodeOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'desc' }];

  const data = await prisma.promoCode.findMany({
    where,
    skip,
    take: limit,
    orderBy,
  });
  const total = await prisma.promoCode.count({ where });
  return { data, meta: { page, limit, total } };
};

const getPromoCodeById = async (id: string) => {
  const result = await prisma.promoCode.findUnique({ where: { id } });
  if (!result || result.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Promo code not found');
  }
  return result;
};

const updatePromoCode = async (id: string, payload: Partial<PromoInput>) => {
  await getPromoCodeById(id);
  const data: Prisma.PromoCodeUncheckedUpdateInput = {};
  if (payload.code !== undefined) data.code = normalizeCode(payload.code);
  if (payload.description !== undefined) data.description = payload.description;
  if (payload.discountType !== undefined) {
    data.discountType = payload.discountType as PromoDiscountType;
  }
  if (payload.discountValue !== undefined) {
    data.discountValue = payload.discountValue;
  }
  if (payload.minOrderAmount !== undefined) {
    data.minOrderAmount = payload.minOrderAmount;
  }
  if (payload.maxDiscount !== undefined) data.maxDiscount = payload.maxDiscount;
  if (payload.usageLimit !== undefined) data.usageLimit = payload.usageLimit;
  if (payload.perUserLimit !== undefined) data.perUserLimit = payload.perUserLimit;
  if (payload.startsAt !== undefined) data.startsAt = toDateOrNull(payload.startsAt);
  if (payload.expiresAt !== undefined) data.expiresAt = toDateOrNull(payload.expiresAt);
  if (payload.isActive !== undefined) data.isActive = payload.isActive;
  if (payload.customerType !== undefined) {
    data.customerType = (payload.customerType as CustomerType | null) ?? null;
  }

  if (typeof data.code === 'string') {
    const duplicate = await prisma.promoCode.findFirst({
      where: {
        code: data.code,
        id: { not: id },
        isDeleted: false,
      },
    });
    if (duplicate) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Promo code already exists');
    }
  }

  return prisma.promoCode.update({ where: { id }, data });
};

const deletePromoCode = async (id: string) => {
  await getPromoCodeById(id);
  return prisma.promoCode.update({
    where: { id },
    data: { isDeleted: true, isActive: false },
  });
};

const validatePromoCode = async (
  code: string,
  options: { userId?: string; role?: string; subtotal?: number } = {},
) => {
  const promo = await prisma.promoCode.findFirst({
    where: { code: normalizeCode(code), isDeleted: false },
  });
  if (!promo) throw new AppError(httpStatus.NOT_FOUND, 'Invalid promo code');
  await assertPromoUsable(promo, options);
  const subtotal = Number(options.subtotal ?? 0);
  const discount = calculateDiscountAmount(promo, subtotal);
  return {
    promo,
    discount,
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
  };
};

const applyPromoForCheckout = async (params: {
  code?: string;
  userId: string;
  role: string;
  subtotal: number;
  manualDiscount?: number;
}) => {
  if (!params.code?.trim()) {
    return {
      discount: Number(params.manualDiscount || 0),
      promoCodeId: null as string | null,
      promoCode: null as string | null,
      promo: null as PromoCode | null,
    };
  }

  const validated = await validatePromoCode(params.code, {
    userId: params.userId,
    role: params.role,
    subtotal: params.subtotal,
  });

  return {
    discount: validated.discount,
    promoCodeId: validated.promo.id,
    promoCode: validated.promo.code,
    promo: validated.promo,
  };
};

const redeemPromoOnOrder = async (params: {
  // Accept interactive transaction client from prisma.$transaction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any;
  promoCodeId: string;
  userId: string;
  orderId: string;
  discount: number;
}) => {
  await params.tx.promoCode.update({
    where: { id: params.promoCodeId },
    data: { usedCount: { increment: 1 } },
  });
  await params.tx.promoRedemption.create({
    data: {
      promoCodeId: params.promoCodeId,
      userId: params.userId,
      orderId: params.orderId,
      discount: params.discount,
    },
  });
};

export const promoCodeService = {
  createPromoCode,
  getAllPromoCodes,
  getPromoCodeById,
  updatePromoCode,
  deletePromoCode,
  validatePromoCode,
  applyPromoForCheckout,
  redeemPromoOnOrder,
  calculateDiscountAmount,
};
