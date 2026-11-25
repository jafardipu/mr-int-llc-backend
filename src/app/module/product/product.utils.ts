import type { Role } from '../../../../generated/prisma/index.js';
import {
  bannerDiscountFor,
  type ActiveDiscount,
  type BannerDiscounts,
} from '../banner/banner.discount.js';

type PriceSource = {
  id: string;
  categoryId: string;
  retailPrice: number;
  wholesalePrice: number;
  wholesaleMinQty: number;
  isDeal: boolean;
  dealPrice: number | null;
};

/**
 * The price a customer pays. A banner discount comes off the customer's own
 * price (wholesale for wholesale users, retail for everyone else). With a deal
 * as well, the lower of the two wins; discounts never stack.
 */
export const resolvePrice = (
  product: PriceSource,
  role: string | undefined,
  discounts: BannerDiscounts,
): {
  unitPrice: number;
  originalPrice: number | null;
  discount: ActiveDiscount | null;
} => {
  const rolePrice =
    role === 'wholesale' ? product.wholesalePrice : product.retailPrice;
  const regular =
    product.isDeal && product.dealPrice != null ? product.dealPrice : rolePrice;

  const discount = bannerDiscountFor(product, discounts);
  if (discount) {
    // Same formula as the admin preview.
    const bannerPrice = Math.round(rolePrice * (100 - discount.percent)) / 100;
    if (bannerPrice < regular) {
      return { unitPrice: bannerPrice, originalPrice: rolePrice, discount };
    }
  }
  return { unitPrice: regular, originalPrice: null, discount: null };
};

export const resolveUnitPrice = (
  product: PriceSource,
  role: string | undefined,
  discounts: BannerDiscounts,
) => resolvePrice(product, role, discounts).unitPrice;

export const withDisplayPrice = <T extends PriceSource>(
  product: T,
  role: string | undefined,
  discounts: BannerDiscounts,
) => {
  const price = resolvePrice(product, role, discounts);
  return {
    ...product,
    displayPrice: price.unitPrice,
    originalPrice: price.originalPrice,
    bannerDiscount: price.discount,
    displayMinQty: role === 'wholesale' ? product.wholesaleMinQty : 1,
    isWholesale: role === 'wholesale',
  };
};

export const isCustomerRole = (role?: string): role is Role =>
  role === 'retail' || role === 'wholesale';
