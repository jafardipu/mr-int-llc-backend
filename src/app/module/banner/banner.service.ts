/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import type { Prisma } from '../../../../generated/prisma/index.js';

const createBanner = async (payload: Prisma.BannerCreateInput) => {
  const result = await prisma.banner.create({ data: payload });
  if (!result) throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create banner');
  return result;
};

const getAllBanner = async (query: Record<string, any>, publicOnly = false) => {
  query.isDeleted = false;
  if (publicOnly) query.isActive = true;
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;
  const where: Prisma.BannerWhereInput = {};

  if (searchTerm) {
    where.OR = ['link', 'image'].map(field => ({
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
  const orderBy: Prisma.BannerOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'desc' }];

  const data = await prisma.banner.findMany({
    where,
    skip,
    take: limit,
    orderBy,
  });
  const total = await prisma.banner.count({ where });
  return { data, meta: { page, limit, total } };
};

const getBannerById = async (id: string) => {
  const result = await prisma.banner.findUnique({ where: { id } });
  if (!result || result.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Banner not found');
  return result;
};

const updateBanner = async (id: string, payload: Prisma.BannerUpdateInput) => {
  await getBannerById(id);
  return prisma.banner.update({ where: { id }, data: payload });
};

const deleteBanner = async (id: string) => {
  await getBannerById(id);
  return prisma.banner.update({
    where: { id },
    data: { isDeleted: true, isActive: false },
  });
};

export const bannerService = {
  createBanner,
  getAllBanner,
  getBannerById,
  updateBanner,
  deleteBanner,
};
