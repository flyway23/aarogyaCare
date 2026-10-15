import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';

await Promise.all([prisma.$connect(), redis.connect()]);
const server = app.listen(env.API_PORT, () => {
  console.log(`AarogyaCare API listening on http://localhost:${env.API_PORT}`);
});

const shutdown = async () => {
  server.close();
  await Promise.all([prisma.$disconnect(), redis.quit()]);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
