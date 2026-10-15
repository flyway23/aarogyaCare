import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  assignmentSchema,
  bedIdSchema,
  bedStatusSchema,
  emptyObjectSchema,
} from './schema.js';
import { assign, list, release, reserve, status } from './controller.js';

const router = Router();
router.get(
  '/',
  auth,
  requireRole('operator', 'admin'),
  validate(emptyObjectSchema, 'query'),
  list,
);
router.post(
  '/:id/assign',
  auth,
  requireRole('operator', 'admin'),
  validate(bedIdSchema, 'params'),
  validate(assignmentSchema),
  assign,
);
router.post(
  '/:id/release',
  auth,
  requireRole('operator', 'admin'),
  validate(bedIdSchema, 'params'),
  validate(emptyObjectSchema),
  release,
);
router.post(
  '/:id/status',
  auth,
  requireRole('operator', 'admin'),
  validate(bedIdSchema, 'params'),
  validate(bedStatusSchema),
  status,
);
router.post(
  '/:id/reserve',
  auth,
  requireRole('operator', 'admin'),
  validate(bedIdSchema, 'params'),
  validate(emptyObjectSchema),
  reserve,
);
export default router;
