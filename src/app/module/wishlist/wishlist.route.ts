import { Router } from 'express';
import auth from '@app/middleware/auth.js';
import validateRequest from '@app/middleware/validateRequest.js';
import { CUSTOMER_ROLES } from '../users/user.constants.js';
import { wishlistController } from './wishlist.controller.js';
import { wishlistValidation } from './wishlist.validation.js';

const router: Router = Router();

router.post(
  '/',
  auth(...CUSTOMER_ROLES),
  validateRequest(wishlistValidation.create),
  wishlistController.addToWishlist,
);
router.delete('/:id', auth(...CUSTOMER_ROLES), wishlistController.removeFromWishlist);
router.get('/', auth(...CUSTOMER_ROLES), wishlistController.getMyWishlist);

export const wishlistRoutes = router;
