import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import { brandService } from './brand.service.js';
import sendResponse from '@app/utils/sendResponse.js';

const createBrand = catchAsync(async (req: Request, res: Response) => {
  const result = await brandService.createBrand(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Brand created successfully',
    data: result,
  });
});

const getAllBrand = catchAsync(async (req: Request, res: Response) => {
  const result = await brandService.getAllBrand(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All brand fetched successfully',
    data: result,
  });
});

const getBrandById = catchAsync(async (req: Request, res: Response) => {
  const result = await brandService.getBrandById(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Brand fetched successfully',
    data: result,
  });
});

const updateBrand = catchAsync(async (req: Request, res: Response) => {
  const result = await brandService.updateBrand(req.params.id as string, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Brand updated successfully',
    data: result,
  });
});

const deleteBrand = catchAsync(async (req: Request, res: Response) => {
  const result = await brandService.deleteBrand(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Brand deleted successfully',
    data: result,
  });
});

export const brandController = {
  createBrand,
  getAllBrand,
  getBrandById,
  updateBrand,
  deleteBrand,
};
