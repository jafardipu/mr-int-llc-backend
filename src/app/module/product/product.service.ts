/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import type { Prisma } from '../../../../generated/prisma/index.js';
import { ProductStatus } from '../../../../generated/prisma/index.js';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import pickQuery from '@app/utils/pickQuery.js';
import { paginationHelper } from '@app/helpers/pagination.helpers.js';
import { withDisplayPrice } from './product.utils.js';

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
  if (data.subcategory === '') data.subcategory = null;

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

  return {
    data: data.map(item => withDisplayPrice(item, role)),
    meta: { page, limit, total },
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

  return withDisplayPrice(result, role);
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
  if (data.subcategory === '') data.subcategory = null;

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
  getProductById,
  updateProduct,
  deleteProduct,
};
