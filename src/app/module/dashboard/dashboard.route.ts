import { Router } from 'express';
import auth from '@app/middleware/auth.js';
import { ADMIN_ROLES } from '../users/user.constants.js';
import { dashboardController } from './dashboard.controller.js';

const router: Router = Router();

router.get('/overview', auth(...ADMIN_ROLES), dashboardController.getOverview);
router.get('/', auth(...ADMIN_ROLES), dashboardController.getOverview);

export const dashboardRoutes = router;
