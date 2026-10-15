import { asyncHandler } from '../../lib/asyncHandler.js';
import { respond } from '../../lib/respond.js';
import {
  createPaymentOrder,
  loadReceipt,
  processWebhook,
  recordOfflinePayment,
  refundPayment,
  verifyPayment,
} from './service.js';

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ],
  );
export const createOrder = asyncHandler(async (req, res) =>
  respond(res, await createPaymentOrder(req.body.appointmentId, req.user.id)),
);
export const verify = asyncHandler(async (req, res) =>
  respond(res, await verifyPayment(req.body, req.user.id)),
);
export const webhook = asyncHandler(async (req, res) =>
  respond(
    res,
    await processWebhook(
      req.body,
      req.rawBody,
      req.get('x-razorpay-signature'),
    ),
  ),
);
export const offline = asyncHandler(async (req, res) =>
  respond(res, await recordOfflinePayment(req.body)),
);
export const refund = asyncHandler(async (req, res) =>
  respond(res, await refundPayment(req.params.id, req.body.reason)),
);
export const receipt = asyncHandler(async (req, res) => {
  const payment = await loadReceipt(req.params.id, req.user);
  const fields = [
    ['Receipt', payment.receiptNo],
    ['Patient', payment.appointment.patient.name],
    ['Doctor', payment.appointment.doctor.user.name],
    ['Specialty', payment.appointment.doctor.specialty.name],
    ['Appointment', payment.appointment.slotStart.toISOString()],
    ['Amount', `INR ${payment.amountInr}`],
    ['Method', payment.method],
    ['Status', payment.status],
  ];
  res
    .type('html')
    .send(
      `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(payment.receiptNo)}</title><style>body{font:16px system-ui;max-width:700px;margin:48px auto;padding:0 24px;color:#17251f}h1{color:#147d59}dt{font-weight:700;margin-top:16px}dd{margin:4px 0}button{margin-top:28px;padding:10px 18px}</style></head><body><h1>AarogyaCare payment receipt</h1><dl>${fields.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl><button onclick="window.print()">Print receipt</button></body></html>`,
    );
});
