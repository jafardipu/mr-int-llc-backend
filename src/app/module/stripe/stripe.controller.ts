import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '@app/utils/catchAsync.js';
import sendResponse from '@app/utils/sendResponse.js';
import StripeService from '@app/class/string.class.js';
import prisma from '@app/shared/prisma.js';

const getCustomerId = catchAsync(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  let customerId = user?.customerId;
  if (!customerId && user) {
    const customer = await StripeService.createCustomer(
      user.email,
      user.name || 'Customer',
    );
    customerId = customer?.id;
    if (customerId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { customerId },
      });
    }
  }
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Customer fetched successfully',
    data: { customerId },
  });
});

export const stripeController = {
  getCustomerId,
};
