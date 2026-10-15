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

describe('Phase 4 beds', () => {
  let operator;
  let operatorTwo;
  let patient;
  let ward;
  let bed;
  beforeAll(async () => {
    operator = await prisma.user.findUnique({
      where: { email: 'operator@aarogyacare.demo' },
    });
    patient = await prisma.user.create({
      data: {
        email: `bed-patient-${Date.now()}@aarogyacare.local`,
        name: 'Bed Test Patient',
        phone: `555-${String(Date.now()).slice(-7)}`,
        role: 'PATIENT',
        passwordHash: 'unused-test-password',
        patientProfile: { create: {} },
      },
    });
    operatorTwo = await prisma.user.create({
      data: {
        email: `bed-operator-${Date.now()}@aarogyacare.local`,
        name: 'Second Bed Operator',
        role: 'OPERATOR',
        passwordHash: 'unused-test-password',
      },
    });
    ward = await prisma.ward.create({
      data: { name: `Bed Test ${Date.now()}`, type: 'GENERAL' },
    });
    bed = await prisma.bed.create({
      data: { wardId: ward.id, bedNumber: 'T-01' },
    });
  });
  afterAll(async () => {
    if (bed) {
      await prisma.bedAssignment.deleteMany({ where: { bedId: bed.id } });
      await prisma.bed.delete({ where: { id: bed.id } });
    }
    if (ward) await prisma.ward.delete({ where: { id: ward.id } });
    if (operatorTwo)
      await prisma.user.delete({ where: { id: operatorTwo.id } });
    if (patient) await prisma.user.delete({ where: { id: patient.id } });
  });

  it('protects bed inventory and serializes competing assignments', async () => {
    expect((await request(app).get('/api/beds')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/beds')
          .set('Authorization', `Bearer ${tokenFor(patient)}`)
      ).status,
    ).toBe(403);
    const inventory = await request(app)
      .get('/api/beds')
      .set('Authorization', `Bearer ${tokenFor(operator)}`);
    expect(inventory.status).toBe(200);
    expect(
      inventory.body.data
        .find((group) => group.type === 'GENERAL')
        .wards.some((item) => item.id === ward.id),
    ).toBe(true);

    const attempts = await Promise.all(
      [operator, operatorTwo].map((user) =>
        request(app)
          .post(`/api/beds/${bed.id}/assign`)
          .set('Authorization', `Bearer ${tokenFor(user)}`)
          .send({ phone: patient.phone }),
      ),
    );
    expect(attempts.map((item) => item.status).sort()).toEqual([200, 409]);
    const forbiddenAssign = await request(app)
      .post(`/api/beds/${bed.id}/assign`)
      .set('Authorization', `Bearer ${tokenFor(patient)}`)
      .send({ phone: patient.phone });
    expect(forbiddenAssign.status).toBe(403);
    const invalidStatus = await request(app)
      .post(`/api/beds/${bed.id}/status`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({ status: 'OCCUPIED' });
    expect(invalidStatus.status).toBe(400);
  });

  it('releases occupied beds into cleaning and expires 30-minute reservations', async () => {
    const released = await request(app)
      .post(`/api/beds/${bed.id}/release`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({});
    expect(released.status).toBe(200);
    expect(released.body.data.status).toBe('CLEANING');
    const available = await request(app)
      .post(`/api/beds/${bed.id}/status`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({ status: 'AVAILABLE' });
    expect(available.body.data.status).toBe('AVAILABLE');
    const reserved = await request(app)
      .post(`/api/beds/${bed.id}/reserve`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({});
    expect(reserved.status).toBe(200);
    expect(
      new Date(reserved.body.data.reservedUntil).getTime(),
    ).toBeGreaterThan(Date.now() + 29 * 60_000);
    await prisma.bed.update({
      where: { id: bed.id },
      data: { reservedUntil: new Date(Date.now() - 1000) },
    });
    await request(app)
      .get('/api/beds')
      .set('Authorization', `Bearer ${tokenFor(operator)}`);
    const expired = await prisma.bed.findUnique({ where: { id: bed.id } });
    expect(expired.status).toBe('AVAILABLE');
    expect(expired.reservedUntil).toBeNull();
  });
});
