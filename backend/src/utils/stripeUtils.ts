import Stripe from 'stripe';
import { PrismaClient, Prisma, User } from '@prisma/client';

// Extend User type to include additional properties
interface UserWithStripeCustomerId extends Omit<User, 'stripeCustomerId'> {
  stripeCustomerId?: string | null;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
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

// Determine return URL with fallback
const getReturnUrl = () => {
  const stripReturnUrl = process.env.STRIPE_RETURN_URL;
  const frontendUrl = process.env.FRONTEND_URL;
  
  if (stripReturnUrl) return stripReturnUrl;
  if (frontendUrl) return `${frontendUrl}/payment/return`;
  
  throw new Error('No return URL configured for Stripe payments');
};

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

    const stripeCustomerId = await findOrCreateStripeCustomer(userId);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [
        {
          price: SUBSCRIPTION_PRICES.ONE_MONTH,
          quantity: 1,
        },
      ],
      success_url: `${getReturnUrl()}?payment=success`,
      cancel_url: `${getReturnUrl()}?payment=canceled`,
      client_reference_id: userId,
      customer_email: user.email || undefined,
      metadata: {
        userId: userId,
      },
    });

    return session;
  } catch (error) {
    console.error('Checkout Session Creation Error:', error);
    throw error;
  }
};

export const createOneTimePayment = async (
  userId: string, 
  paymentMethodId: string, 
  subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS',
  isExistingPaidMember: boolean = false
) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const stripeCustomerId = await findOrCreateStripeCustomer(userId);

    // Create payment intent with explicit metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount: subscriptionLength === 'ONE_MONTH' ? 2000 : 5000, // $20 for one month, $50 for three months
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      
      // Add return URL configuration
      return_url: getReturnUrl(),
      
      // Configure automatic payment methods
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'  // Prevent redirect-based payment methods
      },
      
      confirm: true,
      metadata: {
        userId: userId,
        type: 'ONE_TIME', // Explicitly set subscription type
        subscriptionLength: subscriptionLength, // Include subscription length
        isExistingPaidMember: isExistingPaidMember.toString() // Convert to string for metadata
      }
    });

    // Optional: Update user with payment method and subscription details
    if (paymentIntent.payment_method) {
      const subscriptionStartDate = new Date();
      const subscriptionEndDate = calculateSubscriptionEndDate(subscriptionLength);

      await prisma.user.update({
        where: { id: userId },
        data: { 
          // Explicitly set paid membership status
          isPaidMember: true,
          // Clear trial dates
          trialStartDate: null,
          trialEndDate: null,
          // Set subscription dates
          subscriptionStartDate,
          subscriptionEndDate,
          // Set subscription type
          subscriptionType: 'ONE_TIME',
          // Set subscription length
          subscriptionLength: subscriptionLength as 'ONE_MONTH' | 'THREE_MONTHS',
          // Update payment-related fields
          stripePaymentIntentId: paymentIntent.id,
          lastSubscriptionUpdateDate: new Date()
        }
      });

      console.log(`User ${userId} subscription updated directly`, {
        subscriptionStartDate,
        subscriptionEndDate,
        subscriptionType: 'ONE_TIME'
      });
    }

    return {
      paymentIntent,
      subscriptionEndDate: calculateSubscriptionEndDate(subscriptionLength)
    };

  } catch (error) {
    console.error('One-Time Payment Error:', error);
    throw error;
  }
};

export const renewSubscription = async (
  userId: string, 
  paymentMethodId: string,
  subscriptionLength: 'ONE_MONTH' | 'THREE_MONTHS'
) => {
  try {
    console.log('Renewing subscription:', { 
      userId, 
      paymentMethodId, 
      subscriptionLength,
      timestamp: new Date().toISOString()
    });

    // Validate input
    if (!userId || !paymentMethodId || !subscriptionLength) {
      throw new Error('Missing required parameters');
    }

    // Retrieve user with full subscription details
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { 
        id: true, 
        email: true, 
        stripeCustomerId: true,
        subscriptionEndDate: true,
        subscriptionStartDate: true,  // Add this line
        isPaidMember: true,
        lastSubscriptionEndDate: true,
        trialStartDate: true,
        trialEndDate: true
      } 
    });

    if (!user) {
      console.error('User not found for subscription renewal:', userId);
      throw new Error('User not found');
    }

    // Detailed logging of current user subscription state
    console.log('Current User Subscription State:', {
      isPaidMember: user.isPaidMember,
      subscriptionEndDate: user.subscriptionEndDate,
      lastSubscriptionEndDate: user.lastSubscriptionEndDate,
      trialStartDate: user.trialStartDate,
      trialEndDate: user.trialEndDate
    });

    // Determine the new subscription start and end dates
    const currentDate = new Date();
    const currentSubscriptionEndDate = user.subscriptionEndDate || currentDate;
    
    // Logging date calculations
    console.log('Date Calculations:', {
      currentDate,
      currentSubscriptionEndDate,
      isCurrentSubscriptionActive: currentSubscriptionEndDate > currentDate
    });

    // If current subscription is still active, extend from the current end date
    // Otherwise, start a new subscription from today
    const subscriptionStartDate = currentSubscriptionEndDate > currentDate 
      ? currentSubscriptionEndDate 
      : currentDate;
    
    const subscriptionEndDate = calculateSubscriptionEndDate(
      subscriptionLength, 
      subscriptionStartDate
    );

    // Logging new subscription dates
    console.log('New Subscription Dates:', {
      subscriptionStartDate,
      subscriptionEndDate
    });

    // Ensure Stripe customer exists
    const stripeCustomerId = user.stripeCustomerId || 
      await findOrCreateStripeCustomer(userId);

    // Calculate amount based on subscription length
    const amount = subscriptionLength === 'ONE_MONTH' ? 2000 : 5000; // Amount in cents

    // Create Payment Intent with explicit configuration
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      
      // Explicitly handle return URL and payment method redirects
      return_url: getReturnUrl(),
      
      // Configure automatic payment methods
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'  // Prevent redirect-based payment methods
      },
      
      // Confirm the payment immediately
      confirm: true,
      
      // Add metadata for tracking
      metadata: {
        userId,
        subscriptionLength,
        type: 'subscription_renewal',
        previousSubscriptionEndDate: currentSubscriptionEndDate.toISOString()
      }
    });

    // Update user's subscription details
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        // Ensure paid membership status
        isPaidMember: true,
        
        // Always use the existing start date, only update end date
        subscriptionStartDate: {
          set: user.subscriptionStartDate || subscriptionStartDate
        },
        subscriptionEndDate: {
          set: subscriptionEndDate
        },
        
        // Track last subscription details
        lastSubscriptionEndDate: user.subscriptionEndDate,
        lastRenewalDate: currentDate,
        
        // Update payment-related fields
        stripePaymentIntentId: paymentIntent.id,
        lastSubscriptionUpdateDate: currentDate,
        
        // Optional: Clear trial dates if still present
        trialStartDate: null,
        trialEndDate: null
      },
      select: {
        id: true,
        email: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        lastSubscriptionEndDate: true
      }
    });

    console.log('Subscription Renewal Result:', {
      userId: updatedUser.id,
      email: updatedUser.email,
      subscriptionStartDate: updatedUser.subscriptionStartDate,
      subscriptionEndDate: updatedUser.subscriptionEndDate,
      lastSubscriptionEndDate: updatedUser.lastSubscriptionEndDate
    });

    return {
      paymentIntent,
      subscriptionStartDate,
      subscriptionEndDate
    };

  } catch (error) {
    console.error('Comprehensive Subscription Renewal Error:', {
      userId,
      subscriptionLength,
      errorName: error instanceof Error ? error.name : 'Unknown Error',
      errorMessage: error instanceof Error ? error.message : 'Unknown Error',
      errorStack: error instanceof Error ? error.stack : 'No stack trace'
    });
    throw error;
  }
};

