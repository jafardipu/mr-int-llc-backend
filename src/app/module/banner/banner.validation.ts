import { z } from 'zod';

const bannerSchema = z.object({
  image: z.string().min(1, 'Image is required'),
  link: z.string().optional().nullable(),
  isActive: z.coerce.boolean().optional(),
});

const create = z.object({ body: bannerSchema });
const update = z.object({ body: bannerSchema.partial() });

export const bannerValidation = { create, update };
