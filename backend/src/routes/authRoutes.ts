// In /Users/vikasbommineni/test-prep-platform/backend/src/routes/authRoutes.ts
import express, { Request, Response, NextFunction } from 'express';
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
import asyncHandler from '../middleware/asyncHandler';

const prisma = new PrismaClient();

const router = express.Router();

// Modify the type to make next non-optional
type AsyncRouteHandler = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => Promise<void>;

// Wrap controllers to ensure consistent error handling and type safety
const wrapHandler = (handler: AsyncRouteHandler) => 
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    await handler(req, res, next);
  });

// Handlers with explicit typing
const registerHandler: AsyncRouteHandler = async (req, res, next) => {
  await register(req, res);
  next();
};

const loginHandler: AsyncRouteHandler = async (req, res, next) => {
  await login(req, res);
  next();
};

const refreshTokenHandler: AsyncRouteHandler = async (req, res, next) => {
  await refreshAccessToken(req, res);
  next();
};

const getMembershipStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const subscriptionStatus = await getUserSubscriptionStatus(userId);
  res.json(subscriptionStatus);
});

const manageSubscriptionHandler: AsyncRouteHandler = async (req, res, next) => {
  await manageSubscription(req, res);
  next();
};

const subscriptionStatusHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const subscriptionStatus = await getUserSubscriptionStatus(userId);
  res.json(subscriptionStatus);
});

// Modify the logout handler to match the new signature
const wrappedLogoutHandler: AsyncRouteHandler = async (req, res, next) => {
  await logoutHandler(req, res);
  next();
};

// Routes
router.post('/register', wrapHandler(registerHandler));
router.post('/login', wrapHandler(loginHandler));
router.post('/refresh-token', wrapHandler(refreshTokenHandler));
router.post('/logout', authenticateToken, wrapHandler(wrappedLogoutHandler));
router.post('/manage-subscription', authenticateToken, wrapHandler(manageSubscriptionHandler));
router.get('/membership-status', authenticateToken, getMembershipStatusHandler);

// Add new routes to match frontend API calls
router.get('/subscription-status', authenticateToken, subscriptionStatusHandler);
router.get('/get-subscription-status', authenticateToken, subscriptionStatusHandler);

// New routes for subscription management
router.post('/check-expired-subscriptions', authenticateToken, wrapHandler(async (req, res, next) => {
  await checkAndUpdateExpiredSubscriptions(req, res);
  next();
}));

router.post('/extend-subscription', authenticateToken, wrapHandler(async (req, res, next) => {
  await extendSubscription(req, res);
  next();
}));

export default router;