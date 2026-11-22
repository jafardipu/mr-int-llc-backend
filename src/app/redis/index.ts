import { createClient, type RedisClientType } from 'redis';
import colors from 'colors';
import { Queue } from 'bullmq';
import config from '@app/config/index.js';
import { Server } from 'socket.io';

const redisHost = config.redis_host || 'localhost';
const redisPort = parseInt(config.redis_port || '6379');
const redisUrl = `redis://${redisHost}:${redisPort}`;

const connection = {
  host: redisHost,
  port: redisPort,
};

const pubClient: RedisClientType = createClient({ url: redisUrl });
const subClient: RedisClientType = pubClient.duplicate();

pubClient.on('error', err =>
  console.error(colors.red('Redis pubClient error:'), err),
);
subClient.on('error', err =>
  console.error(colors.red('Redis subClient error:'), err),
);

const connectRedis = async () => {
  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    console.log(colors.blue.bold('✨ Connected to Redis server'));
  } catch (error) {
    console.error(colors.red.bold('❌ Redis connection failed:'), error);
    process.exit(1);
  }
};

const notificationQueue = new Queue('general_notification', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

const ORDER_QUEUE_NAME = 'order_maintenance';

const orderQueue = new Queue(ORDER_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
  },
});

const initRedisSubscriptions = (io: Server) => {
  subClient.subscribe('new_notification_channel', async rawMessage => {
    try {
      const notification = JSON.parse(rawMessage);
      if (notification?.receiverId) {
        const receiverSocketId = await pubClient.hGet(
          'userId_to_socketId',
          notification.receiverId,
        );
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('new_notification', notification);
        }
      }
    } catch (error) {
      console.error(colors.red('new_notification_channel error:'), error);
    }
  });
};

export {
  pubClient,
  subClient,
  connectRedis,
  initRedisSubscriptions,
  notificationQueue,
  orderQueue,
  ORDER_QUEUE_NAME,
  connection,
};
