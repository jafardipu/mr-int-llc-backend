import { z } from 'zod';

// Only `prices` is checked; the text fields keep their current, unvalidated behaviour.
const prices = z.object(
  {
    shippingFee: z
      .number({ error: 'Shipping fee must be a number' })
      .min(0, 'Shipping fee cannot be negative')
      .optional(),
    taxRate: z
      .number({ error: 'Tax rate must be a number' })
      .min(0, 'Tax rate cannot be negative')
      .max(100, 'Tax rate cannot be more than 100%')
      .optional(),
    wholesaleAccountFee: z
      .number({ error: 'Wholesale account fee must be a number' })
      .min(0, 'Wholesale account fee cannot be negative')
      // Stripe cannot charge less than $0.50.
      .refine(value => value === 0 || value >= 0.5, {
        message: 'Wholesale account fee must be 0 (off) or at least $0.50',
      })
      .optional(),
  },
  { error: 'prices must be an object' },
);

const update = z.object({
  body: z.object({ prices: prices.optional() }),
});

export const contentValidation = { update };
