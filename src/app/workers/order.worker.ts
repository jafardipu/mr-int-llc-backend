import { Worker } from 'bullmq';
import colors from 'colors';
import config from '@app/config/index.js';
import { connection, orderQueue, ORDER_QUEUE_NAME } from '@app/redis/index.js';
import { orderService } from '@app/module/order/order.service.js';

const EXPIRE_UNPAID_ORDERS_JOB = 'expire_unpaid_orders';
const EXPIRE_UNPAID_ORDERS_SCHEDULER = 'expire-unpaid-orders';
const EXPIRY_CHECK_INTERVAL_MS = 15 * 60 * 1000;

const orderWorker = new Worker(
  ORDER_QUEUE_NAME,
  async job => {
    if (job.name === EXPIRE_UNPAID_ORDERS_JOB) {
      const result = await orderService.expireUnpaidOrders();
      if (result.expired > 0) {
        console.log(colors.yellow(`🧹 Expired ${result.expired} unpaid order(s)`));
      }
      return result;
    }
  },
  { connection },
);

orderWorker.on('failed', (job, err) => {
  console.error(`❌ Order job failed: ${job?.id}`, err);
});

// Runs once at startup. The scheduler lives in Redis, so it is shared by all
// API replicas and only one of them runs each check.
export const scheduleOrderJobs = async () => {
  const hours = config.checkout.unpaid_order_expiry_hours;
  if (hours > 0) {
    await orderQueue.upsertJobScheduler(
      EXPIRE_UNPAID_ORDERS_SCHEDULER,
      { every: EXPIRY_CHECK_INTERVAL_MS },
      { name: EXPIRE_UNPAID_ORDERS_JOB },
    );
    console.log(
      colors.blue.bold(`⏰ Unpaid orders expire after ${hours}h (checked every 15 min)`),
    );
  } else {
    await orderQueue.removeJobScheduler(EXPIRE_UNPAID_ORDERS_SCHEDULER);
  }
};
