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

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'default_access_secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
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
