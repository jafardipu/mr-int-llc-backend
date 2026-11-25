import httpStatus from 'http-status';
import type { Request } from 'express';
import { UAParser } from 'ua-parser-js';
import bcrypt from 'bcrypt';
import moment from 'moment';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import {
  createToken,
  isPasswordMatched,
  sanitizeUser,
  verifyToken,
} from './user.utils.js';
import config from '@app/config/index.js';
import { generateOtp } from '@app/utils/otpGenerator.js';
import { sendEmail } from '@app/utils/mailSender.js';
import type {
  IChangePassword,
  IJwtPayload,
  ILogin,
  IRegister,
  IResetPassword,
} from './auth.interface.js';
import { Role } from '../../../../generated/prisma/index.js';
import HashPassword from '@app/shared/hashPassword.js';
import { wholesaleFeeService } from '../wholesaleFee/wholesaleFee.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const register = async (payload: IRegister) => {
  const email = payload.email.trim().toLowerCase();

  if (payload.role !== Role.retail && payload.role !== Role.wholesale) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Incorrect role provided. The role must be either 'retail' or 'wholesale'.",
    );
  }

  const isExist = await prisma.user.findFirst({
    where: { email },
    include: { verification: { select: { status: true } } },
  });

  const userData = {
    name: payload.name,
    email,
    password: await HashPassword(payload.password),
    phoneNumber: payload.phoneNumber ?? null,
    role: payload.role,
    fcmToken: payload.fcmToken ?? null,
  };

  if (isExist) {
    if (isExist.isDeleted) {
      throw new AppError(httpStatus.FORBIDDEN, 'This user was deleted');
    }
    if (isExist.status === 'blocked') {
      throw new AppError(httpStatus.FORBIDDEN, 'This user was blocked');
    }
    if (!isExist.verification?.status) {
      const updated = await prisma.user.update({
        where: { id: isExist.id },
        data: userData,
      });
      await wholesaleFeeService.syncSignupFee(updated);
      return sanitizeUser(updated);
    }
    throw new AppError(
      httpStatus.CONFLICT,
      'User already exists and is verified',
    );
  }

  const result = await prisma.user.create({
    data: userData,
  });
  await wholesaleFeeService.syncSignupFee(result);

  return sanitizeUser(result);
};

const login = async (payload: ILogin, req: Request) => {
  payload.email = payload?.email?.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      email: payload.email,
    },
    include: {
      verification: {
        select: {
          status: true,
        },
      },
    },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0] ||
    req.socket.remoteAddress ||
    '';

  const parser = new UAParser(req.headers['user-agent']);
  const result = parser.getResult();

  if (user?.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted');
  }

  if (user.status === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
  }

  if (!(await isPasswordMatched(payload.password, user.password as string))) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password does not match');
  }

  if (!user?.verification?.status) {
    throw new AppError(httpStatus.FORBIDDEN, 'User account is not verified');
  }

  const jwtPayload: { userId: string; role: string } = {
    userId: user?.id?.toString() as string,
    role: user?.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );

  const refreshToken = createToken(
    jwtPayload,
    config.jwt_refresh_secret as string,
    config.jwt_refresh_expires_in as string,
  );

  const newUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      fcmToken: payload?.fcmToken ?? null,
      deviceHistory: {
        create: {
          ip,
          browser: result.browser.name,
          os: result.os.name,
          device: result.device.model || 'Desktop',
        },
      },
    },
    include: {
      deviceHistory: true,
      verification: { select: { status: true } },
    },
  });

  return {
    user: sanitizeUser(newUser),
    accessToken,
    refreshToken,
    // `required: true` means: send the customer to pay the wholesale fee.
    wholesaleFee: await wholesaleFeeService.getFeeState(user.id),
  };
};

const changePassword = async (id: string, payload: IChangePassword) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (
    !(await isPasswordMatched(payload?.oldPassword, user.password as string))
  ) {
    throw new AppError(httpStatus.FORBIDDEN, 'Old password does not match');
  }
  if (payload?.newPassword !== payload?.confirmPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'New password and confirm password do not match',
    );
  }

  const hashedPassword = await bcrypt.hash(
    payload?.newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const result = await prisma.user.update({
    where: { id },
    data: {
      password: hashedPassword,
    },
  });

  return sanitizeUser(result);
};

const forgotPassword = async (email: string) => {
  const user = await prisma.user.findFirst({
    where: { email },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const jwtPayload = {
    email: email,
    userId: user?.id,
  };

  const token = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    '3m',
  );

  const currentTime = new Date();
  const otp = generateOtp();
  const expiresAt = moment(currentTime).add(3, 'minute');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verification: {
        upsert: {
          create: {
            otp: Number(otp),
            expiredAt: expiresAt.toDate(),
            status: false,
          },
          update: {
            otp: Number(otp),
            expiredAt: expiresAt.toDate(),
            status: false,
          },
        },
      },
    },
  });

  const otpEmailPath = path.join(
    __dirname,
    '../../../../public/view/forgot_pass_mail.html',
  );

  await sendEmail(
    user?.email,
    'Your reset password OTP is',
    fs
      .readFileSync(otpEmailPath, 'utf8')
      .replace('{{otpCode}}', otp)
      .replace('{{email}}', user?.email)
      .replace('{{fullName}}', user?.name ?? 'Customer'),
  );
  return { email, token };
};

const resetPassword = async (token: string, payload: IResetPassword) => {
  let decode;
  try {
    decode = verifyToken(token, config.jwt_access_secret as string);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.log(err);
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Session has expired. Please try again',
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: decode?.userId },
    include: {
      verification: {
        select: {
          status: true,
          expiredAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user?.verification?.status) {
    throw new AppError(httpStatus.FORBIDDEN, 'OTP is not verified yet');
  }

  if (payload?.newPassword !== payload?.confirmPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'New password and confirm password do not match',
    );
  }

  const hashedPassword = await bcrypt.hash(
    payload?.newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const result = await prisma.user.update({
    where: { id: decode?.userId },
    data: {
      password: hashedPassword,
      verification: {
        update: {
          otp: 0,
          status: true,
        },
      },
    },
  });

  return sanitizeUser(result);
};

const refreshToken = async (token: string) => {
  const decoded = verifyToken(token, config.jwt_refresh_secret as string);
  const { userId } = decoded;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      verification: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (user?.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted');
  }

  const jwtPayload: IJwtPayload = {
    userId: user?.id?.toString() as string,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );

  return {
    accessToken,
  };
};

export const authServices = {
  register,
  login,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
};
