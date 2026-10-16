import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { emptyObjectSchema } from './schema.js';
import {
  consultationParams,
  consultationReportSchema,
  patientIdParams,
} from './portalSchema.js';
import {
  end,
  patients,
  records,
  report,
  start,
  today,
} from './portalController.js';

const router = Router();
const doctorOnly = [auth, requireRole('doctor')];
router.get(
  '/doctor/today',
  ...doctorOnly,
  validate(emptyObjectSchema, 'query'),
  today,
);
router.get(
  '/doctor/patients',
  ...doctorOnly,
  validate(emptyObjectSchema, 'query'),
  patients,
);
router.get(
  '/doctor/patients/:id/records',
  ...doctorOnly,
  validate(patientIdParams, 'params'),
  validate(emptyObjectSchema, 'query'),
  records,
);
router.post(
  '/consultations/:appointmentId/start',
  ...doctorOnly,
  validate(consultationParams, 'params'),
  validate(emptyObjectSchema),
  start,
);
router.post(
  '/consultations/:appointmentId/end',
  ...doctorOnly,
  validate(consultationParams, 'params'),
  validate(emptyObjectSchema),
  end,
);
router.post(
  '/consultations/:appointmentId/report',
  ...doctorOnly,
  validate(consultationParams, 'params'),
  validate(consultationReportSchema),
  report,
);
export default router;
