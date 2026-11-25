import prisma from '@app/shared/prisma.js';

export type StorePrices = {
  shippingFee: number;
  taxRate: number;
  wholesaleAccountFee: number;
};

// Starting prices, written by startup (defaultTask) and the seed script when
// the contents record has none. Also the fallback if it is ever missing.
export const DEFAULT_PRICES: StorePrices = {
  shippingFee: 10,
  taxRate: 0,
  wholesaleAccountFee: 20,
};

/**
 * Current store prices from the contents record. Read on every use (no
 * cache) so an admin change applies to the next checkout straight away.
 */
export const getPricing = async (): Promise<StorePrices> => {
  const contents = await prisma.contents.findFirst({ select: { prices: true } });
  return { ...DEFAULT_PRICES, ...(contents?.prices ?? {}) };
};
