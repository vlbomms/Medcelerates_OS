import { Request, Response, NextFunction } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { hashPassword, comparePassword } from '../utils/passwordUtils';

const prisma = new PrismaClient();

// Ensure JWT_SECRET is defined
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

interface UserWithRefreshToken {
  email: string;
  password: string;
  id: string;
  isPaidMember: boolean;
  createdAt: Date;
  updatedAt: Date;
  refreshToken?: string | null;
  refreshTokenIssuedAt?: Date | null;
  refreshTokenExpiresAt?: Date | null;
}

interface UserSubscriptionInfo {
  status: string;
  canExtend: boolean;
  canPurchase: boolean;
  subscriptionEndDate?: Date | null;
  trialEndDate?: Date | null;
  lastSubscriptionEndDate?: Date | null;
  subscriptionType?: string | null;
  trialStartDate?: Date | null;
}

const generateToken = (userId: string, email: string) => {
  return jwt.sign(
    { 
      id: userId, 
      email: email,
      // Add more claims as needed
      type: 'access' 
    }, 
    process.env.JWT_SECRET!, 
    { 
      expiresIn: '7d',  // Changed from 1h to 1 week
      issuer: 'test-prep-platform'
    }
  );
};

const generateRefreshToken = (userId: string, email: string) => {
  return jwt.sign(
    { 
      id: userId, 
      email: email,
      type: 'refresh'
    }, 
    process.env.JWT_SECRET!, 
    { 
      expiresIn: '7d',  // Longer expiration for refresh token
      issuer: 'test-prep-platform'
    }
  );
};

// Helper function to calculate subscription duration
const getSubscriptionDuration = (subscriptionType?: string | null): number => {
  switch (subscriptionType) {
    case 'ONE_MONTH':
      return 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    case 'THREE_MONTHS':
      return 3 * 30 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
    default:
      return 0; // No subscription
  }
};

