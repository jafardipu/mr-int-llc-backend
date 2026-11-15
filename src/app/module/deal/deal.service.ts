/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import {
  DealType,
  type Prisma,
} from '../../../../generated/prisma/index.js';
import { withDisplayPrice } from '../product/product.utils.js';

const dealInclude = {
  product: { include: { images: true, brand: true, category: true } },
} satisfies Prisma.DealInclude;

const assertProductAvailableForDeal = async (
  productId: string,
  excludeDealId?: string,
) => {
  const existing = await prisma.deal.findFirst({
    where: {
      productId,
      isDeleted: false,
      ...(excludeDealId ? { id: { not: excludeDealId } } : {}),
    },
  });
  if (existing) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This product already has a deal. One product can appear only once.',
    );
  }
};

const uniqueByProductId = <T extends { productId: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.productId)) return false;
    seen.add(item.productId);
    return true;
  });
};

const createDeal = async (payload: any) => {
  const productId = payload.productId as string;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  await assertProductAvailableForDeal(productId);

  const type =
    payload.type === DealType.clearance
      ? DealType.clearance
      : DealType.weekly;

  const result = await prisma.$transaction(async tx => {
    const deal = await tx.deal.create({
      data: {
        productId,
        dealPrice: payload.dealPrice,
        type,
        startDate: payload.startDate ?? null,
        endDate: payload.endDate ?? null,
        isActive: payload.isActive ?? true,
      },
      include: dealInclude,
    });
    await tx.product.update({
      where: { id: productId },
      data: { isDeal: true, dealPrice: deal.dealPrice },
    });
    return deal;
  });

  return result;
};

const getAllDeal = async (
  query: Record<string, any>,
  role?: string,
  options: { publicOnly?: boolean } = {},
) => {
  query.isDeleted = false;
  if (options.publicOnly && query.isActive == null) {
    query.isActive = true;
  }
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;
  const where: Prisma.DealWhereInput = {};

  if (searchTerm) {
    where.OR = [
      { product: { is: { name: { contains: searchTerm } } } },
      { product: { is: { sku: { contains: searchTerm } } } },
    ];
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
    include: dealInclude,
  });
  const total = await prisma.deal.count({ where });
  const uniqueData = uniqueByProductId(data);

  return {
    data: uniqueData.map(item => ({
      ...item,
      product: withDisplayPrice(item.product, role),
    })),
    meta: { page, limit, total: uniqueData.length },
  };
};

const getDealsByType = async (
  type: DealType,
  query: Record<string, any>,
  role?: string,
  excludeProductIds: string[] = [],
) => {
  const result = await getAllDeal({ ...query, type }, role, {
    publicOnly: true,
  });
  if (!excludeProductIds.length) return result;

  const filtered = result.data.filter(
    item => !excludeProductIds.includes(item.productId),
  );
  return {
    ...result,
    data: filtered,
    meta: { ...result.meta, total: filtered.length },
  };
};

const getDealSections = async (
  query: Record<string, any> = {},
  role?: string,
) => {
  const limit = Math.min(Math.max(Number(query.limit) || 8, 1), 24);
  const weekly = await getDealsByType(DealType.weekly, { page: 1, limit }, role);
  const weeklyProductIds = weekly.data.map(item => item.productId);
  const clearance = await getDealsByType(
    DealType.clearance,
    { page: 1, limit },
    role,
    weeklyProductIds,
  );

  return {
    weekly,
    clearance,
  };
};

const getDealById = async (id: string, role?: string) => {
  const result = await prisma.deal.findUnique({
    where: { id },
    include: dealInclude,
  });
  if (!result || result.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Deal not found');
  return { ...result, product: withDisplayPrice(result.product, role) };
};

const updateDeal = async (id: string, payload: any) => {
  const existing = await prisma.deal.findUnique({ where: { id } });
  if (!existing || existing.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Deal not found');

  const nextProductId =
    typeof payload.productId === 'string' ? payload.productId : existing.productId;
  if (nextProductId !== existing.productId) {
    const product = await prisma.product.findUnique({
      where: { id: nextProductId },
    });
    if (!product || product.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
    }
    await assertProductAvailableForDeal(nextProductId, id);
  }

  const data: Prisma.DealUpdateInput = { ...payload };
  delete (data as any).title;
  delete (data as any).description;
  delete (data as any).image;
  if (payload.type !== undefined) {
    data.type =
      payload.type === DealType.clearance
        ? DealType.clearance
        : DealType.weekly;
  }

  const result = await prisma.deal.update({
    where: { id },
    data,
    include: dealInclude,
  });

  if (
    payload.dealPrice != null ||
    payload.isActive === false ||
    nextProductId !== existing.productId
  ) {
    if (nextProductId !== existing.productId) {
      await prisma.product.update({
        where: { id: existing.productId },
        data: { isDeal: false },
      });
    }
    await prisma.product.update({
      where: { id: nextProductId },
      data: {
        dealPrice:
          typeof payload.dealPrice === 'number'
            ? payload.dealPrice
            : existing.dealPrice,
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
  getDealsByType,
  getDealSections,
  getDealById,
  updateDeal,
  deleteDeal,
};
