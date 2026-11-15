import { Router } from 'express';
import auth from '@app/middleware/auth.js';
import optionalAuth from '@app/middleware/optionalAuth.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { ADMIN_ROLES } from '../users/user.constants.js';
import { dealController } from './deal.controller.js';
import { dealValidation } from './deal.validation.js';

const router: Router = Router();

router.post(
  '/',
  auth(...ADMIN_ROLES),
  validateRequest(dealValidation.create),
  dealController.createDeal,
);
router.patch(
  '/:id',
  auth(...ADMIN_ROLES),
  validateRequest(dealValidation.update),
  dealController.updateDeal,
);
router.delete('/:id', auth(...ADMIN_ROLES), dealController.deleteDeal);
router.get('/sections', optionalAuth, dealController.getDealSections);
router.get('/weekly', optionalAuth, dealController.getWeeklyDeals);
router.get('/clearance', optionalAuth, dealController.getClearanceDeals);
router.get('/:id', optionalAuth, dealController.getDealById);
router.get('/', optionalAuth, dealController.getAllDeal);

export const dealRoutes = router;
