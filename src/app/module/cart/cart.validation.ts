import { z } from 'zod';

const add = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product is required'),
    quantity: z.coerce.number().int().positive().default(1),
  }),
});

const update = z.object({
  body: z.object({
    quantity: z.coerce.number().int().positive('Quantity must be at least 1'),
  }),
});

export const cartValidation = { add, update };
