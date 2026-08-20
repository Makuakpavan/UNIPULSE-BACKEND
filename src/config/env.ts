import dotenv from 'dotenv';
import fs from 'fs';

// Load environment-specific .env file first, then fallback to base .env
const nodeEnv = process.env.NODE_ENV || 'development';
const envPath = `.env.${nodeEnv}`;
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
dotenv.config();

export const env = {
  nodeEnv,
  port: parseInt(process.env.PORT || '5000', 10),
  apiUrl: process.env.API_URL || 'http://localhost:5000',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/unipulse',

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'insecure_dev_access_secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'insecure_dev_refresh_secret',
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',

  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  cloudinaryFolderPrefix: process.env.CLOUDINARY_FOLDER_PREFIX || '',

  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  fromEmail: process.env.FROM_EMAIL || 'noreply@unipulse.com',
  fromName: process.env.FROM_NAME || 'UniPulse',

  totpIssuer: process.env.TOTP_ISSUER || 'UniPulse',

  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  adminEmail: process.env.ADMIN_EMAIL || 'admin@unipulse.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'AdminPass123!',
  // Prefix for keys to isolate environments in Redis and other key-value stores
  keyPrefix: process.env.KEY_PREFIX || `${nodeEnv}:`,
};

/**
 * Fail fast rather than booting with placeholder credentials. Outside of
 * development a missing JWT secret means every token is signed with a value
 * that is public in this repository.
 */
const REQUIRED_IN_PRODUCTION: [string, string | undefined][] = [
  ['JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET],
  ['JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET],
  ['MONGODB_URI', process.env.MONGODB_URI],
  ['CLIENT_URL', process.env.CLIENT_URL],
];

if (nodeEnv !== 'development' && nodeEnv !== 'test') {
  const problems: string[] = [];

  for (const [name, value] of REQUIRED_IN_PRODUCTION) {
    if (!value) problems.push(`${name} is not set`);
  }

  for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = process.env[name];
    if (value && value.length < 32) {
      problems.push(`${name} must be at least 32 characters`);
    }
  }

  if (process.env.JWT_ACCESS_SECRET && process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid configuration for NODE_ENV=${nodeEnv}:\n  - ${problems.join('\n  - ')}`
    );
  }
}
