import { z } from 'zod';

export const schema = z.object({
  addressLine1: z.string().min(1, 'addressLine1 cannot be empty').optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const create = z.object({
  body: schema,
});
const update = z.object({
  body: schema.partial(),
});

export const AddressValidation = {
  create,
  update,
};
