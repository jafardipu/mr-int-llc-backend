/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import type { Prisma } from '../../../../generated/prisma/index.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';

const createAddress = async (payload: any) => {
  if (payload.isDefault && payload.userId) {
    await prisma.address.updateMany({
      where: { userId: payload.userId, isDeleted: false },
      data: { isDefault: false },
    });
  }

  const result = await prisma.address.create({
    data: payload,
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create address');
  }
  return result;
};

const getAllAddress = async (query: Record<string, any>) => {
  query.isDeleted = false;
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;
  const where: Prisma.AddressWhereInput = {};

  if (searchTerm) {
    where.OR = ['addressLine1', 'city', 'state', 'country'].map(field => ({
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
  const orderBy: Prisma.AddressOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ isDefault: 'desc' }, { createdAt: 'desc' }];

  const data = await prisma.address.findMany({
    where,
    skip,
    take: limit,
    orderBy,
  });
  const total = await prisma.address.count({ where });
  return { data, meta: { page, limit, total } };
};

const getAddressById = async (id: string, userId?: string) => {
  const result = await prisma.address.findUnique({ where: { id } });
  if (!result || result.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Address not found!');
  if (userId && result.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized');
  }
  return result;
};

const updateAddress = async (
  id: string,
  userId: string,
  payload: Prisma.AddressUpdateInput,
) => {
  await getAddressById(id, userId);
  if (payload.isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDeleted: false },
      data: { isDefault: false },
    });
  }
  const result = await prisma.address.update({
    where: { id },
    data: payload,
  });
  if (!result)
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to update Address');
  return result;
};

const deleteAddress = async (id: string, userId: string) => {
  await getAddressById(id, userId);
  const result = await prisma.address.update({
    where: { id },
    data: { isDeleted: true },
  });
  if (!result)
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to delete address');
  return result;
};

export const addressService = {
  createAddress,
  getAllAddress,
  getAddressById,
  updateAddress,
  deleteAddress,
};
