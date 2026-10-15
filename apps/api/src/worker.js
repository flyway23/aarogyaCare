import { Worker } from 'bullmq';
import { bullConnection } from './lib/queue.js';
import { sendEmail } from './lib/mailer.js';

const worker = new Worker(
  'payment-emails',
  async (job) => sendEmail(job.data),
  { connection: bullConnection('worker') },
);
worker.on('failed', (job, error) =>
  console.error(`Payment email job ${job?.id} failed`, error.message),
);
console.log('AarogyaCare payment email worker started');
const shutdown = async () => {
  await worker.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
