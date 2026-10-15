import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../lib/httpError.js';
import { kolkataDate, kolkataDateTime } from '../doctors/service.js';

const appointmentRelations = {
  doctor: {
    select: {
      id: true,
      feeInr: true,
      avgConsultMinutes: true,
      status: true,
      user: { select: { name: true } },
      specialty: { select: { name: true } },
    },
  },
  patient: { select: { id: true, name: true, phone: true, email: true } },
  queueEntry: true,
  payment: {
    select: {
      id: true,
      status: true,
      method: true,
      amountInr: true,
      receiptNo: true,
    },
  },
};
const appointmentSelection = (includeReason = false) => ({
  id: true,
  patientId: true,
  doctorId: true,
  slotStart: true,
  slotEnd: true,
  status: true,
  ...(includeReason ? { reason: true } : {}),
  heldUntil: true,
  bookedByUserId: true,
  isEmergency: true,
  createdAt: true,
  updatedAt: true,
  ...appointmentRelations,
});
/** @param {string} slotStart @returns {{date:string,time:string,start:Date}} */
const slotInKolkata = (slotStart) => {
  const start = new Date(slotStart);
  if (Number.isNaN(start.getTime()))
    throw new HttpError(400, 'Invalid slot time');
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(start);
  const part = Object.fromEntries(
    local.map(({ type, value }) => [type, value]),
  );
  return {
    date: `${part.year}-${part.month}-${part.day}`,
    time: `${part.hour}:${part.minute}`,
    start,
  };
};

