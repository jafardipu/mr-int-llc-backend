/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import {
  PrepServiceStatus,
  type Prisma,
} from '../../../../generated/prisma/index.js';
import { notificationQueue } from '@app/redis/index.js';
import { notifyAdmins } from '../notification/notification.service.js';

const createPrepService = async (userId: string, payload: any) => {
  const result = await prisma.prepServiceRequest.create({
    data: {
      userId,
      serviceType: payload.serviceType,
      notes: payload.notes,
      attachments: payload.attachments || [],
    },
  });
  if (!result)
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create prep service request');

  await notifyAdmins({
    message: 'New prep request',
    description: `A ${result.serviceType} request is waiting for review.`,
  });

  return result;
};

const listByUser = async (userId: string, query: Record<string, any>) => {
  query.userId = userId;
  return getAllPrepService(query);
};

const getAllPrepService = async (query: Record<string, any>) => {
  query.isDeleted = false;
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;
  const where: Prisma.PrepServiceRequestWhereInput = {};

  if (searchTerm) {
    where.OR = ['serviceType', 'notes'].map(field => ({
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
  const orderBy: Prisma.PrepServiceRequestOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'desc' }];

  const data = await prisma.prepServiceRequest.findMany({
    where,
    skip,
    take: limit,
    orderBy,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  const total = await prisma.prepServiceRequest.count({ where });
  return { data, meta: { page, limit, total } };
};

const getPrepServiceById = async (id: string, userId?: string, isAdmin = false) => {
  const result = await prisma.prepServiceRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  if (!result || result.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Prep service request not found');
  if (!isAdmin && result.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized');
  }
  return result;
};

const updatePrepServiceStatus = async (
  id: string,
  payload: { status: PrepServiceStatus; adminNote?: string },
) => {
  const existing = await prisma.prepServiceRequest.findUnique({ where: { id } });
  if (!existing || existing.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Prep service request not found');

  const result = await prisma.prepServiceRequest.update({
    where: { id },
    data: {
      status: payload.status,
      adminNote: payload.adminNote ?? null,
    },
  });

  await notificationQueue.add('new_notification', {
    data: {
      receiverId: existing.userId,
      message: 'Prep service updated',
      description: `Your ${existing.serviceType} request is now ${payload.status}.`,
    },
  });

  return result;
};

export const prepServiceService = {
  createPrepService,
  listByUser,
  getAllPrepService,
  getPrepServiceById,
  updatePrepServiceStatus,
};
