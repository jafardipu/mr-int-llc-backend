import { z } from 'zod';

const promoBody = z.object({
  code: z
    .string()
    .min(2, 'Code is required')
    .max(40, 'Code is too long')
    .transform(value => value.trim().toUpperCase()),
  description: z.string().optional().nullable(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.coerce.number().positive('Discount value must be greater than 0'),
  minOrderAmount: z.coerce.number().nonnegative().optional(),
  maxDiscount: z.coerce.number().positive().optional().nullable(),
  usageLimit: z.coerce.number().int().positive().optional().nullable(),
  perUserLimit: z.coerce.number().int().positive().optional(),
  startsAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  isActive: z.coerce.boolean().optional(),
  customerType: z.enum(['retail', 'wholesale']).optional().nullable(),
});

const create = z.object({
  body: promoBody.superRefine((data, ctx) => {
    if (data.discountType === 'percentage' && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Percentage discount cannot exceed 100',
        path: ['discountValue'],
      });
    }
  }),
});

const update = z.object({
  body: promoBody.partial().superRefine((data, ctx) => {
    if (
      data.discountType === 'percentage' &&
      data.discountValue !== undefined &&
      data.discountValue > 100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Percentage discount cannot exceed 100',
        path: ['discountValue'],
      });
    }
  }),
});

const validate = z.object({
  body: z.object({
    code: z.string().min(1, 'Promo code is required'),
    subtotal: z.coerce.number().nonnegative().optional(),
  }),
});

export const promoCodeValidation = { create, update, validate };
