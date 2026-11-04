import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import sendResponse from '@app/utils/sendResponse.js';
import { promoCodeService } from './promoCode.service.js';

const createPromoCode = catchAsync(async (req: Request, res: Response) => {
  const result = await promoCodeService.createPromoCode(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Promo code created successfully',
    data: result,
  });
});

const getAllPromoCodes = catchAsync(async (req: Request, res: Response) => {
  const result = await promoCodeService.getAllPromoCodes(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Promo codes fetched successfully',
    data: result,
  });
});

const getPromoCodeById = catchAsync(async (req: Request, res: Response) => {
  const result = await promoCodeService.getPromoCodeById(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Promo code fetched successfully',
    data: result,
  });
});

const updatePromoCode = catchAsync(async (req: Request, res: Response) => {
  const result = await promoCodeService.updatePromoCode(
    req.params.id as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Promo code updated successfully',
    data: result,
  });
});

const deletePromoCode = catchAsync(async (req: Request, res: Response) => {
  const result = await promoCodeService.deletePromoCode(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Promo code deleted successfully',
    data: result,
  });
});

const validatePromoCode = catchAsync(async (req: Request, res: Response) => {
  const result = await promoCodeService.validatePromoCode(req.body.code, {
    userId: req.user?.userId,
    role: req.user?.role,
    subtotal: req.body.subtotal,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Promo code is valid',
    data: {
      code: result.code,
      discountType: result.discountType,
      discountValue: result.discountValue,
      discount: result.discount,
      minOrderAmount: result.promo.minOrderAmount,
      maxDiscount: result.promo.maxDiscount,
      expiresAt: result.promo.expiresAt,
    },
  });
});

export const promoCodeController = {
  createPromoCode,
  getAllPromoCodes,
  getPromoCodeById,
  updatePromoCode,
  deletePromoCode,
  validatePromoCode,
};
