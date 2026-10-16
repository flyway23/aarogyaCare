import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    doctorProfile: { count: vi.fn() },
    appointment: { count: vi.fn() },
    bed: { groupBy: vi.fn() },
    emergencyCase: { count: vi.fn() },
    document: { count: vi.fn() },
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
    subject: 'c92b286f-12db-49d5-a94e-0ebaaeb61cba',
    expiresIn: '15m',
  });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({
    id: 'c92b286f-12db-49d5-a94e-0ebaaeb61cba',
    email: 'admin@example.com',
    name: 'Admin User',
    phone: null,
    role: 'ADMIN',
    isActive: true,
    deletedAt: null,
  });
  prisma.doctorProfile.count.mockResolvedValue(10);
  prisma.appointment.count.mockResolvedValue(3);
  prisma.bed.groupBy.mockResolvedValue([
    { status: 'AVAILABLE', _count: { _all: 30 } },
  ]);
  prisma.emergencyCase.count.mockResolvedValue(1);
  prisma.document.count.mockResolvedValue(0);
});

describe('admin session permission', () => {
  it('allows admins and returns their safe public identity', async () => {
    const response = await request(app)
      .get('/api/admin/session')
      .set('Authorization', `Bearer ${tokenFor('admin')}`);
    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe('admin');
    expect(response.body.data.passwordHash).toBeUndefined();
  });

  it('returns 403 when a patient tries to access the admin API', async () => {
    const response = await request(app)
      .get('/api/admin/session')
      .set('Authorization', `Bearer ${tokenFor('patient')}`);
    expect(response.status).toBe(403);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns aggregate dashboard counts to admins and blocks patients', async () => {
    const admin = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${tokenFor('admin')}`);
    expect(admin.status).toBe(200);
    expect(admin.body.data).toEqual({
      doctors: 10,
      appointments: 3,
      beds: { available: 30 },
      openEmergencies: 1,
      failedDocuments: 0,
    });
    expect(admin.body.data.patientRecords).toBeUndefined();
    const patient = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${tokenFor('patient')}`);
    expect(patient.status).toBe(403);
  });
});
