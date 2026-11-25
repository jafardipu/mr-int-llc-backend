import { Router } from 'express';
import { contentController } from './content.controller.js';
import auth from '@app/middleware/auth.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { ADMIN_ROLES } from '../users/user.constants.js';
import { contentValidation } from './content.validation.js';

const router: Router = Router();

router.patch(
  '/',
  auth(...ADMIN_ROLES),
  validateRequest(contentValidation.update),
  contentController.updateContents,
);
router.get('/', contentController.getContents);

export const contentsRoutes = router;
