import { z } from 'zod';

const create = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product is required'),
  }),
});

export const wishlistValidation = { create };
