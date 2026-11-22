/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import type { Prisma } from '../../../../generated/prisma/index.js';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import { deleteFromS3 } from '@app/utils/s3.js';

const createBrand = async (payload: Prisma.BrandCreateInput) => {
  const isExist = await prisma.brand.findFirst({
    where: { name: payload.name },
  });

  if (isExist && !isExist.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Brand already exists');
  }

  if (isExist && isExist.isDeleted) {
    return prisma.brand.update({
      where: { id: isExist.id },
      data: { ...payload, isDeleted: false },
    });
  }

  const result = await prisma.brand.create({ data: payload });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create brand');
  }
  return result;
};

const getAllBrand = async (query: Record<string, any>) => {
  query.isDeleted = false;
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;
  const where: Prisma.BrandWhereInput = {};

  if (searchTerm) {
    where.OR = ['name'].map(field => ({
      [field]: { contains: searchTerm },
    }));
  }

  if (Object.keys(filtersData).length > 0) {
    const oldAnd = where.AND;
    const andArray = Array.isArray(oldAnd) ? oldAnd : oldAnd ? [oldAnd] : [];
    where.AND = [
      ...andArray,
      ...Object.entries(filtersData).map(([key, value]) => ({
        [key]: {
          equals: value === 'true' ? true : value === 'false' ? false : value,
        },
      })),
    ];
  }

  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);
  const orderBy: Prisma.BrandOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'asc' }];

  const data = await prisma.brand.findMany({ where, skip, take: limit, orderBy });
  const total = await prisma.brand.count({ where });
  return { data, meta: { page, limit, total } };
};

const getBrandById = async (id: string) => {
  const result = await prisma.brand.findUnique({ where: { id } });
  if (!result || result.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Brand not found!');
  return result;
};

const updateBrand = async (id: string, payload: Prisma.BrandUpdateInput) => {
  const oldBrand = await getBrandById(id);
  let path;
  if (oldBrand?.image && payload.image) {
    path = new URL(oldBrand.image as string).pathname;
  }
  const result = await prisma.brand.update({ where: { id }, data: payload });
  if (!result) throw new AppError(httpStatus.BAD_REQUEST, 'Failed to update Brand');
  if (path && payload.image) await deleteFromS3(path);
  return result;
};

const deleteBrand = async (id: string) => {
  const result = await prisma.brand.update({
    where: { id },
    data: { isDeleted: true },
  });
  if (!result)
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to delete brand');
  return result;
};

export const brandService = {
  createBrand,
  getAllBrand,
  getBrandById,
  updateBrand,
  deleteBrand,
};
