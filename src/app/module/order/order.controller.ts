import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import sendResponse from '@app/utils/sendResponse.js';
import AppError from '@app/error/AppError.js';
import { CUSTOMER_ROLES } from '../users/user.constants.js';
import { orderService } from './order.service.js';

const getCheckoutSummary = catchAsync(async (req: Request, res: Response) => {
  const promoCode =
    typeof req.query.promoCode === 'string' && req.query.promoCode.trim()
      ? req.query.promoCode.trim()
      : undefined;
  const result = await orderService.getCheckoutSummary(
    req.user.userId,
    req.user.role,
    promoCode,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Checkout summary fetched successfully',
    data: result,
  });
});

const checkout = catchAsync(async (req: Request, res: Response) => {
  const result = await orderService.checkout(
    req.user.userId,
    req.user.role,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order placed successfully',
    data: result,
  });
});

const getMyOrders = catchAsync(async (req: Request, res: Response) => {
  const result = await orderService.getMyOrders(req.user.userId, req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Orders fetched successfully',
    data: result,
  });
});

const getMyDashboard = catchAsync(async (req: Request, res: Response) => {
  // Admins pass auth here but have no orders of their own, so they get 403
  // rather than the 401 that auth() returns for a role mismatch.
  if (!(CUSTOMER_ROLES as readonly string[]).includes(req.user.role)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'The order dashboard is only available to customer accounts',
    );
  }
  const result = await orderService.getMyDashboard(req.user.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Dashboard retrieved successfully',
    data: result,
  });
});

const getAllOrders = catchAsync(async (req: Request, res: Response) => {
  const result = await orderService.getAllOrders(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All orders fetched successfully',
    data: result,
  });
});

const getOrderById = catchAsync(async (req: Request, res: Response) => {
  const isAdmin =
    req.user.role === 'admin' || req.user.role === 'supper_admin';
  const result = await orderService.getOrderById(
    req.params.id as string,
    req.user.userId,
    isAdmin,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order fetched successfully',
    data: result,
  });
});

const cancelMyOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await orderService.cancelMyOrder(
    req.params.id as string,
    req.user.userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order cancelled successfully',
    data: result,
  });
});

const updateOrderStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await orderService.updateOrderStatus(
    req.params.id as string,
    req.body.status,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order status updated successfully',
    data: result,
  });
});

export const orderController = {
  getCheckoutSummary,
  checkout,
  getMyOrders,
  getMyDashboard,
  getAllOrders,
  getOrderById,
  cancelMyOrder,
  updateOrderStatus,
};
