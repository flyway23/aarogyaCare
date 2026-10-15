import { createClient } from 'redis';
import { env } from '../config/env.js';

export const redis = createClient({ url: env.REDIS_URL });
redis.on('error', (error) =>
  console.error('Redis connection error:', error.message),
);
