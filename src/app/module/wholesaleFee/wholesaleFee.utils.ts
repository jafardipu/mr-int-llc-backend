// No database or Stripe imports here: the auth middlewares use this file.

export const WHOLESALE_FEE_DUE_MESSAGE =
  'Pay the one-time wholesale account fee to start using your wholesale account';

/**
 * True for a wholesale account that has a fee record which is not paid.
 * Accounts with no record (created before the fee existed) never owe it.
 */
export const isWholesaleFeeDue = (user: {
  role: string;
  wholesaleFee?: { status: string } | null;
}) =>
  user.role === 'wholesale' &&
  !!user.wholesaleFee &&
  user.wholesaleFee.status !== 'paid';
