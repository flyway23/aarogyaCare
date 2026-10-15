import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    patientProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
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
vi.mock('../../lib/mailer.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

const { app } = await import('../../app.js');
const { prisma } = await import('../../lib/prisma.js');
const { redis } = await import('../../lib/redis.js');
const { sendEmail } = await import('../../lib/mailer.js');

const patient = {
  id: '6e2fda30-2b0a-48fa-b339-c2b032fe5941',
  email: 'patient@example.com',
  name: 'Riya Kapoor',
  phone: '9876543210',
  role: 'PATIENT',
  isActive: true,
  deletedAt: null,
  passwordHash: bcrypt.hashSync('Pass@1234', 4),
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue(patient);
  prisma.user.create.mockResolvedValue(patient);
  prisma.user.update.mockResolvedValue(patient);
  prisma.patientProfile.findUnique.mockResolvedValue(null);
  prisma.patientProfile.upsert.mockImplementation(async ({ create }) => create);
  prisma.auditLog.create.mockResolvedValue({});
  redis.get.mockResolvedValue(null);
  redis.set.mockResolvedValue('OK');
});

describe('Phase 1 authentication and patient profile routes', () => {
  it('registers a patient and sets an httpOnly refresh cookie', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const response = await request(app).post('/api/auth/register').send({
      name: 'Riya Kapoor',
      email: 'Riya@example.com',
      password: 'Pass@1234',
      phone: '9876543210',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.role).toBe('patient');
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
  });

  it('logs in and rejects a wrong password with the standard error shape', async () => {
    const success = await request(app)
      .post('/api/auth/login')
      .send({ email: patient.email, password: 'Pass@1234' });
    expect(success.status).toBe(200);
    expect(success.body.data.accessToken).toBeTruthy();

    const failure = await request(app)
      .post('/api/auth/login')
      .send({ email: patient.email, password: 'wrong-pass' });
    expect(failure.status).toBe(401);
    expect(failure.body).toEqual({
      success: false,
      message: 'Email or password is incorrect',
    });
  });

  it('rotates refresh tokens and logs out by revoking the cookie token', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: patient.email, password: 'Pass@1234' });
    const refreshed = await agent.post('/api/auth/refresh').send({});
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toBeTruthy();

    const loggedOut = await agent.post('/api/auth/logout').send({});
    expect(loggedOut.status).toBe(200);
    expect(loggedOut.body.data.message).toBe('Logged out');
    expect(loggedOut.headers['set-cookie'][0]).toContain('Max-Age=0');
    expect(redis.set).toHaveBeenCalled();
    expect(login.body.data.user.id).toBe(patient.id);
  });

  it('returns the current user and reads and updates the patient profile', async () => {
    const token = jwt.sign(
      { type: 'access', role: 'patient' },
      env.JWT_ACCESS_SECRET,
      { subject: patient.id, expiresIn: '15m' },
    );
    const profile = {
      dob: null,
      gender: 'Woman',
      bloodGroup: null,
      allergies: 'Pollen',
    };
    prisma.patientProfile.findUnique.mockResolvedValue(profile);
    prisma.patientProfile.upsert.mockResolvedValue(profile);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    const read = await request(app)
      .get('/api/patients/me/profile')
      .set('Authorization', `Bearer ${token}`);
    const update = await request(app)
      .put('/api/patients/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send(profile);

    expect(me.status).toBe(200);
    expect(me.body.data.role).toBe('patient');
    expect(read.body.data.allergies).toBe('Pollen');
    expect(update.body.data.gender).toBe('Woman');
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it('returns 403 when a non-patient requests the patient profile', async () => {
    const token = jwt.sign(
      { type: 'access', role: 'operator' },
      env.JWT_ACCESS_SECRET,
      { subject: patient.id, expiresIn: '15m' },
    );
    const response = await request(app)
      .get('/api/patients/me/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('sends a password reset and accepts its token once', async () => {
    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: patient.email });
    expect(forgot.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();

    const emailText = sendEmail.mock.calls[0][0].text;
    const token = emailText.split(': ').at(-1);
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'Changed@1234' });
    expect(reset.status).toBe(200);

    redis.set.mockResolvedValueOnce(null);
    const reused = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'Changed@5678' });
    expect(reused.status).toBe(400);
  });

  it('validates every submitted body', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad' });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