/** @param {object} input @param {{id:string,role:string}} requester @returns {Promise<object>} */
export const createAppointment = async (input, requester) => {
  const { date, time, start } = slotInKolkata(input.slotStart);
  if (start <= new Date())
    throw new HttpError(409, 'This slot is no longer available');
  const slotDate = kolkataDate(date);
  try {
    return await prisma.$transaction(
      async (tx) => {
        const doctor = await tx.doctorProfile.findUnique({
          where: { id: input.doctorId },
          include: { schedules: true },
        });
        if (!doctor) throw new HttpError(404, 'Doctor not found');
        const schedule = doctor.schedules.find(
          (item) =>
            item.weekday === slotDate.getUTCDay() &&
            time >= item.startTime &&
            time < item.endTime,
        );
        if (!schedule)
          throw new HttpError(409, 'This slot is not in the doctor schedule');
        const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
        const endMinutes =
          Number(schedule.endTime.slice(0, 2)) * 60 +
          Number(schedule.endTime.slice(3));
        const scheduleStart =
          Number(schedule.startTime.slice(0, 2)) * 60 +
          Number(schedule.startTime.slice(3));
        if (
          minutes + schedule.slotMinutes > endMinutes ||
          (minutes - scheduleStart) % schedule.slotMinutes !== 0
        ) {
          throw new HttpError(409, 'This slot is not in the doctor schedule');
        }
        const conflict = await tx.appointment.findFirst({
          where: {
            doctorId: doctor.id,
            slotStart: start,
            OR: [
              {
                status: { in: ['CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'] },
              },
              { status: 'HELD', heldUntil: { gt: new Date() } },
            ],
          },
          select: { id: true },
        });
        if (conflict)
          throw new HttpError(409, 'This slot has already been booked');

        let patientId = requester.id;
        if (requester.role === 'operator') {
          if (!input.patient)
            throw new HttpError(400, 'Walk-in patient details are required');
          let patient = await tx.user.findFirst({
            where: {
              role: 'PATIENT',
              phone: input.patient.phone,
              isActive: true,
              deletedAt: null,
            },
          });
          if (!patient) {
            const email =
              input.patient.email?.toLowerCase() ??
              `walkin-${randomUUID()}@walkin.aarogyacare.local`;
            const passwordHash = await bcrypt.hash(randomUUID(), 12);
            patient = await tx.user.create({
              data: {
                name: input.patient.name,
                phone: input.patient.phone,
                email,
                passwordHash,
                role: 'PATIENT',
                patientProfile: { create: {} },
              },
            });
          }
          patientId = patient.id;
        }
        const appointment = await tx.appointment.create({
          data: {
            patientId,
            doctorId: doctor.id,
            slotStart: start,
            slotEnd: new Date(start.getTime() + schedule.slotMinutes * 60_000),
            status: 'HELD',
            reason: input.reason,
            heldUntil: new Date(Date.now() + 5 * 60_000),
            bookedByUserId: requester.id,
          },
          select: appointmentSelection(requester.role === 'patient'),
        });
        return appointment;
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error.code === 'P2034' || error.code === 'P2002')
      throw new HttpError(409, 'This slot has already been booked');
    throw error;
  }
};

/** @param {string} userId @returns {Promise<object[]>} */
export const listMyAppointments = async (userId) =>
  prisma.appointment.findMany({
    where: { patientId: userId },
    select: appointmentSelection(true),
    orderBy: { slotStart: 'desc' },
  });

/** @param {string} doctorId @param {string} date @returns {Promise<object[]>} */
export const listDoctorAppointments = async (doctorId, date) => {
  const dayStart = kolkataDateTime(date, '00:00');
  return prisma.appointment.findMany({
    where: {
      doctorId,
      slotStart: {
        gte: dayStart,
        lt: new Date(dayStart.getTime() + 86_400_000),
      },
      status: { in: ['HELD', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'] },
    },
    select: appointmentSelection(false),
    orderBy: { slotStart: 'asc' },
  });
};

/** @param {string} id @param {{id:string,role:string}} requester @returns {Promise<object>} */
export const cancelAppointment = async (id, requester) => {
  const where = {
    id,
    ...(requester.role === 'patient' ? { patientId: requester.id } : {}),
  };
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({ where });
    if (!appointment) throw new HttpError(404, 'Appointment not found');
    if (!['HELD', 'CONFIRMED'].includes(appointment.status))
      throw new HttpError(409, 'This appointment can no longer be cancelled');
    await tx.queueEntry.updateMany({
      where: { appointmentId: id, status: 'WAITING' },
      data: { status: 'SKIPPED' },
    });
    return tx.appointment.update({
      where: { id },
      data: { status: 'CANCELLED', heldUntil: null },
      select: appointmentSelection(requester.role === 'patient'),
    });
  });
};

/** @param {string} id @returns {Promise<object>} */
export const checkInAppointment = async (id) =>
  prisma
    .$transaction(
      async (tx) => {
        const appointment = await tx.appointment.findUnique({ where: { id } });
        if (!appointment) throw new HttpError(404, 'Appointment not found');
        if (appointment.status !== 'CONFIRMED')
          throw new HttpError(409, 'Only confirmed appointments can check in');
        const date = kolkataDate(
          slotInKolkata(appointment.slotStart.toISOString()).date,
        );
        const last = await tx.queueEntry.findFirst({
          where: { doctorId: appointment.doctorId, date },
          orderBy: { position: 'desc' },
          select: { position: true },
        });
        const queueEntry = await tx.queueEntry.create({
          data: {
            appointmentId: id,
            doctorId: appointment.doctorId,
            date,
            position: (last?.position ?? 0) + 1,
          },
        });
        const updated = await tx.appointment.update({
          where: { id },
          data: { status: 'CHECKED_IN' },
          select: appointmentSelection(false),
        });
        return { ...updated, queueEntry };
      },
      { isolationLevel: 'Serializable' },
    )
    .catch((error) => {
      if (error instanceof HttpError) throw error;
      if (error.code === 'P2034' || error.code === 'P2002')
        throw new HttpError(409, 'Queue changed; retry check-in');
      throw error;
    });

/** @returns {Promise<number>} */
export const releaseExpiredHolds = async () => {
  const result = await prisma.appointment.updateMany({
    where: { status: 'HELD', heldUntil: { lte: new Date() } },
    data: { status: 'CANCELLED', heldUntil: null },
  });
  return result.count;
};

/** @param {string} id @param {string} date @returns {Promise<object[]>} */
export const listQueue = async (id, date) =>
  prisma.queueEntry.findMany({
    where: { doctorId: id, date: kolkataDate(date) },
    include: { appointment: { select: appointmentSelection(false) } },
    orderBy: { position: 'asc' },
  });

/** @param {string} id @param {'NO_SHOW'|'SKIPPED'} action @returns {Promise<object>} */
export const updateQueueEntry = async (id, action) =>
  prisma.$transaction(async (tx) => {
    const entry = await tx.queueEntry.findUnique({ where: { id } });
    if (!entry) throw new HttpError(404, 'Queue entry not found');
    if (entry.status !== 'WAITING')
      throw new HttpError(409, 'Only waiting entries can be changed');
    const updated = await tx.queueEntry.update({
      where: { id },
      data: { status: 'SKIPPED' },
    });
    if (action === 'NO_SHOW')
      await tx.appointment.update({
        where: { id: entry.appointmentId },
        data: { status: 'NO_SHOW' },
      });
    return updated;
  });

/** @param {string} id @param {number} newPosition @param {string} reason @returns {Promise<object[]>} */
export const reorderQueue = async (id, newPosition, reason) =>
  prisma.$transaction(async (tx) => {
    const target = await tx.queueEntry.findUnique({ where: { id } });
    if (!target || target.status !== 'WAITING')
      throw new HttpError(404, 'Waiting queue entry not found');
    const allEntries = await tx.queueEntry.findMany({
      where: {
        doctorId: target.doctorId,
        date: target.date,
      },
      orderBy: { position: 'asc' },
    });
    const entries = allEntries.filter((entry) => entry.status === 'WAITING');
    if (newPosition < 1 || newPosition > entries.length)
      throw new HttpError(400, 'Position is outside the waiting queue');
    const reordered = entries.filter((entry) => entry.id !== id);
    reordered.splice(newPosition - 1, 0, target);
    const waitingQueue = [...reordered];
    const finalOrder = allEntries.map((entry) =>
      entry.status === 'WAITING' ? waitingQueue.shift() : entry,
    );
    for (const entry of allEntries)
      await tx.queueEntry.update({
        where: { id: entry.id },
        data: { position: -entry.position },
      });
    for (const [index, entry] of finalOrder.entries())
      await tx.queueEntry.update({
        where: { id: entry.id },
        data: {
          position: index + 1,
          ...(entry.id === id ? { reorderReason: reason } : {}),
        },
      });
    return tx.queueEntry.findMany({
      where: { doctorId: target.doctorId, date: target.date },
      orderBy: { position: 'asc' },
    });
  });
