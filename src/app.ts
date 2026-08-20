import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import mongoose from 'mongoose';
import { RequestHandler } from 'express';
import { env } from './config/env';
import { redis } from './config/redis';
import { globalRateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import postRoutes from './routes/post.routes';
import eventRoutes from './routes/event.routes';
import marketplaceRoutes from './routes/marketplace.routes';
import communityRoutes from './routes/community.routes';
import chatRoutes from './routes/chat.routes';
import notificationRoutes from './routes/notification.routes';
import adminRoutes from './routes/admin.routes';
import searchRoutes from './routes/search.routes';

const app = express();

// Required behind Render/any reverse proxy: without it every request appears to
// come from the proxy, which collapses all rate-limit buckets into one and
// records the proxy's address in the audit log.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: env.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression() as unknown as RequestHandler);
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev') as unknown as RequestHandler);

// Registered before the rate limiter so platform health checks never consume quota.
app.get('/health', async (req, res) => {
  const timestamp = new Date().toISOString();
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  let redisState = 'unknown';
  try {
    const pong = await redis.ping();
    redisState = pong === 'PONG' ? 'connected' : 'disconnected';
  } catch (err) {
    redisState = 'disconnected';
  }

  res.status(200).json({
    status: 'ok',
    timestamp,
    environment: env.nodeEnv,
    database: dbState,
    redis: redisState,
  });
});

app.use(globalRateLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
