import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { app } from '../../app.js';

const tokenFor = (user) =>
  jwt.sign(
    { type: 'access', role: user.role.toLowerCase() },
    env.JWT_ACCESS_SECRET,
    { subject: user.id, expiresIn: '15m' },
  );

describe('Phase 7 patient records, consent, chat, feedback, and notifications', () => {
  let patient;
  let doctor;
  let appointment;
  let doctorProfile;
  let patientToken;
  let doctorToken;
  let priorConsent;

  beforeAll(async () => {
    patient = await prisma.user.findUnique({
      where: { email: 'patient@aarogyacare.demo' },
    });
    doctor = await prisma.user.findUnique({
      where: { email: 'doctor1@aarogyacare.demo' },
    });
    doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: doctor.id },
    });
    appointment = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        doctor: { userId: doctor.id },
        status: 'COMPLETED',
      },
    });
    if (!appointment) throw new Error('Run the demo seed before Phase 7 tests');
    patientToken = tokenFor(patient);
    doctorToken = tokenFor(doctor);
    priorConsent = await prisma.consent.findUnique({
      where: {
        patientId_doctorId: { patientId: patient.id, doctorId: doctor.id },
      },
    });
    await prisma.feedback.deleteMany({
      where: { appointmentId: appointment.id },
    });
    await prisma.chatMessage.deleteMany({
      where: { thread: { appointmentId: appointment.id } },
    });
  });

  afterAll(async () => {
    if (appointment) {
      await prisma.feedback.deleteMany({
        where: { appointmentId: appointment.id },
      });
      await prisma.chatThread.deleteMany({
        where: { appointmentId: appointment.id },
      });
    }
    if (patient && doctor) {
      if (priorConsent)
        await prisma.consent.upsert({
          where: {
            patientId_doctorId: { patientId: patient.id, doctorId: doctor.id },
          },
          create: priorConsent,
          update: {
            grantedAt: priorConsent.grantedAt,
            revokedAt: priorConsent.revokedAt,
          },
        });
      else
        await prisma.consent.deleteMany({
          where: { patientId: patient.id, doctorId: doctor.id },
        });
    }
  });

  it('scopes records to patients and keeps operator out of clinical data', async () => {
    const records = await request(app)
      .get('/api/records')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(records.status).toBe(200);
    expect(
      records.body.data.appointments.some((item) => item.id === appointment.id),
    ).toBe(true);
    const operator = await prisma.user.findUnique({
      where: { email: 'operator@aarogyacare.demo' },
    });
    const denied = await request(app)
      .get('/api/records')
      .set('Authorization', `Bearer ${tokenFor(operator)}`);
    expect(denied.status).toBe(403);
  });

  it('grants and revokes consent and allows chat only to appointment participants after completion', async () => {
    const granted = await request(app)
      .put('/api/consents')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctor.id, granted: true });
    expect(granted.status).toBe(200);
    const sent = await request(app)
      .post(`/api/chat/${appointment.id}/messages`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ text: 'Demo follow-up question' });
    expect(sent.status).toBe(201);
    const doctorRead = await request(app)
      .get(`/api/chat/${appointment.id}/messages`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(doctorRead.status).toBe(200);
    expect(
      doctorRead.body.data.some(
        (message) => message.text === 'Demo follow-up question',
      ),
    ).toBe(true);
    const revoked = await request(app)
      .put('/api/consents')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctor.id, granted: false });
    expect(revoked.status).toBe(200);
    const history = await request(app)
      .get('/api/access-history')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(history.status).toBe(200);
    const notifications = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(notifications.status).toBe(200);
  });

  it('accepts feedback only once for a completed visit and supports patient JSON export', async () => {
    const response = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        appointmentId: appointment.id,
        text: 'The demo visit flow was easy to use.',
      });
    expect(response.status).toBe(201);
    const repeated = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        appointmentId: appointment.id,
        text: 'Another feedback submission.',
      });
    expect(repeated.status).toBe(409);
    const exported = await request(app)
      .get('/api/records/export')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(exported.status).toBe(200);
    expect(exported.headers['content-disposition']).toContain(
      'aarogyacare-records.json',
    );
  });

  it('reschedules an owned active appointment to an available slot', async () => {
    const day = new Date(Date.now() + 14 * 86400000);
    while ([0, 6].includes(day.getUTCDay()))
      day.setUTCDate(day.getUTCDate() + 1);
    const date = day.toISOString().slice(0, 10);
    const start = new Date(`${date}T03:30:00.000Z`);
    const pending = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctorProfile.id,
        slotStart: start,
        slotEnd: new Date(start.getTime() + 15 * 60000),
        status: 'CONFIRMED',
        reason: 'Reschedule workflow test',
        bookedByUserId: patient.id,
      },
    });
    try {
      const slots = await request(app)
        .get(`/api/doctors/${doctorProfile.id}/slots`)
        .query({ date })
        .set('Authorization', `Bearer ${patientToken}`);
      const nextSlot = slots.body.data.find(
        (item) => item.start !== start.toISOString(),
      );
      expect(nextSlot).toBeTruthy();
      const moved = await request(app)
        .post(`/api/appointments/${pending.id}/reschedule`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ slotStart: nextSlot.start });
      expect(moved.status).toBe(200);
      expect(moved.body.data.status).toBe('CONFIRMED');
      expect(new Date(moved.body.data.slotStart).toISOString()).toBe(
        nextSlot.start,
      );
    } finally {
      await prisma.appointment.delete({ where: { id: pending.id } });
    }
  });
});
