import { z } from 'zod';

const create = z.object({
  body: z.object({
    orderId: z.string().min(1, 'Order is required'),
    paymentMethod: z.string().optional(),
  }),
});

export const paymentValidation = { create };
