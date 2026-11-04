import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import sendResponse from '@app/utils/sendResponse.js';
import { wishlistService } from './wishlist.service.js';

const addToWishlist = catchAsync(async (req: Request, res: Response) => {
  const result = await wishlistService.addToWishlist(
    req.user.userId,
    req.body.productId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Added to wishlist successfully',
    data: result,
  });
});

const getMyWishlist = catchAsync(async (req: Request, res: Response) => {
  const result = await wishlistService.getMyWishlist(
    req.user.userId,
    req.query,
    req.user.role,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Wishlist fetched successfully',
    data: result,
  });
});

const removeFromWishlist = catchAsync(async (req: Request, res: Response) => {
  const result = await wishlistService.removeFromWishlist(
    req.user.userId,
    req.params.id as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Removed from wishlist successfully',
    data: result,
  });
});

export const wishlistController = {
  addToWishlist,
  getMyWishlist,
  removeFromWishlist,
};
