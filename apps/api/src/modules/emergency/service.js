import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../lib/httpError.js';
import { eventBus } from '../../lib/eventBus.js';

const alertView = (item) => ({
  id: item.id,
  name: item.name,
  phone: item.phone,
  complaint: item.complaint,
  severity: item.severity,
  location: item.location,
  status: item.status,
  createdAt: item.createdAt,
  linkedAppointmentId: item.linkedAppointmentId,
});
const emitRaised = (item) => eventBus.emit('emergency.raised', alertView(item));

const lockEmergency = async (tx, id) => {
  await tx.$queryRaw`SELECT "id" FROM "EmergencyCase" WHERE "id" = ${id}::uuid FOR UPDATE`;
  const item = await tx.emergencyCase.findUnique({ where: { id } });
  if (!item) throw new HttpError(404, 'Emergency case not found');
  return item;
};
const lockBed = async (tx, id) => {
  await tx.$queryRaw`SELECT "id" FROM "Bed" WHERE "id" = ${id}::uuid FOR UPDATE`;
  const bed = await tx.bed.findUnique({ where: { id } });
  if (!bed) throw new HttpError(404, 'Bed not found');
  return bed;
};

/** @param {object} input @param {{id:string,role:string}} requester @returns {Promise<object>} */
export const raiseEmergency = async (input, requester) => {
  const item = await prisma.emergencyCase.create({
    data: {
      ...input,
      patientId: requester.role === 'patient' ? requester.id : null,
      raisedByUserId: requester.id,
    },
  });
  emitRaised(item);
  return alertView(item);
};

/** @returns {Promise<object[]>} */
export const listEmergencies = async (requester) => {
  const doctor =
    requester.role === 'doctor'
      ? await prisma.doctorProfile.findUnique({
          where: { userId: requester.id },
          select: { id: true },
        })
      : null;
  if (requester.role === 'doctor' && !doctor)
    throw new HttpError(403, 'Doctor profile required');
  const cases = await prisma.emergencyCase.findMany({
    where: {
      status: { not: 'CLOSED' },
      ...(doctor
        ? {
            OR: [
              { linkedAppointment: { doctorId: doctor.id } },
              {
                patient: {
                  appointmentsAsPatient: { some: { doctorId: doctor.id } },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      acceptedBy: { select: { id: true, name: true } },
      bedAssignments: {
        where: { releasedAt: null },
        include: { bed: { include: { ward: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return cases
    .sort(
      (a, b) =>
        rank[a.severity] - rank[b.severity] || b.createdAt - a.createdAt,
    )
    .map((item) => ({ ...item, complaint: item.complaint }));
};

/** @param {string} id @param {{id:string}} requester @returns {Promise<object>} */
export const acceptEmergency = async (id, requester) => {
  const result = await prisma.$transaction(async (tx) => {
    const item = await lockEmergency(tx, id);
    if (item.status === 'ACCEPTED' && item.acceptedByUserId === requester.id)
      return item;
    if (item.status !== 'RAISED')
      throw new HttpError(409, 'Only raised emergencies can be accepted');
    return tx.emergencyCase.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedByUserId: requester.id },
    });
  });
  return alertView(result);
};

/** @param {string} emergencyId @param {string} bedId @param {{id:string}} requester @returns {Promise<object>} */
export const reserveEmergencyBed = async (emergencyId, bedId, requester) => {
  const result = await prisma.$transaction(async (tx) => {
    const item = await lockEmergency(tx, emergencyId);
    if (item.status !== 'ACCEPTED')
      throw new HttpError(409, 'Accept the emergency before reserving a bed');
    const bed = await lockBed(tx, bedId);
    if (bed.status !== 'AVAILABLE')
      throw new HttpError(409, 'Only available beds can be reserved');
    if (
      await tx.bedAssignment.findFirst({
        where: { emergencyCaseId: emergencyId, releasedAt: null },
      })
    )
      throw new HttpError(409, 'Emergency case already has a bed reservation');
    const until = new Date(Date.now() + 30 * 60_000);
    const updatedBed = await tx.bed.update({
      where: { id: bedId },
      data: { status: 'RESERVED', reservedUntil: until },
      include: { ward: true },
    });
    const assignment = await tx.bedAssignment.create({
      data: {
        bedId,
        emergencyCaseId: emergencyId,
        patientId: item.patientId,
        assignedByUserId: requester.id,
      },
    });
    return { bed: updatedBed, assignment, emergency: alertView(item) };
  });
  eventBus.emit('bed.updated');
  return result;
};

/** @param {string} id @param {{id:string}} requester @returns {Promise<object>} */
export const closeEmergency = async (id, _requester) => {
  let bedChanged = false;
  const item = await prisma.$transaction(async (tx) => {
    const current = await lockEmergency(tx, id);
    if (current.status === 'CLOSED') return current;
    const assignment = await tx.bedAssignment.findFirst({
      where: { emergencyCaseId: id, releasedAt: null },
      include: { bed: true },
    });
    if (assignment?.bed.status === 'OCCUPIED')
      throw new HttpError(
        409,
        'Release the occupied bed before closing this emergency',
      );
    if (assignment?.bed.status === 'RESERVED') {
      await tx.bedAssignment.update({
        where: { id: assignment.id },
        data: { releasedAt: new Date() },
      });
      await tx.bed.update({
        where: { id: assignment.bedId },
        data: { status: 'AVAILABLE', reservedUntil: null },
      });
      bedChanged = true;
    }
    return tx.emergencyCase.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  });
  if (bedChanged) eventBus.emit('bed.updated');
  return alertView(item);
};

/** @param {string} appointmentId @param {{severity:string,location:string}} input @param {{id:string}} requester @returns {Promise<object>} */
export const escalateAppointment = async (appointmentId, input, requester) => {
  const { item, created } = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: { select: { id: true, name: true, phone: true } } },
    });
    if (!appointment) throw new HttpError(404, 'Appointment not found');
    const existing = await tx.emergencyCase.findUnique({
      where: { linkedAppointmentId: appointmentId },
    });
    if (existing) return { item: existing, created: false };
    if (
      !['HELD', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'].includes(
        appointment.status,
      )
    )
      throw new HttpError(409, 'This appointment cannot be escalated');
    const saved = await tx.emergencyCase.create({
      data: {
        patientId: appointment.patientId,
        name: appointment.patient.name,
        phone: appointment.patient.phone ?? 'Not provided',
        complaint: appointment.reason,
        severity: input.severity,
        location: input.location,
        raisedByUserId: requester.id,
        linkedAppointmentId: appointmentId,
      },
    });
    return { item: saved, created: true };
  });
  if (created) emitRaised(item);
  return alertView(item);
};
