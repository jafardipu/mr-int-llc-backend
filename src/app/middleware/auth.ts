import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import { type JwtPayload } from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import AppError from '@app/error/AppError.js';
import config from '@app/config/index.js';
import prisma from '@app/shared/prisma.js';
import {
  isWholesaleFeeDue,
  WHOLESALE_FEE_DUE_MESSAGE,
} from '@app/module/wholesaleFee/wholesaleFee.utils.js';

type AuthOptions = {
  // Let a wholesale account that has not paid its one-time fee through.
  allowUnpaidWholesaleFee: boolean;
};

const createAuth =
  (options: AuthOptions) =>
  (...userRoles: string[]) => {
    return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
      const token = req?.headers?.authorization?.split(' ')[1];

      if (!token) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'you are not authorized!');
      }

      let decode;
      try {
        decode = jwt.verify(
          token,
          config.jwt_access_secret as string,
        ) as JwtPayload;
      } catch (error) {
        console.log(error);
        throw new AppError(httpStatus.UNAUTHORIZED, 'unauthorized');
      }

      const { role, userId } = decode;
      const isUserExist = await prisma.user.findFirst({
        where: {
          id: userId,
          isDeleted: false,
        },
        include: {
          verification: true,
          wholesaleFee: { select: { status: true } },
        },
      });
      if (!isUserExist) {
        throw new AppError(httpStatus.NOT_FOUND, 'user not found');
      }
      if (userRoles && !userRoles.includes(role)) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized');
      }

      if (isUserExist.status === 'blocked') {
        throw new AppError(httpStatus.UNAUTHORIZED, 'your account is blocked');
      }

      if (isUserExist.isDeleted) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'your account is deleted');
      }

      if (!isUserExist.verification?.status) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          'your account is not verified',
        );
      }

      if (!options.allowUnpaidWholesaleFee && isWholesaleFeeDue(isUserExist)) {
        throw new AppError(httpStatus.PAYMENT_REQUIRED, WHOLESALE_FEE_DUE_MESSAGE);
      }

      req.user = decode;
      next();
    });
  };

const auth = createAuth({ allowUnpaidWholesaleFee: false });

/**
 * Same as auth, but a wholesale account that still owes its one-time fee gets
 * through. Only for the fee, profile, password and notification endpoints.
 */
export const authAllowUnpaidFee = createAuth({ allowUnpaidWholesaleFee: true });

export default auth;
