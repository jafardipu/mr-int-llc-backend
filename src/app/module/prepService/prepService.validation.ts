import { z } from 'zod';
import { PREP_REVIEW_STATUSES } from './prepService.constants.js';

// Create and resubmit take only uploaded files; the service checks those.

const review = z.object({
  body: z.object({
    status: z.enum(PREP_REVIEW_STATUSES, {
      error: 'Status must be completed or correction_required',
    }),
    adminNote: z.string().max(1000).nullish(),
  }),
});

export const prepServiceValidation = { review };
