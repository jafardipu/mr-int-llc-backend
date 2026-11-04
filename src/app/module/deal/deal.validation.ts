import { z } from 'zod';

const dealSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  image: z.string().optional(),
  productId: z.string().min(1, 'Product is required'),
  dealPrice: z.coerce.number().positive(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isActive: z.coerce.boolean().optional(),
});

const create = z.object({ body: dealSchema });
const update = z.object({ body: dealSchema.partial() });

export const dealValidation = { create, update };
