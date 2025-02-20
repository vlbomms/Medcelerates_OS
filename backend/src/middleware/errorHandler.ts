// In /Users/vikasbommineni/test-prep-platform/backend/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

interface ErrorWithStatus extends Error {
  status?: number;
  code?: string;
}

const errorHandler = (
  err: ErrorWithStatus, 
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  console.error('Error:', {
    message: err.message,
    code: err.code,
    stack: err.stack
  });

  // Default to 500 internal server error if no status is set
  const status = err.status || 500;
  const message = err.message || 'An unexpected error occurred';

  res.status(status).json({
    error: {
      message,
      code: err.code,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

export default errorHandler;