import { z } from 'zod';

const checkout = z.object({
  body: z.object({
    addressId: z.string().min(1, 'Address is required'),
    notes: z.string().optional(),
    shippingFee: z.coerce.number().nonnegative().optional(),
    tax: z.coerce.number().nonnegative().optional(),
    discount: z.coerce.number().nonnegative().optional(),
    promoCode: z.string().trim().min(1).optional(),
  }),
});

const updateStatus = z.object({
  body: z.object({
    status: z.enum(['pending', 'processing', 'completed', 'cancelled']),
  }),
});

export const orderValidation = { checkout, updateStatus };
