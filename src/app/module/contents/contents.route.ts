import { Router } from 'express';
import { contentController } from './content.controller.js';
import auth from '@app/middleware/auth.js';
import { ADMIN_ROLES } from '../users/user.constants.js';

const router: Router = Router();

router.patch('/', auth(...ADMIN_ROLES), contentController.updateContents);
router.get('/', contentController.getContents);

export const contentsRoutes = router;
