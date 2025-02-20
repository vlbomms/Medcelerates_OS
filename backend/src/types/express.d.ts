// In /Users/vikasbommineni/test-prep-platform/backend/src/types/express.d.ts
import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      } & Partial<JwtPayload>;
    }
  }
}

export {};