export const handleStripeWebhook = async (event: Stripe.Event) => {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId as string;

        if (userId) {
          const subscriptionStartDate = new Date();
          const subscriptionLength = session.metadata?.subscriptionLength || 'ONE_MONTH';
          const subscriptionEndDate = calculateSubscriptionEndDate(subscriptionLength);

          await prisma.user.update({
            where: { id: userId },
            data: { 
              // Explicitly set paid membership status
              isPaidMember: true,
              // Clear trial dates
              trialStartDate: null,
              trialEndDate: null,
              // Set subscription dates
              subscriptionStartDate,
              subscriptionEndDate,
              // Set subscription type
              subscriptionType: 'ONE_TIME',
              // Remove any existing trial-related flags
              subscriptionLength: subscriptionLength as 'ONE_MONTH' | 'THREE_MONTHS',
              // Track last update
              lastSubscriptionUpdateDate: new Date()
            }
          });

          console.log(`User ${userId} became a paid member via checkout session`, {
            subscriptionStartDate,
            subscriptionEndDate,
            subscriptionType: 'ONE_TIME'
          });
        }
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const paymentUserId = paymentIntent.metadata?.userId;
        const paymentSubscriptionLength = 
          paymentIntent.metadata?.subscriptionLength === 'THREE_MONTHS' 
            ? 'THREE_MONTHS' 
            : 'ONE_MONTH';

        if (paymentUserId) {
          const subscriptionStartDate = new Date();
          const subscriptionEndDate = calculateSubscriptionEndDate(paymentSubscriptionLength);

          await prisma.user.update({
            where: { id: paymentUserId },
            data: { 
              // Explicitly set paid membership status
              isPaidMember: true,
              // Clear trial dates
              trialStartDate: null,
              trialEndDate: null,
              // Set subscription dates
              subscriptionStartDate,
              subscriptionEndDate,
              // Set subscription type with string value
              subscriptionType: 'ONE_TIME',
              // Set subscription length
              subscriptionLength: paymentSubscriptionLength,
              // Track last update
              lastSubscriptionUpdateDate: new Date()
            }
          });

          console.log(`User ${paymentUserId} subscription updated via payment intent`, {
            subscriptionStartDate,
            subscriptionEndDate,
            subscriptionType: 'ONE_TIME',
            subscriptionLength: paymentSubscriptionLength
          });
        }
        break;
    
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        const deletedUserId = subscription.metadata.userId;

        if (deletedUserId) {
          await prisma.user.update({
            where: { id: deletedUserId },
            data: { 
              // Reset membership status
              isPaidMember: false,
              stripeCustomerId: null,
              // Clear subscription dates
              subscriptionStartDate: null,
              subscriptionEndDate: null,
              subscriptionType: null,
              subscriptionLength: null,
              // Optionally reset to trial if desired
              trialStartDate: new Date(),
              trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days trial
              // Track last update
              lastSubscriptionUpdateDate: new Date()
            }
          });
          console.log(`User ${deletedUserId} subscription cancelled`);
        }
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    console.error('Stripe Webhook Error:', error);
    // Ensure error is logged but doesn't break webhook processing
  }
};

// Helper function to calculate subscription end date
export const calculateSubscriptionEndDate = (
  subscriptionLength: string, 
  existingEndDate: Date = new Date()
): Date => {
  const endDate = new Date(existingEndDate);
  
  switch (subscriptionLength) {
    case 'ONE_MONTH':
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case 'THREE_MONTHS':
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    default:
      throw new Error(`Invalid subscription length: ${subscriptionLength}`);
  }
  
  return endDate;
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