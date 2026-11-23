// Multipart field name the customer uploads files under.
export const PREP_ATTACHMENT_FIELD = 'attachments';
export const PREP_MAX_ATTACHMENTS = 8;
export const PREP_MAX_FILE_SIZE_MB = 10;

export const PREP_ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf',
  '.csv',
  '.xls',
  '.xlsx',
];

// Windows browsers often report CSV files as application/vnd.ms-excel.
export const PREP_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const PREP_ALLOWED_TYPES_LABEL = 'JPG, PNG, WEBP, PDF, CSV, XLS and XLSX';

// Statuses an admin can move an `under_review` request to.
export const PREP_REVIEW_STATUSES = ['completed', 'correction_required'] as const;
