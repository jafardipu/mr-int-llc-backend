import { Router } from 'express';
import optionalAuth from '@app/middleware/optionalAuth.js';
import auth from '@app/middleware/auth.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { ADMIN_ROLES } from '../users/user.constants.js';
import { contactController } from './contact.controller.js';
import { contactValidation } from './contact.validation.js';

const router: Router = Router();

router.post(
  '/',
  optionalAuth,
  validateRequest(contactValidation.create),
  contactController.createContact,
);
router.get('/', auth(...ADMIN_ROLES), contactController.getAllContact);
router.get('/:id', auth(...ADMIN_ROLES), contactController.getContactById);
router.patch(
  '/:id/reply',
  auth(...ADMIN_ROLES),
  validateRequest(contactValidation.reply),
  contactController.replyContact,
);

export const contactRoutes = router;
