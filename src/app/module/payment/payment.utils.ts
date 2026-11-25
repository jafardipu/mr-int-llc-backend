import prisma from '@app/shared/prisma.js';
import StripeService from '@app/class/string.class.js';

// Stripe's minimum charge for USD card payments.
export const MIN_CARD_AMOUNT_CENTS = 50;

export const toCents = (amount: number) => Math.round(amount * 100);

export const isCheckoutSessionId = (id?: string | null): id is string =>
  typeof id === 'string' && id.startsWith('cs_');

/** The user's Stripe customer id, created (and saved on the user) the first time. */
export const ensureStripeCustomer = async (user: {
  id: string;
  email: string;
  name?: string | null;
  customerId?: string | null;
}) => {
  if (user.customerId) return user.customerId;

  const customer = await StripeService.createCustomer(
    user.email,
    user.name || 'Customer',
  );
  if (customer?.id) {
    await prisma.user.update({
      where: { id: user.id },
      data: { customerId: customer.id },
    });
  }
  return customer?.id ?? null;
};
