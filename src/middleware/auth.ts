import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthenticatedRequest, TokenPayload, UserRole } from '../types';
import { env } from '../config/env';
import { formatResponse } from '../utils/helpers';
import logger from '../utils/logger';

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json(formatResponse(false, 'Access token required'));
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json(formatResponse(false, 'Access token required'));
      return;
    }

    const decoded = jwt.verify(token, env.jwtAccessSecret) as TokenPayload;

    const user = await User.findById(decoded.userId).select('+password');

    if (!user || !user.isActive) {
      res.status(401).json(formatResponse(false, 'User not found or deactivated'));
      return;
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json(formatResponse(false, 'Token expired'));
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json(formatResponse(false, 'Invalid token'));
      return;
    }
    logger.error('Auth middleware error:', error);
    res.status(500).json(formatResponse(false, 'Authentication error'));
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.jwtAccessSecret) as TokenPayload;
    const user = await User.findById(decoded.userId);

    if (user && user.isActive) {
      req.user = user;
    }
    next();
  } catch {
    next();
  }
};
