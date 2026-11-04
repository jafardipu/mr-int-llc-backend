import { z } from 'zod';

const create = z.object({
  body: z.object({
    question: z.string().min(1, 'Question is required'),
    answer: z.string().min(1, 'Answer is required'),
    categoryId: z.string().optional(),
  }),
});

const update = z.object({
  body: z.object({
    question: z.string().optional(),
    answer: z.string().optional(),
    categoryId: z.string().optional().nullable(),
  }),
});

export const faqValidation = { create, update };
