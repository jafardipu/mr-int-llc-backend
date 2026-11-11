import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import sendResponse from '@app/utils/sendResponse.js';
import { prepServiceService } from './prepService.service.js';

const createPrepService = catchAsync(async (req: Request, res: Response) => {
  const result = await prepServiceService.createPrepService(
    req.user.userId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Prep service request created successfully',
    data: result,
  });
});

const getMyPrepServices = catchAsync(async (req: Request, res: Response) => {
  const result = await prepServiceService.listByUser(req.user.userId, req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Prep service requests fetched successfully',
    data: result,
  });
});

const getAllPrepServices = catchAsync(async (req: Request, res: Response) => {
  const result = await prepServiceService.getAllPrepService(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All prep service requests fetched successfully',
    data: result,
  });
});

const getPrepServiceById = catchAsync(async (req: Request, res: Response) => {
  const isAdmin =
    req.user.role === 'admin' || req.user.role === 'supper_admin';
  const result = await prepServiceService.getPrepServiceById(
    req.params.id as string,
    req.user.userId,
    isAdmin,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Prep service request fetched successfully',
    data: result,
  });
});

const updatePrepServiceStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await prepServiceService.updatePrepServiceStatus(
    req.params.id as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Prep service status updated successfully',
    data: result,
  });
});

export const prepServiceController = {
  createPrepService,
  getMyPrepServices,
  getAllPrepServices,
  getPrepServiceById,
  updatePrepServiceStatus,
};
