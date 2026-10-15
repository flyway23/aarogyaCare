import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  emptyObjectSchema,
  queueIdSchema,
  queueListSchema,
  reorderSchema,
} from './schema.js';
import { list, noShow, reorder, skip } from './controller.js';

const router = Router();
router.get(
  '/queue',
  auth,
  requireRole('operator'),
  validate(queueListSchema, 'query'),
  list,
);
router.post(
  '/queue/:id/no-show',
  auth,
  requireRole('operator'),
  validate(queueIdSchema, 'params'),
  validate(emptyObjectSchema),
  noShow,
);
router.post(
  '/queue/:id/skip',
  auth,
  requireRole('operator'),
  validate(queueIdSchema, 'params'),
  validate(emptyObjectSchema),
  skip,
);
router.post(
  '/queue/:id/reorder',
  auth,
  requireRole('operator'),
  validate(queueIdSchema, 'params'),
  validate(reorderSchema),
  reorder,
);

export default router;
