import { afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('./lib/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) },
}));
vi.mock('./lib/redis.js', () => ({
  redis: { ping: vi.fn().mockResolvedValue('PONG') },
}));

const { app } = await import('./app.js');

describe('GET /api/health', () => {
  it('reports healthy database and Redis dependencies', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('returns the standard error shape for an unknown route', async () => {
    const response = await request(app).get('/missing');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, message: 'Not found' });
  });
});

afterAll(() => vi.restoreAllMocks());
