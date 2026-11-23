import { Router } from 'express';
import auth from '@app/middleware/auth.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { ADMIN_ROLES, AUTH_ROLES, CUSTOMER_ROLES } from '../users/user.constants.js';
import { orderController } from './order.controller.js';
import { orderValidation } from './order.validation.js';

const router: Router = Router();

router.get(
  '/checkout-summary',
  auth(...CUSTOMER_ROLES),
  orderController.getCheckoutSummary,
);
router.post(
  '/checkout',
  auth(...CUSTOMER_ROLES),
  validateRequest(orderValidation.checkout),
  orderController.checkout,
);
router.patch('/:id/cancel', auth(...CUSTOMER_ROLES), orderController.cancelMyOrder);
router.patch(
  '/:id/status',
  auth(...ADMIN_ROLES),
  validateRequest(orderValidation.updateStatus),
  orderController.updateOrderStatus,
);
router.get('/my-orders', auth(...CUSTOMER_ROLES), orderController.getMyOrders);
// AUTH_ROLES so admins reach the controller and get 403 instead of 401.
router.get('/my-dashboard', auth(...AUTH_ROLES), orderController.getMyDashboard);
router.get('/', auth(...ADMIN_ROLES), orderController.getAllOrders);
router.get('/:id', auth(...AUTH_ROLES), orderController.getOrderById);

export const orderRoutes = router;
