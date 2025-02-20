// In /Users/vikasbommineni/test-prep-platform/backend/src/middleware/asyncHandler.ts
import { Request, Response, NextFunction } from 'express';

// Type for an async route handler
type AsyncRouteHandler = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => Promise<void | Response>;

// Middleware to wrap async route handlers and catch errors
const asyncHandler = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;