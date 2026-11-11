import { Router } from 'express';
import multer from 'multer';
import auth from '@app/middleware/auth.js';
import parseData from '@app/middleware/parseData.js';
import uploadMultiple from '@app/middleware/uploadMulti.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { ADMIN_ROLES, AUTH_ROLES, CUSTOMER_ROLES } from '../users/user.constants.js';
import { prepServiceController } from './prepService.controller.js';
import { prepServiceValidation } from './prepService.validation.js';

const router: Router = Router();
const uploads = multer({ storage: multer.memoryStorage() });
const files = [{ name: 'attachments', maxCount: 8 }];

router.post(
  '/',
  auth(...CUSTOMER_ROLES),
  uploads.fields(files),
  parseData(),
  uploadMultiple(files),
  validateRequest(prepServiceValidation.create),
  prepServiceController.createPrepService,
);
router.patch(
  '/:id/status',
  auth(...ADMIN_ROLES),
  validateRequest(prepServiceValidation.updateStatus),
  prepServiceController.updatePrepServiceStatus,
);
router.get('/my', auth(...CUSTOMER_ROLES), prepServiceController.getMyPrepServices);
router.get('/', auth(...ADMIN_ROLES), prepServiceController.getAllPrepServices);
router.get('/:id', auth(...AUTH_ROLES), prepServiceController.getPrepServiceById);

export const prepServiceRoutes = router;
