import { Router } from 'express';
import multer from 'multer';
import auth from '@app/middleware/auth.js';
import parseData from '@app/middleware/parseData.js';
import uploadSingle from '@app/middleware/uploadSingle.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { ADMIN_ROLES } from '../users/user.constants.js';
import { bannerController } from './banner.controller.js';
import { bannerValidation } from './banner.validation.js';

const router: Router = Router();
const uploads = multer({ storage: multer.memoryStorage() });

router.post(
  '/',
  auth(...ADMIN_ROLES),
  uploads.single('image'),
  parseData(),
  uploadSingle('image'),
  validateRequest(bannerValidation.create),
  bannerController.createBanner,
);
router.patch(
  '/:id',
  auth(...ADMIN_ROLES),
  uploads.single('image'),
  parseData(),
  uploadSingle('image'),
  validateRequest(bannerValidation.update),
  bannerController.updateBanner,
);
router.delete('/:id', auth(...ADMIN_ROLES), bannerController.deleteBanner);
router.get('/homepage', bannerController.getHomepageBanners);
router.get('/:id', bannerController.getBannerById);
router.get('/', auth(...ADMIN_ROLES), bannerController.getAllBanner);

export const bannerRoutes = router;
