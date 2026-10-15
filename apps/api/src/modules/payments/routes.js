import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  createOrderSchema,
  emptyObjectSchema,
  offlineSchema,
  paymentIdSchema,
  refundSchema,
  verifySchema,
  webhookSchema,
} from './schema.js';
import {
  createOrder,
  verify,
  webhook,
  offline,
  refund,
  receipt,
} from './controller.js';

const router = Router();
router.post('/webhook', validate(webhookSchema), webhook);
router.post(
  '/create-order',
  auth,
  requireRole('patient'),
  validate(createOrderSchema),
  createOrder,
);
router.post(
  '/verify',
  auth,
  requireRole('patient'),
  validate(verifySchema),
  verify,
);
router.post(
  '/offline',
  auth,
  requireRole('operator'),
  validate(offlineSchema),
  offline,
);
router.post(
  '/:id/refund',
  auth,
  requireRole('operator', 'admin'),
  validate(paymentIdSchema, 'params'),
  validate(refundSchema),
  refund,
);
router.get(
  '/:id/receipt',
  auth,
  requireRole('patient', 'operator', 'admin'),
  validate(paymentIdSchema, 'params'),
  validate(emptyObjectSchema, 'query'),
  receipt,
);
export default router;
