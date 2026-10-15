import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../lib/httpError.js';
import { env } from '../../config/env.js';
import { eventBus } from '../../lib/eventBus.js';

const paymentInclude = {
  appointment: {
    include: {
      patient: true,
      doctor: { include: { user: true, specialty: true } },
    },
  },
};
const amountFor = (appointment) => appointment.doctor.feeInr;
const sign = (secret, value) =>
  createHmac('sha256', secret).update(value).digest();
const equalHex = (provided, expected) => {
  if (!/^[\da-f]{64}$/i.test(provided)) return false;
  const a = Buffer.from(provided, 'hex');
  const b = expected;
  return a.length === b.length && timingSafeEqual(a, b);
};
const razorpay = async (path, body) => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET)
    throw new HttpError(503, 'Razorpay is not configured');
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new HttpError(
      502,
      data.error?.description || 'Payment gateway request failed',
    );
  return data;
};
const receiptNo = () =>
  `AC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const confirmAndPay = async (tx, paymentId, paymentData) => {
  const updated = await tx.payment.updateMany({
    where: { id: paymentId, status: 'CREATED' },
    data: paymentData,
  });
  if (!updated.count) {
    const current = await tx.payment.findUnique({ where: { id: paymentId } });
    if (
      current?.status === 'PAID' &&
      (!paymentData.razorpayPaymentId ||
        current.razorpayPaymentId === paymentData.razorpayPaymentId)
    )
      return { payment: current, duplicate: true };
    if (current?.status === 'PAID')
      throw new HttpError(
        409,
        'Payment was already completed with a different gateway payment',
      );
    throw new HttpError(409, 'Payment is no longer payable');
  }
  const payment = await tx.payment.findUnique({ where: { id: paymentId } });
  const confirmed = await tx.appointment.updateMany({
    where: {
      id: payment.appointmentId,
      status: 'HELD',
      heldUntil: { gt: new Date() },
    },
    data: { status: 'CONFIRMED', heldUntil: null },
  });
  if (!confirmed.count)
    throw new HttpError(
      409,
      'Appointment hold has expired or is no longer active',
    );
  return { payment, duplicate: false };
};
const emitPaid = (paymentId, duplicate) => {
  if (!duplicate) eventBus.emit('payment.paid', { paymentId });
};

export const createPaymentOrder = async (appointmentId, userId) => {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patientId: userId },
    include: { doctor: true },
  });
  if (!appointment) throw new HttpError(404, 'Appointment not found');
  const existing = await prisma.payment.findUnique({
    where: { appointmentId },
  });
  if (existing?.status === 'PAID')
    return { mock: env.MOCK_PAYMENTS, payment: existing };
  if (appointment.status !== 'HELD' || appointment.heldUntil <= new Date())
    throw new HttpError(
      409,
      'Appointment hold has expired or is no longer active',
    );
  if (existing?.status === 'CREATED' && existing.razorpayOrderId)
    return {
      mock: false,
      payment: existing,
      order: {
        id: existing.razorpayOrderId,
        amount: existing.amountInr * 100,
        currency: 'INR',
      },
      keyId: env.RAZORPAY_KEY_ID,
    };
  if (env.MOCK_PAYMENTS) {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.upsert({
        where: { appointmentId },
        create: {
          appointmentId,
          amountInr: amountFor(appointment),
          method: 'MOCK',
          status: 'CREATED',
          receiptNo: receiptNo(),
        },
        update: {},
      });
      return confirmAndPay(tx, payment.id, { status: 'PAID' });
    });
    emitPaid(result.payment.id, result.duplicate);
    return { mock: true, payment: result.payment };
  }
  const order = await razorpay('orders', {
    amount: amountFor(appointment) * 100,
    currency: 'INR',
    receipt: `appointment-${appointmentId}`,
    notes: { appointmentId },
  });
  const payment = await prisma.payment.upsert({
    where: { appointmentId },
    create: {
      appointmentId,
      amountInr: amountFor(appointment),
      method: 'RAZORPAY',
      status: 'CREATED',
      razorpayOrderId: order.id,
      receiptNo: receiptNo(),
    },
    update: { razorpayOrderId: order.id },
  });
  return {
    mock: false,
    payment,
    order: { id: order.id, amount: order.amount, currency: order.currency },
    keyId: env.RAZORPAY_KEY_ID,
  };
};

export const verifyPayment = async (
  { orderId, paymentId: gatewayPaymentId, signature },
  userId,
) => {
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId: orderId, appointment: { patientId: userId } },
  });
  if (!payment) throw new HttpError(404, 'Payment order not found');
  if (!env.RAZORPAY_KEY_SECRET)
    throw new HttpError(503, 'Razorpay is not configured');
  if (
    !equalHex(
      signature,
      sign(env.RAZORPAY_KEY_SECRET, `${orderId}|${gatewayPaymentId}`),
    )
  )
    throw new HttpError(400, 'Invalid payment signature');
  const result = await prisma.$transaction((tx) =>
    confirmAndPay(tx, payment.id, {
      status: 'PAID',
      razorpayPaymentId: gatewayPaymentId,
    }),
  );
  emitPaid(payment.id, result.duplicate);
  return { payment: result.payment, duplicate: result.duplicate };
};

export const processWebhook = async (body, rawBody, signature) => {
  if (!env.RAZORPAY_WEBHOOK_SECRET)
    throw new HttpError(503, 'Razorpay webhook is not configured');
  if (
    !signature ||
    !equalHex(signature, sign(env.RAZORPAY_WEBHOOK_SECRET, rawBody))
  )
    throw new HttpError(401, 'Invalid webhook signature');
  if (!['payment.captured', 'order.paid'].includes(body.event))
    return { received: true, ignored: true };
  const entity = body.payload.payment?.entity;
  if (!entity?.id || !entity?.order_id)
    return { received: true, ignored: true };
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId: entity.order_id },
  });
  if (!payment) return { received: true, unmatched: true };
  const result = await prisma.$transaction((tx) =>
    confirmAndPay(tx, payment.id, {
      status: 'PAID',
      razorpayPaymentId: entity.id,
    }),
  );
  emitPaid(payment.id, result.duplicate);
  return { received: true, duplicate: result.duplicate };
};

export const recordOfflinePayment = async ({ appointmentId, method }) => {
  const result = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: true },
    });
    if (!appointment) throw new HttpError(404, 'Appointment not found');
    if (appointment.status !== 'HELD' || appointment.heldUntil <= new Date())
      throw new HttpError(
        409,
        'Appointment hold has expired or is no longer active',
      );
    const existing = await tx.payment.findUnique({ where: { appointmentId } });
    if (existing?.status === 'PAID') {
      if (existing.method === method)
        return { payment: existing, duplicate: true };
      throw new HttpError(409, 'Appointment already has a payment');
    }
    if (existing)
      throw new HttpError(409, 'An online payment is already pending');
    const payment = await tx.payment.create({
      data: {
        appointmentId,
        amountInr: amountFor(appointment),
        method,
        status: 'CREATED',
        receiptNo: receiptNo(),
      },
    });
    return confirmAndPay(tx, payment.id, { status: 'PAID' });
  });
  emitPaid(result.payment.id, result.duplicate);
  return result;
};

export const refundPayment = async (id, reason) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: paymentInclude,
  });
  if (!payment) throw new HttpError(404, 'Payment not found');
  if (payment.status === 'REFUNDED')
    return {
      payment,
      refund: await prisma.refund.findUnique({ where: { paymentId: id } }),
      duplicate: true,
    };
  if (payment.status !== 'PAID' || payment.appointment.status !== 'CANCELLED')
    throw new HttpError(
      409,
      'Only paid cancelled appointments can be refunded',
    );
  const hours =
    (payment.appointment.slotStart - payment.appointment.updatedAt) / 3_600_000;
  const percentage = hours >= 24 ? 100 : hours >= 2 ? 50 : 0;
  const amountInr = Math.floor((payment.amountInr * percentage) / 100);
  let refund = await prisma.refund.findUnique({ where: { paymentId: id } });
  if (refund?.status === 'PROCESSED')
    return { payment, refund, duplicate: true };
  if (refund?.status === 'CREATED')
    throw new HttpError(409, 'Refund is already being processed');
  refund = await prisma.refund.upsert({
    where: { paymentId: id },
    create: { paymentId: id, amountInr, reason, status: 'CREATED' },
    update: { amountInr, reason, status: 'CREATED' },
  });
  if (!amountInr) {
    const saved = await prisma.refund.update({
      where: { id: refund.id },
      data: { status: 'PROCESSED' },
    });
    return { payment, refund: saved, refundPercentage: 0 };
  }
  try {
    if (!env.MOCK_PAYMENTS && payment.method === 'RAZORPAY')
      await razorpay(`payments/${payment.razorpayPaymentId}/refund`, {
        amount: amountInr * 100,
        notes: { reason },
      });
    const [savedRefund, savedPayment] = await prisma.$transaction([
      prisma.refund.update({
        where: { id: refund.id },
        data: { status: 'PROCESSED' },
      }),
      prisma.payment.update({ where: { id }, data: { status: 'REFUNDED' } }),
    ]);
    return {
      payment: savedPayment,
      refund: savedRefund,
      refundPercentage: percentage,
    };
  } catch (error) {
    await prisma.refund.update({
      where: { id: refund.id },
      data: { status: 'FAILED' },
    });
    throw error;
  }
};

export const loadReceipt = async (id, requester) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: paymentInclude,
  });
  if (!payment) throw new HttpError(404, 'Payment not found');
  if (
    requester.role === 'patient' &&
    payment.appointment.patientId !== requester.id
  )
    throw new HttpError(404, 'Payment not found');
  return payment;
};
