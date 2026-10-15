import { readFile } from 'node:fs/promises';
import { unlink } from 'node:fs/promises';
import { URL as NodeURL } from 'node:url';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';

const patient = await prisma.user.findUnique({
  where: { email: 'patient@aarogyacare.demo' },
});
if (!patient) throw new Error('Run the API seed first.');
const token = jwt.sign(
  { type: 'access', role: 'patient' },
  env.JWT_ACCESS_SECRET,
  { subject: patient.id, expiresIn: '2m' },
);
const form = new globalThis.FormData();
form.append(
  'file',
  new globalThis.Blob(
    [await readFile(new NodeURL('./fake-lab-report.pdf', import.meta.url))],
    { type: 'application/pdf' },
  ),
  'fake-lab-report.pdf',
);
const uploaded = await globalThis.fetch('http://localhost:3000/api/documents', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
if (!uploaded.ok)
  throw new Error(`Upload failed: ${uploaded.status} ${await uploaded.text()}`);
const { data: doc } = await uploaded.json();
try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));
    const current = await prisma.document.findUnique({
      where: { id: doc.id },
      include: { extractions: true, timelineEvents: true },
    });
    if (current.status === 'READY') {
      if (current.type !== 'LAB_REPORT' || !current.extractions.length)
        throw new Error('Worker completed with unexpected extraction results.');
      globalThis.console.log(
        `Separate worker processed ${current.originalName}: ${current.type}, ${current.extractions.length} extractions, ${current.timelineEvents.length} timeline events.`,
      );
      globalThis.process.exitCode = 0;
      break;
    }
    if (current.status === 'FAILED')
      throw new Error(`Worker failed: ${current.failReason}`);
    if (attempt === 29)
      throw new Error('Timed out waiting for the separate worker.');
  }
} finally {
  const stored = await prisma.document.findUnique({
    where: { id: doc.id },
    select: { storagePath: true },
  });
  if (stored) await unlink(stored.storagePath).catch(() => {});
  await prisma.document.delete({ where: { id: doc.id } });
  await prisma.$disconnect();
}
