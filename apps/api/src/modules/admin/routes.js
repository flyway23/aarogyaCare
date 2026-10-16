import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  emptyQuerySchema,
  itemParams,
  resourceBody,
  resourceItemParams,
  resourceParams,
  resourceQuery,
} from './schema.js';
import * as controller from './controller.js';

const router = Router();
router.get(
  '/session',
  auth,
  requireRole('admin'),
  validate(emptyQuerySchema, 'query'),
  controller.getSession,
);
router.get(
  '/overview',
  auth,
  requireRole('admin'),
  validate(emptyQuerySchema, 'query'),
  controller.getOverview,
);
router.get(
  '/meta',
  auth,
  requireRole('admin'),
  validate(emptyQuerySchema, 'query'),
  controller.getMeta,
);
router.get(
  '/documents/failed',
  auth,
  requireRole('admin'),
  validate(emptyQuerySchema, 'query'),
  controller.failedDocuments,
);
router.post(
  '/documents/:id/retry',
  auth,
  requireRole('admin'),
  validate(itemParams, 'params'),
  validate(emptyQuerySchema),
  controller.retryDocument,
);
router.patch(
  '/feedback/:id/hide',
  auth,
  requireRole('admin'),
  validate(itemParams, 'params'),
  validate(emptyQuerySchema),
  controller.hideFeedback,
);
router.get(
  '/:resource/export.csv',
  auth,
  requireRole('admin'),
  validate(resourceParams, 'params'),
  validate(emptyQuerySchema, 'query'),
  controller.exportResource,
);
router.get(
  '/:resource/:id',
  auth,
  requireRole('admin'),
  validate(resourceItemParams, 'params'),
  validate(emptyQuerySchema, 'query'),
  controller.getResourceItem,
);
router.post(
  '/:resource/:id/restore',
  auth,
  requireRole('admin'),
  validate(resourceItemParams, 'params'),
  validate(emptyQuerySchema),
  controller.restoreResourceItem,
);
router.put(
  '/:resource/:id',
  auth,
  requireRole('admin'),
  validate(resourceItemParams, 'params'),
  validate(resourceBody),
  controller.updateResourceItem,
);
router.delete(
  '/:resource/:id',
  auth,
  requireRole('admin'),
  validate(resourceItemParams, 'params'),
  validate(emptyQuerySchema),
  controller.deleteResourceItem,
);
router.get(
  '/:resource',
  auth,
  requireRole('admin'),
  validate(resourceParams, 'params'),
  validate(resourceQuery, 'query'),
  controller.listResource,
);
router.post(
  '/:resource',
  auth,
  requireRole('admin'),
  validate(resourceParams, 'params'),
  validate(resourceBody),
  controller.createResourceItem,
);

export default router;
