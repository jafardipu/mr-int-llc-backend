/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import type { Prisma } from '../../../../generated/prisma/index.js';
import { ProductStatus } from '../../../../generated/prisma/index.js';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import { withDisplayPrice } from './product.utils.js';
import { getActiveBannerDiscounts } from '../banner/banner.discount.js';

const productInclude = {
  brand: true,
  category: true,
  images: true,
} satisfies Prisma.ProductInclude;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const collectImageUrls = (payload: any) => {
  const uploaded = Array.isArray(payload.images) ? payload.images : [];
  const kept = Array.isArray(payload.keepImages) ? payload.keepImages : [];
  return [...kept, ...uploaded].filter(
    (url): url is string => typeof url === 'string' && url.length > 0,
  );
};

const createProduct = async (payload: any) => {
  const { images, keepImages, volumeTiers, ...data } = payload;
  void images;
  void keepImages;

  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, isDeleted: false },
  });
  if (!category) throw new AppError(httpStatus.NOT_FOUND, 'Category not found');

  const brand = await prisma.brand.findFirst({
    where: { id: data.brandId, isDeleted: false },
  });
  if (!brand) throw new AppError(httpStatus.NOT_FOUND, 'Brand not found');

  const skuExists = await prisma.product.findFirst({ where: { sku: data.sku } });
  if (skuExists) throw new AppError(httpStatus.CONFLICT, 'SKU already exists');

  if (data.amazonUrl === '') data.amazonUrl = null;
  if (data.walmartUrl === '') data.walmartUrl = null;
  if (data.asin === '') data.asin = null;
  delete data.subcategory;

  const imageUrls = collectImageUrls(payload);

  const result = await prisma.product.create({
    data: {
      ...data,
      slug: data.slug || slugify(data.name),
      volumeTiers: volumeTiers ?? undefined,
      images: imageUrls.length
        ? {
            create: imageUrls.map((url: string, index: number) => ({
              url,
              isPrimary: index === 0,
            })),
          }
        : undefined,
    },
    include: productInclude,
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create product');
  }
  return result;
};

const getAllProduct = async (query: Record<string, any>, role?: string) => {
  const isAdmin = role === 'admin' || role === 'supper_admin';
  if (!isAdmin) {
    query.isDeleted = false;
    if (!query.status) query.status = ProductStatus.active;
  }

  const { filters, pagination } = await pickQuery(query);
  const {
    searchTerm,
    minPrice,
    maxPrice,
    deal,
    category,
    brand,
    ...filtersData
  } = filters;

  const where: Prisma.ProductWhereInput = {};

  if (searchTerm) {
    where.OR = ['name', 'sku', 'description'].map(field => ({
      [field]: { contains: searchTerm },
    }));
  }

  const andConditions: Prisma.ProductWhereInput[] = [];

  if (category || filtersData.categoryId) {
    andConditions.push({
      categoryId: (category || filtersData.categoryId) as string,
    });
    delete filtersData.categoryId;
  }
  if (brand || filtersData.brandId) {
    andConditions.push({ brandId: (brand || filtersData.brandId) as string });
    delete filtersData.brandId;
  }
  if (deal === 'true' || deal === true || filtersData.isDeal === 'true') {
    andConditions.push({ isDeal: true });
    delete filtersData.isDeal;
  }
  if (
    filtersData.isFeatured === 'true' ||
    filtersData.isFeatured === true ||
    filtersData.featured === 'true' ||
    filtersData.featured === true
  ) {
    andConditions.push({ isFeatured: true });
    delete filtersData.isFeatured;
    delete filtersData.featured;
  }

  const priceField = role === 'wholesale' ? 'wholesalePrice' : 'retailPrice';
  if (minPrice || maxPrice) {
    andConditions.push({
      [priceField]: {
        ...(minPrice ? { gte: Number(minPrice) } : {}),
        ...(maxPrice ? { lte: Number(maxPrice) } : {}),
      },
    });
  }

  if (Object.keys(filtersData).length > 0) {
    andConditions.push(
      ...Object.entries(filtersData).map(([key, value]) => ({
        [key]: {
          equals: value === 'true' ? true : value === 'false' ? false : value,
        },
      })),
    );
  }

  if (andConditions.length) {
    where.AND = andConditions;
  }

  const { page, limit, skip, sort } =
    paginationHelper.calculatePagination(pagination);
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = sort
    ? sort.split(',').map(field => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) return { [trimmed.slice(1)]: 'desc' };
        return { [trimmed]: 'asc' };
      })
    : [{ createdAt: 'desc' }];

  const data = await prisma.product.findMany({
    where,
    skip,
    take: limit,
    orderBy,
    include: productInclude,
  });
  const total = await prisma.product.count({ where });
  const discounts = await getActiveBannerDiscounts();

  return {
    data: data.map(item => withDisplayPrice(item, role, discounts)),
    meta: { page, limit, total },
  };
};

