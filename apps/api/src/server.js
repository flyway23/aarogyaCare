import { createServer } from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { releaseExpiredHolds } from './modules/appointments/service.js';
import { closePaymentEmailQueue } from './modules/payments/events.js';
import { attachSocketServer, closeSocketServer } from './lib/socket.js';
import { expireBedReservations } from './modules/beds/service.js';
import { closeEmergencyAlertQueue } from './modules/emergency/events.js';

await Promise.all([prisma.$connect(), redis.connect()]);
await releaseExpiredHolds();
await expireBedReservations();
const holdCleanup = setInterval(() => {
  Promise.all([releaseExpiredHolds(), expireBedReservations()]).catch((error) =>
    console.error('Reservation cleanup failed', error.message),
  );
}, 60_000);
holdCleanup.unref();
const httpServer = createServer(app);
attachSocketServer(httpServer);
httpServer.listen(env.API_PORT, () => {
  console.log(`AarogyaCare API listening on http://localhost:${env.API_PORT}`);
});

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(holdCleanup);
  await closeSocketServer();
  await Promise.all([
    prisma.$disconnect(),
    redis.quit(),
    closePaymentEmailQueue(),
    closeEmergencyAlertQueue(),
  ]);
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
