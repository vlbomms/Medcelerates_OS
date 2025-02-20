// In /Users/vikasbommineni/test-prep-platform/backend/src/services/authService.ts
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function generateTokens(userId: string, email: string) {
  // Generate access token
  const accessToken = jwt.sign(
    { id: userId, email }, 
    process.env.JWT_SECRET!, 
    { expiresIn: '1h' }
  );

  // Generate refresh token
  const refreshToken = jwt.sign(
    { id: userId, email }, 
    process.env.REFRESH_TOKEN_SECRET!, 
    { expiresIn: '7d' }
  );

  // Update user's refresh token in database
  await prisma.user.update({
    where: { id: userId },
    data: { 
      refreshToken,
      refreshTokenIssuedAt: new Date(),
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });

  return { accessToken, refreshToken };
}