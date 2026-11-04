import { z } from 'zod';

const create = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product is required'),
    rating: z.coerce.number().min(1).max(5),
    review: z.string().min(1, 'Review is required'),
  }),
});

export const reviewValidation = { create };
