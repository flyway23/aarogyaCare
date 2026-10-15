import { asyncHandler } from '../../lib/asyncHandler.js';
import { respond } from '../../lib/respond.js';
import { getPatientProfile, updatePatientProfile } from './service.js';

export const getMyProfile = asyncHandler(async (req, res) => {
  respond(res, await getPatientProfile(req.user.id, req.ip));
});

export const putMyProfile = asyncHandler(async (req, res) => {
  respond(res, await updatePatientProfile(req.user.id, req.body, req.ip));
});
