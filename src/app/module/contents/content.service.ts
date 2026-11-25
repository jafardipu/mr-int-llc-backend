/* eslint-disable @typescript-eslint/no-explicit-any */
import AppError from '@app/error/AppError.js';
import prisma from '@app/shared/prisma.js';
import httpStatus from 'http-status';
import { PAYMENT_STATUS } from '../../../../generated/prisma/index.js';
import { DEFAULT_PRICES, type StorePrices } from './content.pricing.js';

const roundMoney = (value: number) => Math.round(value * 100) / 100;

// The price fields an admin may send; anything else in `prices` is ignored.
const pickPrices = (prices: Record<string, any>) => {
  const picked: Partial<StorePrices> = {};
  if (typeof prices.shippingFee === 'number') picked.shippingFee = roundMoney(prices.shippingFee);
  if (typeof prices.taxRate === 'number') picked.taxRate = prices.taxRate;
  if (typeof prices.wholesaleAccountFee === 'number') {
    picked.wholesaleAccountFee = roundMoney(prices.wholesaleAccountFee);
  }
  return picked;
};

const updateContents = async (payload: Record<string, any>) => {
  const contents = await prisma.contents.findFirst({ where: {} });
  if (!contents)
    throw new AppError(httpStatus.BAD_REQUEST, 'initial contents not found ');

  // Partial price updates keep the other prices as they are.
  const { prices, ...rest } = payload;
  const nextPrices: StorePrices | null =
    prices && typeof prices === 'object'
      ? { ...DEFAULT_PRICES, ...(contents.prices ?? {}), ...pickPrices(prices) }
      : null;

  const result = await prisma.contents.update({
    where: { id: contents.id },
    data: { ...rest, ...(nextPrices ? { prices: { set: nextPrices } } : {}) },
  });

  if (!result)
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to update contents');

  // Turning the wholesale fee off frees accounts that have not paid yet.
  if (nextPrices?.wholesaleAccountFee === 0) {
    await prisma.wholesaleFee.deleteMany({
      where: { status: { not: PAYMENT_STATUS.paid } },
    });
  }

  return result;
};

const getContents = async (query: Record<string, any>) => {
  const record = await prisma.contents.findFirst();
  const result = record
    ? { ...record, prices: record.prices ?? DEFAULT_PRICES }
    : null;

  if (!query?.key) {
    return result;
  }

  const key = query.key as keyof NonNullable<typeof result>;
  return result ? { [key]: result[key] } : { [key]: null };
};

export const contentsService = {
  getContents,
  updateContents,
};
