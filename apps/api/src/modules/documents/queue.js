import { Queue } from 'bullmq';
import { bullConnection } from '../../lib/queue.js';

export const documentsQueue = new Queue('documents', {
  connection: bullConnection(),
});
