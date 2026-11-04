import { Router } from 'express';
import { addressController } from './address.controller.js';
import auth from '@app/middleware/auth.js';
import { CUSTOMER_ROLES } from '../users/user.constants.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { AddressValidation } from './address.validation.js';

const router: Router = Router();

router.post(
  '/',
  auth(...CUSTOMER_ROLES),
  validateRequest(AddressValidation.create),
  addressController.createAddress,
);
router.patch(
  '/:id',
  auth(...CUSTOMER_ROLES),
  validateRequest(AddressValidation.update),
  addressController.updateAddress,
);
router.delete('/:id', auth(...CUSTOMER_ROLES), addressController.deleteAddress);
router.get('/:id', auth(...CUSTOMER_ROLES), addressController.getAddressById);
router.get('/', auth(...CUSTOMER_ROLES), addressController.getMyAddress);

export const addressRoutes = router;
