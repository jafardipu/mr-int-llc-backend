import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import sendResponse from '@app/utils/sendResponse.js';
import { prepServiceService } from './prepService.service.js';

// Files from upload.array() in the route; empty when none were sent.
const uploadedFiles = (req: Request) =>
  Array.isArray(req.files) ? req.files : [];

const isAdminRole = (role: string) => role === 'admin' || role === 'supper_admin';

const createPrepService = catchAsync(async (req: Request, res: Response) => {
  const result = await prepServiceService.createPrepService(
    req.user.userId,
    uploadedFiles(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Prep service request submitted successfully',
    data: result,
  });
});

const resubmitPrepService = catchAsync(async (req: Request, res: Response) => {
  const result = await prepServiceService.resubmitPrepService(
    req.params.id as string,
    req.user.userId,
    uploadedFiles(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Attachments resubmitted for review',
    data: result,
  });
});

const getMyPrepServices = catchAsync(async (req: Request, res: Response) => {
  const result = await prepServiceService.listPrepServices(
    req.query,
    req.user.userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Prep service requests fetched successfully',
    data: result,
  });
});

const getAllPrepServices = catchAsync(async (req: Request, res: Response) => {
  const result = await prepServiceService.listPrepServices(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All prep service requests fetched successfully',
    data: result,
  });
});

const getPrepServiceById = catchAsync(async (req: Request, res: Response) => {
  const result = await prepServiceService.getPrepServiceById(
    req.params.id as string,
    req.user.userId,
    isAdminRole(req.user.role),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Prep service request fetched successfully',
    data: result,
  });
});

const reviewPrepService = catchAsync(async (req: Request, res: Response) => {
  const result = await prepServiceService.reviewPrepService(
    req.params.id as string,
    { status: req.body.status, adminNote: req.body.adminNote },
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message:
      result.status === 'completed'
        ? 'Prep service request approved'
        : 'Correction requested from the customer',
    data: result,
  });
});

export const prepServiceController = {
  createPrepService,
  resubmitPrepService,
  getMyPrepServices,
  getAllPrepServices,
  getPrepServiceById,
  reviewPrepService,
};
