import { z } from 'zod';

const create = z.object({
  body: z.object({
    question: z.string().trim().min(1, 'Question is required'),
    answer: z.string().trim().min(1, 'Answer is required'),
  }),
});

const update = z.object({
  body: z.object({
    question: z.string().trim().min(1, 'Question cannot be empty').optional(),
    answer: z.string().trim().min(1, 'Answer cannot be empty').optional(),
  }),
});

const reorder = z.object({
  body: z.object({
    ids: z
      .array(z.string().min(1), { error: 'ids must be a list of FAQ ids' })
      .min(1, 'Send at least one FAQ id'),
  }),
});

export const faqValidation = { create, update, reorder };