export const register = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password, subscriptionLength } = req.body;

    // Detailed logging of input
    console.log('Registration Request:', {
      email,
      subscriptionLength,
      isPaidMember: !!subscriptionLength
    });

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    const now = new Date();

    // Determine trial and paid member status
    const isPaidMember = !!subscriptionLength;
    
    // Always set trial dates for non-paid members
    const trialStartDate = isPaidMember ? null : now;
    const trialEndDate = isPaidMember 
      ? null 
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);  // 7 days trial

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        trialStartDate,
        trialEndDate,
        isPaidMember,
        subscriptionType: isPaidMember ? 'ONE_TIME' : null,
        subscriptionStartDate: isPaidMember ? now : null,
        subscriptionLength: subscriptionLength || null,
        subscriptionEndDate: isPaidMember 
          ? new Date(now.getTime() + getSubscriptionDuration(subscriptionLength)) 
          : null,
        stripeCustomerId: null,
        stripePaymentIntentId: null,
        refreshToken: null,
        refreshTokenIssuedAt: null,
        refreshTokenExpiresAt: null
      },
      select: { 
        id: true, 
        email: true, 
        trialStartDate: true,
        trialEndDate: true,
        isPaidMember: true,
        subscriptionType: true,
        subscriptionLength: true
      }
    });

    console.log(`User registered successfully: ${user.email}`);

    // Generate tokens
    const accessToken = generateToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id, user.email);

    // Update user with refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshToken,
        refreshTokenIssuedAt: now,
        refreshTokenExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    return res.status(201).json({ 
      token: accessToken, 
      refreshToken,
      user: { 
        id: user.id, 
        email: user.email,
        isPaidMember: user.isPaidMember,
        subscriptionType: user.subscriptionType,
        subscriptionLength: user.subscriptionLength
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Server error during registration' });
  }
};

export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    console.log('Login request received:', {
      body: req.body,
      headers: req.headers
    });

    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      console.log('Login failed: Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({ 
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        isPaidMember: true,
        trialStartDate: true,
        trialEndDate: true,
        subscriptionType: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true
      }
    });

    if (!user) {
      console.log(`Login attempt failed: User not found for email ${email}`);
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Log user details found (without password)
    console.log('User found:', {
      id: user.id,
      email: user.email,
      isPaidMember: user.isPaidMember,
      trialStartDate: user.trialStartDate,
      trialEndDate: user.trialEndDate
    });

    // Check password
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      console.log(`Login attempt failed: Password mismatch for email ${email}`);
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const accessToken = generateToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id, user.email);
    const now = new Date();

    // Store refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshToken,
        refreshTokenIssuedAt: now,
        refreshTokenExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    console.log(`Login successful for user: ${email}`);

    // Return tokens and user details
    return res.json({
      accessToken,
      refreshToken,
      userId: user.id,
      email: user.email,
      isPaidMember: user.isPaidMember,
      subscriptionDetails: {
        trialStartDate: user.trialStartDate,
        trialEndDate: user.trialEndDate,
        subscriptionType: user.subscriptionType,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      error: 'Server error during login', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// New method to handle token refresh
export const refreshAccessToken = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token required' });
      return res;
    }

    // Verify the refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as { 
        id: string; 
        email: string; 
        type: string 
      };
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return res;
    }

    // Check if token is a refresh token
    if (decoded.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid token type' });
      return res;
    }

    // Find user with matching refresh token
    const user = await prisma.user.findFirst({
      where: { 
        id: decoded.id, 
        refreshToken: refreshToken,
        refreshTokenExpiresAt: { gt: new Date() }
      }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return res;
    }

    // Generate new access and refresh tokens
    const newAccessToken = generateToken(user.id, user.email);
    const newRefreshToken = generateRefreshToken(user.id, user.email);
    const now = new Date();

    // Update user with new refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: newRefreshToken,
        refreshTokenIssuedAt: now,
        refreshTokenExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    return res.json({ 
      token: newAccessToken, 
      refreshToken: newRefreshToken 
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({ error: 'Server error during token refresh' });
  }
};

// Helper function to determine user's subscription status
export const getUserSubscriptionStatus = async (userId: string): Promise<UserSubscriptionInfo> => {
  console.log('Retrieving User Subscription Status', { userId });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPaidMember: true,
      trialStartDate: true,
      trialEndDate: true,
      subscriptionEndDate: true,
      lastSubscriptionEndDate: true,
      subscriptionType: true
    }
  });

  if (!user) {
    console.error('User not found', { userId });
    throw new Error('User not found');
  }

  // Log raw user data with more context
  console.log('User Subscription Data', {
    isPaidMember: user.isPaidMember,
    trialStartDate: user.trialStartDate ? user.trialStartDate.toISOString() : null,
    trialEndDate: user.trialEndDate ? user.trialEndDate.toISOString() : null,
    subscriptionEndDate: user.subscriptionEndDate ? user.subscriptionEndDate.toISOString() : null,
    subscriptionType: user.subscriptionType
  });

  const now = new Date();
  console.log('Current Date', { now: now.toISOString() });

  // Case 1: Active Paid Membership (Prioritized)
  if (user.isPaidMember && user.subscriptionEndDate && user.subscriptionEndDate > now) {
    console.log('Active Paid Membership');
    return {
      status: 'ACTIVE_PAID',
      canExtend: true,
      canPurchase: false,
      subscriptionEndDate: user.subscriptionEndDate,
      subscriptionType: user.subscriptionType
    };
  }

  // Case 2: Active Trial Period
  if (!user.isPaidMember && user.trialStartDate && user.trialEndDate) {
    const trialStartDate = user.trialStartDate instanceof Date 
      ? user.trialStartDate 
      : new Date(user.trialStartDate);
    const trialEndDate = user.trialEndDate instanceof Date 
      ? user.trialEndDate 
      : new Date(user.trialEndDate);
    
    console.log('Trial Period Check', {
      trialStartDate: trialStartDate.toISOString(),
      trialEndDate: trialEndDate.toISOString(),
      now: now.toISOString(),
      isTrialActive: now >= trialStartDate && now <= trialEndDate
    });

    if (now >= trialStartDate && now <= trialEndDate) {
      console.log('Active Trial Period');
      return {
        status: 'ACTIVE_TRIAL',
        canExtend: false,
        canPurchase: true,
        trialStartDate: trialStartDate,
        trialEndDate: trialEndDate
      };
    }
  }

  // Case 3: Expired Paid Membership (Previously paid, but subscription ended)
  if (user.isPaidMember && user.subscriptionEndDate && user.subscriptionEndDate <= now) {
    console.log('Expired Paid Membership');
    const subscriptionEndDate = user.lastSubscriptionEndDate || user.subscriptionEndDate;
    return {
      status: 'EXPIRED_PAID',
      canExtend: true,
      canPurchase: true,
      subscriptionEndDate: subscriptionEndDate,
      subscriptionType: user.subscriptionType
    };
  }

  // Case 4: Expired Trial (Never paid, trial ended)
  if (!user.isPaidMember && user.trialEndDate && user.trialEndDate <= now) {
    console.log('Expired Trial');
    return {
      status: 'EXPIRED_TRIAL',
      canExtend: false,
      canPurchase: true,
      trialEndDate: user.trialEndDate
    };
  }

  // Case 5: No previous subscription
  console.log('No Active Subscription');
  return {
    status: 'NO_SUBSCRIPTION',
    canExtend: false,
    canPurchase: true
  };
};

