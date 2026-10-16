import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../lib/httpError.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { eventBus } from '../../lib/eventBus.js';
import { getDoctorSlots } from '../doctors/service.js';

const isParticipant = (appointment, user) =>
  user.role === 'patient'
    ? appointment.patientId === user.id
    : appointment.doctor?.userId === user.id;

/** @param {string} userId @returns {Promise<object>} */
export const getOwnRecords = async (userId) => {
  const [appointments, documents] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId: userId, status: 'COMPLETED' },
      select: {
        id: true,
        slotStart: true,
        doctor: { select: { user: { select: { name: true } } } },
        visitSummary: true,
        consultationReport: { include: { medicines: true } },
        feedback: { select: { id: true } },
      },
      orderBy: { slotStart: 'desc' },
    }),
    prisma.document.findMany({
      where: { patientId: userId },
      select: {
        id: true,
        appointmentId: true,
        originalName: true,
        status: true,
        type: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  await writeAuditLog({
    userId,
    action: 'PATIENT_RECORDS_READ',
    entity: 'PatientRecords',
    entityId: userId,
  });
  return { appointments, documents };
};

/** @param {string} userId @returns {Promise<object>} */
export const exportOwnRecords = async (userId) => {
  const records = await getOwnRecords(userId);
  return { exportedAt: new Date().toISOString(), records };
};

/** @param {string} appointmentId @param {object} user @returns {Promise<object>} */
const getChatThread = async (appointmentId, user) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { doctor: { select: { userId: true } } },
  });
  if (!appointment || !isParticipant(appointment, user))
    throw new HttpError(404, 'Appointment not found');
  if (appointment.status !== 'COMPLETED')
    throw new HttpError(
      409,
      'Chat is available after the consultation is completed',
    );
  return prisma.chatThread.upsert({
    where: { appointmentId },
    create: {
      appointmentId,
      patientId: appointment.patientId,
      doctorId: appointment.doctor.userId,
    },
    update: {},
  });
};

/** @param {string} appointmentId @param {object} user @returns {Promise<object[]>} */
export const listChatMessages = async (appointmentId, user) => {
  const thread = await getChatThread(appointmentId, user);
  await writeAuditLog({
    userId: user.id,
    action: 'CHAT_MESSAGES_READ',
    entity: 'ChatThread',
    entityId: thread.id,
  });
  return prisma.chatMessage.findMany({
    where: { threadId: thread.id },
    include: { sender: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
};

/** @param {string} appointmentId @param {object} user @param {string} text @returns {Promise<object>} */
export const sendChatMessage = async (appointmentId, user, text) => {
  const thread = await getChatThread(appointmentId, user);
  if (user.role === 'patient') {
    const local = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .formatToParts(new Date())
        .map(({ type, value }) => [type, value]),
    );
    const since = new Date(
      Date.UTC(
        Number(local.year),
        Number(local.month) - 1,
        Number(local.day),
        -5,
        -30,
      ),
    );
    const sent = await prisma.chatMessage.count({
      where: {
        senderId: user.id,
        thread: { patientId: user.id },
        createdAt: { gte: since },
      },
    });
    if (sent >= 20) throw new HttpError(429, 'Daily message limit reached');
  }
  const message = await prisma.chatMessage.create({
    data: { threadId: thread.id, senderId: user.id, text },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });
  await writeAuditLog({
    userId: user.id,
    action: 'CHAT_MESSAGE_CREATED',
    entity: 'ChatMessage',
    entityId: message.id,
  });
  return message;
};

/** @param {string} userId @param {string} appointmentId @param {string} text @returns {Promise<object>} */
export const createFeedback = async (userId, appointmentId, text) => {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patientId: userId, status: 'COMPLETED' },
  });
  if (!appointment) throw new HttpError(404, 'Completed appointment not found');
  return prisma.feedback.create({
    data: { appointmentId, patientId: userId, text },
  });
};

