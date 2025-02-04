import { Request, Response } from 'express';
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

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    console.log(`Registration attempt for email: ${email}`);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      console.warn(`Registration attempt with existing email: ${email}`);
      return res.status(400).json({ 
        error: 'Email already in use', 
        details: 'A user with this email address already exists. Please use a different email or log in.' 
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
      select: { id: true, email: true }
    });

    console.log(`User registered successfully: ${user.email}`);

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
        refreshTokenExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
      } as Prisma.UserUpdateInput
    });

    res.status(201).json({ 
      user, 
      token: accessToken,
      refreshToken 
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle Prisma unique constraint violation
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return res.status(400).json({ 
          error: 'Email already in use', 
          details: 'A user with this email address already exists. Please use a different email or log in.' 
        });
      }
    }
    
    res.status(500).json({ 
      error: 'Server error during registration', 
      details: 'An unexpected error occurred while processing your registration.' 
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
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
        refreshTokenExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
      } as Prisma.UserUpdateInput
    });

    res.json({ 
      token: accessToken, 
      refreshToken,
      user: { 
        id: user.id, 
        email: user.email,
        isPaidMember: user.isPaidMember 
      } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

// New method to handle token refresh
export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as { 
      id: string; 
      email: string; 
      type: string 
    };

    // Ensure it's a refresh token
    if (decoded.type !== 'refresh') {
      return res.status(403).json({ error: 'Invalid token type' });
    }

    // Find user by ID and check refresh token
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    }) as UserWithRefreshToken | null;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Additional security checks
    const now = new Date();
    
    // Check if stored refresh token matches
    if (user.refreshToken !== refreshToken) {
      // Token has been reused or invalidated
      await prisma.user.update({
        where: { id: user.id },
        data: {
          refreshToken: null,
          refreshTokenIssuedAt: null,
          refreshTokenExpiresAt: null
        } as Prisma.UserUpdateInput
      });
      return res.status(403).json({ error: 'Token invalidated' });
    }

    // Check refresh token expiration
    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < now) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Generate new tokens
    const newAccessToken = generateToken(user.id, user.email);
    const newRefreshToken = generateRefreshToken(user.id, user.email);

    // Update user with new refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: newRefreshToken,
        refreshTokenIssuedAt: now,
        refreshTokenExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
      } as Prisma.UserUpdateInput
    });

    res.json({ 
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: { 
        id: user.id, 
        email: user.email,
        isPaidMember: user.isPaidMember 
      } 
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Internal server error during token refresh' });
  }
};