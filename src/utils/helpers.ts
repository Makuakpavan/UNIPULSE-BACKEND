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

/**
 * Short-lived token issued after a successful password check when the account
 * has 2FA enabled. It is not a session token: it only names the account that
 * may complete the TOTP step.
 */
export const generateTwoFactorChallengeToken = (userId: string): string =>
  jwt.sign({ userId, purpose: '2fa' }, String(env.jwtAccessSecret), { expiresIn: '5m' });

export const verifyTwoFactorChallengeToken = (token: string): string => {
  let payload: { userId?: string; purpose?: string };
  try {
    payload = jwt.verify(token, String(env.jwtAccessSecret)) as typeof payload;
  } catch {
    throw new Error('Invalid or expired 2FA challenge');
  }

  // An access token would also verify here; the purpose claim keeps the two apart.
  if (payload.purpose !== '2fa' || !payload.userId) {
    throw new Error('Invalid or expired 2FA challenge');
  }

  return payload.userId;
};

export const generateRandomToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Escape regex metacharacters so user input can be used in a $regex query
 * without altering the pattern or causing catastrophic backtracking.
 */
export const escapeRegex = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Normalise anything that identifies a document to its id string: a raw
 * ObjectId, a populated document, or a lean `{ _id }` object. A hydrated
 * document's own `toString()` returns its inspect form rather than its id, so
 * the `_id` hop is what makes populated arrays comparable.
 */
const toIdString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const raw = (value as any)._id ?? value;
  return raw ? raw.toString() : null;
};

/**
 * Membership test for arrays of ObjectIds. `Array.prototype.includes` compares
 * by reference/SameValueZero, so it never matches an ObjectId against a string
 * (or against another ObjectId instance with the same value). Handles populated
 * arrays as well as raw id arrays.
 */
export const containsId = (
  list: unknown[] | undefined | null,
  id: unknown
): boolean => {
  if (!list || !id) return false;
  const target = toIdString(id);
  if (!target) return false;
  return list.some((entry) => toIdString(entry) === target);
};

/** Copy only the listed fields from an untrusted object (mass-assignment guard). */
export const pick = <T extends object>(source: any, fields: string[]): Partial<T> => {
  const result: any = {};
  if (!source || typeof source !== 'object') return result;
  for (const field of fields) {
    if (source[field] !== undefined) result[field] = source[field];
  }
  return result;
};

/**
 * Derive a URL-safe slug from a free-text institution name. Students submit the
 * name only — letting them choose the slug would hand them a way to squat on a
 * real institution's identifier.
 */
export const slugify = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

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
