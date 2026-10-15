import { asyncHandler } from '../../lib/asyncHandler.js';
import { respond } from '../../lib/respond.js';
import {
  changeQueueOrder,
  getQueue,
  markNoShow,
  skipQueueEntry,
} from './service.js';

export const list = asyncHandler(async (req, res) =>
  respond(res, await getQueue(req.query.doctorId, req.query.date)),
);
export const noShow = asyncHandler(async (req, res) =>
  respond(res, await markNoShow(req.params.id)),
);
export const skip = asyncHandler(async (req, res) =>
  respond(res, await skipQueueEntry(req.params.id)),
);
export const reorder = asyncHandler(async (req, res) =>
  respond(
    res,
    await changeQueueOrder(req.params.id, req.body.position, req.body.reason),
  ),
);
