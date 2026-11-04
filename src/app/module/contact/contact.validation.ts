import { z } from 'zod';

const create = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Valid email is required'),
    subject: z.string().optional(),
    message: z.string().min(1, 'Message is required'),
  }),
});

const reply = z.object({
  body: z.object({
    reply: z.string().min(1, 'Reply is required'),
  }),
});

export const contactValidation = { create, reply };