const getMostSoldProducts = async (
  take: number,
  excludeIds: string[] = [],
) => {
  if (take <= 0) return [];

  const sales = await prisma.orderItem.groupBy({
    by: ['productId'],
    ...(excludeIds.length
      ? { where: { productId: { notIn: excludeIds } } }
      : {}),
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: take * 3,
  });

  const soldIds = sales.map(row => row.productId);
  if (soldIds.length === 0) {
    return prisma.product.findMany({
      where: {
        isDeleted: false,
        status: ProductStatus.active,
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      take,
      orderBy: [{ createdAt: 'desc' }],
      include: productInclude,
    });
  }

  const products = await prisma.product.findMany({
    where: {
      id: { in: soldIds },
      isDeleted: false,
      status: ProductStatus.active,
    },
    include: productInclude,
  });

  const byId = new Map(products.map(product => [product.id, product]));
  const ordered = soldIds
    .map(id => byId.get(id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product))
    .slice(0, take);

  if (ordered.length >= take) return ordered;

  const more = await prisma.product.findMany({
    where: {
      isDeleted: false,
      status: ProductStatus.active,
      id: {
        notIn: [...excludeIds, ...ordered.map(product => product.id)],
      },
    },
    take: take - ordered.length,
    orderBy: [{ createdAt: 'desc' }],
    include: productInclude,
  });

  return [...ordered, ...more];
};

const getFeaturedProducts = async (
  query: Record<string, any> = {},
  role?: string,
) => {
  const target = Math.min(Math.max(Number(query.limit) || 8, 1), 24);
  const baseWhere: Prisma.ProductWhereInput = {
    isDeleted: false,
    status: ProductStatus.active,
  };

  const featured = await prisma.product.findMany({
    where: { ...baseWhere, isFeatured: true },
    take: target,
    orderBy: [{ createdAt: 'desc' }],
    include: productInclude,
  });

  const remaining = target - featured.length;
  const bestsellers =
    remaining > 0
      ? await getMostSoldProducts(
          remaining,
          featured.map(product => product.id),
        )
      : [];

  const combined = [...featured, ...bestsellers];
  const discounts = await getActiveBannerDiscounts();
  const source =
    featured.length === 0
      ? ('fallback' as const)
      : bestsellers.length > 0
        ? ('mixed' as const)
        : ('featured' as const);

  return {
    data: combined.map(item => withDisplayPrice(item, role, discounts)),
    meta: { page: 1, limit: target, total: combined.length },
    source,
  };
};

const getProductById = async (id: string, role?: string) => {
  const result = await prisma.product.findUnique({
    where: { id },
    include: {
      ...productInclude,
      reviews: {
        include: {
          user: { select: { id: true, name: true, profile: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!result || result.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found!');

  return withDisplayPrice(result, role, await getActiveBannerDiscounts());
};

const updateProduct = async (id: string, payload: any) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || existing.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found!');

  const { images, keepImages, volumeTiers, ...data } = payload;
  const imageUrls = collectImageUrls(payload);
  const replaceImages = Array.isArray(images) || Array.isArray(keepImages);

  if (data.sku && data.sku !== existing.sku) {
    const skuExists = await prisma.product.findFirst({
      where: { sku: data.sku, id: { not: id } },
    });
    if (skuExists) throw new AppError(httpStatus.CONFLICT, 'SKU already exists');
  }

  if (data.amazonUrl === '') data.amazonUrl = null;
  if (data.walmartUrl === '') data.walmartUrl = null;
  if (data.asin === '') data.asin = null;
  delete data.subcategory;

  if (replaceImages) {
    await prisma.productImage.deleteMany({ where: { productId: id } });
  }

  const result = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      ...(volumeTiers !== undefined ? { volumeTiers } : {}),
      ...(replaceImages
        ? {
            images: {
              create: imageUrls.map((url: string, index: number) => ({
                url,
                isPrimary: index === 0,
              })),
            },
          }
        : {}),
    },
    include: productInclude,
  });

  if (!result)
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to update Product');
  return result;
};

const deleteProduct = async (id: string) => {
  const result = await prisma.product.update({
    where: { id },
    data: { isDeleted: true },
  });
  if (!result)
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to delete product');
  return result;
};

export const productService = {
  createProduct,
  getAllProduct,
  getFeaturedProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
