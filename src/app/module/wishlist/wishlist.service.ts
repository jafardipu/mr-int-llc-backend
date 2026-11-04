/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import { withDisplayPrice } from '../product/product.utils.js';
import type { Prisma } from '../../../../generated/prisma/index.js';

const addToWishlist = async (userId: string, productId: string) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  const existing = await prisma.wishlist.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (existing) {
    return existing;
  }

  return prisma.wishlist.create({
    data: { userId, productId },
    include: { product: { include: { images: true } } },
  });
};

const getMyWishlist = async (userId: string, query: Record<string, any>, role?: string) => {
  const { pagination } = await pickQuery(query);
  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);

  const where: Prisma.WishlistWhereInput = { userId };
  const orderBy: Prisma.WishlistOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'desc' }];

  const data = await prisma.wishlist.findMany({
    where,
    skip,
    take: limit,
    orderBy,
    include: {
      product: { include: { images: true, brand: true, category: true } },
    },
  });
  const total = await prisma.wishlist.count({ where });

  return {
    data: data.map(item => ({
      ...item,
      product: withDisplayPrice(item.product, role),
    })),
    meta: { page, limit, total },
  };
};

const removeFromWishlist = async (userId: string, id: string) => {
  const item = await prisma.wishlist.findUnique({ where: { id } });
  if (!item || item.userId !== userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Wishlist item not found');
  }
  return prisma.wishlist.delete({ where: { id } });
};

export const wishlistService = {
  addToWishlist,
  getMyWishlist,
  removeFromWishlist,
};
