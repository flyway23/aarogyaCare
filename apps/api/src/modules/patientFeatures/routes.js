import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import * as schema from './schema.js';

const router = Router();
router.get(
  '/records',
  auth,
  requireRole('patient'),
  validate(schema.emptyQuery, 'query'),
  controller.records,
);
router.get(
  '/records/export',
  auth,
  requireRole('patient'),
  validate(schema.emptyQuery, 'query'),
  controller.exportRecords,
);
router.get(
  '/chat/:appointmentId/messages',
  auth,
  requireRole('patient', 'doctor'),
  validate(schema.appointmentParams, 'params'),
  controller.chatMessages,
);
router.post(
  '/chat/:appointmentId/messages',
  auth,
  requireRole('patient', 'doctor'),
  validate(schema.appointmentParams, 'params'),
  validate(schema.messageSchema),
  controller.postChatMessage,
);
router.post(
  '/feedback',
  auth,
  requireRole('patient'),
  validate(schema.feedbackSchema),
  controller.postFeedback,
);
router.post(
  '/appointments/:id/reschedule',
  auth,
  requireRole('patient'),
  validate(schema.idParams, 'params'),
  validate(schema.rescheduleSchema),
  controller.reschedule,
);
router.get(
  '/consents',
  auth,
  requireRole('patient'),
  validate(schema.emptyQuery, 'query'),
  controller.consents,
);
router.put(
  '/consents',
  auth,
  requireRole('patient'),
  validate(schema.consentSchema),
  controller.updateConsent,
);
router.get(
  '/access-history',
  auth,
  requireRole('patient'),
  validate(schema.emptyQuery, 'query'),
  controller.accessHistory,
);
router.get(
  '/notifications',
  auth,
  requireRole('patient', 'doctor', 'operator', 'admin'),
  validate(schema.emptyQuery, 'query'),
  controller.notifications,
);
router.post(
  '/notifications/:id/read',
  auth,
  requireRole('patient', 'doctor', 'operator', 'admin'),
  validate(schema.notificationParams, 'params'),
  validate(schema.emptyQuery),
  controller.readNotification,
);
export default router;
