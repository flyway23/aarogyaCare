import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { emptyQuerySchema } from './schema.js';
import { getSession } from './controller.js';

const router = Router();
router.get(
  '/session',
  auth,
  requireRole('admin'),
  validate(emptyQuerySchema, 'query'),
  getSession,
);

export default router;
