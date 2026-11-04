import { Router } from 'express';
import { authControllers } from './auth.controller.js';
import { AUTH_ROLES } from '../users/user.constants.js';
import auth from '@app/middleware/auth.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { authValidation } from './auth.validation.js';

const router: Router = Router();

router.post(
  '/register',
  validateRequest(authValidation.register),
  authControllers.register,
);
router.post(
  '/login',
  validateRequest(authValidation.login),
  authControllers.login,
);
router.post('/refresh-token', authControllers.refreshToken);

router.patch(
  '/change-password',
  auth(...AUTH_ROLES),
  validateRequest(authValidation.changePassword),
  authControllers.changePassword,
);

router.patch(
  '/forgot-password',
  validateRequest(authValidation.forgotPassword),
  authControllers.forgotPassword,
);
router.patch(
  '/reset-password',
  validateRequest(authValidation.resetPassword),
  authControllers.resetPassword,
);

export const authRoutes = router;
