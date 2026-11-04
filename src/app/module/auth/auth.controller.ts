import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import sendResponse from '@app/utils/sendResponse.js';
import config from '@app/config/index.js';
import { authServices } from './auth.service.js';
import catchAsync from '@app/utils/catchAsync.js';
import { otpServices } from '../otp/otp.service.js';

const register = catchAsync(async (req: Request, res: Response) => {
  const result = await authServices.register(req.body);
  const sendOtp = await otpServices.resendOtp({ email: result.email });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User created successfully',
    data: { user: result, otpToken: sendOtp },
  });
});

const login = catchAsync(async (req: Request, res: Response) => {
  const result = await authServices.login(req.body, req);
  const { refreshToken } = result;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cookieOptions: any = {
    secure: false,
    httpOnly: true,
    maxAge: 31536000000,
  };

  if (config.NODE_ENV === 'production') {
    cookieOptions.sameSite = 'none';
  }
  res.cookie('refreshToken', refreshToken, cookieOptions);
  res.cookie('token', refreshToken, cookieOptions);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Logged in successfully',
    data: result,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const result = await authServices.changePassword(req?.user?.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password changed successfully',
    data: result,
  });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const result = await authServices.forgotPassword(req?.body?.email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'An OTP sent to your email!',
    data: result,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const result = await authServices.resetPassword(
    req?.headers?.token as string,
    req?.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset successfully',
    data: result,
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  const result = await authServices.refreshToken(
    refreshToken || req.body.refreshToken,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Access token retrieved successfully',
    data: result,
  });
});

export const authControllers = {
  register,
  login,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
};
