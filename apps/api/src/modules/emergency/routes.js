import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { bedIdSchema } from '../beds/schema.js';
import {
  emptyObjectSchema,
  emergencyIdSchema,
  escalateSchema,
  raiseEmergencySchema,
  reserveEmergencyBedSchema,
} from './schema.js';
import { accept, close, escalate, list, raise, reserve } from './controller.js';

const router = Router();
router.post(
  '/emergency',
  auth,
  requireRole('patient', 'operator'),
  validate(raiseEmergencySchema),
  raise,
);
router.get(
  '/emergency',
  auth,
  requireRole('operator', 'doctor', 'admin'),
  validate(emptyObjectSchema, 'query'),
  list,
);
router.post(
  '/emergency/:id/accept',
  auth,
  requireRole('operator', 'admin'),
  validate(emergencyIdSchema, 'params'),
  validate(emptyObjectSchema),
  accept,
);
router.post(
  '/emergency/:id/reserve-bed',
  auth,
  requireRole('operator', 'admin'),
  validate(emergencyIdSchema, 'params'),
  validate(reserveEmergencyBedSchema),
  reserve,
);
router.post(
  '/emergency/:id/close',
  auth,
  requireRole('operator', 'admin'),
  validate(emergencyIdSchema, 'params'),
  validate(emptyObjectSchema),
  close,
);
router.post(
  '/appointments/:id/escalate',
  auth,
  requireRole('operator'),
  validate(bedIdSchema, 'params'),
  validate(escalateSchema),
  escalate,
);
export default router;
