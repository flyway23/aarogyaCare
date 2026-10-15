import { Worker } from 'bullmq';
import { bullConnection } from './lib/queue.js';
import { sendEmail } from './lib/mailer.js';

const worker = new Worker(
  'payment-emails',
  async (job) => sendEmail(job.data),
  { connection: bullConnection('worker') },
);
const emergencyWorker = new Worker(
  'emergency-alerts',
  async (job) => sendEmail(job.data),
  { connection: bullConnection('worker') },
);
worker.on('failed', (job, error) =>
  console.error(`Payment email job ${job?.id} failed`, error.message),
);
emergencyWorker.on('failed', (job, error) =>
  console.error(`Emergency email job ${job?.id} failed`, error.message),
);
console.log('AarogyaCare email workers started');
const shutdown = async () => {
  await Promise.all([worker.close(), emergencyWorker.close()]);
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
