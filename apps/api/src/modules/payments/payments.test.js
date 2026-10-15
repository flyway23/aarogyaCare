import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { app } from '../../app.js';
import { closePaymentEmailQueue } from './events.js';

const tokenFor = (user) =>
  jwt.sign(
    { type: 'access', role: user.role.toLowerCase() },
    env.JWT_ACCESS_SECRET,
    { subject: user.id, expiresIn: '15m' },
  );

describe('Phase 3 payments and refunds', () => {
  let doctor;
  let patient;
  let operator;
  let appointments = [];
  let payments = [];
  beforeAll(async () => {
    doctor = await prisma.doctorProfile.findFirst({
      where: { user: { email: 'doctor1@aarogyacare.demo' } },
    });
    patient = await prisma.user.findUnique({
      where: { email: 'patient@aarogyacare.demo' },
    });
    operator = await prisma.user.findUnique({
      where: { email: 'operator@aarogyacare.demo' },
    });
    if (!doctor || !patient || !operator)
      throw new Error('Run the database seed before payment tests');
  });
  afterAll(async () => {
    if (payments.length)
      await prisma.refund.deleteMany({
        where: { paymentId: { in: payments } },
      });
    if (payments.length)
      await prisma.payment.deleteMany({ where: { id: { in: payments } } });
    if (appointments.length)
      await prisma.appointment.deleteMany({
        where: { id: { in: appointments } },
      });
    await closePaymentEmailQueue();
  });

  it('mock pays once, confirms the appointment, and protects patient/operator routes', async () => {
    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        slotStart: new Date(Date.now() + 10 * 86_400_000),
        slotEnd: new Date(Date.now() + 10 * 86_400_000 + 15 * 60_000),
        reason: 'Payment test',
        bookedByUserId: patient.id,
        status: 'HELD',
        heldUntil: new Date(Date.now() + 300_000),
      },
    });
    appointments.push(appointment.id);
    const path = '/api/payments/create-order';
    const denied = await request(app)
      .post(path)
      .send({ appointmentId: appointment.id });
    expect(denied.status).toBe(401);
    const wrongRole = await request(app)
      .post(path)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({ appointmentId: appointment.id });
    expect(wrongRole.status).toBe(403);
    const first = await request(app)
      .post(path)
      .set('Authorization', `Bearer ${tokenFor(patient)}`)
      .send({ appointmentId: appointment.id });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({
      mock: true,
      payment: { status: 'PAID', method: 'MOCK' },
    });
    payments.push(first.body.data.payment.id);
    const repeated = await request(app)
      .post(path)
      .set('Authorization', `Bearer ${tokenFor(patient)}`)
      .send({ appointmentId: appointment.id });
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.payment.id).toBe(first.body.data.payment.id);
    expect(
      (await prisma.appointment.findUnique({ where: { id: appointment.id } }))
        .status,
    ).toBe('CONFIRMED');
    const offlineDenied = await request(app)
      .post('/api/payments/offline')
      .set('Authorization', `Bearer ${tokenFor(patient)}`)
      .send({ appointmentId: appointment.id, method: 'CASH' });
    expect(offlineDenied.status).toBe(403);
    const receipt = await request(app)
      .get(`/api/payments/${first.body.data.payment.id}/receipt`)
      .set('Authorization', `Bearer ${tokenFor(patient)}`);
    expect(receipt.status).toBe(200);
    expect(receipt.text).toContain('AarogyaCare payment receipt');
  });

  it.each([
    ['full', 48, 100],
    ['half', 12, 50],
    ['zero', 1, 0],
  ])(
    'calculates %s refunds at the cancellation threshold',
    async (_label, hoursUntil, percentage) => {
      const now = Date.now();
      const appointment = await prisma.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          slotStart: new Date(now + hoursUntil * 3_600_000),
          slotEnd: new Date(now + hoursUntil * 3_600_000 + 900_000),
          reason: 'Refund test',
          bookedByUserId: patient.id,
          status: 'CANCELLED',
          heldUntil: null,
        },
      });
      appointments.push(appointment.id);
      const payment = await prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          amountInr: doctor.feeInr,
          method: 'MOCK',
          status: 'PAID',
          receiptNo: `TEST-${appointment.id}`,
        },
      });
      payments.push(payment.id);
      const response = await request(app)
        .post(`/api/payments/${payment.id}/refund`)
        .set('Authorization', `Bearer ${tokenFor(operator)}`)
        .send({ reason: 'Patient cancellation request' });
      expect(response.status).toBe(200);
      expect(response.body.data.refund.amountInr).toBe(
        Math.floor((doctor.feeInr * percentage) / 100),
      );
      expect(response.body.data.refund.status).toBe('PROCESSED');
    },
  );

  it('verifies Razorpay signatures and treats repeated verify/webhook delivery as idempotent', async () => {
    const oldKey = env.RAZORPAY_KEY_SECRET;
    const oldWebhookKey = env.RAZORPAY_WEBHOOK_SECRET;
    env.RAZORPAY_KEY_SECRET = 'payment-test-secret';
    env.RAZORPAY_WEBHOOK_SECRET = 'webhook-test-secret';
    try {
      const appointment = await prisma.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          slotStart: new Date(Date.now() + 15 * 86_400_000),
          slotEnd: new Date(Date.now() + 15 * 86_400_000 + 900_000),
          reason: 'Signature test',
          bookedByUserId: patient.id,
          status: 'HELD',
          heldUntil: new Date(Date.now() + 300_000),
        },
      });
      appointments.push(appointment.id);
      const orderId = `order_test_${appointment.id}`;
      const gatewayPaymentId = `pay_test_${appointment.id}`;
      const payment = await prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          amountInr: doctor.feeInr,
          method: 'RAZORPAY',
          status: 'CREATED',
          razorpayOrderId: orderId,
          receiptNo: `TEST-${appointment.id}`,
        },
      });
      payments.push(payment.id);
      const verifyPayload = {
        orderId,
        paymentId: gatewayPaymentId,
        signature: createHmac('sha256', env.RAZORPAY_KEY_SECRET)
          .update(`${orderId}|${gatewayPaymentId}`)
          .digest('hex'),
      };
      const verified = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${tokenFor(patient)}`)
        .send(verifyPayload);
      expect(verified.status).toBe(200);
      const verifiedAgain = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${tokenFor(patient)}`)
        .send(verifyPayload);
      expect(verifiedAgain.status).toBe(200);
      expect(verifiedAgain.body.data.duplicate).toBe(true);
      const payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: gatewayPaymentId,
              order_id: orderId,
              status: 'captured',
            },
          },
        },
      };
      const rawBody = JSON.stringify(payload);
      const signature = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
      const webhook = () =>
        request(app)
          .post('/api/payments/webhook')
          .set('x-razorpay-signature', signature)
          .set('Content-Type', 'application/json')
          .send(rawBody);
      const firstDelivery = await webhook();
      const duplicateDelivery = await webhook();
      expect(firstDelivery.status).toBe(200);
      expect(duplicateDelivery.status).toBe(200);
      expect(duplicateDelivery.body.data.duplicate).toBe(true);
      expect(
        (await prisma.payment.findUnique({ where: { id: payment.id } })).status,
      ).toBe('PAID');
    } finally {
      env.RAZORPAY_KEY_SECRET = oldKey;
      env.RAZORPAY_WEBHOOK_SECRET = oldWebhookKey;
    }
  });
});
