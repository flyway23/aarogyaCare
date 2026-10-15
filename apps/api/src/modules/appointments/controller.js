import { asyncHandler } from '../../lib/asyncHandler.js';
import { respond } from '../../lib/respond.js';
import {
  cancelAppointment,
  checkInAppointment,
  confirmAppointment,
  createAppointment,
  listDoctorAppointments,
  listMyAppointments,
} from './service.js';

export const create = asyncHandler(async (req, res) =>
  respond(res, await createAppointment(req.body, req.user)),
);
export const mine = asyncHandler(async (req, res) =>
  respond(res, await listMyAppointments(req.user.id)),
);
export const listForOperator = asyncHandler(async (req, res) =>
  respond(
    res,
    await listDoctorAppointments(req.query.doctorId, req.query.date),
  ),
);
export const cancel = asyncHandler(async (req, res) =>
  respond(res, await cancelAppointment(req.params.id, req.user)),
);
export const confirm = asyncHandler(async (req, res) =>
  respond(res, await confirmAppointment(req.params.id)),
);
export const checkIn = asyncHandler(async (req, res) =>
  respond(res, await checkInAppointment(req.params.id)),
);
