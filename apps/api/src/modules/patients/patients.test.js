import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    patientProfile: { findUnique: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock('../../lib/redis.js', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

const { app } = await import('../../app.js');
const { prisma } = await import('../../lib/prisma.js');

const tokenFor = (role) =>
  jwt.sign({ type: 'access', role }, env.JWT_ACCESS_SECRET, {
    subject: 'e6737de7-b278-4dbd-824e-b7985280d6d8',
    expiresIn: '15m',
  });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.patientProfile.findUnique.mockResolvedValue({ allergies: 'Pollen' });
  prisma.patientProfile.upsert.mockResolvedValue({
    allergies: 'Pollen',
    bloodGroup: 'O+',
  });
  prisma.auditLog.create.mockResolvedValue({});
});

describe('patient profile access', () => {
  it('allows a patient to read and update only their profile and records both accesses', async () => {
    const token = tokenFor('patient');
    const read = await request(app)
      .get('/api/patients/me/profile')
      .set('Authorization', `Bearer ${token}`);
    const update = await request(app)
      .put('/api/patients/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ allergies: 'Pollen', bloodGroup: 'O+' });

    expect(read.status).toBe(200);
    expect(read.body.data.allergies).toBe('Pollen');
    expect(update.status).toBe(200);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it('denies operators and doctors profile access', async () => {
    for (const role of ['operator', 'doctor']) {
      const response = await request(app)
        .get('/api/patients/me/profile')
        .set('Authorization', `Bearer ${tokenFor(role)}`);
      expect(response.status).toBe(403);
    }
    expect(prisma.patientProfile.findUnique).not.toHaveBeenCalled();
  });
});
