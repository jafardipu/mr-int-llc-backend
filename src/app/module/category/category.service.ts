/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import type { Prisma } from '../../../../generated/prisma/index.js';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import { deleteFromS3 } from '@app/utils/s3.js';

const createCategory = async (payload: Prisma.CategoryCreateInput) => {
  const isExist = await prisma.category.findFirst({
    where: {
      name: payload.name,
    },
  });

  if (isExist && !isExist.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Category already exists');
  }

  if (isExist && isExist.isDeleted) {
    return prisma.category.update({
      where: {
        id: isExist.id,
      },
      data: {
        ...payload,
        isDeleted: false,
      },
    });
  }

  const result = await prisma.category.create({
    data: payload,
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create category');
  }

  return result;
};

const getAllCategory = async (query: Record<string, any>) => {
  query.isDeleted = false;
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;

  const where: Prisma.CategoryWhereInput = {};

  if (searchTerm) {
    where.OR = ['name'].map(field => ({
      [field]: {
        contains: searchTerm,
      },
    }));
  }

  if (Object.keys(filtersData).length > 0) {
    const oldAnd = where.AND;
    const andArray = Array.isArray(oldAnd) ? oldAnd : oldAnd ? [oldAnd] : [];

    where.AND = [
      ...andArray,
      ...Object.entries(filtersData).map(([key, value]) => ({
        [key]: { equals: value === 'true' ? true : value === 'false' ? false : value },
      })),
    ];
  }

  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);

  const orderBy: Prisma.CategoryOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) {
          return { [trimmed.slice(1)]: 'desc' };
        }
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'asc' }];

  const data = await prisma.category.findMany({
    where,
    skip,
    take: limit,
    orderBy,
    include: {
      _count: { select: { products: true } },
    },
  });

  const total = await prisma.category.count({ where });

  return {
    data,
    meta: { page, limit, total },
  };
};

const getCategoryById = async (id: string) => {
  const result = await prisma.category.findUnique({
    where: {
      id,
    },
    include: {
      _count: { select: { products: true } },
      products: {
        where: { isDeleted: false },
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: {
          images: true,
          brand: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!result || result.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found!');

  return result;
};

const updateCategory = async (
  id: string,
  payload: Prisma.CategoryUpdateInput,
) => {
  const oldCategory = await getCategoryById(id);
  let path;
  if (oldCategory?.image && payload.image) {
    path = new URL(oldCategory?.image as string).pathname;
  }
  const result = await prisma.category.update({
    where: {
      id,
    },
    data: payload,
  });

  if (!result) throw new AppError(httpStatus.BAD_REQUEST, 'Failed to update Category');

  if (path && payload.image) {
    try {
      await deleteFromS3(path);
    } catch {
      // keep update successful even if image cleanup fails
    }
  }
  return result;
};

const deleteCategory = async (id: string) => {
  const result = await prisma.category.update({
    where: {
      id,
    },
    data: {
      isDeleted: true,
    },
  });

  if (!result)
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to delete category');
  if (result.image) {
    try {
      const path = new URL(result.image as string).pathname;
      await deleteFromS3(path);
    } catch {
      // keep delete successful even if S3 cleanup fails
    }
  }
  return result;
};

export const categoryService = {
  createCategory,
  getAllCategory,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
