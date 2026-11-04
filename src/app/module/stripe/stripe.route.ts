import { Router } from 'express';
import { stripeController } from './stripe.controller.js';
import auth from '@app/middleware/auth.js';
import { CUSTOMER_ROLES } from '../users/user.constants.js';

const router: Router = Router();

router.get(
  '/get-customer',
  auth(...CUSTOMER_ROLES),
  stripeController.getCustomerId,
);

export const stripeRoutes = router;
