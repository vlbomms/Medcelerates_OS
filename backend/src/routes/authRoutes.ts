import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import { PrismaClient } from '@prisma/client';
import { 
  register, 
  login, 
  refreshAccessToken,
  logoutHandler,
  manageSubscription,
  getUserSubscriptionStatus,
  checkAndUpdateExpiredSubscriptions,
  extendSubscription
} from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const prisma = new PrismaClient();

const router = express.Router();

// Explicitly type the handlers as RequestHandler
const registerHandler: RequestHandler = async (req, res, next) => {
  try {
    await register(req, res);
  } catch (error) {
    next(error);
  }
};

const loginHandler: RequestHandler = async (req, res, next) => {
  try {
    await login(req, res);
  } catch (error) {
    next(error);
  }
};

const refreshTokenHandler: RequestHandler = async (req, res, next) => {
  try {
    await refreshAccessToken(req, res);
  } catch (error) {
    next(error);
  }
};

const getMembershipStatusHandler: RequestHandler<ParamsDictionary, any, any, ParsedQs, Record<string, any>> = 
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const subscriptionStatus = await getUserSubscriptionStatus(userId);
    res.json(subscriptionStatus);
  } catch (error) {
    next(error);
  }
};

const manageSubscriptionHandler: RequestHandler = async (req, res, next) => {
  try {
    await manageSubscription(req, res);
  } catch (error) {
    next(error);
  }
};

const subscriptionStatusHandler: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const subscriptionStatus = await getUserSubscriptionStatus(userId);
    res.json(subscriptionStatus);
  } catch (error) {
    next(error);
  }
};

// Routes
router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.post('/refresh-token', refreshTokenHandler);
router.post('/logout', authenticateToken, logoutHandler);
router.post('/manage-subscription', authenticateToken, manageSubscriptionHandler);
router.get('/membership-status', authenticateToken, subscriptionStatusHandler);

// Add new routes to match frontend API calls
router.get('/subscription-status', authenticateToken, subscriptionStatusHandler);
router.get('/get-subscription-status', authenticateToken, subscriptionStatusHandler);

// New routes for subscription management
router.post('/check-expired-subscriptions', authenticateToken, async (req, res, next) => {
  try {
    await checkAndUpdateExpiredSubscriptions(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/extend-subscription', authenticateToken, async (req, res, next) => {
  try {
    await extendSubscription(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;