import auth from '@app/middleware/auth.js';
import { Router } from 'express';
import multer from 'multer';
import { ADMIN_ROLES } from '../users/user.constants.js';
import parseData from '@app/middleware/parseData.js';
import uploadSingle from '@app/middleware/uploadSingle.js';
import validateRequest from '@app/middleware/validateRequest.js';
import brandValidation from './brand.validation.js';
import { brandController } from './brand.controller.js';

const router: Router = Router();
const uploads = multer({ storage: multer.memoryStorage() });

router.post(
  '/',
  auth(...ADMIN_ROLES),
  uploads.single('image'),
  parseData(),
  uploadSingle('image'),
  validateRequest(brandValidation.create),
  brandController.createBrand,
);
router.patch(
  '/:id',
  auth(...ADMIN_ROLES),
  uploads.single('image'),
  parseData(),
  uploadSingle('image'),
  validateRequest(brandValidation.update),
  brandController.updateBrand,
);
router.delete('/:id', auth(...ADMIN_ROLES), brandController.deleteBrand);
router.get('/:id', brandController.getBrandById);
router.get('/', brandController.getAllBrand);

export const brandRoutes = router;
