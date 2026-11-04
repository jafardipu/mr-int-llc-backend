import { Worker } from 'bullmq';
import { connection, pubClient } from '@app/redis/index.js';
import prisma from '@app/shared/prisma.js';

const notificationWorker = new Worker(
  'general_notification',
  async job => {
    if (job.name === 'new_notification') {
      const payload = job.data;
      const notification = payload?.data;

      if (!notification?.receiverId) {
        throw new Error('Notification receiverId is required');
      }

      if (!payload.notificationStored) {
        await prisma.notification.create({ data: notification });
        await job.updateData({ ...payload, notificationStored: true });
      }

      const receiverSocketId = await pubClient.hGet(
        'userId_to_socketId',
        notification.receiverId,
      );

      if (receiverSocketId && global.socketio) {
        global.socketio
          .to(receiverSocketId)
          .emit('new_notification', notification);
      }
    }
  },
  { connection },
);

notificationWorker.on('completed', job => {
  console.log(`✅ Job completed: ${job.id}`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`❌ Job failed: ${job?.id}`, err);
});
