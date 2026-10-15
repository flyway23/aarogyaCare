import jwt from 'jsonwebtoken';
import { createServer } from 'node:http';
import request from 'supertest';
import { io as connectSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { app } from '../../app.js';
import { closeEmergencyAlertQueue } from './events.js';
import { attachSocketServer, closeSocketServer } from '../../lib/socket.js';

const tokenFor = (user) =>
  jwt.sign(
    { type: 'access', role: user.role.toLowerCase() },
    env.JWT_ACCESS_SECRET,
    { subject: user.id, expiresIn: '15m' },
  );

describe('Phase 4 emergencies', () => {
  let patient;
  let operator;
  let doctor;
  let profile;
  let ward;
  let bed;
  let testPatientId;
  const emergencyIds = [];
  const appointmentIds = [];
  beforeAll(async () => {
    const leftovers = await prisma.user.findMany({
      where: { email: { startsWith: 'emergency-test-' } },
      select: { id: true },
    });
    const leftoverIds = leftovers.map((item) => item.id);
    if (leftoverIds.length) {
      const cases = await prisma.emergencyCase.findMany({
        where: {
          OR: [
            { patientId: { in: leftoverIds } },
            { raisedByUserId: { in: leftoverIds } },
          ],
        },
        select: { id: true },
      });
      const caseIds = cases.map((item) => item.id);
      if (caseIds.length)
        await prisma.bedAssignment.deleteMany({
          where: { emergencyCaseId: { in: caseIds } },
        });
      if (caseIds.length)
        await prisma.emergencyCase.deleteMany({
          where: { id: { in: caseIds } },
        });
      await prisma.appointment.deleteMany({
        where: { patientId: { in: leftoverIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: leftoverIds } } });
    }
    patient = await prisma.user.create({
      data: {
        email: `emergency-test-${Date.now()}@aarogyacare.local`,
        name: 'Emergency Test Patient',
        role: 'PATIENT',
        passwordHash: 'unused-test-password',
        patientProfile: { create: {} },
      },
    });
    testPatientId = patient.id;
    operator = await prisma.user.findUnique({
      where: { email: 'operator@aarogyacare.demo' },
    });
    doctor = await prisma.user.findUnique({
      where: { email: 'doctor1@aarogyacare.demo' },
    });
    profile = await prisma.doctorProfile.findUnique({
      where: { userId: doctor.id },
    });
    ward = await prisma.ward.create({
      data: { name: `Emergency Test ${Date.now()}`, type: 'EMERGENCY' },
    });
    bed = await prisma.bed.create({
      data: { wardId: ward.id, bedNumber: 'E-01' },
    });
  });
  afterAll(async () => {
    if (bed)
      await prisma.bedAssignment.deleteMany({ where: { bedId: bed.id } });
    if (emergencyIds.length)
      await prisma.bedAssignment.deleteMany({
        where: { emergencyCaseId: { in: emergencyIds } },
      });
    if (emergencyIds.length)
      await prisma.emergencyCase.deleteMany({
        where: { id: { in: emergencyIds } },
      });
    if (appointmentIds.length)
      await prisma.appointment.deleteMany({
        where: { id: { in: appointmentIds } },
      });
    if (testPatientId)
      await prisma.user.delete({ where: { id: testPatientId } });
    if (bed) await prisma.bed.delete({ where: { id: bed.id } });
    if (ward) await prisma.ward.delete({ where: { id: ward.id } });
    await closeEmergencyAlertQueue();
  });

  it('raises a patient emergency, accepts it, reserves and assigns a bed, then closes it', async () => {
    const denied = await request(app)
      .get('/api/emergency')
      .set('Authorization', `Bearer ${tokenFor(patient)}`);
    expect(denied.status).toBe(403);
    const raised = await request(app)
      .post('/api/emergency')
      .set('Authorization', `Bearer ${tokenFor(patient)}`)
      .send({
        name: patient.name,
        phone: '555-123-4567',
        complaint: 'Needs urgent assessment',
        severity: 'CRITICAL',
        location: 'Emergency entrance',
      });
    expect(raised.status).toBe(200);
    expect(raised.body.data).toMatchObject({
      name: patient.name,
      status: 'RAISED',
    });
    const emergencyId = raised.body.data.id;
    emergencyIds.push(emergencyId);

    const accepted = await request(app)
      .post(`/api/emergency/${emergencyId}/accept`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({});
    expect(accepted.status).toBe(200);
    const reserved = await request(app)
      .post(`/api/emergency/${emergencyId}/reserve-bed`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({ bedId: bed.id });
    expect(reserved.status).toBe(200);
    expect(reserved.body.data.bed.status).toBe('RESERVED');
    const assigned = await request(app)
      .post(`/api/beds/${bed.id}/assign`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({ emergencyCaseId: emergencyId });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.bed.status).toBe('OCCUPIED');
    const caseAfterAdmission = await prisma.emergencyCase.findUnique({
      where: { id: emergencyId },
    });
    expect(caseAfterAdmission.status).toBe('ADMITTED');
    const prematureClose = await request(app)
      .post(`/api/emergency/${emergencyId}/close`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({});
    expect(prematureClose.status).toBe(409);
    const operatorList = await request(app)
      .get('/api/emergency')
      .set('Authorization', `Bearer ${tokenFor(operator)}`);
    expect(operatorList.status).toBe(200);
    expect(operatorList.body.data[0].severity).toBe('CRITICAL');
    const doctorList = await request(app)
      .get('/api/emergency')
      .set('Authorization', `Bearer ${tokenFor(doctor)}`);
    expect(doctorList.status).toBe(200);
    expect(doctorList.body.data.some((item) => item.id === emergencyId)).toBe(
      false,
    );
    await request(app)
      .post(`/api/beds/${bed.id}/release`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({});
    const closed = await request(app)
      .post(`/api/emergency/${emergencyId}/close`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({});
    expect(closed.status).toBe(200);
    expect(closed.body.data.status).toBe('CLOSED');
  });

  it('escalates an appointment once and denies doctor escalation', async () => {
    const start = new Date(Date.now() + 20 * 86_400_000);
    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: profile.id,
        slotStart: start,
        slotEnd: new Date(start.getTime() + 15 * 60_000),
        reason: 'Urgent breathing symptoms',
        status: 'CONFIRMED',
        bookedByUserId: patient.id,
      },
    });
    appointmentIds.push(appointment.id);
    const wrongRole = await request(app)
      .post(`/api/appointments/${appointment.id}/escalate`)
      .set('Authorization', `Bearer ${tokenFor(doctor)}`)
      .send({ location: 'Clinic room 2' });
    expect(wrongRole.status).toBe(403);
    const response = await request(app)
      .post(`/api/appointments/${appointment.id}/escalate`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({ severity: 'HIGH', location: 'Clinic room 2' });
    expect(response.status).toBe(200);
    expect(response.body.data.linkedAppointmentId).toBe(appointment.id);
    emergencyIds.push(response.body.data.id);
    const doctorCases = await request(app)
      .get('/api/emergency')
      .set('Authorization', `Bearer ${tokenFor(doctor)}`);
    expect(
      doctorCases.body.data.some((item) => item.id === response.body.data.id),
    ).toBe(true);
    const duplicate = await request(app)
      .post(`/api/appointments/${appointment.id}/escalate`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({ severity: 'HIGH', location: 'Clinic room 2' });
    expect(duplicate.body.data.id).toBe(response.body.data.id);
  });

  it('sends an emergency to an authenticated staff socket and rejects patient sockets', async () => {
    const httpServer = createServer(app);
    attachSocketServer(httpServer);
    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = httpServer.address();
    const staffSocket = connectSocket(`http://127.0.0.1:${port}`, {
      auth: { token: tokenFor(operator) },
      transports: ['websocket'],
    });
    const patientSocket = connectSocket(`http://127.0.0.1:${port}`, {
      auth: { token: tokenFor(patient) },
      transports: ['websocket'],
    });
    const patientRejected = new Promise((resolve) =>
      patientSocket.once('connect_error', resolve),
    );
    try {
      await new Promise((resolve, reject) => {
        staffSocket.once('connect', resolve);
        staffSocket.once('connect_error', reject);
      });
      expect((await patientRejected).message).toContain(
        'Staff access required',
      );
      await prisma.bed.update({
        where: { id: bed.id },
        data: { status: 'AVAILABLE', reservedUntil: null },
      });
      const bedCounts = new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Live bed counts timed out')),
          2000,
        );
        staffSocket.once('bed.counts', (counts) => {
          clearTimeout(timer);
          resolve(counts);
        });
      });
      const reservedBed = await request(app)
        .post(`/api/beds/${bed.id}/reserve`)
        .set('Authorization', `Bearer ${tokenFor(operator)}`)
        .send({});
      expect(reservedBed.status).toBe(200);
      expect(
        (await bedCounts).find((count) => count.type === 'EMERGENCY').reserved,
      ).toBeGreaterThan(0);
      const alertReceived = new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Emergency socket alert timed out')),
          2000,
        );
        staffSocket.once('emergency.raised', (alert) => {
          clearTimeout(timer);
          resolve(alert);
        });
      });
      const raised = await request(app)
        .post('/api/emergency')
        .set('Authorization', `Bearer ${tokenFor(patient)}`)
        .send({
          name: patient.name,
          phone: '555-123-4567',
          complaint: 'Socket alert test',
          severity: 'HIGH',
          location: 'Test entrance',
        });
      expect(raised.status).toBe(200);
      emergencyIds.push(raised.body.data.id);
      expect((await alertReceived).id).toBe(raised.body.data.id);
    } finally {
      staffSocket.disconnect();
      patientSocket.disconnect();
      await closeSocketServer();
    }
  });
});
