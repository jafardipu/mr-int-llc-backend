import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import catchAsync from '@app/utils/catchAsync.js';
import sendResponse from '@app/utils/sendResponse.js';
import { contactService } from './contact.service.js';

const createContact = catchAsync(async (req: Request, res: Response) => {
  const result = await contactService.createContact({
    ...req.body,
    userId: req.user?.userId,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Message sent successfully',
    data: result,
  });
});

const getAllContact = catchAsync(async (req: Request, res: Response) => {
  const result = await contactService.getAllContact(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Contact messages fetched successfully',
    data: result,
  });
});

const getContactById = catchAsync(async (req: Request, res: Response) => {
  const result = await contactService.getContactById(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Support message fetched successfully',
    data: result,
  });
});

const replyContact = catchAsync(async (req: Request, res: Response) => {
  const result = await contactService.replyContact(
    req.params.id as string,
    req.body.reply,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Reply sent successfully',
    data: result,
  });
});

export const contactController = {
  createContact,
  getAllContact,
  getContactById,
  replyContact,
};
