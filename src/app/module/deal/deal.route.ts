import { Router } from 'express';
import multer from 'multer';
import auth from '@app/middleware/auth.js';
import optionalAuth from '@app/middleware/optionalAuth.js';
import parseData from '@app/middleware/parseData.js';
import uploadSingle from '@app/middleware/uploadSingle.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { ADMIN_ROLES } from '../users/user.constants.js';
import { dealController } from './deal.controller.js';
import { dealValidation } from './deal.validation.js';

const router: Router = Router();
const uploads = multer({ storage: multer.memoryStorage() });

router.post(
  '/',
  auth(...ADMIN_ROLES),
  uploads.single('image'),
  parseData(),
  uploadSingle('image'),
  validateRequest(dealValidation.create),
  dealController.createDeal,
);
router.patch(
  '/:id',
  auth(...ADMIN_ROLES),
  uploads.single('image'),
  parseData(),
  uploadSingle('image'),
  validateRequest(dealValidation.update),
  dealController.updateDeal,
);
router.delete('/:id', auth(...ADMIN_ROLES), dealController.deleteDeal);
router.get('/:id', optionalAuth, dealController.getDealById);
router.get('/', optionalAuth, dealController.getAllDeal);

export const dealRoutes = router;
