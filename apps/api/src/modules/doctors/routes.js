import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  dateQuerySchema,
  doctorIdSchema,
  doctorListSchema,
  emptyObjectSchema,
  leaveSchema,
  scheduleSchema,
  statusSchema,
} from './schema.js';
import {
  doctor,
  doctors,
  postLeave,
  putSchedule,
  putStatus,
  queueInfo,
  slots,
  specialties,
} from './controller.js';

const router = Router();
const allRoles = ['patient', 'doctor', 'operator', 'admin'];
router.get(
  '/specialties',
  auth,
  requireRole(...allRoles),
  validate(emptyObjectSchema, 'query'),
  specialties,
);
router.get(
  '/doctors',
  auth,
  requireRole(...allRoles),
  validate(doctorListSchema, 'query'),
  doctors,
);
router.get(
  '/doctors/:id',
  auth,
  requireRole(...allRoles),
  validate(doctorIdSchema, 'params'),
  validate(emptyObjectSchema, 'query'),
  doctor,
);
router.get(
  '/doctors/:id/slots',
  auth,
  requireRole(...allRoles),
  validate(doctorIdSchema, 'params'),
  validate(dateQuerySchema, 'query'),
  slots,
);
router.get(
  '/doctors/:id/queue-info',
  auth,
  requireRole(...allRoles),
  validate(doctorIdSchema, 'params'),
  validate(dateQuerySchema, 'query'),
  queueInfo,
);
router.put(
  '/doctors/me/schedule',
  auth,
  requireRole('doctor'),
  validate(scheduleSchema),
  putSchedule,
);
router.post(
  '/doctors/me/leave',
  auth,
  requireRole('doctor'),
  validate(leaveSchema),
  postLeave,
);
router.put(
  '/doctors/me/status',
  auth,
  requireRole('doctor'),
  validate(statusSchema),
  putStatus,
);

export default router;
