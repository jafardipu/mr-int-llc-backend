import { z } from 'zod';

const volumeTierSchema = z.object({
  minQty: z.coerce.number().int().positive(),
  maxQty: z.coerce.number().int().positive().optional().nullable(),
  discountPercent: z.coerce.number().min(0).max(100),
  unitPrice: z.coerce.number().positive(),
});

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().optional(),
  description: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  retailPrice: z.coerce.number().positive('Retail price must be greater than 0'),
  wholesalePrice: z.coerce
    .number()
    .positive('Wholesale price must be greater than 0'),
  wholesaleMinQty: z.coerce.number().int().positive().default(1),
  stock: z.coerce.number().int().nonnegative().default(0),
  brandId: z.string().min(1, 'Brand is required'),
  categoryId: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional().nullable(),
  asin: z.string().optional().nullable(),
  amazonUrl: z.string().url().optional().or(z.literal('')).nullable(),
  walmartUrl: z.string().url().optional().or(z.literal('')).nullable(),
  isDeal: z.coerce.boolean().optional(),
  dealPrice: z.coerce.number().positive().optional().nullable(),
  status: z.enum(['active', 'inactive', 'out_of_stock']).optional(),
  images: z.array(z.string()).optional(),
  keepImages: z.array(z.string()).optional(),
  volumeTiers: z.array(volumeTierSchema).optional(),
});

const create = z.object({
  body: productSchema,
});

const update = z.object({
  body: productSchema.partial(),
});

const productValidation = {
  create,
  update,
};
export default productValidation;
