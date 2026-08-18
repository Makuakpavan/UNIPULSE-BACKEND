import Redis from 'ioredis';
import { env } from './env';
import logger from '../utils/logger';

export const redis = new Redis(env.redisUrl, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err.message);
});

export const cacheGet = async (key: string): Promise<string | null> => {
  try {
    return await redis.get(`${env.keyPrefix}${key}`);
  } catch {
    return null;
  }
};

export const cacheSet = async (key: string, value: string, ttlSeconds = 3600): Promise<void> => {
  try {
    await redis.setex(`${env.keyPrefix}${key}`, ttlSeconds, value);
  } catch {
    // Fail silently - cache is not critical
  }
};

export const cacheDelete = async (key: string): Promise<void> => {
  try {
    await redis.del(`${env.keyPrefix}${key}`);
  } catch {
    // Fail silently
  }
};

export const cacheDeletePattern = async (pattern: string): Promise<void> => {
  try {
    const keys = await redis.keys(`${env.keyPrefix}${pattern}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Fail silently
  }
};
