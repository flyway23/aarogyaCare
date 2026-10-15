import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../lib/httpError.js';
import { eventBus } from '../../lib/eventBus.js';

const wardTypes = ['GENERAL', 'PRIVATE', 'SEMI_PRIVATE', 'ICU', 'EMERGENCY'];
const statusKeys = [
  'available',
  'occupied',
  'reserved',
  'cleaning',
  'outOfService',
];
const emitUpdated = () => eventBus.emit('bed.updated');

const lockBed = async (tx, id) => {
  await tx.$queryRaw`SELECT "id" FROM "Bed" WHERE "id" = ${id}::uuid FOR UPDATE`;
  const bed = await tx.bed.findUnique({
    where: { id },
    include: { ward: true },
  });
  if (!bed) throw new HttpError(404, 'Bed not found');
  return bed;
};

/** Release stale reservations, retaining their assignment history. @returns {Promise<number>} */
export const expireBedReservations = async () => {
  const expired = await prisma.bed.findMany({
    where: { status: 'RESERVED', reservedUntil: { lte: new Date() } },
    select: { id: true },
  });
  let count = 0;
  for (const { id } of expired) {
    const changed = await prisma.$transaction(async (tx) => {
      const bed = await lockBed(tx, id);
      if (bed.status !== 'RESERVED' || bed.reservedUntil > new Date())
        return false;
      await tx.bedAssignment.updateMany({
        where: { bedId: id, releasedAt: null },
        data: { releasedAt: new Date() },
      });
      await tx.bed.update({
        where: { id },
        data: { status: 'AVAILABLE', reservedUntil: null },
      });
      return true;
    });
    if (changed) count += 1;
  }
  if (count) emitUpdated();
  return count;
};

/** @returns {Promise<object>} */
export const getBedCounts = async () => {
  const beds = await prisma.bed.findMany({
    select: { status: true, ward: { select: { type: true } } },
  });
  return wardTypes.map((type) => {
    const matching = beds.filter((bed) => bed.ward.type === type);
    const counts = Object.fromEntries(statusKeys.map((key) => [key, 0]));
    for (const bed of matching) {
      const key =
        bed.status === 'OUT_OF_SERVICE'
          ? 'outOfService'
          : bed.status.toLowerCase();
      counts[key] += 1;
    }
    return { type, total: matching.length, ...counts };
  });
};

