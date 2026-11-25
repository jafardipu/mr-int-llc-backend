import { Router } from 'express';
import { faqController } from './faq.controller.js';
import auth from '@app/middleware/auth.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { ADMIN_ROLES } from '../users/user.constants.js';
import { faqValidation } from './faq.validation.js';

const router: Router = Router();

router.post(
  '/',
  auth(...ADMIN_ROLES),
  validateRequest(faqValidation.create),
  faqController.createFaq,
);
// Before '/:id' so "reorder" is not read as an id.
router.patch(
  '/reorder',
  auth(...ADMIN_ROLES),
  validateRequest(faqValidation.reorder),
  faqController.reorderFaqs,
);
router.patch(
  '/:id',
  auth(...ADMIN_ROLES),
  validateRequest(faqValidation.update),
  faqController.updateFaq,
);
router.delete('/:id', auth(...ADMIN_ROLES), faqController.deleteFaq);
router.get('/:id', faqController.getFaqById);
router.get('/', faqController.getAllFaq);

export const faqRoutes = router;
