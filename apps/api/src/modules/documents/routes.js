import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { HttpError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { documentsQueue } from './queue.js';

const router = Router();
const uploadDir = fileURLToPath(new URL('../../../uploads/', import.meta.url));
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (e) {
      cb(e);
    }
  },
  filename: (_req, _file, cb) => cb(null, `${randomUUID()}.upload`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    };
    if (
      !allowed[file.mimetype]?.includes(
        path.extname(file.originalname).toLowerCase(),
      )
    )
      return cb(new HttpError(415, 'Only PDF, JPG, and PNG files are allowed'));
    cb(null, true);
  },
});
const parseUpload = (req, res, next) =>
  upload.single('file')(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE')
      return next(new HttpError(413, 'Document exceeds the 10 MB limit'));
    if (error?.code === 'LIMIT_UNEXPECTED_FILE')
      return next(new HttpError(400, 'Upload one file using the file field'));
    next(error);
  });
const documentIdSchema = z.object({ id: z.string().uuid() });
const patientSearchSchema = z.object({ id: z.string().uuid() });
const patientSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
});

router.post(
  '/documents',
  auth,
  requireRole('patient'),
  parseUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'A document file is required');
    const appointmentId = req.body.appointmentId || null;
    if (appointmentId && !z.string().uuid().safeParse(appointmentId).success) {
      const { unlink } = await import('node:fs/promises');
      await unlink(req.file.path).catch(() => {});
      throw new HttpError(400, 'Invalid appointment ID');
    }
    if (
      appointmentId &&
      !(await prisma.appointment.findFirst({
        where: { id: appointmentId, patientId: req.user.id },
      }))
    ) {
      const { unlink } = await import('node:fs/promises');
      await unlink(req.file.path).catch(() => {});
      throw new HttpError(404, 'Appointment not found');
    }
    let document;
    try {
      document = await prisma.document.create({
        data: {
          patientId: req.user.id,
          appointmentId,
          originalName: path.basename(req.file.originalname),
          mimeType: req.file.mimetype,
          storagePath: req.file.path,
        },
      });
      await documentsQueue.add(
        'process',
        { documentId: document.id },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      const { unlink } = await import('node:fs/promises');
      await unlink(req.file.path).catch(() => {});
      throw error;
    }
    res.status(202).json({ success: true, data: document });
  }),
);

router.get(
  '/documents',
  auth,
  asyncHandler(async (req, res) => {
    if (!['patient', 'doctor', 'admin'].includes(req.user.role))
      throw new HttpError(403, 'Forbidden');
    const where =
      req.user.role === 'patient'
        ? { patientId: req.user.id }
        : req.user.role === 'doctor'
          ? {
              patient: {
                appointmentsAsPatient: {
                  some: { doctor: { userId: req.user.id } },
                },
                patientConsents: {
                  none: { doctorId: req.user.id, revokedAt: { not: null } },
                },
              },
            }
          : {};
    const data = await prisma.document.findMany({
      where,
      select: {
        id: true,
        patientId: true,
        appointmentId: true,
        originalName: true,
        status: true,
        type: true,
        failReason: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data });
  }),
);

const getAuthorized = async (req) => {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: {
      patient: {
        select: {
          appointmentsAsPatient: {
            where: { doctor: { userId: req.user.id } },
            select: { id: true },
            take: 1,
          },
          patientConsents: {
            where: { doctorId: req.user.id, revokedAt: { not: null } },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!doc) throw new HttpError(404, 'Document not found');
  const allowed =
    req.user.role === 'admin' ||
    (req.user.role === 'patient' && doc.patientId === req.user.id) ||
    (req.user.role === 'doctor' &&
      doc.patient.appointmentsAsPatient.length > 0 &&
      doc.patient.patientConsents.length === 0);
  if (!allowed) throw new HttpError(404, 'Document not found');
  return doc;
};
router.get(
  '/documents/:id/status',
  auth,
  validate(documentIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    const doc = await getAuthorized(req);
    res.json({
      success: true,
      data: {
        id: doc.id,
        status: doc.status,
        type: doc.type,
        failReason: doc.failReason,
      },
    });
  }),
);
router.get(
  '/documents/:id/file',
  auth,
  validate(documentIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    const doc = await getAuthorized(req);
    await writeAuditLog({
      userId: req.user.id,
      action: 'DOCUMENT_FILE_READ',
      entity: 'Document',
      entityId: doc.id,
      ip: req.ip,
    });
    res.type(doc.mimeType).download(doc.storagePath, doc.originalName);
  }),
);
router.get(
  '/patients/:id/search',
  auth,
  requireRole('doctor'),
  validate(patientSearchSchema, 'params'),
  validate(patientSearchQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { q } = req.query;
    const allowed = await prisma.appointment.count({
      where: { patientId: id, doctor: { userId: req.user.id } },
    });
    if (!allowed) throw new HttpError(404, 'Patient not found');
    const revoked = await prisma.consent.findUnique({
      where: { patientId_doctorId: { patientId: id, doctorId: req.user.id } },
      select: { revokedAt: true },
    });
    if (revoked?.revokedAt)
      throw new HttpError(403, 'Patient has revoked record access');
    const data = await prisma.document.findMany({
      where: {
        patientId: id,
        OR: [
          { extractedText: { contains: q, mode: 'insensitive' } },
          {
            extractions: {
              some: { value: { contains: q, mode: 'insensitive' } },
            },
          },
        ],
      },
      select: {
        id: true,
        originalName: true,
        type: true,
        extractions: {
          where: { value: { contains: q, mode: 'insensitive' } },
          select: { kind: true, value: true, sourceSnippet: true },
        },
      },
    });
    res.json({ success: true, data });
  }),
);
export default router;
