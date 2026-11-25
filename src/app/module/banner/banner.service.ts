/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import type { BannerTarget, Prisma } from '../../../../generated/prisma/index.js';
import { bannerRuleIssues, BANNER_TARGET_TYPES } from './banner.validation.js';
import { liveBannerTarget } from './banner.discount.js';

export const bannerInclude = {
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      retailPrice: true,
      status: true,
      isDeleted: true,
      images: { select: { id: true, url: true, isPrimary: true } },
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      status: true,
      isDeleted: true,
      _count: { select: { products: { where: { isDeleted: false } } } },
    },
  },
} satisfies Prisma.BannerInclude;

// The banner fields this service writes. `undefined` means "not provided".
type BannerFields = {
  image?: string;
  targetType?: BannerTarget;
  productId?: string | null;
  categoryId?: string | null;
  discountPercent?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  link?: string | null;
  isActive?: boolean;
};

const nullableDate = (value: unknown) =>
  value === null || value === '' ? null : new Date(value as string);

const toBoolean = (value: unknown) =>
  value === true || value === 'true' ? true : value === false || value === 'false' ? false : undefined;

/**
 * validateRequest checks the body but leaves req.body as sent, so read only
 * the known fields and convert their types here.
 */
const pickBannerFields = (payload: Record<string, any>): BannerFields => {
  const fields: BannerFields = {};
  if (typeof payload.image === 'string') fields.image = payload.image;
  if (BANNER_TARGET_TYPES.includes(payload.targetType)) {
    fields.targetType = payload.targetType as BannerTarget;
  }
  if (payload.productId !== undefined) fields.productId = payload.productId || null;
  if (payload.categoryId !== undefined) fields.categoryId = payload.categoryId || null;
  if (payload.discountPercent !== undefined) {
    fields.discountPercent =
      payload.discountPercent === null || payload.discountPercent === ''
        ? null
        : Number(payload.discountPercent);
  }
  if (payload.startDate !== undefined) fields.startDate = nullableDate(payload.startDate);
  if (payload.endDate !== undefined) fields.endDate = nullableDate(payload.endDate);
  if (payload.link !== undefined) fields.link = payload.link || null;
  const isActive = toBoolean(payload.isActive);
  if (isActive !== undefined) fields.isActive = isActive;
  return fields;
};

/** Keep only the id that matches the target; a discount needs dates and vice versa. */
const normalize = (banner: BannerFields): BannerFields => {
  const next = { ...banner };
  if (next.targetType === 'product') next.categoryId = null;
  if (next.targetType === 'category') next.productId = null;
  if (next.targetType) next.link = null;
  if (next.discountPercent == null) {
    next.discountPercent = null;
    next.startDate = null;
    next.endDate = null;
  }
  return next;
};

const assertRules = (banner: BannerFields) => {
  const [issue] = bannerRuleIssues(banner);
  if (issue) throw new AppError(httpStatus.BAD_REQUEST, issue.message);
};

const assertTargetExists = async (banner: BannerFields) => {
  if (banner.targetType === 'product' && banner.productId) {
    const product = await prisma.product.findFirst({
      where: { id: banner.productId, isDeleted: false },
      select: { id: true },
    });
    if (!product) throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }
  if (banner.targetType === 'category' && banner.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: banner.categoryId, isDeleted: false },
      select: { id: true },
    });
    if (!category) throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
  }
};

// Drops keys left undefined so Prisma does not see them.
const toData = (banner: BannerFields) =>
  Object.fromEntries(
    Object.entries(banner).filter(([, value]) => value !== undefined),
  );

const createBanner = async (payload: Record<string, any>) => {
  const banner = normalize(pickBannerFields(payload));
  assertRules(banner);
  await assertTargetExists(banner);

  const result = await prisma.banner.create({
    data: toData(banner) as Prisma.BannerUncheckedCreateInput,
    include: bannerInclude,
  });
  if (!result) throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create banner');
  return result;
};

const getAllBanner = async (query: Record<string, any>, publicOnly = false) => {
  query.isDeleted = false;
  if (publicOnly) query.isActive = true;
  const { filters, pagination } = await pickQuery(query);
  const { searchTerm, ...filtersData } = filters;
  const and: Prisma.BannerWhereInput[] = [];

  if (searchTerm) {
    const contains = { contains: String(searchTerm), mode: 'insensitive' as const };
    and.push({
      OR: [
        { link: contains },
        { product: { is: { name: contains } } },
        { category: { is: { name: contains } } },
      ],
    });
  }
  if (Object.keys(filtersData).length > 0) {
    and.push(
      ...Object.entries(filtersData).map(([key, value]) => ({
        [key]: {
          equals: value === 'true' ? true : value === 'false' ? false : value,
        },
      })),
    );
  }

  if (publicOnly) {
    const now = new Date();
    // Old banners don't have the new fields at all, and `null` does not
    // match a missing field, so each "none" check covers both.
    and.push(
      {
        OR: [
          { discountPercent: null },
          { discountPercent: { isSet: false } },
          { startDate: { lte: now }, endDate: { gte: now } },
        ],
      },
      {
        OR: [
          liveBannerTarget,
          { targetType: null },
          { targetType: { isSet: false } },
        ],
      },
    );
  }

  const where: Prisma.BannerWhereInput = and.length ? { AND: and } : {};

  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);
  const orderBy: Prisma.BannerOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'desc' }];

  const data = await prisma.banner.findMany({
    where,
    skip,
    take: limit,
    orderBy,
    include: bannerInclude,
  });
  const total = await prisma.banner.count({ where });
  return { data, meta: { page, limit, total } };
};

const getBannerById = async (id: string) => {
  const result = await prisma.banner.findUnique({
    where: { id },
    include: bannerInclude,
  });
  if (!result || result.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Banner not found');
  return result;
};

const updateBanner = async (id: string, payload: Record<string, any>) => {
  const existing = await getBannerById(id);
  const changes = pickBannerFields(payload);

  const merged = normalize({
    ...(existing.targetType ? { targetType: existing.targetType } : {}),
    productId: existing.productId,
    categoryId: existing.categoryId,
    discountPercent: existing.discountPercent,
    startDate: existing.startDate,
    endDate: existing.endDate,
    link: existing.link,
    ...changes,
  });
  assertRules(merged);

  // Check the target when the request sets one, so a quick change such as
  // hiding the banner still works after its product was deleted.
  const touchesTarget = ['targetType', 'productId', 'categoryId'].some(
    key => payload[key] !== undefined,
  );
  if (touchesTarget) await assertTargetExists(merged);

  return prisma.banner.update({
    where: { id },
    data: toData(merged) as Prisma.BannerUncheckedUpdateInput,
    include: bannerInclude,
  });
};

const deleteBanner = async (id: string) => {
  await getBannerById(id);
  return prisma.banner.update({
    where: { id },
    data: { isDeleted: true, isActive: false },
    include: bannerInclude,
  });
};

export const bannerService = {
  createBanner,
  getAllBanner,
  getBannerById,
  updateBanner,
  deleteBanner,
};
