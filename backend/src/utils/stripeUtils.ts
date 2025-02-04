import Stripe from 'stripe';
import { PrismaClient, Prisma, User } from '@prisma/client';

// Extend User type to include stripeCustomerId
type UserWithStripeCustomerId = User & {
  stripeCustomerId?: string | null;
}

// Extend the UserUpdateInput type to include stripeCustomerId
type UserUpdateInputWithStripeCustomerId = Prisma.UserUpdateInput & {
  stripeCustomerId?: string | null;
};

// Ensure environment variables are set
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined');
}

if (!process.env.STRIPE_SUBSCRIPTION_PRICE_ID) {
  throw new Error('STRIPE_SUBSCRIPTION_PRICE_ID is not defined');
}

if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL is not defined');
}

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia'
});

export const createCheckoutSession = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { id: true, email: true, isPaidMember: true } 
    });
    
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isPaidMember) {
      throw new Error('User is already a paid member');
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/subscribe`,
      client_reference_id: userId,
      customer_email: user.email || undefined,
      metadata: {
        userId: userId,
      },
    });

    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

export const createOneTimePayment = async (userId: string, paymentMethodId: string) => {
  try {
    console.log('One-time Payment Process Started', { 
      userId, 
      paymentMethodId, 
      paymentMethodPrefix: paymentMethodId.slice(0, 5) 
    });

    // Validate payment method ID format
    if (!paymentMethodId || !paymentMethodId.startsWith('pm_')) {
      console.error('Invalid Payment Method ID format', { 
        paymentMethodId, 
        expectedPrefix: 'pm_' 
      });
      throw new Error('Invalid Payment Method ID. Must start with "pm_"');
    }

    // Validate Stripe price ID
    const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
    if (!priceId || !priceId.startsWith('price_')) {
      console.error('Invalid Stripe Price ID', { 
        priceId, 
        expectedPrefix: 'price_' 
      });
      throw new Error('Invalid Stripe Price ID. Must start with "price_"');
    }

    // Retrieve payment method details for additional validation
    let paymentMethodDetails;
    try {
      paymentMethodDetails = await stripe.paymentMethods.retrieve(paymentMethodId);
      console.log('Payment Method Retrieved', {
        id: paymentMethodDetails.id,
        type: paymentMethodDetails.type,
        cardBrand: paymentMethodDetails.card?.brand,
        cardLast4: paymentMethodDetails.card?.last4
      });
    } catch (retrieveError) {
      console.error('Failed to retrieve payment method', { 
        paymentMethodId, 
        error: retrieveError 
      });
      throw new Error('Invalid or non-existent Payment Method');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    }) as UserWithStripeCustomerId;

    if (!user) {
      console.error('User not found', { userId });
      throw new Error('User not found');
    }

    if (user.isPaidMember) {
      console.error('User is already a paid member', { userId });
      throw new Error('User is already a paid member');
    }

    let customerId: string;
    
    // Create or retrieve Stripe customer
    try {
      if (user.stripeCustomerId) {
        customerId = user.stripeCustomerId;
        console.log('Using existing Stripe customer ID', { customerId });
      } else {
        console.log('Creating new Stripe customer', { 
          email: user.email, 
          paymentMethodId 
        });
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          payment_method: paymentMethodId,
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        });
        customerId = customer.id;

        // Update user with new Stripe customer ID
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customerId } as UserUpdateInputWithStripeCustomerId
        });
        console.log('New Stripe customer created and user updated', { 
          customerId, 
          userId 
        });
      }
    } catch (customerError) {
      console.error('Error creating/retrieving Stripe customer', { 
        userId, 
        email: user.email, 
        error: customerError 
      });
      throw customerError;
    }

    // Attach payment method to customer if not already attached
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
      console.log('Payment method attached to customer', { 
        paymentMethodId, 
        customerId 
      });
    } catch (attachError) {
      console.error('Error attaching payment method', { 
        paymentMethodId, 
        customerId, 
        error: attachError 
      });
      throw attachError;
    }

    // Validate the price ID exists in Stripe
    let priceDetails;
    try {
      priceDetails = await stripe.prices.retrieve(priceId);
      console.log('Price ID validated', { 
        priceId, 
        productId: priceDetails.product, 
        unitAmount: priceDetails.unit_amount 
      });
    } catch (priceError) {
      console.error('Invalid Stripe Price ID', { priceId, error: priceError });
      throw new Error(`Invalid Stripe Price ID: ${priceId}. Please check your Stripe dashboard.`);
    }

    // Create one-time payment intent
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: priceDetails.unit_amount!, // Amount in cents
        currency: priceDetails.currency || 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
        payment_method_types: ['card']
      });
      console.log('Payment Intent created successfully', { 
        paymentIntentId: paymentIntent.id, 
        customerId, 
        amount: paymentIntent.amount 
      });
    } catch (paymentError) {
      console.error('Error creating Payment Intent', { 
        customerId, 
        priceId, 
        error: paymentError 
      });
      throw paymentError;
    }

    // Update user to paid member
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          isPaidMember: true,
          stripePaymentIntentId: paymentIntent.id
        } as Prisma.UserUpdateInput
      });
      console.log('User updated to paid member', { 
        userId, 
        paymentIntentId: paymentIntent.id 
      });
    } catch (updateError) {
      console.error('Error updating user to paid member', { 
        userId, 
        paymentIntentId: paymentIntent.id, 
        error: updateError 
      });
      throw updateError;
    }

    return paymentIntent;
  } catch (error) {
    console.error('Detailed One-time Payment Error:', error);
    throw error;
  }
};

export const handleStripeWebhook = async (event: Stripe.Event) => {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;

        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: { 
              isPaidMember: true,
              stripeCustomerId: session.customer as string
            } as UserUpdateInputWithStripeCustomerId
          });
          console.log(`User ${userId} became a paid member`);
        }
        break;
    
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        const deletedUserId = subscription.metadata.userId;

        if (deletedUserId) {
          await prisma.user.update({
            where: { id: deletedUserId },
            data: { 
              isPaidMember: false,
              stripeCustomerId: null 
            } as UserUpdateInputWithStripeCustomerId
          });
          console.log(`User ${deletedUserId} subscription cancelled`);
        }
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    console.error('Error handling Stripe webhook:', error);
    throw error;
  }
};