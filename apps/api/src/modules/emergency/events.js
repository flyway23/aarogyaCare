import { Queue } from 'bullmq';
import { env } from '../../config/env.js';
import { eventBus } from '../../lib/eventBus.js';
import { bullConnection } from '../../lib/queue.js';
import { getSocketServer } from '../../lib/socket.js';

export const emergencyAlertQueue = new Queue('emergency-alerts', {
  connection: bullConnection(),
});

eventBus.on('emergency.raised', (alert) => {
  getSocketServer()?.to('staff').emit('emergency.raised', {
    id: alert.id,
    severity: alert.severity,
    location: alert.location,
    status: alert.status,
    createdAt: alert.createdAt,
  });
  void emergencyAlertQueue
    .add(
      'emergency-desk-alert',
      {
        to: env.EMERGENCY_DESK_EMAIL,
        subject: `Emergency ${alert.severity}: ${alert.location}`,
        text: `Emergency case ${alert.id}. Severity: ${alert.severity}. Location: ${alert.location}. Patient/contact: ${alert.name}, ${alert.phone}. Complaint details are available to authorized staff in the emergency dashboard.`,
      },
      {
        jobId: `emergency-${alert.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    )
    .catch((error) =>
      console.error('Failed to enqueue emergency alert', error.message),
    );
});

export const closeEmergencyAlertQueue = () => emergencyAlertQueue.close();
