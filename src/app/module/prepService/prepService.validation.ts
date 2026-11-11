import { z } from 'zod';

const create = z.object({
  body: z.object({
    serviceType: z.string().min(1, 'Service type is required'),
    notes: z.string().optional(),
    attachments: z.array(z.string()).optional(),
  }),
});

const updateStatus = z.object({
  body: z.object({
    status: z.enum(['under_review', 'correction_required', 'completed']),
    adminNote: z.string().optional(),
  }),
});

export const prepServiceValidation = { create, updateStatus };
