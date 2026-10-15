import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  appointmentIdSchema,
  appointmentListSchema,
  createAppointmentSchema,
  emptyObjectSchema,
} from './schema.js';
import {
  cancel,
  checkIn,
  confirm,
  create,
  listForOperator,
  mine,
} from './controller.js';

const router = Router();
router.get(
  '/appointments/me',
  auth,
  requireRole('patient'),
  validate(emptyObjectSchema, 'query'),
  mine,
);
router.get(
  '/appointments',
  auth,
  requireRole('operator'),
  validate(appointmentListSchema, 'query'),
  listForOperator,
);
router.post(
  '/appointments',
  auth,
  requireRole('patient', 'operator'),
  validate(createAppointmentSchema),
  create,
);
router.post(
  '/appointments/:id/confirm',
  auth,
  requireRole('operator'),
  validate(appointmentIdSchema, 'params'),
  validate(emptyObjectSchema),
  confirm,
);
router.post(
  '/appointments/:id/cancel',
  auth,
  requireRole('patient', 'operator'),
  validate(appointmentIdSchema, 'params'),
  validate(emptyObjectSchema),
  cancel,
);
router.post(
  '/appointments/:id/check-in',
  auth,
  requireRole('operator'),
  validate(appointmentIdSchema, 'params'),
  validate(emptyObjectSchema),
  checkIn,
);

export default router;
