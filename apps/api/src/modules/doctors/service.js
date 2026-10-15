import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../lib/httpError.js';

const doctorSelect = {
  id: true,
  feeInr: true,
  bio: true,
  avgConsultMinutes: true,
  status: true,
  user: { select: { id: true, name: true } },
  specialty: { select: { id: true, name: true } },
};
const activeStatuses = ['HELD', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'];

/** @param {string} date @returns {Date} */
export const kolkataDate = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/** @param {string} date @param {string} time @returns {Date} */
export const kolkataDateTime = (date, time) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30));
};

/** @param {string} value @returns {number} */
const weekdayFor = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

/** @returns {Promise<object[]>} */
export const listSpecialties = async () =>
  prisma.specialty.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { doctors: true } } },
  });

/** @param {string|undefined} specialtyId @returns {Promise<object[]>} */
export const listDoctors = async (specialtyId) =>
  prisma.doctorProfile.findMany({
    where: specialtyId ? { specialtyId } : {},
    select: doctorSelect,
    orderBy: { user: { name: 'asc' } },
  });

/** @param {string} id @returns {Promise<object>} */
export const getDoctor = async (id) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id },
    select: { ...doctorSelect, schedules: { orderBy: { weekday: 'asc' } } },
  });
  if (!doctor) throw new HttpError(404, 'Doctor not found');
  return doctor;
};

/** @param {string} id @param {string} date @returns {Promise<object[]>} */
export const getDoctorSlots = async (id, date) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id },
    include: {
      schedules: true,
      leaves: { where: { date: kolkataDate(date) } },
    },
  });
  if (!doctor) throw new HttpError(404, 'Doctor not found');
  if (doctor.leaves.length) return [];
  const daySchedules = doctor.schedules.filter(
    (item) => item.weekday === weekdayFor(date),
  );
  const now = new Date();
  const bookings = await prisma.appointment.findMany({
    where: {
      doctorId: id,
      slotStart: {
        gte: kolkataDateTime(date, '00:00'),
        lt: kolkataDateTime(date, '23:59'),
      },
      status: { in: activeStatuses },
    },
    select: { slotStart: true, heldUntil: true, status: true },
  });
  const slots = [];
  for (const schedule of daySchedules) {
    let cursor = schedule.startTime;
    const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
    const endMinutes = endHour * 60 + endMinute;
    while (true) {
      const [hour, minute] = cursor.split(':').map(Number);
      const startMinutes = hour * 60 + minute;
      if (startMinutes + schedule.slotMinutes > endMinutes) break;
      const start = kolkataDateTime(date, cursor);
      const end = new Date(start.getTime() + schedule.slotMinutes * 60_000);
      const occupied = bookings.some(
        (booking) =>
          booking.slotStart.getTime() === start.getTime() &&
          (booking.status !== 'HELD' || booking.heldUntil > now),
      );
      if (!occupied && start > now)
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          available: true,
        });
      const next = startMinutes + schedule.slotMinutes;
      cursor = `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
    }
  }
  return slots.sort((a, b) => a.start.localeCompare(b.start));
};

/** @param {string} id @param {string} date @param {string} slotStart @returns {Promise<object>} */
export const getQueueInfo = async (id, date, slotStart) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id },
    select: { status: true, avgConsultMinutes: true },
  });
  if (!doctor) throw new HttpError(404, 'Doctor not found');
  const start = slotStart
    ? new Date(slotStart)
    : kolkataDateTime(date, '23:59');
  const patientsAhead = await prisma.appointment.count({
    where: {
      doctorId: id,
      slotStart: { gte: kolkataDateTime(date, '00:00'), lt: start },
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'] },
    },
  });
  const adjustment = doctor.status === 'AVAILABLE' ? 0 : 15;
  return {
    patientsAhead,
    estimatedWaitMinRange: [
      Math.round(patientsAhead * doctor.avgConsultMinutes * 0.8) + adjustment,
      Math.round(patientsAhead * doctor.avgConsultMinutes * 1.3) + adjustment,
    ],
    doctorStatus: doctor.status,
  };
};

/** @param {string} userId @param {Array<object>} schedules @returns {Promise<object[]>} */
export const replaceDoctorSchedule = async (userId, schedules) => {
  const doctor = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!doctor) throw new HttpError(404, 'Doctor profile not found');
  for (const item of schedules)
    if (item.startTime >= item.endTime)
      throw new HttpError(400, 'Schedule end time must be after start time');
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    const daySchedules = schedules
      .filter((item) => item.weekday === weekday)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let index = 1; index < daySchedules.length; index += 1)
      if (daySchedules[index].startTime < daySchedules[index - 1].endTime)
        throw new HttpError(400, 'Doctor schedule intervals cannot overlap');
  }
  await prisma.$transaction(async (tx) => {
    await tx.doctorSchedule.deleteMany({ where: { doctorId: doctor.id } });
    for (const item of schedules)
      await tx.doctorSchedule.create({
        data: { ...item, doctorId: doctor.id },
      });
  });
  return prisma.doctorSchedule.findMany({
    where: { doctorId: doctor.id },
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
  });
};

/** @param {string} userId @param {string} date @returns {Promise<object>} */
export const addDoctorLeave = async (userId, date) => {
  const doctor = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!doctor) throw new HttpError(404, 'Doctor profile not found');
  return prisma.doctorLeave.upsert({
    where: { doctorId_date: { doctorId: doctor.id, date: kolkataDate(date) } },
    create: { doctorId: doctor.id, date: kolkataDate(date) },
    update: {},
  });
};

/** @param {string} userId @param {'AVAILABLE'|'BUSY'|'AWAY'} status @returns {Promise<object>} */
export const setDoctorStatus = async (userId, status) => {
  const doctor = await prisma.doctorProfile
    .update({ where: { userId }, data: { status }, select: { status: true } })
    .catch((error) => {
      if (error.code === 'P2025')
        throw new HttpError(404, 'Doctor profile not found');
      throw error;
    });
  return doctor;
};
