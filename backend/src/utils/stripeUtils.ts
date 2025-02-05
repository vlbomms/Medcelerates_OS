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

if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL is not defined');
}

if (!process.env.STRIPE_ONE_MONTH_PRICE_ID) {
  throw new Error('STRIPE_ONE_MONTH_PRICE_ID is not defined');
}

if (!process.env.STRIPE_THREE_MONTHS_PRICE_ID) {
  throw new Error('STRIPE_THREE_MONTHS_PRICE_ID is not defined');
}

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia'
});

// Define subscription prices
const SUBSCRIPTION_PRICES = {
  ONE_MONTH: process.env.STRIPE_ONE_MONTH_PRICE_ID,
  THREE_MONTHS: process.env.STRIPE_THREE_MONTHS_PRICE_ID
};

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

export const createOneTimePayment = async (
  userId: string, 
  paymentMethodId: string, 
  subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS'
) => {
  try {
    console.log('One-time Payment Process Started', { 
      userId, 
      paymentMethodId, 
      subscriptionLength,
      paymentMethodPrefix: paymentMethodId.slice(0, 5) 
    });

    // Validate Stripe price ID
    const priceId = SUBSCRIPTION_PRICES[subscriptionLength];
    if (!priceId || !priceId.startsWith('price_')) {
      console.error('Invalid Stripe Price ID', { 
        priceId, 
        expectedPrefix: 'price_' 
      });
      throw new Error(`Invalid Stripe Price ID for ${subscriptionLength} subscription`);
    }

    // Retrieve payment method details for additional validation
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    // Validate customer
    let customerId = await findOrCreateStripeCustomer(userId);

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

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
      throw priceError;
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

    // Calculate subscription end date
    const subscriptionEndDate = calculateSubscriptionEndDate(subscriptionLength);

    // Update user to paid member
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          isPaidMember: true,
          stripePaymentIntentId: paymentIntent.id,
          subscriptionType: 'ONE_TIME',
          subscriptionLength: subscriptionLength,
          subscriptionStartDate: new Date(),
          subscriptionEndDate: subscriptionEndDate
        } as Prisma.UserUpdateInput
      });
      console.log('User updated to paid member', { 
        userId,
        paymentIntentId: paymentIntent.id,
        subscriptionEndDate 
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

// Helper function to calculate subscription end date
const calculateSubscriptionEndDate = (subscriptionLength: string): Date => {
  const now = new Date();
  switch (subscriptionLength) {
    case 'ONE_MONTH':
      return new Date(now.setMonth(now.getMonth() + 1));
    case 'THREE_MONTHS':
      return new Date(now.setMonth(now.getMonth() + 3));
    default:
      throw new Error('Invalid subscription length');
  }
};

// Helper function to find or create Stripe customer
const findOrCreateStripeCustomer = async (userId: string): Promise<string> => {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  }) as UserWithStripeCustomerId;

  if (!user) {
    console.error('User not found', { userId });
    throw new Error('User not found');
  }

  // If user already has a Stripe customer ID, return it
  if (user.stripeCustomerId) {
    console.log('Using existing Stripe customer ID', { customerId: user.stripeCustomerId });
    return user.stripeCustomerId;
  }

  // Create Stripe customer
  try {
    console.log('Creating new Stripe customer', { 
      email: user.email 
    });
    const customer = await stripe.customers.create({
      email: user.email || undefined,
    });
    const customerId = customer.id;

    // Update user with new Stripe customer ID
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId } as UserUpdateInputWithStripeCustomerId
    });
    console.log('New Stripe customer created and user updated', { 
      customerId, 
      userId 
    });

    return customerId;
  } catch (customerError) {
    console.error('Error creating/retrieving Stripe customer', { 
      userId, 
      email: user.email, 
      error: customerError 
    });
    throw customerError;
  }
};

export const renewSubscription = async (
  userId: string, 
  paymentMethodId: string,
  subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS'
) => {
  try {
    // Find user's current subscription details
    const user = await prisma.user.findUnique({ 
      where: { id: userId } 
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user can renew
    if (!user.subscriptionEndDate || user.subscriptionEndDate < new Date()) {
      // Subscription has expired or is about to expire
      const paymentIntent = await createOneTimePayment(
        userId, 
        paymentMethodId, 
        subscriptionLength
      );

      return paymentIntent;
    } else {
      throw new Error('Subscription is still active');
    }
  } catch (error) {
    console.error('Subscription Renewal Error:', error);
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