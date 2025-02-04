import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { createCheckoutSession, handleStripeWebhook, createOneTimePayment } from '../utils/stripeUtils';
import { authMiddleware } from '../middleware/authMiddleware';
import Stripe from 'stripe';

// Remove RequestHandler import and use a custom type instead
type AsyncRequestHandler = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => Promise<void>;

// Ensure STRIPE_SECRET_KEY is defined
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia'
});

const router = express.Router();

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

const createCheckoutSessionHandler: AsyncRequestHandler = async (req, res, next) => {
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

router.post('/create-checkout-session', authMiddleware, createCheckoutSessionHandler);
router.post('/create-subscription', authMiddleware, async (req, res, next) => {
  try {
    const { paymentMethodId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }

    const paymentIntent = await createOneTimePayment(userId, paymentMethodId);
    res.json(paymentIntent);
  } catch (error) {
    console.error('One-time Payment Error:', error);
    next(error);
  }
});
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res, next) => {
  try {
    // Ensure STRIPE_WEBHOOK_SECRET is defined
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      next(new Error('Stripe webhook secret is not configured'));
      return;
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      next(new Error('Stripe signature is missing'));
      return;
    }

    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
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
});

export default router;