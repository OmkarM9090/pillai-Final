import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

// ============================================================
// Custom application error
// ============================================================
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ============================================================
// 404 Not Found handler (must be registered before errorHandler)
// ============================================================
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

// ============================================================
// Global error handler middleware
// ============================================================
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const isDev = process.env.NODE_ENV === 'development';

  // Known operational error
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const mongooseErr = err as any;
    const errors = Object.values(mongooseErr.errors).map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
    sendError(res, 'Validation failed', 422, errors);
    return;
  }

  // Mongoose duplicate key error
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue ?? {})[0] ?? 'field';
    sendError(res, `A record with that ${field} already exists.`, 409);
    return;
  }

  // Mongoose CastError (invalid ObjectId etc.)
  if (err.name === 'CastError') {
    sendError(res, 'Invalid ID format.', 400);
    return;
  }

  // Unknown / unexpected error - log but don't expose internals
  console.error('❌ Unhandled error:', {
    message: err.message,
    stack: isDev ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method,
  });

  sendError(
    res,
    isDev ? err.message : 'An unexpected server error occurred. Please try again later.',
    500
  );
}
