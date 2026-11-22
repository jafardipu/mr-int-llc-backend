import { Router } from 'express';
import { paymentController } from './payment.controller.js';
import auth from '@app/middleware/auth.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { ADMIN_ROLES, CUSTOMER_ROLES } from '../users/user.constants.js';
import { paymentValidation } from './payment.validation.js';

const router: Router = Router();

router.post(
  '/create',
  auth(...CUSTOMER_ROLES),
  validateRequest(paymentValidation.create),
  paymentController.createPayment,
);
router.get('/confirm-payment', paymentController.confirmPayment);
// Stripe webhook: signature-verified, no auth. Uses the raw body captured in app.ts.
router.post('/webhook', paymentController.stripeWebhook);
router.get('/', auth(...ADMIN_ROLES), paymentController.getAllPayments);
router.get('/:id', auth(...ADMIN_ROLES), paymentController.getPaymentById);

export const paymentRoutes = router;
