import { z } from 'zod';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long'),
  image: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});

const create = z.object({
  body: categorySchema,
});
const update = z.object({
  body: categorySchema.partial(),
});
const categoryValidation = {
  create,
  update,
};
export default categoryValidation;
