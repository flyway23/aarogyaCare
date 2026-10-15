import { HttpError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import {
  listQueue,
  reorderQueue,
  updateQueueEntry,
} from '../appointments/service.js';

/** @param {string} doctorId @param {string} date @returns {Promise<object[]>} */
export const getQueue = async (doctorId, date) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    select: { id: true },
  });
  if (!doctor) throw new HttpError(404, 'Doctor not found');
  return listQueue(doctorId, date);
};

/** @param {string} id @returns {Promise<object>} */
export const markNoShow = async (id) => updateQueueEntry(id, 'NO_SHOW');
/** @param {string} id @returns {Promise<object>} */
export const skipQueueEntry = async (id) => updateQueueEntry(id, 'SKIPPED');
/** @param {string} id @param {number} position @param {string} reason @returns {Promise<object[]>} */
export const changeQueueOrder = async (id, position, reason) =>
  reorderQueue(id, position, reason);
