import prisma from '@app/shared/prisma.js';
import type { Prisma } from '../../../../generated/prisma/index.js';

export type ActiveDiscount = { percent: number; endsAt: Date; bannerId: string };
export type BannerDiscounts = {
  byProduct: Map<string, ActiveDiscount>;
  byCategory: Map<string, ActiveDiscount>;
};

/**
 * Where a banner's target is still live: an active, non-deleted product or
 * category. Banners with no target (legacy `link` banners) never match.
 * Shared with the homepage list so a discount runs exactly while its banner
 * can be shown.
 */
export const liveBannerTarget: Prisma.BannerWhereInput = {
  OR: [
    {
      targetType: 'product',
      product: { is: { isDeleted: false, status: 'active' } },
    },
    {
      targetType: 'category',
      category: { is: { isDeleted: false, status: 'active' } },
    },
  ],
};

const keepHigher = (
  map: Map<string, ActiveDiscount>,
  key: string,
  discount: ActiveDiscount,
) => {
  const current = map.get(key);
  if (!current || discount.percent > current.percent) map.set(key, discount);
};

/** One small query per request. No cache: checkout must see offers start/stop on time. */
export const getActiveBannerDiscounts = async (
  now = new Date(),
): Promise<BannerDiscounts> => {
  const banners = await prisma.banner.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      discountPercent: { gt: 0 },
      startDate: { lte: now },
      endDate: { gte: now },
      ...liveBannerTarget,
    },
    select: {
      id: true,
      targetType: true,
      productId: true,
      categoryId: true,
      discountPercent: true,
      endDate: true,
    },
  });

  const discounts: BannerDiscounts = { byProduct: new Map(), byCategory: new Map() };
  for (const banner of banners) {
    if (banner.discountPercent == null || banner.endDate == null) continue;
    const discount: ActiveDiscount = {
      percent: banner.discountPercent,
      endsAt: banner.endDate,
      bannerId: banner.id,
    };
    if (banner.targetType === 'product' && banner.productId) {
      keepHigher(discounts.byProduct, banner.productId, discount);
    } else if (banner.targetType === 'category' && banner.categoryId) {
      keepHigher(discounts.byCategory, banner.categoryId, discount);
    }
  }
  return discounts;
};

/** The best banner discount for a product (its own product banner vs its category banner), or null. */
export const bannerDiscountFor = (
  product: { id: string; categoryId: string },
  discounts: BannerDiscounts,
): ActiveDiscount | null => {
  const own = discounts.byProduct.get(product.id) ?? null;
  const viaCategory = discounts.byCategory.get(product.categoryId) ?? null;
  if (!own) return viaCategory;
  if (!viaCategory) return own;
  return viaCategory.percent > own.percent ? viaCategory : own;
};
