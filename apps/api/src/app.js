import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { asyncHandler } from './lib/asyncHandler.js';
import { respond } from './lib/respond.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { env } from './config/env.js';
import { HttpError } from './lib/httpError.js';
import authRoutes from './modules/auth/routes.js';
import patientRoutes from './modules/patients/routes.js';
import adminRoutes from './modules/admin/routes.js';
import doctorRoutes from './modules/doctors/routes.js';
import appointmentRoutes from './modules/appointments/routes.js';
import queueRoutes from './modules/queue/routes.js';

export const app = express();
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', doctorRoutes);
app.use('/api', appointmentRoutes);
app.use('/api', queueRoutes);

app.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    await Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()]);
    respond(res, { status: 'ok' });
  }),
);

app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
app.use(errorHandler);
