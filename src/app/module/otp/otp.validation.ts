import { z } from 'zod';

const verifyOtpZodSchema = z.object({
  body: z.object({
    // Accept string or number from clients/Swagger, then enforce 6 digits
    otp: z
      .union([z.string(), z.number()])
      .transform(value => String(value).trim())
      .pipe(
        z
          .string()
          .nonempty('otp is required')
          .length(6, { message: 'otp must be exactly 6 characters long' }),
      ),
  }),
});

const resentOtpZodSchema = z.object({
  body: z.object({
    email: z.string().nonempty('Email is required').email(),
  }),
});

export const resentOtpValidations = {
  resentOtpZodSchema,
  verifyOtpZodSchema,
};