/** @returns {Promise<object[]>} */
export const getBeds = async () => {
  await expireBedReservations();
  const wards = await prisma.ward.findMany({
    include: {
      beds: {
        include: {
          assignments: {
            where: { releasedAt: null },
            include: {
              patient: { select: { id: true, name: true, phone: true } },
              emergencyCase: {
                select: { id: true, name: true, severity: true, status: true },
              },
            },
          },
        },
        orderBy: { bedNumber: 'asc' },
      },
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
  const counts = await getBedCounts();
  return counts.map((group) => ({
    ...group,
    wards: wards.filter((ward) => ward.type === group.type),
  }));
};

/** @param {string} bedId @param {{patientId?:string, emergencyCaseId?:string}} input @param {{id:string}} requester @returns {Promise<object>} */
export const assignBed = async (bedId, input, requester) => {
  const result = await prisma.$transaction(async (tx) => {
    const bed = await lockBed(tx, bedId);
    const now = new Date();
    const validReserved = bed.status === 'RESERVED' && bed.reservedUntil > now;
    if (bed.status !== 'AVAILABLE' && !validReserved)
      throw new HttpError(409, 'Bed is not available for assignment');
    let emergencyCase = null;
    let assignedPatientId = input.patientId ?? null;
    if (input.emergencyCaseId) {
      await tx.$queryRaw`SELECT "id" FROM "EmergencyCase" WHERE "id" = ${input.emergencyCaseId}::uuid FOR UPDATE`;
      emergencyCase = await tx.emergencyCase.findUnique({
        where: { id: input.emergencyCaseId },
      });
      if (!emergencyCase) throw new HttpError(404, 'Emergency case not found');
      if (emergencyCase.status !== 'ACCEPTED')
        throw new HttpError(409, 'Accept the emergency before assigning a bed');
      assignedPatientId = emergencyCase.patientId;
      if (validReserved) {
        const reservation = await tx.bedAssignment.findFirst({
          where: { bedId, emergencyCaseId: emergencyCase.id, releasedAt: null },
        });
        if (!reservation)
          throw new HttpError(409, 'This bed is reserved for another case');
        await tx.bedAssignment.update({
          where: { id: reservation.id },
          data: { releasedAt: now },
        });
      } else if (
        await tx.bedAssignment.findFirst({
          where: { emergencyCaseId: emergencyCase.id, releasedAt: null },
        })
      ) {
        throw new HttpError(
          409,
          'Emergency case already has a bed reservation',
        );
      }
      if (
        emergencyCase.patientId &&
        (await tx.bedAssignment.findFirst({
          where: { patientId: emergencyCase.patientId, releasedAt: null },
        }))
      ) {
        throw new HttpError(
          409,
          'Patient already has an active bed assignment',
        );
      }
    } else {
      if (validReserved)
        throw new HttpError(
          409,
          'Reserved beds must be assigned to their emergency case',
        );
      if (input.phone) {
        const patient = await tx.user.findFirst({
          where: {
            role: 'PATIENT',
            phone: input.phone,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!patient)
          throw new HttpError(404, 'Patient account not found for that phone');
        assignedPatientId = patient.id;
      }
      if (
        await tx.bedAssignment.findFirst({
          where: { patientId: assignedPatientId, releasedAt: null },
        })
      )
        throw new HttpError(
          409,
          'Patient already has an active bed assignment',
        );
    }
    const assignment = await tx.bedAssignment.create({
      data: {
        bedId,
        patientId: assignedPatientId,
        emergencyCaseId: emergencyCase?.id ?? null,
        assignedByUserId: requester.id,
      },
    });
    const updatedBed = await tx.bed.update({
      where: { id: bedId },
      data: { status: 'OCCUPIED', reservedUntil: null },
      include: { ward: true },
    });
    if (emergencyCase)
      await tx.emergencyCase.update({
        where: { id: emergencyCase.id },
        data: { status: 'ADMITTED' },
      });
    return { bed: updatedBed, assignment };
  });
  emitUpdated();
  return result;
};

/** @param {string} bedId @param {{id:string}} requester @returns {Promise<object>} */
export const releaseBed = async (bedId, _requester) => {
  const result = await prisma.$transaction(async (tx) => {
    const bed = await lockBed(tx, bedId);
    if (bed.status !== 'OCCUPIED')
      throw new HttpError(409, 'Only occupied beds can be released');
    await tx.bedAssignment.updateMany({
      where: { bedId, releasedAt: null },
      data: { releasedAt: new Date() },
    });
    return tx.bed.update({
      where: { id: bedId },
      data: { status: 'CLEANING', reservedUntil: null },
      include: { ward: true },
    });
  });
  emitUpdated();
  return result;
};

/** @param {string} bedId @param {{id:string}} requester @returns {Promise<object>} */
export const reserveBed = async (bedId, _requester) => {
  const result = await prisma.$transaction(async (tx) => {
    const bed = await lockBed(tx, bedId);
    if (bed.status !== 'AVAILABLE')
      throw new HttpError(409, 'Only available beds can be reserved');
    return tx.bed.update({
      where: { id: bedId },
      data: {
        status: 'RESERVED',
        reservedUntil: new Date(Date.now() + 30 * 60_000),
      },
      include: { ward: true },
    });
  });
  emitUpdated();
  return result;
};

/** @param {string} bedId @param {'AVAILABLE'|'CLEANING'|'OUT_OF_SERVICE'} nextStatus @param {{id:string}} requester @returns {Promise<object>} */
export const setBedStatus = async (bedId, nextStatus, _requester) => {
  const result = await prisma.$transaction(async (tx) => {
    const bed = await lockBed(tx, bedId);
    const allowed = {
      AVAILABLE: ['CLEANING', 'OUT_OF_SERVICE'],
      CLEANING: ['AVAILABLE', 'OUT_OF_SERVICE'],
      OUT_OF_SERVICE: ['AVAILABLE', 'CLEANING'],
      RESERVED: ['AVAILABLE'],
      OCCUPIED: [],
    };
    if (!allowed[bed.status].includes(nextStatus))
      throw new HttpError(
        409,
        `Cannot change bed from ${bed.status} to ${nextStatus}`,
      );
    if (bed.status === 'RESERVED')
      await tx.bedAssignment.updateMany({
        where: { bedId, releasedAt: null },
        data: { releasedAt: new Date() },
      });
    return tx.bed.update({
      where: { id: bedId },
      data: { status: nextStatus, reservedUntil: null },
      include: { ward: true },
    });
  });
  emitUpdated();
  return result;
};
