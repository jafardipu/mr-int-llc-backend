import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import sendResponse from '@app/utils/sendResponse.js';
import { cartService } from './cart.service.js';

const getCart = catchAsync(async (req: Request, res: Response) => {
  const result = await cartService.getCart(req.user.userId, req.user.role);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cart fetched successfully',
    data: result,
  });
});

const addToCart = catchAsync(async (req: Request, res: Response) => {
  const result = await cartService.addToCart(
    req.user.userId,
    req.body,
    req.user.role,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Item added to cart successfully',
    data: result,
  });
});

const updateCartItem = catchAsync(async (req: Request, res: Response) => {
  const result = await cartService.updateCartItem(
    req.user.userId,
    req.params.id as string,
    Number(req.body.quantity),
    req.user.role,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cart item updated successfully',
    data: result,
  });
});

const removeCartItem = catchAsync(async (req: Request, res: Response) => {
  const result = await cartService.removeCartItem(
    req.user.userId,
    req.params.id as string,
    req.user.role,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cart item removed successfully',
    data: result,
  });
});

export const cartController = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
};
