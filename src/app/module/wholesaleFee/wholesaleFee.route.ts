import { Router } from 'express';
import { authAllowUnpaidFee } from '@app/middleware/auth.js';
import { USER_ROLE } from '../users/user.constants.js';
import { wholesaleFeeController } from './wholesaleFee.controller.js';

const router: Router = Router();

// Public: the fee amount, for the sign-up form.
router.get('/info', wholesaleFeeController.getFeeInfo);

// A wholesale account that still owes the fee must reach these.
router.get('/me', authAllowUnpaidFee(USER_ROLE.wholesale), wholesaleFeeController.getMyFee);
router.post(
  '/checkout',
  authAllowUnpaidFee(USER_ROLE.wholesale),
  wholesaleFeeController.createCheckout,
);
router.get(
  '/confirm',
  authAllowUnpaidFee(USER_ROLE.wholesale),
  wholesaleFeeController.confirmCheckout,
);

export const wholesaleFeeRoutes = router;
