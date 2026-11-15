import { z } from 'zod';

const dealSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  dealPrice: z.coerce.number().positive(),
  type: z.enum(['weekly', 'clearance']),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  isActive: z.coerce.boolean().optional(),
});

const create = z.object({ body: dealSchema });
const update = z.object({
  body: dealSchema.partial().extend({
    type: z.enum(['weekly', 'clearance']).optional(),
  }),
});

export const dealValidation = { create, update };
