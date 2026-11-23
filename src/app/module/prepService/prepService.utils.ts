import path from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  PREP_ALLOWED_EXTENSIONS,
  PREP_ALLOWED_MIME_TYPES,
} from './prepService.constants.js';

type FileInfo = { originalname: string; mimetype: string };

// Both the extension and the reported MIME type must be on the allow list.
export const isAllowedAttachment = (file: FileInfo) =>
  PREP_ALLOWED_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase()) &&
  PREP_ALLOWED_MIME_TYPES.includes(file.mimetype);

/**
 * Storage key for an attachment. A unique folder per file prevents overwrites,
 * and the last path segment keeps a cleaned-up version of the original file
 * name so dashboards can show it.
 */
export const buildAttachmentKey = (userId: string, originalName: string) => {
  const ext = path.extname(originalName).toLowerCase();
  const base =
    path
      .basename(originalName, path.extname(originalName))
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .slice(0, 80) || 'file';
  const unique = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  return `prep-services/${userId}/${unique}/${base}${ext}`;
};
