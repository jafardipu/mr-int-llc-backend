import { z } from 'zod';

export const BANNER_TARGET_TYPES = ['product', 'category'] as const;

// A malformed id would make Prisma throw instead of returning "not found".
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid id');

export type BannerRuleInput = {
  targetType?: string | null | undefined;
  productId?: string | null | undefined;
  categoryId?: string | null | undefined;
  discountPercent?: number | null | undefined;
  startDate?: Date | null | undefined;
  endDate?: Date | null | undefined;
};

/**
 * Cross-field rules. The create schema runs them on the request; update runs
 * them in the service on the existing banner merged with the changes.
 */
export const bannerRuleIssues = (banner: BannerRuleInput) => {
  const issues: { path: string; message: string }[] = [];

  if (banner.targetType === 'product' && !banner.productId) {
    issues.push({ path: 'productId', message: 'Select the product to promote' });
  }
  if (banner.targetType === 'category' && !banner.categoryId) {
    issues.push({ path: 'categoryId', message: 'Select the category to promote' });
  }

  if (banner.discountPercent != null) {
    if (!banner.targetType) {
      issues.push({
        path: 'targetType',
        message: 'Choose the product or category the discount applies to',
      });
    }
    if (!banner.startDate) {
      issues.push({ path: 'startDate', message: 'Start date is required for a discount' });
    }
    if (!banner.endDate) {
      issues.push({ path: 'endDate', message: 'End date is required for a discount' });
    }
    if (banner.startDate && banner.endDate && banner.endDate <= banner.startDate) {
      issues.push({ path: 'endDate', message: 'End date must be after the start date' });
    }
  }

  return issues;
};

const bannerFields = z.object({
  image: z.string().min(1, 'Image is required'),
  targetType: z.enum(BANNER_TARGET_TYPES, {
    error: 'Target must be product or category',
  }),
  productId: objectId.nullable().optional(),
  categoryId: objectId.nullable().optional(),
  discountPercent: z.coerce
    .number({ error: 'Discount must be a number' })
    .min(1, 'Discount must be at least 1%')
    .max(99, 'Discount cannot be more than 99%')
    .nullable()
    .optional(),
  startDate: z.coerce.date({ error: 'Start date is not a valid date' }).nullable().optional(),
  endDate: z.coerce.date({ error: 'End date is not a valid date' }).nullable().optional(),
  link: z.string().nullable().optional(),
  isActive: z.coerce.boolean().optional(),
});

const create = z.object({
  body: bannerFields.superRefine((banner, ctx) => {
    for (const issue of bannerRuleIssues(banner)) {
      ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
    }
  }),
});

const update = z.object({ body: bannerFields.partial() });

export const bannerValidation = { create, update };
