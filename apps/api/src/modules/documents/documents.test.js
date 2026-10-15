import jwt from 'jsonwebtoken';
import { unlink } from 'node:fs/promises';
import request from 'supertest';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../config/env.js';
import { app } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { documentsQueue } from './queue.js';
import { processDocument } from './processor.js';

const tokenFor = (user) =>
  jwt.sign(
    { type: 'access', role: user.role.toLowerCase() },
    env.JWT_ACCESS_SECRET,
    { subject: user.id, expiresIn: '15m' },
  );
const samplePath = fileURLToPath(
  new URL('../../../samples/fake-prescription.pdf', import.meta.url),
);
const imagePath = fileURLToPath(
  new URL('../../../samples/fake-lab-image.png', import.meta.url),
);

describe('Phase 5 document pipeline', () => {
  let patient;
  const ids = [];
  beforeAll(async () => {
    patient = await prisma.user.findUnique({
      where: { email: 'patient@aarogyacare.demo' },
    });
  });
  afterAll(async () => {
    if (ids.length) {
      const documents = await prisma.document.findMany({
        where: { id: { in: ids } },
        select: { storagePath: true },
      });
      await Promise.all(
        documents.map((doc) => unlink(doc.storagePath).catch(() => {})),
      );
      await prisma.document.deleteMany({ where: { id: { in: ids } } });
    }
    const jobs = await documentsQueue.getJobs([
      'waiting',
      'delayed',
      'completed',
      'failed',
    ]);
    await Promise.all(
      jobs
        .filter((job) => ids.includes(job.data.documentId))
        .map((job) => job.remove()),
    );
    await documentsQueue.close();
  });

  it('queues a PDF for the patient, extracts a prescription, and marks duplicate uploads failed', async () => {
    const denied = await request(app)
      .post('/api/documents')
      .set(
        'Authorization',
        `Bearer ${tokenFor({ ...patient, role: 'OPERATOR' })}`,
      );
    expect(denied.status).toBe(403);
    const uploaded = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${tokenFor(patient)}`)
      .attach('file', samplePath);
    expect(uploaded.status).toBe(202);
    ids.push(uploaded.body.data.id);
    await processDocument(uploaded.body.data.id);
    const ready = await prisma.document.findUnique({
      where: { id: uploaded.body.data.id },
      include: { extractions: true, timelineEvents: true },
    });
    expect(ready.status).toBe('READY');
    expect(ready.type).toBe('PRESCRIPTION');
    expect(
      ready.extractions.some(
        (x) => x.kind === 'medicine' && x.value.includes('500 mg'),
      ),
    ).toBe(true);
    expect(ready.timelineEvents.length).toBeGreaterThan(0);

    const duplicate = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${tokenFor(patient)}`)
      .attach('file', samplePath);
    expect(duplicate.status).toBe(202);
    ids.push(duplicate.body.data.id);
    await processDocument(duplicate.body.data.id);
    const failed = await prisma.document.findUnique({
      where: { id: duplicate.body.data.id },
    });
    expect(failed.status).toBe('FAILED');
    expect(failed.failReason).toBe('duplicate');

    const image = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${tokenFor(patient)}`)
      .attach('file', imagePath);
    expect(image.status).toBe(202);
    ids.push(image.body.data.id);
    await processDocument(image.body.data.id);
    const imageReady = await prisma.document.findUnique({
      where: { id: image.body.data.id },
      include: { extractions: true },
    });
    expect(imageReady.status).toBe('READY');
    expect(imageReady.type).toBe('LAB_REPORT');
    expect(
      imageReady.extractions.some((x) => x.kind === 'lab' && x.isAbnormal),
    ).toBe(true);
  }, 30000);
});
