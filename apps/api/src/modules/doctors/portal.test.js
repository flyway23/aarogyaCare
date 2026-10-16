import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../config/env.js';
import { app } from '../../app.js';
import { eventBus } from '../../lib/eventBus.js';
import { prisma } from '../../lib/prisma.js';
import { kolkataDate } from './service.js';

const tokenFor = (user) =>
  jwt.sign(
    { type: 'access', role: user.role.toLowerCase() },
    env.JWT_ACCESS_SECRET,
    { subject: user.id, expiresIn: '15m' },
  );

describe('Phase 6 doctor portal', () => {
  let patient;
  let doctor;
  let otherDoctor;
  let appointment;
  let document;
  beforeAll(async () => {
    doctor = await prisma.user.findUnique({
      where: { email: 'doctor1@aarogyacare.demo' },
    });
    otherDoctor = await prisma.user.findUnique({
      where: { email: 'doctor2@aarogyacare.demo' },
    });
    const profile = await prisma.doctorProfile.findUnique({
      where: { userId: doctor.id },
    });
    patient = await prisma.user.create({
      data: {
        email: `doctor-portal-test-${Date.now()}@aarogyacare.local`,
        name: 'Doctor Portal Test Patient',
        role: 'PATIENT',
        passwordHash: 'unused-test-password',
        patientProfile: { create: { allergies: 'Penicillin' } },
      },
    });
    appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: profile.id,
        slotStart: new Date(),
        slotEnd: new Date(Date.now() + 15 * 60_000),
        status: 'CHECKED_IN',
        reason: 'Test consultation',
        bookedByUserId: patient.id,
      },
    });
    document = await prisma.document.create({
      data: {
        patientId: patient.id,
        appointmentId: appointment.id,
        originalName: 'record.pdf',
        mimeType: 'application/pdf',
        storagePath: 'test-only.pdf',
        status: 'READY',
        type: 'LAB_REPORT',
        extractedText: 'Hemoglobin 8.8 g/dL',
        extractions: {
          create: {
            kind: 'lab',
            value: 'Hemoglobin 8.8 g/dL',
            sourceSnippet: 'Hemoglobin 8.8 g/dL range 12-16',
            isAbnormal: true,
          },
        },
      },
    });
    await prisma.timelineEvent.create({
      data: {
        patientId: patient.id,
        documentId: document.id,
        eventDate: new Date(),
        description: 'Lab report added',
      },
    });
    await prisma.visitSummary.create({
      data: {
        patientId: patient.id,
        appointmentId: appointment.id,
        content: 'Machine-generated – verify with original documents',
      },
    });
  });
  afterAll(async () => {
    if (patient) {
      await prisma.auditLog.deleteMany({ where: { entityId: patient.id } });
      await prisma.consent.deleteMany({ where: { patientId: patient.id } });
      await prisma.consultationReport.deleteMany({
        where: { appointmentId: appointment?.id },
      });
      await prisma.document.deleteMany({ where: { patientId: patient.id } });
      await prisma.appointment.deleteMany({ where: { patientId: patient.id } });
      await prisma.user.delete({ where: { id: patient.id } });
    }
  });

  it('scopes patient records, completes consultations, creates immutable reports, and emits completion', async () => {
    const doctorToken = tokenFor(doctor);
    const otherToken = tokenFor(otherDoctor);
    const queue = await request(app)
      .get('/api/doctor/today')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(queue.status).toBe(200);
    expect(
      queue.body.data.appointments.some((item) => item.id === appointment.id),
    ).toBe(true);

    const listed = await request(app)
      .get('/api/doctor/patients')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.some((item) => item.id === patient.id)).toBe(false);
    const deniedRecords = await request(app)
      .get(`/api/doctor/patients/${patient.id}/records`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(deniedRecords.status).toBe(404);
    const records = await request(app)
      .get(`/api/doctor/patients/${patient.id}/records`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(records.status).toBe(200);
    expect(
      records.body.data.documents[0].extractions[0].sourceSnippet,
    ).toContain('range 12-16');
    expect(records.body.data.latestSummary.content).toContain(
      'Machine-generated',
    );
    expect(
      await prisma.auditLog.count({
        where: {
          userId: doctor.id,
          action: 'DOCTOR_PATIENT_RECORDS_READ',
          entityId: patient.id,
        },
      }),
    ).toBeGreaterThan(0);

    const profileDenied = await request(app)
      .put('/api/patients/me/profile')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ allergies: 'Changed' });
    expect(profileDenied.status).toBe(403);
    expect(
      (
        await request(app)
          .put(`/api/documents/${document.id}`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({ extractedText: 'Changed' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(`/api/documents/${document.id}`)
          .set('Authorization', `Bearer ${doctorToken}`)
      ).status,
    ).toBe(404);

    await prisma.consent.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        revokedAt: new Date(),
      },
    });
    expect(
      (
        await request(app)
          .get(`/api/doctor/patients/${patient.id}/records`)
          .set('Authorization', `Bearer ${doctorToken}`)
      ).status,
    ).toBe(403);
    await prisma.consent.delete({
      where: {
        patientId_doctorId: { patientId: patient.id, doctorId: doctor.id },
      },
    });

    const started = await request(app)
      .post(`/api/consultations/${appointment.id}/start`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({});
    expect(started.status).toBe(200);
    expect(started.body.data.status).toBe('IN_CONSULTATION');
    const completedEvent = new Promise((resolve) =>
      eventBus.once('consultation.completed', resolve),
    );
    const ended = await request(app)
      .post(`/api/consultations/${appointment.id}/end`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({});
    expect(ended.status).toBe(200);
    expect(ended.body.data.status).toBe('COMPLETED');
    expect((await completedEvent).appointmentId).toBe(appointment.id);
    const treatedPatients = await request(app)
      .get('/api/doctor/patients')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(
      treatedPatients.body.data.some((item) => item.id === patient.id),
    ).toBe(true);

    const payload = {
      diagnosis: 'Seasonal allergy',
      notes: 'Follow up if symptoms continue',
      followUpDate: kolkataDate(new Date().toISOString().slice(0, 10))
        .toISOString()
        .slice(0, 10),
      medicines: [
        {
          medicine: 'Cetirizine',
          dosage: '10 mg',
          frequency: 'Once daily',
          duration: '5 days',
          instructions: 'At night',
        },
      ],
    };
    const saved = await request(app)
      .post(`/api/consultations/${appointment.id}/report`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send(payload);
    expect(saved.status).toBe(201);
    expect(saved.body.data.medicines[0].medicine).toBe('Cetirizine');
    const repeated = await request(app)
      .post(`/api/consultations/${appointment.id}/report`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send(payload);
    expect(repeated.status).toBe(409);
    const changed = await request(app)
      .put(`/api/consultations/${appointment.id}/report`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send(payload);
    expect(changed.status).toBe(404);
  });
});
