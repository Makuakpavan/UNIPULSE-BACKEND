import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { TokenPayload, UserRole } from '../types';

export const generateAccessToken = (payload: TokenPayload): string => {
  const signOptions: jwt.SignOptions = {
    expiresIn: env.jwtAccessExpiry as jwt.SignOptions['expiresIn'],
  };

  return jwt.sign(payload, String(env.jwtAccessSecret), signOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const signOptions: jwt.SignOptions = {
    expiresIn: env.jwtRefreshExpiry as jwt.SignOptions['expiresIn'],
  };

  return jwt.sign(payload, String(env.jwtRefreshSecret), signOptions);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, String(env.jwtAccessSecret)) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, String(env.jwtRefreshSecret)) as TokenPayload;
};

export const generateRandomToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

export const sanitizeContent = (content: string): string => {
  return content
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
};

export const buildPagination = (page: number, limit: number) => {
  const skip = (page - 1) * limit;
  return { skip, limit };
};

export const formatResponse = <T>(
  success: boolean,
  message: string,
  data?: T,
  meta?: any
) => {
  const response: any = { success, message };
  if (data !== undefined) response.data = data;
  if (meta !== undefined) response.meta = meta;
  return response;
};

export const hasRole = (userRole: UserRole, requiredRoles: UserRole[]): boolean => {
  const roleHierarchy: Record<UserRole, number> = {
    [UserRole.STUDENT]: 1,
    [UserRole.VERIFIED_STUDENT]: 2,
    [UserRole.INSTITUTION_ADMIN]: 3,
    [UserRole.SUPER_ADMIN]: 4,
  };

  const userLevel = roleHierarchy[userRole];
  const requiredLevel = Math.min(...requiredRoles.map((r) => roleHierarchy[r]));

  return userLevel >= requiredLevel;
};
