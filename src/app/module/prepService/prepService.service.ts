/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { uploadToS3 } from '@app/utils/s3.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import {
  PrepServiceStatus,
  type Prisma,
} from '../../../../generated/prisma/index.js';
import { notificationQueue } from '@app/redis/index.js';
import { notifyAdmins } from '../notification/notification.service.js';
import { PREP_REVIEW_STATUSES } from './prepService.constants.js';
import { buildAttachmentKey } from './prepService.utils.js';

type ReviewPayload = {
  status: (typeof PREP_REVIEW_STATUSES)[number];
  adminNote?: string | null | undefined;
};

const STATUS_VALUES = Object.values(PrepServiceStatus) as string[];

const requestInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phoneNumber: true,
      profile: true,
    },
  },
} satisfies Prisma.PrepServiceRequestInclude;

const customerName = (user: { name: string | null; email: string }) =>
  user.name || user.email;

const findRequest = async (id: string) => {
  const request = await prisma.prepServiceRequest.findUnique({ where: { id } });
  if (!request || request.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Prep service request not found');
  }
  return request;
};

const findWithUser = (id: string) =>
  prisma.prepServiceRequest.findUniqueOrThrow({
    where: { id },
    include: requestInclude,
  });

const uploadAttachments = async (userId: string, files: Express.Multer.File[]) => {
  if (files.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Upload at least one attachment');
  }
  const urls = await Promise.all(
    files.map(file =>
      uploadToS3({ file, fileName: buildAttachmentKey(userId, file.originalname) }),
    ),
  );
  if (urls.some(url => !url)) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to upload attachments, please try again',
    );
  }
  return urls as string[];
};

// Customer: starts a request with attachments only. Status starts as under_review.
const createPrepService = async (userId: string, files: Express.Multer.File[]) => {
  const attachments = await uploadAttachments(userId, files);
  const result = await prisma.prepServiceRequest.create({
    data: { userId, attachments },
    include: requestInclude,
  });

  await notifyAdmins({
    message: 'New prep request',
    description: `${customerName(result.user)} submitted a prep service request with ${attachments.length} attachment(s).`,
  });

  return result;
};

// Customer: replaces the attachments after the admin asked for corrections.
const resubmitPrepService = async (
  id: string,
  userId: string,
  files: Express.Multer.File[],
) => {
  const existing = await findRequest(id);
  if (existing.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized');
  }
  if (existing.status !== PrepServiceStatus.correction_required) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Attachments can only be resubmitted when the request needs correction',
    );
  }

  const attachments = await uploadAttachments(userId, files);
  // adminNote is kept so the admin can see what they asked for on the next review.
  const { count } = await prisma.prepServiceRequest.updateMany({
    where: {
      id,
      userId,
      isDeleted: false,
      status: PrepServiceStatus.correction_required,
    },
    data: { attachments, status: PrepServiceStatus.under_review },
  });
  if (count === 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This request was changed in the meantime, please refresh and try again',
    );
  }

  const result = await findWithUser(id);
  await notifyAdmins({
    message: 'Prep request resubmitted',
    description: `${customerName(result.user)} resubmitted attachments for a prep service request.`,
  });
  return result;
};

// Admin: approves (completed) or asks for corrections. Only under_review requests.
const reviewPrepService = async (id: string, payload: ReviewPayload) => {
  const existing = await findRequest(id);
  if (existing.status !== PrepServiceStatus.under_review) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      existing.status === PrepServiceStatus.completed
        ? 'This request is already approved'
        : 'This request is waiting for the customer to resubmit attachments',
    );
  }

  const adminNote = payload.adminNote?.trim() || null;
  const { count } = await prisma.prepServiceRequest.updateMany({
    where: { id, isDeleted: false, status: PrepServiceStatus.under_review },
    data: { status: payload.status, adminNote },
  });
  if (count === 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This request was reviewed in the meantime, please refresh',
    );
  }

  const approved = payload.status === PrepServiceStatus.completed;
  await notificationQueue.add('new_notification', {
    data: {
      receiverId: existing.userId,
      message: approved ? 'Prep request approved' : 'Prep request needs changes',
      description: approved
        ? `Your prep service request has been approved.${adminNote ? ` Note: ${adminNote}` : ''}`
        : adminNote ||
          'Please check your prep service request and resubmit the attachments.',
    },
  });

  return findWithUser(id);
};

/**
 * Lists requests. With `ownerId` only that customer's requests are returned
 * and the userId/searchTerm filters are ignored.
 */
const listPrepServices = async (query: Record<string, any>, ownerId?: string) => {
  const { pagination } = await pickQuery(query);
  const where: Prisma.PrepServiceRequestWhereInput = { isDeleted: false };

  if (typeof query.status === 'string' && query.status) {
    if (!STATUS_VALUES.includes(query.status)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Invalid status. Use one of: ${STATUS_VALUES.join(', ')}`,
      );
    }
    where.status = query.status as PrepServiceStatus;
  }

  if (ownerId) {
    where.userId = ownerId;
  } else {
    if (typeof query.userId === 'string' && query.userId) {
      where.userId = query.userId;
    }
    const searchTerm =
      typeof query.searchTerm === 'string' ? query.searchTerm.trim() : '';
    if (searchTerm) {
      where.OR = [
        { user: { is: { name: { contains: searchTerm, mode: 'insensitive' } } } },
        { user: { is: { email: { contains: searchTerm, mode: 'insensitive' } } } },
      ];
    }
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

  const [data, total] = await Promise.all([
    prisma.prepServiceRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: requestInclude,
    }),
    prisma.prepServiceRequest.count({ where }),
  ]);
  return { data, meta: { page, limit, total } };
};

const getPrepServiceById = async (id: string, userId?: string, isAdmin = false) => {
  const existing = await findRequest(id);
  if (!isAdmin && existing.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized');
  }
  return findWithUser(id);
};

export const prepServiceService = {
  createPrepService,
  resubmitPrepService,
  reviewPrepService,
  listPrepServices,
  getPrepServiceById,
};
