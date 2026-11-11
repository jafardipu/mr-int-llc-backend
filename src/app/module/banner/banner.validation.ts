import { z } from 'zod';

const bannerSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  image: z.string().min(1, 'Image is required'),
  subtitle: z.string().optional(),
  link: z.string().optional(),
  position: z.coerce.number().int().nonnegative().optional(),
  isActive: z.coerce.boolean().optional(),
});

const create = z.object({ body: bannerSchema });
const update = z.object({ body: bannerSchema.partial() });

export const bannerValidation = { create, update };
