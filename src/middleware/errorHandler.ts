import { Request, Response, NextFunction } from 'express';
import { formatResponse } from '../utils/helpers';
import logger from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Terminal response for an unexpected failure. Controllers catch their own
 * errors, so without this they were returning raw `error.message` — leaking
 * Mongoose/driver internals to clients and logging nothing.
 */
export const respondServerError = (req: Request, res: Response, error: unknown): void => {
  logger.error(`Unhandled error in ${req.method} ${req.originalUrl}:`, error);
  res.status(500).json(formatResponse(false, 'Internal server error'));
};

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(formatResponse(false, err.message));
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values((err as any).errors).map((e: any) => e.message);
    res.status(400).json(formatResponse(false, `Validation Error: ${messages.join(', ')}`));
    return;
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue)[0];
    res.status(409).json(formatResponse(false, `${field} already exists`));
    return;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    res.status(400).json(formatResponse(false, `Invalid ${(err as any).path}: ${(err as any).value}`));
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json(formatResponse(false, 'Invalid token'));
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json(formatResponse(false, 'Token expired'));
    return;
  }

  logger.error('Unhandled error:', err);
  res.status(500).json(formatResponse(false, 'Internal server error'));
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json(formatResponse(false, `Route ${req.originalUrl} not found`));
};
