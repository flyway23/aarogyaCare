import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { app } from '../../app.js';

describe('Phase 8 generic admin resources', () => {
  let admin;
  let patient;
  let adminToken;
  let patientToken;
  const email = `admin-resource-${randomUUID()}@aarogyacare.demo`;
  const specialtyName = `Demo Specialty ${randomUUID()}`;
  let userId;
  let specialtyId;

  beforeAll(async () => {
    admin = await prisma.user.findUnique({
      where: { email: 'admin@aarogyacare.demo' },
    });
    patient = await prisma.user.findUnique({
      where: { email: 'patient@aarogyacare.demo' },
    });
    const token = (user) =>
      jwt.sign(
        { type: 'access', role: user.role.toLowerCase() },
        env.JWT_ACCESS_SECRET,
        { subject: user.id, expiresIn: '15m' },
      );
    adminToken = token(admin);
    patientToken = token(patient);
  });

  afterAll(async () => {
    if (specialtyId)
      await prisma.specialty
        .delete({ where: { id: specialtyId } })
        .catch(() => {});
    if (userId)
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('serves resource metadata and denies non-admin resource access', async () => {
    const metadata = await request(app)
      .get('/api/admin/meta')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(metadata.status).toBe(200);
    expect(metadata.body.data.specialties.fields.name.required).toBe(true);
    expect(metadata.body.data.payments.readOnly).toBe(true);
    const denied = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(denied.status).toBe(403);
  });

  it('creates, edits, soft-deletes, restores, and exports a user and specialty', async () => {
    const specialty = await request(app)
      .post('/api/admin/specialties')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: specialtyName });
    expect(specialty.status).toBe(201);
    specialtyId = specialty.body.data.id;
    const editedSpecialty = await request(app)
      .put(`/api/admin/specialties/${specialtyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${specialtyName} updated` });
    expect(editedSpecialty.status).toBe(200);
    const csv = await request(app)
      .get('/api/admin/specialties/export.csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain(`${specialtyName} updated`);
    await request(app)
      .delete(`/api/admin/specialties/${specialtyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    specialtyId = null;

    const created = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email,
        name: 'Admin Managed Patient',
        role: 'PATIENT',
        password: 'DemoPass@123',
      });
    expect(created.status).toBe(201);
    expect(created.body.data.passwordHash).toBeUndefined();
    userId = created.body.data.id;
    const edited = await request(app)
      .put(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Edited Demo Patient' });
    expect(edited.body.data.name).toBe('Edited Demo Patient');
    await request(app)
      .delete(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const deleted = await request(app)
      .get('/api/admin/users')
      .query({ search: email, includeDeleted: 'true' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.body.data.items[0].deletedAt).toBeTruthy();
    const restored = await request(app)
      .post(`/api/admin/users/${userId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(restored.status).toBe(200);
    expect(restored.body.data.deletedAt).toBeNull();
  });
});
