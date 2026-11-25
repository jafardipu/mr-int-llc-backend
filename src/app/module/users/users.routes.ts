import parseData from '@app/middleware/parseData.js';
import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import { userController } from './user.controller.js';
import { ADMIN_ROLES, AUTH_ROLES, USER_ROLE } from './user.constants.js';
import auth, { authAllowUnpaidFee } from '@app/middleware/auth.js';

const router: Router = Router();
const storage = memoryStorage();
const upload = multer({ storage });

router.post(
  '/',
  upload.single('profile'),
  parseData(),
  userController.createUser,
);

router.patch(
  '/update-my-profile',
  authAllowUnpaidFee(...AUTH_ROLES),
  upload.single('profile'),
  parseData(),
  userController.updateMyProfile,
);

router.patch(
  '/:id/block',
  auth(...ADMIN_ROLES),
  userController.blockUser,
);

router.patch(
  '/:id',
  auth(...ADMIN_ROLES),
  upload.single('profile'),
  parseData(),
  userController.updateUser,
);

router.delete(
  '/delete-my-account',
  authAllowUnpaidFee(...AUTH_ROLES),
  userController.deleteMYAccount,
);

router.delete('/:id', auth(...ADMIN_ROLES), userController.deleteUser);

router.get('/my-profile', authAllowUnpaidFee(...AUTH_ROLES), userController.getMyProfile);

router.get('/:id', auth(...ADMIN_ROLES), userController.getUserById);

router.get('/', auth(USER_ROLE.admin, USER_ROLE.supper_admin), userController.getAllUser);

export const userRoutes = router;
