import type { Role } from '../../../../generated/prisma/index.js';

type PriceSource = {
  retailPrice: number;
  wholesalePrice: number;
  wholesaleMinQty: number;
  isDeal: boolean;
  dealPrice: number | null;
};

export const resolveUnitPrice = (product: PriceSource, role?: string) => {
  if (product.isDeal && product.dealPrice != null) {
    return product.dealPrice;
  }
  if (role === 'wholesale') {
    return product.wholesalePrice;
  }
  return product.retailPrice;
};

export const withDisplayPrice = <T extends PriceSource>(
  product: T,
  role?: string,
) => {
  return {
    ...product,
    displayPrice: resolveUnitPrice(product, role),
    displayMinQty: role === 'wholesale' ? product.wholesaleMinQty : 1,
    isWholesale: role === 'wholesale',
  };
};

export const isCustomerRole = (role?: string): role is Role =>
  role === 'retail' || role === 'wholesale';
