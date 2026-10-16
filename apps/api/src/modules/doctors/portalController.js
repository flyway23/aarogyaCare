import { asyncHandler } from '../../lib/asyncHandler.js';
import { respond } from '../../lib/respond.js';
import {
  createConsultationReport,
  endConsultation,
  getDoctorToday,
  getPatientRecords,
  listDoctorPatients,
  startConsultation,
} from './portalService.js';

export const today = asyncHandler(async (req, res) =>
  respond(res, await getDoctorToday(req.user.id)),
);
export const patients = asyncHandler(async (req, res) =>
  respond(res, await listDoctorPatients(req.user.id)),
);
export const records = asyncHandler(async (req, res) =>
  respond(res, await getPatientRecords(req.params.id, req.user.id, req.ip)),
);
export const start = asyncHandler(async (req, res) =>
  respond(res, await startConsultation(req.params.appointmentId, req.user.id)),
);
export const end = asyncHandler(async (req, res) =>
  respond(res, await endConsultation(req.params.appointmentId, req.user.id)),
);
export const report = asyncHandler(async (req, res) => {
  const data = await createConsultationReport(
    req.params.appointmentId,
    req.body,
    req.user.id,
  );
  res.status(201);
  respond(res, data);
});
