import { z } from 'zod';

const register = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Valid email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    phoneNumber: z.string().optional(),
    role: z.enum(['retail', 'wholesale']),
    fcmToken: z.string().optional(),
  }),
});

const login = z.object({
  body: z.object({
    email: z.string().email('Valid email is required'),
    password: z.string().min(1, 'Password is required'),
    fcmToken: z.string().optional(),
  }),
});

const changePassword = z.object({
  body: z.object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  }),
});

const forgotPassword = z.object({
  body: z.object({
    email: z.string().email('Valid email is required'),
  }),
});

const resetPassword = z.object({
  body: z.object({
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  }),
});

export const authValidation = {
  register,
  login,
  changePassword,
  forgotPassword,
  resetPassword,
};
