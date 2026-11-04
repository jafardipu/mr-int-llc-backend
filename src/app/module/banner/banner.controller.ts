import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import sendResponse from '@app/utils/sendResponse.js';
import { bannerService } from './banner.service.js';

const createBanner = catchAsync(async (req: Request, res: Response) => {
  const result = await bannerService.createBanner(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Banner created successfully',
    data: result,
  });
});

const getHomepageBanners = catchAsync(async (req: Request, res: Response) => {
  const result = await bannerService.getAllBanner(req.query, true);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Homepage banners fetched successfully',
    data: result,
  });
});

const getAllBanner = catchAsync(async (req: Request, res: Response) => {
  const result = await bannerService.getAllBanner(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All banner fetched successfully',
    data: result,
  });
});

const getBannerById = catchAsync(async (req: Request, res: Response) => {
  const result = await bannerService.getBannerById(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Banner fetched successfully',
    data: result,
  });
});

const updateBanner = catchAsync(async (req: Request, res: Response) => {
  const result = await bannerService.updateBanner(
    req.params.id as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Banner updated successfully',
    data: result,
  });
});

const deleteBanner = catchAsync(async (req: Request, res: Response) => {
  const result = await bannerService.deleteBanner(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Banner deleted successfully',
    data: result,
  });
});

export const bannerController = {
  createBanner,
  getHomepageBanners,
  getAllBanner,
  getBannerById,
  updateBanner,
  deleteBanner,
};
