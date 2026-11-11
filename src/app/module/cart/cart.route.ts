import { Router } from 'express';
import auth from '@app/middleware/auth.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { CUSTOMER_ROLES } from '../users/user.constants.js';
import { cartController } from './cart.controller.js';
import { cartValidation } from './cart.validation.js';

const router: Router = Router();

router.post(
  '/',
  auth(...CUSTOMER_ROLES),
  validateRequest(cartValidation.add),
  cartController.addToCart,
);
router.patch(
  '/:id',
  auth(...CUSTOMER_ROLES),
  validateRequest(cartValidation.update),
  cartController.updateCartItem,
);
router.delete('/:id', auth(...CUSTOMER_ROLES), cartController.removeCartItem);
router.get('/', auth(...CUSTOMER_ROLES), cartController.getCart);

export const cartRoutes = router;
