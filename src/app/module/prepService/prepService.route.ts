import { Router } from 'express';
import multer from 'multer';
import httpStatus from 'http-status';
import auth from '@app/middleware/auth.js';
import validateRequest from '@app/middleware/validateRequest.js';
import AppError from '@app/error/AppError.js';
import { ADMIN_ROLES, AUTH_ROLES, CUSTOMER_ROLES } from '../users/user.constants.js';
import { prepServiceController } from './prepService.controller.js';
import { prepServiceValidation } from './prepService.validation.js';
import {
  PREP_ALLOWED_TYPES_LABEL,
  PREP_ATTACHMENT_FIELD,
  PREP_MAX_ATTACHMENTS,
  PREP_MAX_FILE_SIZE_MB,
} from './prepService.constants.js';
import { isAllowedAttachment } from './prepService.utils.js';

const router: Router = Router();

// Files are checked here, before anything is uploaded to storage.
const uploadAttachments = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PREP_MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedAttachment(file)) return cb(null, true);
    cb(
      new AppError(
        httpStatus.BAD_REQUEST,
        `${file.originalname}: only ${PREP_ALLOWED_TYPES_LABEL} files are allowed`,
      ),
    );
  },
}).array(PREP_ATTACHMENT_FIELD, PREP_MAX_ATTACHMENTS);

// Customer
router.post(
  '/',
  auth(...CUSTOMER_ROLES),
  uploadAttachments,
  prepServiceController.createPrepService,
);
router.patch(
  '/:id/resubmit',
  auth(...CUSTOMER_ROLES),
  uploadAttachments,
  prepServiceController.resubmitPrepService,
);
router.get('/my', auth(...CUSTOMER_ROLES), prepServiceController.getMyPrepServices);

// Admin
router.patch(
  '/:id/status',
  auth(...ADMIN_ROLES),
  validateRequest(prepServiceValidation.review),
  prepServiceController.reviewPrepService,
);
router.get('/', auth(...ADMIN_ROLES), prepServiceController.getAllPrepServices);

// Owner or admin
router.get('/:id', auth(...AUTH_ROLES), prepServiceController.getPrepServiceById);

export const prepServiceRoutes = router;
