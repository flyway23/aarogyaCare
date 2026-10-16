import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../lib/httpError.js';
import { eventBus } from '../../lib/eventBus.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { kolkataDate, kolkataDateTime } from './service.js';

const todayInKolkata = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const getDoctorProfile = async (userId) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!doctor) throw new HttpError(403, 'Doctor profile required');
  return doctor;
};

export async function getDoctorToday(userId) {
  const doctor = await getDoctorProfile(userId);
  const date = todayInKolkata();
  const start = kolkataDateTime(date, '00:00');
  const end = new Date(start.getTime() + 86_400_000);
  const [emergencies, appointments] = await Promise.all([
    prisma.emergencyCase.findMany({
      where: {
        status: { not: 'CLOSED' },
        OR: [
          { linkedAppointment: { doctorId: doctor.id } },
          {
            patient: {
              appointmentsAsPatient: { some: { doctorId: doctor.id } },
            },
          },
        ],
      },
      include: { patient: { select: { id: true, name: true, phone: true } } },
      orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        slotStart: { gte: start, lt: end },
        status: {
          in: ['CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED'],
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
            patientProfile: { select: { allergies: true } },
          },
        },
        queueEntry: true,
        consultationReport: { select: { id: true } },
      },
      orderBy: [{ queueEntry: { position: 'asc' } }, { slotStart: 'asc' }],
    }),
  ]);
  const severityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  emergencies.sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      a.createdAt - b.createdAt,
  );
  return { date, status: doctor.status, emergencies, appointments };
}

export async function listDoctorPatients(userId) {
  const doctor = await getDoctorProfile(userId);
  const visited = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      status: { in: ['IN_CONSULTATION', 'COMPLETED'] },
    },
    distinct: ['patientId'],
    select: { patientId: true },
  });
  if (!visited.length) return [];
  return prisma.user.findMany({
    where: {
      id: { in: visited.map((item) => item.patientId) },
      role: 'PATIENT',
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      patientProfile: {
        select: { dob: true, gender: true, bloodGroup: true, allergies: true },
      },
      appointmentsAsPatient: {
        where: {
          doctorId: doctor.id,
          status: { in: ['IN_CONSULTATION', 'COMPLETED'] },
        },
        select: { id: true, slotStart: true, status: true },
        orderBy: { slotStart: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getPatientRecords(patientId, doctorUserId, ip) {
  const doctor = await getDoctorProfile(doctorUserId);
  const appointment = await prisma.appointment.findFirst({
    where: { patientId, doctorId: doctor.id },
    select: { id: true },
  });
  if (!appointment) throw new HttpError(404, 'Patient not found');
  const revoked = await prisma.consent.findUnique({
    where: { patientId_doctorId: { patientId, doctorId: doctorUserId } },
    select: { revokedAt: true },
  });
  if (revoked?.revokedAt)
    throw new HttpError(403, 'Patient has revoked record access');
  const [profile, documents, timeline, latestSummary, reports, appointments] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: patientId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          patientProfile: true,
        },
      }),
      prisma.document.findMany({
        where: { patientId },
        select: {
          id: true,
          appointmentId: true,
          originalName: true,
          mimeType: true,
          status: true,
          type: true,
          failReason: true,
          createdAt: true,
          extractions: {
            select: {
              id: true,
              kind: true,
              value: true,
              sourceSnippet: true,
              confidence: true,
              isAbnormal: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.timelineEvent.findMany({
        where: { patientId },
        orderBy: { eventDate: 'desc' },
        take: 100,
      }),
      prisma.visitSummary.findFirst({
        where: { patientId, appointment: { doctorId: doctor.id } },
        include: { appointment: { select: { id: true, slotStart: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.consultationReport.findMany({
        where: { patientId, doctorId: doctorUserId },
        include: { medicines: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.appointment.findMany({
        where: { patientId, doctorId: doctor.id, status: 'COMPLETED' },
        select: {
          id: true,
          slotStart: true,
          consultationReport: { select: { id: true } },
        },
        orderBy: { slotStart: 'desc' },
      }),
    ]);
  if (!profile) throw new HttpError(404, 'Patient not found');
  await writeAuditLog({
    userId: doctorUserId,
    action: 'DOCTOR_PATIENT_RECORDS_READ',
    entity: 'PatientProfile',
    entityId: patientId,
    ip,
  });
  return {
    patient: profile,
    documents,
    timeline,
    latestSummary,
    reports,
    appointments,
  };
}

export async function startConsultation(appointmentId, doctorUserId) {
  const doctor = await getDoctorProfile(doctorUserId);
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({
      where: { id: appointmentId, doctorId: doctor.id },
    });
    if (!appointment) throw new HttpError(404, 'Appointment not found');
    if (appointment.status !== 'CHECKED_IN')
      throw new HttpError(
        409,
        'Only checked-in appointments can start a consultation',
      );
    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'IN_CONSULTATION' },
      include: { patient: { select: { id: true, name: true } } },
    });
    await tx.queueEntry.updateMany({
      where: { appointmentId, status: 'WAITING' },
      data: { status: 'IN_PROGRESS' },
    });
    return updated;
  });
}

export async function endConsultation(appointmentId, doctorUserId) {
  const doctor = await getDoctorProfile(doctorUserId);
  const completed = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({
      where: { id: appointmentId, doctorId: doctor.id },
    });
    if (!appointment) throw new HttpError(404, 'Appointment not found');
    if (appointment.status !== 'IN_CONSULTATION')
      throw new HttpError(409, 'Only active consultations can be completed');
    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED' },
      include: { patient: { select: { id: true, name: true } } },
    });
    await tx.queueEntry.updateMany({
      where: { appointmentId, status: 'IN_PROGRESS' },
      data: { status: 'DONE' },
    });
    return updated;
  });
  eventBus.emit('consultation.completed', {
    appointmentId: completed.id,
    patientId: completed.patientId,
    doctorId: doctorUserId,
    completedAt: completed.updatedAt,
  });
  return completed;
}

export async function createConsultationReport(
  appointmentId,
  input,
  doctorUserId,
) {
  const doctor = await getDoctorProfile(doctorUserId);
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, doctorId: doctor.id, status: 'COMPLETED' },
    select: { id: true, patientId: true },
  });
  if (!appointment) throw new HttpError(404, 'Completed appointment not found');
  const existing = await prisma.consultationReport.findUnique({
    where: { appointmentId },
  });
  if (existing)
    throw new HttpError(409, 'A report already exists for this appointment');
  try {
    const report = await prisma.consultationReport.create({
      data: {
        appointmentId,
        patientId: appointment.patientId,
        doctorId: doctorUserId,
        diagnosis: input.diagnosis,
        notes: input.notes,
        followUpDate: input.followUpDate
          ? kolkataDate(input.followUpDate)
          : null,
        medicines: {
          create: input.medicines.map((item) => ({
            ...item,
            patientId: appointment.patientId,
          })),
        },
      },
      include: { medicines: true },
    });
    eventBus.emit('consultation.report.ready', {
      patientId: appointment.patientId,
      appointmentId,
    });
    return report;
  } catch (error) {
    if (error.code === 'P2002')
      throw new HttpError(409, 'A report already exists for this appointment');
    throw error;
  }
}