/** @param {string} userId @param {string} appointmentId @param {string} slotStart @returns {Promise<object>} */
export const rescheduleAppointment = async (
  userId,
  appointmentId,
  slotStart,
) => {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patientId: userId },
  });
  if (!appointment) throw new HttpError(404, 'Appointment not found');
  if (!['HELD', 'CONFIRMED'].includes(appointment.status))
    throw new HttpError(409, 'This appointment can no longer be rescheduled');
  const start = new Date(slotStart);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(start);
  const date = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  const dateString = `${date.year}-${date.month}-${date.day}`;
  const slots = await getDoctorSlots(appointment.doctorId, dateString);
  const slot = slots.find((item) => item.start === start.toISOString());
  if (!slot) throw new HttpError(409, 'Selected slot is no longer available');
  const updated = await prisma.$transaction(
    async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          doctorId: appointment.doctorId,
          slotStart: start,
          id: { not: appointmentId },
          status: {
            in: ['HELD', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'],
          },
        },
      });
      if (conflict)
        throw new HttpError(409, 'Selected slot is no longer available');
      await tx.queueEntry.deleteMany({ where: { appointmentId } });
      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          slotStart: start,
          slotEnd: new Date(slot.end),
          heldUntil:
            appointment.status === 'HELD'
              ? new Date(Date.now() + 5 * 60000)
              : null,
        },
      });
    },
    { isolationLevel: 'Serializable' },
  );
  eventBus.emit('appointment.rescheduled', { appointmentId });
  return updated;
};

/** @param {string} userId @returns {Promise<object[]>} */
export const listConsents = async (userId) =>
  prisma.consent.findMany({
    where: { patientId: userId },
    include: {
      doctor: {
        select: {
          name: true,
          doctorProfile: { select: { specialty: { select: { name: true } } } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

/** @param {string} userId @param {string} doctorId @param {boolean} granted @returns {Promise<object>} */
export const setConsent = async (userId, doctorId, granted) => {
  const doctor = await prisma.user.findFirst({
    where: { id: doctorId, role: 'DOCTOR', isActive: true, deletedAt: null },
  });
  if (!doctor) throw new HttpError(404, 'Doctor not found');
  const consent = await prisma.consent.upsert({
    where: { patientId_doctorId: { patientId: userId, doctorId } },
    create: {
      patientId: userId,
      doctorId,
      ...(granted ? {} : { revokedAt: new Date() }),
    },
    update: granted
      ? { grantedAt: new Date(), revokedAt: null }
      : { revokedAt: new Date() },
  });
  await writeAuditLog({
    userId,
    action: granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
    entity: 'Consent',
    entityId: consent.id,
  });
  return consent;
};

/** @param {string} userId @returns {Promise<object[]>} */
export const getAccessHistory = async (userId) => {
  const [documents, reports, summaries] = await Promise.all([
    prisma.document.findMany({
      where: { patientId: userId },
      select: { id: true },
    }),
    prisma.consultationReport.findMany({
      where: { patientId: userId },
      select: { id: true },
    }),
    prisma.visitSummary.findMany({
      where: { patientId: userId },
      select: { id: true },
    }),
  ]);
  const entityIds = [...documents, ...reports, ...summaries].map(
    (item) => item.id,
  );
  const threads = await prisma.chatThread.findMany({
    where: { patientId: userId },
    select: { id: true },
  });
  return prisma.auditLog.findMany({
    where: {
      OR: [
        {
          entityId: {
            in: [...entityIds, ...threads.map((thread) => thread.id)],
          },
        },
        {
          entityId: userId,
          entity: { in: ['PatientProfile', 'PatientRecords'] },
        },
      ],
    },
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
};

/** @param {string} userId @returns {Promise<object[]>} */
export const getNotifications = async (userId) =>
  prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

/** @param {string} userId @param {string} id @returns {Promise<object>} */
export const markNotificationRead = async (userId, id) => {
  const updated = await prisma.notification.updateMany({
    where: { id, userId },
    data: { readAt: new Date() },
  });
  if (!updated.count) throw new HttpError(404, 'Notification not found');
  return prisma.notification.findUnique({ where: { id } });
};
