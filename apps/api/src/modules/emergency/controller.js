import { asyncHandler } from '../../lib/asyncHandler.js';
import { respond } from '../../lib/respond.js';
import {
  acceptEmergency,
  closeEmergency,
  escalateAppointment,
  listEmergencies,
  raiseEmergency,
  reserveEmergencyBed,
} from './service.js';

export const raise = asyncHandler(async (req, res) =>
  respond(res, await raiseEmergency(req.body, req.user)),
);
export const list = asyncHandler(async (req, res) =>
  respond(res, await listEmergencies(req.user)),
);
export const accept = asyncHandler(async (req, res) =>
  respond(res, await acceptEmergency(req.params.id, req.user)),
);
export const reserve = asyncHandler(async (req, res) =>
  respond(
    res,
    await reserveEmergencyBed(req.params.id, req.body.bedId, req.user),
  ),
);
export const close = asyncHandler(async (req, res) =>
  respond(res, await closeEmergency(req.params.id, req.user)),
);
export const escalate = asyncHandler(async (req, res) =>
  respond(res, await escalateAppointment(req.params.id, req.body, req.user)),
);
