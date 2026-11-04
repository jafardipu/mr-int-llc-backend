import jwt from 'jsonwebtoken';
import { type JwtPayload } from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import config from '@app/config/index.js';
import prisma from '@app/shared/prisma.js';

const optionalAuth = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = req?.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next();
    }

    try {
      const decode = jwt.verify(
        token,
        config.jwt_access_secret as string,
      ) as JwtPayload;
      const user = await prisma.user.findFirst({
        where: {
          id: decode.userId,
          isDeleted: false,
        },
      });
      if (user && user.status !== 'blocked') {
        req.user = decode;
      }
    } catch {
      // Guest catalog access stays public if the token is invalid.
    }

    next();
  },
);

export default optionalAuth;