// Method to purchase or extend subscription
export const manageSubscription = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, subscriptionType } = req.body;

    // Validate input
    if (!userId || !subscriptionType) {
      return res.status(400).json({ error: 'Missing user ID or subscription type' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const now = new Date();
    const subscriptionEnd = new Date(now.getTime() + getSubscriptionDuration(subscriptionType));

    // Update user's subscription
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isPaidMember: true,
        subscriptionType,
        subscriptionStartDate: now,
        subscriptionLength: subscriptionType,
        subscriptionEndDate: subscriptionEnd,
        lastSubscriptionEndDate: null, // Clear last subscription end date
        
        // Explicitly set trial dates to null
        trialStartDate: null,
        trialEndDate: null
      }
    });

    return res.json({
      message: 'Subscription updated successfully',
      subscription: {
        type: updatedUser.subscriptionType,
        startDate: updatedUser.subscriptionStartDate,
        endDate: updatedUser.subscriptionEndDate,
        trialStartDate: updatedUser.trialStartDate,
        trialEndDate: updatedUser.trialEndDate
      }
    });
  } catch (error) {
    console.error('Subscription management error:', error);
    return res.status(500).json({ error: 'Error managing subscription' });
  }
};

export const getMembershipStatusHandler = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isPaidMember: true,
        subscriptionType: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        trialStartDate: true,
        trialEndDate: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine subscription status
    let status: 'ACTIVE_PAID' | 'ACTIVE_TRIAL' | 'EXPIRED_TRIAL' | 'EXPIRED_PAID' | 'NO_SUBSCRIPTION' = 'NO_SUBSCRIPTION';
    const now = new Date();

    if (user.isPaidMember && user.subscriptionEndDate && user.subscriptionEndDate > now) {
      status = 'ACTIVE_PAID';
    } else if (!user.isPaidMember && user.trialStartDate && user.trialEndDate) {
      if (user.trialEndDate > now) {
        status = 'ACTIVE_TRIAL';
      } else {
        status = 'EXPIRED_TRIAL';
      }
    } else if (user.isPaidMember && (!user.subscriptionEndDate || user.subscriptionEndDate <= now)) {
      status = 'EXPIRED_PAID';
    }

    // Determine additional flags
    const canExtend = status === 'ACTIVE_TRIAL' || status === 'EXPIRED_TRIAL';
    const canPurchase = status !== 'ACTIVE_PAID';

    console.log('Membership Status Details:', {
      status,
      canExtend,
      canPurchase,
      subscriptionType: user.subscriptionType,
      trialStartDate: user.trialStartDate,
      trialEndDate: user.trialEndDate
    });

    return res.status(200).json({
      status,
      canExtend,
      canPurchase,
      isPaidMember: user.isPaidMember,
      subscriptionType: user.subscriptionType,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: user.subscriptionEndDate,
      trialStartDate: user.trialStartDate,
      trialEndDate: user.trialEndDate
    });
  } catch (error) {
    console.error('Membership status error:', error);
    return res.status(500).json({ error: 'Failed to retrieve membership status' });
  }
};

