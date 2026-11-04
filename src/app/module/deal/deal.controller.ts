import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import sendResponse from '@app/utils/sendResponse.js';
import { dealService } from './deal.service.js';

const createDeal = catchAsync(async (req: Request, res: Response) => {
  const result = await dealService.createDeal(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Deal created successfully',
    data: result,
  });
});

const getAllDeal = catchAsync(async (req: Request, res: Response) => {
  const result = await dealService.getAllDeal(req.query, req.user?.role);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All deal fetched successfully',
    data: result,
  });
});

const getDealById = catchAsync(async (req: Request, res: Response) => {
  const result = await dealService.getDealById(
    req.params.id as string,
    req.user?.role,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Deal fetched successfully',
    data: result,
  });
});

const updateDeal = catchAsync(async (req: Request, res: Response) => {
  const result = await dealService.updateDeal(req.params.id as string, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Deal updated successfully',
    data: result,
  });
});

const deleteDeal = catchAsync(async (req: Request, res: Response) => {
  const result = await dealService.deleteDeal(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Deal deleted successfully',
    data: result,
  });
});

export const dealController = {
  createDeal,
  getAllDeal,
  getDealById,
  updateDeal,
  deleteDeal,
};
