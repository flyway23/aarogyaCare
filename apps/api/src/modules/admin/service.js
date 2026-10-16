import { getCurrentUser } from '../auth/service.js';
import { prisma } from '../../lib/prisma.js';

/** @param {string} userId @returns {Promise<object>} */
export const getAdminSession = async (userId) => getCurrentUser(userId);

export const getAdminOverview = async () => {
  const [doctors, appointments, beds, openEmergencies, documents] =
    await Promise.all([
      prisma.doctorProfile.count(),
      prisma.appointment.count(),
      prisma.bed.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.emergencyCase.count({
        where: { status: { in: ['RAISED', 'ACCEPTED'] } },
      }),
      prisma.document.count({ where: { status: 'FAILED' } }),
    ]);
  return {
    doctors,
    appointments,
    beds: beds.reduce(
      (result, row) => ({
        ...result,
        [row.status.toLowerCase()]: row._count._all,
      }),
      {},
    ),
    openEmergencies,
    failedDocuments: documents,
  };
};
