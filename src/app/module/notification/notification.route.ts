import { Router } from 'express';
import { notificationController } from './notification.controller.js';
import { authAllowUnpaidFee } from '@app/middleware/auth.js';
import { AUTH_ROLES } from '../users/user.constants.js';

const router: Router = Router();

// Open to a wholesale account that still owes its fee: the "account
// activated" notification arrives here.
router.patch('/', authAllowUnpaidFee(...AUTH_ROLES), notificationController.readNotification);
router.delete('/', authAllowUnpaidFee(...AUTH_ROLES), notificationController.deleteNotification);
router.get('/', authAllowUnpaidFee(...AUTH_ROLES), notificationController.getNotification);

export const notificationRoutes = router;
