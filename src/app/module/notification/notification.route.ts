import { Router } from 'express';
import { notificationController } from './notification.controller.js';
import auth from '@app/middleware/auth.js';
import { AUTH_ROLES } from '../users/user.constants.js';

const router: Router = Router();

router.patch('/', auth(...AUTH_ROLES), notificationController.readNotification);
router.delete('/', auth(...AUTH_ROLES), notificationController.deleteNotification);
router.get('/', auth(...AUTH_ROLES), notificationController.getNotification);

export const notificationRoutes = router;
