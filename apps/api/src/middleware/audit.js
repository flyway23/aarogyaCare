import { prisma } from '../lib/prisma.js';

/** @param {{userId: string|null, action: string, entity: string, entityId: string, ip?: string}} entry @returns {Promise<void>} */
export const writeAuditLog = async (entry) => {
  await prisma.auditLog.create({ data: entry });
};
