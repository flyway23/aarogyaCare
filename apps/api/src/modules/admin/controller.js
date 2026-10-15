import { asyncHandler } from '../../lib/asyncHandler.js';
import { respond } from '../../lib/respond.js';
import { getAdminSession } from './service.js';

export const getSession = asyncHandler(async (req, res) => {
  respond(res, await getAdminSession(req.user.id));
});
