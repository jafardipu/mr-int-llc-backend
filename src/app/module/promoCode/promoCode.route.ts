import { Router } from 'express';
import auth from '@app/middleware/auth.js';
import optionalAuth from '@app/middleware/optionalAuth.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { ADMIN_ROLES } from '../users/user.constants.js';
import { promoCodeController } from './promoCode.controller.js';
import { promoCodeValidation } from './promoCode.validation.js';

const router: Router = Router();

router.post(
  '/validate',
  optionalAuth,
  validateRequest(promoCodeValidation.validate),
  promoCodeController.validatePromoCode,
);

router.post(
  '/',
  auth(...ADMIN_ROLES),
  validateRequest(promoCodeValidation.create),
  promoCodeController.createPromoCode,
);
router.get('/', auth(...ADMIN_ROLES), promoCodeController.getAllPromoCodes);
router.get('/:id', auth(...ADMIN_ROLES), promoCodeController.getPromoCodeById);
router.patch(
  '/:id',
  auth(...ADMIN_ROLES),
  validateRequest(promoCodeValidation.update),
  promoCodeController.updatePromoCode,
);
router.delete('/:id', auth(...ADMIN_ROLES), promoCodeController.deletePromoCode);

export const promoCodeRoutes = router;
