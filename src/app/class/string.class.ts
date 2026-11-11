import config from '@app/config/index.js';
import { Stripe as StripeType } from 'stripe';

interface IProducts {
  amount: number;
  name: string;
  quantity: number;
}

class StripeServices {
  private stripe() {
    return new StripeType(config.stripe.stripe_api_secret as string, {
      typescript: true,
    });
  }

  private handleError(error: unknown, message: string): never {
    if (error instanceof StripeType.errors.StripeError) {
      console.error('Stripe Error:', error.message);
      throw new Error(`Stripe Error: ${message} - ${error.message}`);
    } else if (error instanceof Error) {
      console.error('Error:', error.message);
      throw new Error(`${message} - ${error.message}`);
    } else {
      console.error('Unknown Error:', error);
      throw new Error(`${message} - An unknown error occurred.`);
    }
  }

  public async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string> = {},
    payment_method_types: string[] = ['card'],
  ) {
    try {
      return await this.stripe().paymentIntents.create({
        amount: Math.round(amount * 100),
        currency,
        payment_method_types,
        metadata,
      });
    } catch (error) {
      this.handleError(error, 'Error creating payment intent');
    }
  }

  public async retrievePaymentIntent(paymentIntentId: string) {
    try {
      return await this.stripe().paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.handleError(error, 'Error retrieving payment intent');
    }
  }

  public async refund(payment_intent: string, amount?: number) {
    try {
      if (amount) {
        return await this.stripe().refunds.create({
          payment_intent: payment_intent,
          amount: Math.round(amount),
        });
      }
      return await this.stripe().refunds.create({
        payment_intent: payment_intent,
      });
    } catch (error) {
      this.handleError(error, 'Error processing refund');
    }
  }

  public async getCheckoutSession(
    product: IProducts,
    success_url: string,
    cancel_url: string,
    customer: string = '',
    currency: string = 'usd',
    payment_method_types: Array<'card' | 'paypal' | 'ideal'> = ['card'],
  ) {
    try {
      if (!product?.name || !product?.amount || !product?.quantity) {
        throw new Error('Product details are incomplete.');
      }
      const stripe = this.stripe();

      return await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: product?.name,
              },
              unit_amount: parseFloat((product?.amount * 100).toFixed(2)),
            },
            quantity: product?.quantity,
          },
        ],
        success_url: success_url,
        cancel_url: cancel_url,
        mode: 'payment',
        customer,
        payment_method_types,
      });
    } catch (error) {
      this.handleError(error, 'Error creating checkout session');
    }
  }

  public async createCustomer(email: string, name: string) {
    try {
      const existing = await this.stripe().customers.list({
        email,
        limit: 1,
      });

      if (existing.data.length > 0) {
        return existing.data[0];
      }

      return await this.stripe().customers.create({
        email,
        name,
      });
    } catch (error) {
      this.handleError(error, 'customer creation failed');
    }
  }

  public async getCustomer(customerId: string) {
    try {
      return await this.stripe().customers.retrieve(customerId);
    } catch (error) {
      this.handleError(error, 'customer get failed');
    }
  }

  public getStripe() {
    return this.stripe();
  }
}

const StripeService = new StripeServices();
export default StripeService;
