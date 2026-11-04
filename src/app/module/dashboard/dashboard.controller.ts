import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import sendResponse from '@app/utils/sendResponse.js';
import { dashboardService } from './dashboard.service.js';

const getOverview = catchAsync(async (req: Request, res: Response) => {
  const rawYear = req.query.year;
  const yearValue = Array.isArray(rawYear) ? rawYear[0] : rawYear;
  const year =
    yearValue !== undefined && yearValue !== null && `${yearValue}`.trim() !== ''
      ? `${yearValue}`
      : undefined;
  const result = await dashboardService.getOverview(year ? { year } : {});
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Dashboard overview fetched successfully',
    data: result,
  });
});

export const dashboardController = {
  getOverview,
};
