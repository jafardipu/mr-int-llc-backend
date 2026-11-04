import AppError from '@app/error/AppError.js';
import { notificationQueue } from '@app/redis/index.js';
import prisma from '@app/shared/prisma.js';
import httpStatus from 'http-status';
import { Role } from '../../../../generated/prisma/index.js';

const getNotification = async (userId: string) => {
  return prisma.notification.findMany({
    where: { receiverId: userId },
    orderBy: { createdAt: 'desc' },
  });
};

export const notifyAdmins = async (payload: {
  message: string;
  description?: string;
  orderId?: string;
}) => {
  const admins = await prisma.user.findMany({
    where: {
      isDeleted: false,
      role: { in: [Role.admin, Role.supper_admin] },
    },
    select: { id: true },
  });

  await Promise.all(
    admins.map(admin =>
      notificationQueue.add('new_notification', {
        data: {
          receiverId: admin.id,
          message: payload.message,
          description: payload.description,
          ...(payload.orderId ? { orderId: payload.orderId } : {}),
        },
      }),
    ),
  );
};

const deleteNotification = async (userId: string) => {
  const notification = await prisma.notification.deleteMany({
    where: { receiverId: userId },
  });

  if (!notification)
    throw new AppError(httpStatus.BAD_REQUEST, 'Notification delete failed.');

  return notification;
};

const readNotification = async (userId: string) => {
  const notification = await prisma.notification.updateMany({
    where: { receiverId: userId },
    data: { isRead: true },
  });

  if (!notification)
    throw new AppError(httpStatus.BAD_REQUEST, 'Notification read failed.');

  return notification;
};

export const notificationService = {
  deleteNotification,
  getNotification,
  readNotification,
};
