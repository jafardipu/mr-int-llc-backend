import { Router } from 'express';
import auth from '@app/middleware/auth.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { AUTH_ROLES, CUSTOMER_ROLES } from '../users/user.constants.js';
import { reviewController } from './review.controller.js';
import { reviewValidation } from './review.validation.js';

const router: Router = Router();

router.post(
  '/',
  auth(...CUSTOMER_ROLES),
  validateRequest(reviewValidation.create),
  reviewController.createReview,
);
router.delete('/:id', auth(...AUTH_ROLES), reviewController.deleteReview);
router.get('/:id', reviewController.getReviewById);
router.get('/', reviewController.getAllReview);

export const reviewRoutes = router;
