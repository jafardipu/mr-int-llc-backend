import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import sendResponse from '@app/utils/sendResponse.js';
import { wholesaleFeeService } from './wholesaleFee.service.js';

const getFeeInfo = catchAsync(async (_req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Wholesale account fee fetched successfully',
    data: await wholesaleFeeService.getFeeInfo(),
  });
});

const getMyFee = catchAsync(async (req: Request, res: Response) => {
  const result = await wholesaleFeeService.getFeeState(req.user.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Wholesale account fee status fetched successfully',
    data: result,
  });
});

const createCheckout = catchAsync(async (req: Request, res: Response) => {
  const result = await wholesaleFeeService.createCheckout(req.user.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Checkout session created successfully',
    data: result,
  });
});

const confirmCheckout = catchAsync(async (req: Request, res: Response) => {
  // `session_id` is the name Stripe uses in the success URL.
  const id = req.query.session_id ?? req.query.sessionId;
  const result = await wholesaleFeeService.confirmCheckout(
    req.user.userId,
    typeof id === 'string' ? id : undefined,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message:
      result.status === 'paid'
        ? 'Wholesale account activated'
        : 'The payment is not complete yet',
    data: result,
  });
});

export const wholesaleFeeController = {
  getFeeInfo,
  getMyFee,
  createCheckout,
  confirmCheckout,
};
