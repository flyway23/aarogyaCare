import { asyncHandler } from '../../lib/asyncHandler.js';
import { respond } from '../../lib/respond.js';
import * as service from './service.js';

export const getSession = asyncHandler(async (req, res) => respond(res, await service.getAdminSession(req.user.id)));

export const getOverview = asyncHandler(async (_req, res) => respond(res, await service.getAdminOverview()));
export const getMeta = asyncHandler(async (_req, res) => respond(res, await service.getAdminMeta()));
export const listResource = asyncHandler(async (req, res) => respond(res, await service.listAdminResource(req.params.resource, req.query)));
export const getResourceItem = asyncHandler(async (req, res) => respond(res, await service.getAdminResourceItem(req.params.resource, req.params.id)));
export const createResourceItem = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.createAdminResourceItem(req.params.resource, req.body, req.user.id, req.ip) }));
export const updateResourceItem = asyncHandler(async (req, res) => respond(res, await service.updateAdminResourceItem(req.params.resource, req.params.id, req.body, req.user.id, req.ip)));
export const deleteResourceItem = asyncHandler(async (req, res) => respond(res, await service.deleteAdminResourceItem(req.params.resource, req.params.id, req.user.id, req.ip)));
export const restoreResourceItem = asyncHandler(async (req, res) => respond(res, await service.restoreAdminResourceItem(req.params.resource, req.params.id, req.user.id, req.ip)));
export const exportResource = asyncHandler(async (req, res) => {
  const csv = await service.exportAdminResource(req.params.resource);
  res.type('text/csv').setHeader('Content-Disposition', `attachment; filename="${req.params.resource}.csv"`).send(csv);
});
export const hideFeedback = asyncHandler(async (req, res) => respond(res, await service.hideFeedback(req.params.id, req.user.id, req.ip)));
export const failedDocuments = asyncHandler(async (_req, res) => respond(res, await service.listFailedDocuments()));
export const retryDocument = asyncHandler(async (req, res) => respond(res, await service.retryDocument(req.params.id, req.user.id, req.ip)));
