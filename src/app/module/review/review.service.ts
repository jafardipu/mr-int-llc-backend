/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { Prisma } from '../../../../generated/prisma/index.js';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';

const createReview = async (
  userId: string,
  payload: { productId: string; rating: number; review: string },
) => {
  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
  });
  if (!product || product.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  const purchased = await prisma.orderItem.findFirst({
    where: {
      productId: payload.productId,
      order: { userId, status: { in: ['completed', 'processing'] } },
    },
  });
  if (!purchased) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only review products you purchased',
    );
  }

  try {
    return await prisma.$transaction(async tx => {
      const review = await tx.review.create({
        data: {
          userId,
          productId: payload.productId,
          rating: payload.rating,
          review: payload.review,
        },
      });

      const stats = await tx.review.aggregate({
        where: { productId: payload.productId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.product.update({
        where: { id: payload.productId },
        data: {
          avgRating: stats._avg.rating || 0,
          totalReview: stats._count.rating || 0,
        },
      });

      return review;
    });
  } catch (error: any) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AppError(httpStatus.BAD_REQUEST, 'You have already reviewed this product');
    }
    throw new AppError(
      httpStatus.BAD_REQUEST,
      error.message || 'Failed to create review',
    );
  }
};

const getAllReview = async (query: Record<string, any>) => {
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;
  const where: Prisma.ReviewWhereInput = {};

  if (searchTerm) {
    where.OR = [{ review: { contains: searchTerm } }];
  }
  if (Object.keys(filtersData).length > 0) {
    where.AND = Object.entries(filtersData).map(([key, value]) => ({
      [key]: { equals: value },
    }));
  }

  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);
  const orderBy: Prisma.ReviewOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'desc' }];

  const data = await prisma.review.findMany({
    where,
    skip,
    take: limit,
    orderBy,
    include: {
      user: { select: { id: true, name: true, profile: true } },
      product: { select: { id: true, name: true, sku: true } },
    },
  });
  const total = await prisma.review.count({ where });
  return { data, meta: { page, limit, total } };
};

const getReviewById = async (id: string) => {
  const result = await prisma.review.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, profile: true } },
      product: true,
    },
  });
  if (!result) throw new AppError(httpStatus.NOT_FOUND, 'Review not found');
  return result;
};

const deleteReview = async (id: string, userId: string, isAdmin = false) => {
  const existing = await prisma.review.findUnique({ where: { id } });
  if (!existing) throw new AppError(httpStatus.NOT_FOUND, 'Review not found');
  if (!isAdmin && existing.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized');
  }

  const result = await prisma.$transaction(async tx => {
    const deleted = await tx.review.delete({ where: { id } });
    const stats = await tx.review.aggregate({
      where: { productId: existing.productId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await tx.product.update({
      where: { id: existing.productId },
      data: {
        avgRating: stats._avg.rating || 0,
        totalReview: stats._count.rating || 0,
      },
    });
    return deleted;
  });

  return result;
};

export const reviewService = {
  createReview,
  getAllReview,
  getReviewById,
  deleteReview,
};
