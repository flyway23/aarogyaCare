import { asyncHandler } from '../../lib/asyncHandler.js';
import { respond } from '../../lib/respond.js';
import * as service from './service.js';

export const records = asyncHandler(async (req, res) =>
  respond(res, await service.getOwnRecords(req.user.id)),
);
export const exportRecords = asyncHandler(async (req, res) => {
  const data = await service.exportOwnRecords(req.user.id);
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="aarogyacare-records.json"',
  );
  res
    .type('application/json')
    .send(JSON.stringify({ success: true, data }, null, 2));
});
export const chatMessages = asyncHandler(async (req, res) =>
  respond(
    res,
    await service.listChatMessages(req.params.appointmentId, req.user),
  ),
);
export const postChatMessage = asyncHandler(async (req, res) =>
  res.status(201).json({
    success: true,
    data: await service.sendChatMessage(
      req.params.appointmentId,
      req.user,
      req.body.text,
    ),
  }),
);
export const postFeedback = asyncHandler(async (req, res) =>
  res.status(201).json({
    success: true,
    data: await service.createFeedback(
      req.user.id,
      req.body.appointmentId,
      req.body.text,
    ),
  }),
);
export const reschedule = asyncHandler(async (req, res) =>
  respond(
    res,
    await service.rescheduleAppointment(
      req.user.id,
      req.params.id,
      req.body.slotStart,
    ),
  ),
);
export const consents = asyncHandler(async (req, res) =>
  respond(res, await service.listConsents(req.user.id)),
);
export const updateConsent = asyncHandler(async (req, res) =>
  respond(
    res,
    await service.setConsent(req.user.id, req.body.doctorId, req.body.granted),
  ),
);
export const accessHistory = asyncHandler(async (req, res) =>
  respond(res, await service.getAccessHistory(req.user.id)),
);
export const notifications = asyncHandler(async (req, res) =>
  respond(res, await service.getNotifications(req.user.id)),
);
export const readNotification = asyncHandler(async (req, res) =>
  respond(res, await service.markNotificationRead(req.user.id, req.params.id)),
);
