 
import httpStatus from 'http-status';
import prisma from '@app/shared/prisma.js';
import AppError from '@app/error/AppError.js';
import { resolveUnitPrice, withDisplayPrice } from '../product/product.utils.js';

const getOrCreateCart = async (userId: string) => {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId } });
};

const getCart = async (userId: string, role?: string) => {
  const cart = await getOrCreateCart(userId);
  const fullCart = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: {
      items: {
        include: {
          product: {
            include: { images: true, brand: true, category: true },
          },
        },
      },
    },
  });

  const items = (fullCart?.items || []).map(item => {
    const product = withDisplayPrice(item.product, role);
    const unitPrice = resolveUnitPrice(item.product, role);
    return {
      ...item,
      product,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    ...fullCart,
    items,
    subtotal,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
};

const addToCart = async (
  userId: string,
  payload: { productId: string; quantity: number },
  role?: string,
) => {
  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
  });
  if (!product || product.isDeleted || product.status !== 'active') {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  const quantity = Number(payload.quantity) || 1;
  const minQty = role === 'wholesale' ? product.wholesaleMinQty : 1;
  if (quantity < minQty) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Minimum quantity for this product is ${minQty}`,
    );
  }
  if (quantity > product.stock) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Insufficient stock');
  }

  const cart = await getOrCreateCart(userId);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: product.id } },
  });

  const nextQty = existing ? existing.quantity + quantity : quantity;
  if (nextQty > product.stock) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Insufficient stock');
  }

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: nextQty },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity },
    });
  }

  return getCart(userId, role);
};

const updateCartItem = async (
  userId: string,
  itemId: string,
  quantity: number,
  role?: string,
) => {
  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { cart: true, product: true },
  });
  if (!item || item.cart.userId !== userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart item not found');
  }

  const minQty = role === 'wholesale' ? item.product.wholesaleMinQty : 1;
  if (quantity < minQty) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Minimum quantity for this product is ${minQty}`,
    );
  }
  if (quantity > item.product.stock) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Insufficient stock');
  }

  await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity },
  });

  return getCart(userId, role);
};

const removeCartItem = async (userId: string, itemId: string, role?: string) => {
  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { cart: true },
  });
  if (!item || item.cart.userId !== userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart item not found');
  }

  await prisma.cartItem.delete({ where: { id: itemId } });
  return getCart(userId, role);
};

export const cartService = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
};
