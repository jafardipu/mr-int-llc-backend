import { z } from 'zod';

// Prices (discount, shipping, tax, total) are always calculated on the server.
// validateRequest does not replace req.body with the parsed result, so extra
// fields such as a client-sent `discount` still reach the service; checkout
// reads only addressId, notes and promoCode.
const checkout = z.object({
  body: z.object({
    addressId: z.string().min(1, 'Address is required'),
    notes: z.string().optional(),
    promoCode: z.string().trim().min(1).optional(),
  }),
});

const updateStatus = z.object({
  body: z.object({
    status: z.enum(['pending', 'processing', 'completed', 'cancelled']),
  }),
});

export const orderValidation = { checkout, updateStatus };