// Method to check and update expired subscriptions
export const checkAndUpdateExpiredSubscriptions = async (req: Request, res: Response): Promise<Response> => {
  try {
    const now = new Date();

    // Find all users with expired subscriptions
    const expiredSubscriptionUsers = await prisma.user.findMany({
      where: {
        isPaidMember: true,
        subscriptionEndDate: {
          lt: now // Less than current time
        }
      }
    });

    // Batch update for expired subscriptions
    const updatePromises = expiredSubscriptionUsers.map(async (user) => {
      return prisma.user.update({
        where: { id: user.id },
        data: {
          isPaidMember: false,
          subscriptionType: null,
          subscriptionStartDate: null,
          subscriptionLength: null,
          subscriptionEndDate: null,
          lastSubscriptionEndDate: now,
          
          // Explicitly set trial dates to null
          trialStartDate: null,
          trialEndDate: null
        }
      });
    });

    // Execute all updates
    const updatedUsers = await Promise.all(updatePromises);

    return res.json({
      message: 'Expired subscriptions updated',
      updatedUsersCount: updatedUsers.length,
      details: updatedUsers.map(user => ({
        userId: user.id,
        email: user.email,
        isPaidMember: user.isPaidMember
      }))
    });
  } catch (error) {
    console.error('Error updating expired subscriptions:', error);
    return res.status(500).json({ error: 'Failed to update expired subscriptions' });
  }
};

// Optional: Add a method to extend an existing subscription
export const extendSubscription = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, subscriptionType } = req.body;

    // Find the user
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { 
        id: true, 
        subscriptionEndDate: true, 
        isPaidMember: true 
      } 
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const now = new Date();
    const subscriptionDuration = getSubscriptionDuration(subscriptionType);
    
    // If subscription is still active, extend from the current end date
    // Otherwise, start a new subscription from now
    const newSubscriptionStart = user.subscriptionEndDate && user.subscriptionEndDate > now 
      ? user.subscriptionEndDate 
      : now;
    
    const newSubscriptionEnd = new Date(newSubscriptionStart.getTime() + subscriptionDuration);

    // Update subscription
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isPaidMember: true,
        subscriptionType,
        subscriptionStartDate: newSubscriptionStart,
        subscriptionLength: subscriptionType,
        subscriptionEndDate: newSubscriptionEnd,
        
        // Clear trial dates when extending/renewing
        trialStartDate: null,
        trialEndDate: null
      }
    });

    return res.json({
      message: 'Subscription extended successfully',
      subscription: {
        type: updatedUser.subscriptionType,
        startDate: updatedUser.subscriptionStartDate,
        endDate: updatedUser.subscriptionEndDate
      }
    });
  } catch (error) {
    console.error('Subscription extension error:', error);
    return res.status(500).json({ error: 'Error extending subscription' });
  }
};

export const logoutHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Clear refresh token in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        refreshTokenIssuedAt: null,
        refreshTokenExpiresAt: null
      }
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    // Log error for server-side tracking
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error during logout' });
  }
};