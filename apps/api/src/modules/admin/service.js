import { getCurrentUser } from '../auth/service.js';
import { prisma } from '../../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { HttpError } from '../../lib/httpError.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { resources, resourceMetadata } from './resources.js';
import { documentsQueue } from '../documents/queue.js';

const getResource = (key) => {
  const config = resources[key];
  if (!config) throw new HttpError(404, 'Admin resource not found');
  return config;
};
const modelFor = (config) => prisma[config.model];
const selectFor = (config) =>
  Object.fromEntries(['id', ...config.columns].map((field) => [field, true]));
const whereFor = (config, search, includeDeleted = false) => ({
  ...(search
    ? {
        OR: config.search.map((field) => ({
          [field]: { contains: search, mode: 'insensitive' },
        })),
      }
    : {}),
  ...(config.softDelete && !includeDeleted ? { deletedAt: null } : {}),
});
const cleanInput = async (config, payload, create = false) => {
  const result = {};
  for (const [key, value] of Object.entries(payload)) {
    const field = config.fields[key];
    if (!field) throw new HttpError(400, `Field ${key} is not editable`);
    if (field.type === 'password') {
      if (typeof value !== 'string' || value.length < 8)
        throw new HttpError(400, 'Password must contain at least 8 characters');
      result.passwordHash = await bcrypt.hash(value, 12);
    } else if (field.type === 'number') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed))
        throw new HttpError(400, `${key} must be a number`);
      result[key] = parsed;
    } else if (field.type === 'boolean') {
      if (typeof value !== 'boolean')
        throw new HttpError(400, `${key} must be true or false`);
      result[key] = value;
    } else if (value === '' && !field.required) {
      if (key === 'phone' || key === 'reservedUntil') result[key] = null;
    } else if (field.type === 'select' && !field.options.includes(value)) {
      throw new HttpError(400, `Invalid ${key}`);
    } else if (key === 'email') {
      result.email = String(value).trim().toLowerCase();
    } else result[key] = value;
  }
  for (const [key, field] of Object.entries(config.fields))
    if (
      (create && field.required && result[key] == null) ||
      (create && field.createRequired && result.passwordHash == null)
    )
      throw new HttpError(400, `${key} is required`);
  return result;
};

