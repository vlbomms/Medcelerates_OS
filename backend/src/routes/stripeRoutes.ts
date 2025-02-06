import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { createCheckoutSession, handleStripeWebhook, createOneTimePayment, renewSubscription } from '../utils/stripeUtils';
import { authenticateToken } from '../middleware/authMiddleware';
import Stripe from 'stripe';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type AsyncRequestHandler = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => Promise<void>;

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia'
});

const router = express.Router();

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

const createCheckoutSessionHandler: AsyncRequestHandler = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const checkoutSession = await createCheckoutSession(userId);
    res.json(checkoutSession);
  } catch (error) {
    next(error);
  }
};

const createSubscriptionHandler: AsyncRequestHandler = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { 
      paymentMethodId, 
      subscriptionLength,
      isExistingPaidMember = false // Default to false if not provided
    } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!paymentMethodId) {
      res.status(400).json({ error: 'Payment method ID is required' });
      return;
    }

    if (!['ONE_MONTH', 'THREE_MONTHS'].includes(subscriptionLength)) {
      res.status(400).json({ 
        error: 'Invalid subscription length', 
        details: 'Subscription length must be ONE_MONTH or THREE_MONTHS' 
      });
      return;
    }

    const paymentIntent = await createOneTimePayment(
      userId, 
      paymentMethodId, 
      subscriptionLength as 'ONE_MONTH' | 'THREE_MONTHS',
      isExistingPaidMember
    );
    res.json(paymentIntent);
  } catch (error) {
    console.error('Subscription Creation Error:', error);
    
    // Log more detailed error information
    if (error instanceof Error) {
      console.error('Error Name:', error.name);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
    }
    
    // Send a more informative error response
    res.status(500).json({ 
      error: 'Failed to create subscription', 
      details: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
};

const renewSubscriptionHandler: AsyncRequestHandler = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { 
      paymentMethodId, 
      subscriptionLength 
    } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!paymentMethodId) {
      res.status(400).json({ error: 'Payment method ID is required' });
      return;
    }

    if (!['ONE_MONTH', 'THREE_MONTHS'].includes(subscriptionLength)) {
      res.status(400).json({ 
        error: 'Invalid subscription length', 
        details: 'Subscription length must be ONE_MONTH or THREE_MONTHS' 
      });
      return;
    }

    const renewalResult = await renewSubscription(
      userId, 
      paymentMethodId, 
      subscriptionLength as 'ONE_MONTH' | 'THREE_MONTHS'
    );

    res.json(renewalResult);
  } catch (error) {
    console.error('Subscription Renewal Error:', error);
    next(error);
  }
};

const stripeWebhookHandler: AsyncRequestHandler = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      res.status(500).json({ error: 'Stripe webhook secret is not configured' });
      return;
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      res.status(400).json({ error: 'Stripe signature is missing' });
      return;
    }

    const event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    await handleStripeWebhook(event);
    res.json({received: true});
  } catch (error) {
    if (error instanceof Error) {
      console.error('Webhook error:', error.message);
      next(error);
      return;
    }
    next(new Error('An unknown error occurred'));
  }
};

const getSubscriptionStatusHandler: AsyncRequestHandler = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userSelect = {
      isPaidMember: true,
      subscriptionType: true,
      subscriptionLength: true,
      subscriptionStartDate: true,
      subscriptionEndDate: true
    } satisfies Prisma.UserSelect;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelect
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Subscription Status Error:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription status' });
  }
};

// Stripe Payment Return Handler
router.get('/payment/return', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { payment_intent, payment_intent_client_secret, redirect_status } = req.query;

    // Type guard to ensure req.user exists
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent as string);

    // Handle different payment statuses
    switch (paymentIntent.status) {
      case 'succeeded':
        res.status(200).json({ status: 'success', message: 'Payment successful' });
        break;
      case 'requires_payment_method':
        res.status(400).json({ status: 'failed', message: 'Payment method required' });
        break;
      case 'canceled':
        res.status(400).json({ status: 'canceled', message: 'Payment was canceled' });
        break;
      default:
        res.status(400).json({ status: 'unknown', message: 'Unknown payment status' });
    }
  } catch (error) {
    console.error('Payment Return Error:', error);
    next(error);
  }
});

router.post('/create-checkout-session', authenticateToken, createCheckoutSessionHandler);
router.post('/create-subscription', authenticateToken, createSubscriptionHandler);
router.post('/renew-subscription', authenticateToken, renewSubscriptionHandler);
router.post('/webhook', express.raw({type: 'application/json'}), stripeWebhookHandler);
router.get('/subscription', authenticateToken, getSubscriptionStatusHandler);

export default router;