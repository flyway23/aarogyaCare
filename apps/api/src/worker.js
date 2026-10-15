import { Worker } from 'bullmq';
import { bullConnection } from './lib/queue.js';
import { sendEmail } from './lib/mailer.js';
import { processDocument } from './modules/documents/processor.js';

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
const documentsWorker = new Worker(
  'documents',
  async (job) => processDocument(job.data.documentId),
  {
    connection: bullConnection('worker'),
    concurrency: 1,
  },
);
worker.on('failed', (job, error) =>
  console.error(`Payment email job ${job?.id} failed`, error.message),
);
emergencyWorker.on('failed', (job, error) =>
  console.error(`Emergency email job ${job?.id} failed`, error.message),
);
documentsWorker.on('failed', async (job, error) => {
  console.error(`Document job ${job?.id} failed`, error.message);
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1))
    await (
      await import('./lib/prisma.js')
    ).prisma.document
      .update({
        where: { id: job.data.documentId },
        data: { status: 'FAILED', failReason: error.message.slice(0, 500) },
      })
      .catch(() => {});
});
console.log('AarogyaCare email workers started');
const shutdown = async () => {
  await Promise.all([
    worker.close(),
    emergencyWorker.close(),
    documentsWorker.close(),
  ]);
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