export const getAdminMeta = async () => resourceMetadata;
export const listAdminResource = async (
  key,
  {
    page = 1,
    pageSize = 20,
    search = '',
    sort = 'createdAt',
    direction = 'desc',
    includeDeleted = false,
  },
) => {
  const config = getResource(key);
  if (!config.columns.includes(sort)) sort = config.columns[0];
  const where = whereFor(config, search, includeDeleted);
  const [total, items] = await Promise.all([
    modelFor(config).count({ where }),
    modelFor(config).findMany({
      where,
      select: selectFor(config),
      orderBy: { [sort]: direction },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    items,
    page,
    pageSize,
    total,
    pages: Math.ceil(total / pageSize),
    readOnly: Boolean(config.readOnly),
  };
};
export const getAdminResourceItem = async (key, id) => {
  const config = getResource(key);
  const item = await modelFor(config).findFirst({
    where: { id, ...(config.softDelete ? { deletedAt: null } : {}) },
    select: selectFor(config),
  });
  if (!item) throw new HttpError(404, 'Resource item not found');
  return item;
};
export const createAdminResourceItem = async (key, payload, userId, ip) => {
  const config = getResource(key);
  if (config.readOnly) throw new HttpError(405, 'This resource is read-only');
  const data = await cleanInput(config, payload, true);
  if (key === 'users' && data.role === 'PATIENT')
    data.patientProfile = { create: {} };
  const item = await modelFor(config).create({
    data,
    select: selectFor(config),
  });
  await writeAuditLog({
    userId,
    action: 'ADMIN_CREATE',
    entity: config.model,
    entityId: item.id,
    ip,
  });
  return item;
};
export const updateAdminResourceItem = async (key, id, payload, userId, ip) => {
  const config = getResource(key);
  if (config.readOnly) throw new HttpError(405, 'This resource is read-only');
  if (
    key === 'users' &&
    id === userId &&
    ((payload.role && payload.role !== 'ADMIN') || payload.isActive === false)
  )
    throw new HttpError(409, 'You cannot remove your own administrator access');
  const data = await cleanInput(config, payload);
  const item = await modelFor(config).update({
    where: { id },
    data,
    select: selectFor(config),
  });
  await writeAuditLog({
    userId,
    action: 'ADMIN_UPDATE',
    entity: config.model,
    entityId: item.id,
    ip,
  });
  return item;
};
export const deleteAdminResourceItem = async (key, id, userId, ip) => {
  const config = getResource(key);
  if (config.readOnly) throw new HttpError(405, 'This resource is read-only');
  if (key === 'users' && id === userId)
    throw new HttpError(
      409,
      'You cannot delete your own administrator account',
    );
  const item = config.softDelete
    ? await modelFor(config).update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
        select: { id: true },
      })
    : await modelFor(config).delete({ where: { id }, select: { id: true } });
  await writeAuditLog({
    userId,
    action: 'ADMIN_DELETE',
    entity: config.model,
    entityId: id,
    ip,
  });
  return item;
};
export const restoreAdminResourceItem = async (key, id, userId, ip) => {
  const config = getResource(key);
  if (!config.softDelete)
    throw new HttpError(400, 'This resource does not support restore');
  const item = await modelFor(config).update({
    where: { id },
    data: { deletedAt: null, isActive: true },
    select: selectFor(config),
  });
  await writeAuditLog({
    userId,
    action: 'ADMIN_RESTORE',
    entity: config.model,
    entityId: id,
    ip,
  });
  return item;
};
export const exportAdminResource = async (key) => {
  const config = getResource(key);
  const data = await modelFor(config).findMany({
    where: whereFor(config, ''),
    select: selectFor(config),
    orderBy: { [config.columns[0]]: 'asc' },
    take: 10000,
  });
  const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [
    config.columns.map(csvValue).join(','),
    ...data.map((row) =>
      config.columns.map((field) => csvValue(row[field])).join(','),
    ),
  ].join('\r\n');
};
export const hideFeedback = async (id, userId, ip) => {
  const item = await prisma.feedback.update({
    where: { id },
    data: { isHidden: true },
  });
  await writeAuditLog({
    userId,
    action: 'ADMIN_HIDE_FEEDBACK',
    entity: 'Feedback',
    entityId: id,
    ip,
  });
  return item;
};
export const listFailedDocuments = async () =>
  prisma.document.findMany({
    where: { status: 'FAILED' },
    select: {
      id: true,
      patientId: true,
      originalName: true,
      failReason: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
export const retryDocument = async (id, userId, ip) => {
  const document = await prisma.document.findFirst({
    where: { id, status: 'FAILED' },
  });
  if (!document) throw new HttpError(404, 'Failed document job not found');
  const updated = await prisma.document.update({
    where: { id },
    data: { status: 'QUEUED', failReason: null },
  });
  await documentsQueue.add(
    'process',
    { documentId: id },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );
  await writeAuditLog({
    userId,
    action: 'ADMIN_RETRY_DOCUMENT',
    entity: 'Document',
    entityId: id,
    ip,
  });
  return { id: updated.id, status: updated.status };
};

/** @param {string} userId @returns {Promise<object>} */
export const getAdminSession = async (userId) => getCurrentUser(userId);

export const getAdminOverview = async () => {
  const now = new Date();
  const local = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value]),
  );
  const start = new Date(
    Date.UTC(
      Number(local.year),
      Number(local.month) - 1,
      Number(local.day),
      -5,
      -30,
    ),
  );
  const end = new Date(start.getTime() + 86400000);
  const [
    doctors,
    appointments,
    beds,
    openEmergencies,
    documents,
    queue,
    revenue,
  ] = await Promise.all([
    prisma.doctorProfile.count(),
    prisma.appointment.count({ where: { slotStart: { gte: start, lt: end } } }),
    prisma.bed.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.emergencyCase.count({
      where: { status: { in: ['RAISED', 'ACCEPTED'] } },
    }),
    prisma.document.count({ where: { status: 'FAILED' } }),
    prisma.queueEntry.findMany({
      where: {
        date: new Date(
          Date.UTC(
            Number(local.year),
            Number(local.month) - 1,
            Number(local.day),
          ),
        ),
        status: 'WAITING',
      },
      include: { doctor: { select: { avgConsultMinutes: true } } },
    }),
    prisma.payment.aggregate({
      where: {
        status: 'PAID',
        createdAt: {
          gte: new Date(
            Date.UTC(Number(local.year), Number(local.month) - 1, 1, -5, -30),
          ),
        },
      },
      _sum: { amountInr: true },
    }),
  ]);
  const bedCounts = beds.reduce(
    (result, row) => ({
      ...result,
      [row.status.toLowerCase()]: row._count._all,
    }),
    {},
  );
  const totalBeds = beds.reduce((sum, row) => sum + row._count._all, 0);
  return {
    doctors,
    appointments,
    appointmentsToday: appointments,
    averageWaitMinutes: queue.length
      ? Math.round(
          queue.reduce(
            (sum, row) =>
              sum +
              Math.max(0, row.position - 1) * row.doctor.avgConsultMinutes,
            0,
          ) / queue.length,
        )
      : 0,
    bedOccupancyPercent: totalBeds
      ? Math.round(((bedCounts.occupied ?? 0) / totalBeds) * 100)
      : 0,
    revenueThisMonthInr: revenue._sum.amountInr ?? 0,
    beds: bedCounts,
    openEmergencies,
    failedDocuments: documents,
  };
};
