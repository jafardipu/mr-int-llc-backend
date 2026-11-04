import { z } from 'zod';

const brandSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long'),
  image: z.string().optional().nullable(),
});

const create = z.object({
  body: brandSchema,
});
const update = z.object({
  body: brandSchema.partial(),
});

const brandValidation = {
  create,
  update,
};
export default brandValidation;
