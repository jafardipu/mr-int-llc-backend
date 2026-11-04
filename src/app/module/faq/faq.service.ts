/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import type { Prisma } from '../../../../generated/prisma/index.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';

const createFaq = async (payload: Prisma.FaqCreateInput) => {
  const result = await prisma.faq.create({ data: payload });
  if (!result) throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create faq');
  return result;
};

const getAllFaq = async (query: Record<string, any>) => {
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, include: includeData, ...filtersData } = filters;
  const include: Record<string, any> = {};

  if (includeData) {
    String(includeData)
      .split(',')
      .forEach((field: string) => {
        const trimmedField = field.trim();
        if (trimmedField) include[trimmedField] = true;
      });
  }

  const where: Prisma.FaqWhereInput = {};
  if (searchTerm) {
    where.OR = ['question', 'answer'].map(field => ({
      [field]: { contains: searchTerm },
    }));
  }
  if (Object.keys(filtersData).length > 0) {
    where.AND = Object.entries(filtersData).map(([key, value]) => ({
      [key]: { equals: value },
    }));
  }

  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);
  const orderBy: Prisma.FaqOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [];

  const data = await prisma.faq.findMany({
    where,
    skip,
    take: limit,
    include,
    orderBy,
  });
  const total = await prisma.faq.count({ where });
  return { data, meta: { page, limit, total } };
};

const getFaqById = async (id: string) => {
  const result = await prisma.faq.findUnique({ where: { id } });
  if (!result) throw new AppError(httpStatus.NOT_FOUND, 'Faq not found!');
  return result;
};

const updateFaq = async (id: string, payload: Prisma.FaqUpdateInput) => {
  const result = await prisma.faq.update({ where: { id }, data: payload });
  if (!result) throw new AppError(httpStatus.BAD_REQUEST, 'Failed to update Faq');
  return result;
};

const deleteFaq = async (id: string) => {
  const result = await prisma.faq.delete({ where: { id } });
  if (!result) throw new AppError(httpStatus.BAD_REQUEST, 'Failed to delete faq');
  return result;
};

export const faqService = {
  createFaq,
  getAllFaq,
  getFaqById,
  updateFaq,
  deleteFaq,
};
