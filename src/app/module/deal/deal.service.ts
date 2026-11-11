/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import type { Prisma } from '../../../../generated/prisma/index.js';
import { withDisplayPrice } from '../product/product.utils.js';

const createDeal = async (payload: any) => {
  const productId = payload.productId as string;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  const result = await prisma.$transaction(async tx => {
    const deal = await tx.deal.create({
      data: {
        title: payload.title,
        description: payload.description ?? null,
        image: payload.image ?? null,
        productId,
        dealPrice: payload.dealPrice,
        startDate: payload.startDate ?? null,
        endDate: payload.endDate ?? null,
        isActive: payload.isActive ?? true,
      },
      include: { product: { include: { images: true, brand: true } } },
    });
    await tx.product.update({
      where: { id: productId },
      data: { isDeal: true, dealPrice: deal.dealPrice },
    });
    return deal;
  });

  return result;
};

const getAllDeal = async (query: Record<string, any>, role?: string) => {
  query.isDeleted = false;
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;
  const where: Prisma.DealWhereInput = {};

  if (searchTerm) {
    where.OR = ['title', 'description'].map(field => ({
      [field]: { contains: searchTerm },
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
  const orderBy: Prisma.DealOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'desc' }];

  const data = await prisma.deal.findMany({
    where,
    skip,
    take: limit,
    orderBy,
    include: { product: { include: { images: true, brand: true, category: true } } },
  });
  const total = await prisma.deal.count({ where });

  return {
    data: data.map(item => ({
      ...item,
      product: withDisplayPrice(item.product, role),
    })),
    meta: { page, limit, total },
  };
};

const getDealById = async (id: string, role?: string) => {
  const result = await prisma.deal.findUnique({
    where: { id },
    include: { product: { include: { images: true, brand: true, category: true } } },
  });
  if (!result || result.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Deal not found');
  return { ...result, product: withDisplayPrice(result.product, role) };
};

const updateDeal = async (id: string, payload: Prisma.DealUpdateInput) => {
  const existing = await prisma.deal.findUnique({ where: { id } });
  if (!existing || existing.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Deal not found');

  const result = await prisma.deal.update({
    where: { id },
    data: payload,
    include: { product: true },
  });

  if (payload.dealPrice != null || payload.isActive === false) {
    await prisma.product.update({
      where: { id: existing.productId },
      data: {
        dealPrice: typeof payload.dealPrice === 'number' ? payload.dealPrice : existing.dealPrice,
        isDeal: payload.isActive === false ? false : true,
      },
    });
  }

  return result;
};

const deleteDeal = async (id: string) => {
  const existing = await prisma.deal.findUnique({ where: { id } });
  if (!existing) throw new AppError(httpStatus.NOT_FOUND, 'Deal not found');

  const result = await prisma.deal.update({
    where: { id },
    data: { isDeleted: true, isActive: false },
  });
  await prisma.product.update({
    where: { id: existing.productId },
    data: { isDeal: false },
  });
  return result;
};

export const dealService = {
  createDeal,
  getAllDeal,
  getDealById,
  updateDeal,
  deleteDeal,
};
