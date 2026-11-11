/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import HashPassword from '@app/shared/hashPassword.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import { Role, type Prisma } from '../../../../generated/prisma/index.js';
import { sanitizeUser } from '../auth/user.utils.js';

const userSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  role: true,
  profile: true,
  phoneNumber: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
  verification: {
    select: {
      status: true,
    },
  },
  address: true,
  deviceHistory: true,
} satisfies Prisma.UserSelect;

const create = async (payload: Prisma.UserCreateInput) => {
  const { address, ...userData }: any = payload;
  userData.email = userData?.email?.trim().toLowerCase();

  const isExist = await prisma.user.findFirst({
    where: {
      email: userData.email,
    },
    include: {
      verification: {
        select: {
          status: true,
        },
      },
    },
  });

  userData.password = await HashPassword(userData?.password as string);
  if (
    userData.role === Role.admin ||
    userData.role === Role.supper_admin
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Incorrect role provided. The role must be either 'retail' or 'wholesale'.",
    );
  }

  if (isExist) {
    if (isExist.isDeleted) {
      throw new AppError(httpStatus.FORBIDDEN, 'This user was deleted');
    }

    if (isExist.status === 'blocked') {
      throw new AppError(httpStatus.FORBIDDEN, 'This user was blocked');
    }

    if (!isExist.verification?.status) {
      return sanitizeUser(
        await prisma.user.update({
          where: { id: isExist.id },
          data: userData,
        }),
      );
    }

    throw new AppError(
      httpStatus.CONFLICT,
      'User already exists and is verified',
    );
  }

  const result = await prisma.user.create({
    data: {
      ...userData,
      ...(address && {
        address: {
          create: address,
        },
      }),
    },
    include: { address: true },
  });

  return sanitizeUser(result);
};

const getAll = async (query: Record<string, any>) => {
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;

  const pipeline: Prisma.UserWhereInput = {
    isDeleted: false,
  };

  if (searchTerm) {
    pipeline.OR = ['name', 'email', 'phoneNumber'].map(field => ({
      [field]: {
        contains: searchTerm,
      },
    }));
  }

  if (Object.keys(filtersData).length > 0) {
    const oldAnd = pipeline.AND;
    const oldAndArray = Array.isArray(oldAnd) ? oldAnd : oldAnd ? [oldAnd] : [];

    pipeline.AND = [
      ...oldAndArray,
      ...Object.entries(filtersData).map(([key, value]) => ({
        [key]: { equals: value },
      })),
    ];
  }

  if (!filtersData.role) {
    pipeline.role = { in: [Role.retail, Role.wholesale] };
  }

  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);

  let sortArray: Prisma.UserOrderByWithRelationInput[] = [];
  if (sort) {
    sortArray = sort.split(',').map(field => {
      const trimmedField = field.trim();
      if (trimmedField.startsWith('-')) {
        return { [trimmedField.slice(1)]: 'desc' };
      }
      return { [trimmedField]: 'asc' };
    });
  }

  const data = await prisma.user.findMany({
    where: pipeline,
    skip,
    take: limit,
    orderBy: sortArray,
    select: userSelect,
  });

  const total = await prisma.user.count({
    where: pipeline,
  });

  return {
    data,
    meta: { page, limit, total },
  };
};

const getById = async (id: string) => {
  const result = await prisma.user.findUnique({
    where: {
      id,
      isDeleted: false,
    },
    select: {
      ...userSelect,
      orders: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          customerType: true,
          total: true,
          createdAt: true,
        },
      },
    },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  return result;
};

const update = async (id: string, payload: Prisma.UserUpdateInput) => {
  const { password, role, email, ...safePayload }: any = payload;
  void password;
  void role;
  void email;

  try {
    const result = await prisma.user.update({
      where: { id },
      data: safePayload,
      select: userSelect,
    });
    return result;
  } catch (error: any) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'User update failed: ' + error.message,
    );
  }
};

const blockUser = async (id: string, statusValue: 'active' | 'blocked') => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.role === Role.admin || user.role === Role.supper_admin) {
    throw new AppError(httpStatus.FORBIDDEN, 'Cannot block an admin account');
  }

  const result = await prisma.user.update({
    where: { id },
    data: { status: statusValue },
    select: userSelect,
  });

  return result;
};

const deleteUser = async (id: string) => {
  const result = await prisma.user.update({
    where: {
      id,
    },
    data: { isDeleted: true },
    select: userSelect,
  });

  return result;
};

export const userService = {
  create,
  update,
  getAll,
  getById,
  deleteUser,
  blockUser,
};
