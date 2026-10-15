import { asyncHandler } from '../../lib/asyncHandler.js';
import { respond } from '../../lib/respond.js';
import {
  addDoctorLeave,
  getDoctor,
  getDoctorSlots,
  getQueueInfo,
  listDoctors,
  listSpecialties,
  replaceDoctorSchedule,
  setDoctorStatus,
} from './service.js';

export const specialties = asyncHandler(async (_req, res) =>
  respond(res, await listSpecialties()),
);
export const doctors = asyncHandler(async (req, res) =>
  respond(res, await listDoctors(req.query.specialtyId)),
);
export const doctor = asyncHandler(async (req, res) =>
  respond(res, await getDoctor(req.params.id)),
);
export const slots = asyncHandler(async (req, res) =>
  respond(res, await getDoctorSlots(req.params.id, req.query.date)),
);
export const queueInfo = asyncHandler(async (req, res) =>
  respond(
    res,
    await getQueueInfo(req.params.id, req.query.date, req.query.slotStart),
  ),
);
export const putSchedule = asyncHandler(async (req, res) =>
  respond(res, await replaceDoctorSchedule(req.user.id, req.body.schedules)),
);
export const postLeave = asyncHandler(async (req, res) =>
  respond(res, await addDoctorLeave(req.user.id, req.body.date)),
);
export const putStatus = asyncHandler(async (req, res) =>
  respond(res, await setDoctorStatus(req.user.id, req.body.status)),
);
