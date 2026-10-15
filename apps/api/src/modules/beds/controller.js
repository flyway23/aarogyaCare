import { asyncHandler } from '../../lib/asyncHandler.js';
import { respond } from '../../lib/respond.js';
import {
  assignBed,
  getBeds,
  releaseBed,
  reserveBed,
  setBedStatus,
} from './service.js';

export const list = asyncHandler(async (_req, res) =>
  respond(res, await getBeds()),
);
export const assign = asyncHandler(async (req, res) =>
  respond(res, await assignBed(req.params.id, req.body, req.user)),
);
export const release = asyncHandler(async (req, res) =>
  respond(res, await releaseBed(req.params.id, req.user)),
);
export const reserve = asyncHandler(async (req, res) =>
  respond(res, await reserveBed(req.params.id, req.user)),
);
export const status = asyncHandler(async (req, res) =>
  respond(res, await setBedStatus(req.params.id, req.body.status, req.user)),
);
