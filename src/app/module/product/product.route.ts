import auth from '@app/middleware/auth.js';
import optionalAuth from '@app/middleware/optionalAuth.js';
import { Router } from 'express';
import multer from 'multer';
import { ADMIN_ROLES } from '../users/user.constants.js';
import parseData from '@app/middleware/parseData.js';
import uploadMultiple from '@app/middleware/uploadMulti.js';
import validateRequest from '@app/middleware/validateRequest.js';
import productValidation from './product.validation.js';
import { productController } from './product.controller.js';

const router: Router = Router();
const uploads = multer({ storage: multer.memoryStorage() });
const productFiles = [{ name: 'images', maxCount: 8 }];

router.post(
  '/',
  auth(...ADMIN_ROLES),
  uploads.fields(productFiles),
  parseData(),
  uploadMultiple(productFiles),
  validateRequest(productValidation.create),
  productController.createProduct,
);
router.patch(
  '/:id',
  auth(...ADMIN_ROLES),
  uploads.fields(productFiles),
  parseData(),
  uploadMultiple(productFiles),
  validateRequest(productValidation.update),
  productController.updateProduct,
);
router.delete('/:id', auth(...ADMIN_ROLES), productController.deleteProduct);
router.get('/:id', optionalAuth, productController.getProductById);
router.get('/', optionalAuth, productController.getAllProduct);

export const productRoutes = router;
