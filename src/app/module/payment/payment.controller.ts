import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import sendResponse from '@app/utils/sendResponse.js';
import { paymentService } from './payment.service.js';

const createPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.createPayment(req.user.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Checkout session created successfully',
    data: result,
  });
});

const confirmPayment = catchAsync(async (req: Request, res: Response) => {
  // `session_id` is the name Stripe uses in the success URL; paymentIntentId is
  // kept for payments started with the old PaymentIntent flow.
  const id =
    req.query.sessionId ??
    req.query.session_id ??
    req.query.paymentIntentId ??
    req.body?.sessionId ??
    req.body?.paymentIntentId;
  const result = await paymentService.confirmPayment(
    typeof id === 'string' ? id : undefined,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message:
      result.status === 'paid'
        ? 'Payment confirmed successfully'
        : `Payment is ${result.status}`,
    data: result,
  });
});

// Stripe calls this endpoint; it must stay public and unauthenticated.
const stripeWebhook = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.handleWebhook(
    req.rawBody,
    req.get('stripe-signature'),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Webhook received',
    data: result,
  });
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.getAllPayments(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payments fetched successfully',
    data: result,
  });
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.getPaymentById(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment fetched successfully',
    data: result,
  });
});

export const paymentController = {
  createPayment,
  confirmPayment,
  stripeWebhook,
  getAllPayments,
  getPaymentById,
};
