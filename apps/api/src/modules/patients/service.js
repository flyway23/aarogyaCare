import { prisma } from '../../lib/prisma.js';
import { writeAuditLog } from '../../middleware/audit.js';

const profileSelect = {
  dob: true,
  gender: true,
  bloodGroup: true,
  allergies: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
};

/** @param {string} userId @param {string} ip @returns {Promise<object|null>} */
export const getPatientProfile = async (userId, ip) => {
  const profile = await prisma.patientProfile.findUnique({
    where: { userId },
    select: profileSelect,
  });
  await writeAuditLog({
    userId,
    action: 'READ',
    entity: 'PatientProfile',
    entityId: userId,
    ip,
  });
  return profile;
};

/** @param {string} userId @param {object} data @param {string} ip @returns {Promise<object>} */
export const updatePatientProfile = async (userId, data, ip) => {
  const updateData = {
    ...data,
    ...(data.dob !== undefined
      ? { dob: data.dob ? new Date(`${data.dob}T00:00:00.000Z`) : null }
      : {}),
  };
  const profile = await prisma.patientProfile.upsert({
    where: { userId },
    create: { userId, ...updateData },
    update: updateData,
    select: profileSelect,
  });
  await writeAuditLog({
    userId,
    action: 'UPDATE',
    entity: 'PatientProfile',
    entityId: userId,
    ip,
  });
  return profile;
};
