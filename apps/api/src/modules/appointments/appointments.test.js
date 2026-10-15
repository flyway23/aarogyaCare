import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { app } from '../../app.js';
import { releaseExpiredHolds } from './service.js';

const tokenFor = (user) =>
  jwt.sign(
    { type: 'access', role: user.role.toLowerCase() },
    env.JWT_ACCESS_SECRET,
    { subject: user.id, expiresIn: '15m' },
  );
const futureWeekday = () => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
  const [year, month, day] = today.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 14));
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6)
    date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

describe('Phase 2 doctors, appointments, and queue', () => {
  let doctor;
  let patient;
  let operator;
  let doctorUser;
  let date;
  let slotStart;
  let leaveDate;
  let walkInPhone;

  beforeAll(async () => {
    doctor = await prisma.doctorProfile.findFirst({
      where: { user: { email: 'doctor1@aarogyacare.demo' } },
    });
    patient = await prisma.user.findUnique({
      where: { email: 'patient@aarogyacare.demo' },
    });
    operator = await prisma.user.findUnique({
      where: { email: 'operator@aarogyacare.demo' },
    });
    doctorUser = await prisma.user.findUnique({
      where: { email: 'doctor1@aarogyacare.demo' },
    });
    if (!doctor || !patient || !operator)
      throw new Error('Run the Phase 2 database seed before API tests');
    date = futureWeekday();
    slotStart = new Date(`${date}T07:15:00.000Z`); // 12:45 Asia/Kolkata
    const leaveDay = new Date(`${date}T00:00:00.000Z`);
    leaveDay.setUTCDate(leaveDay.getUTCDate() + 7);
    leaveDate = leaveDay.toISOString().slice(0, 10);
    walkInPhone = `99999${String(Date.now()).slice(-5)}`;
    await prisma.appointment.deleteMany({
      where: {
        doctorId: doctor.id,
        slotStart: {
          gte: new Date(`${date}T00:00:00.000Z`),
          lt: new Date(`${date}T23:59:59.999Z`),
        },
      },
    });
  });

  afterAll(async () => {
    if (doctor && date) {
      await prisma.appointment.deleteMany({
        where: {
          doctorId: doctor.id,
          slotStart: {
            gte: new Date(`${date}T00:00:00.000Z`),
            lt: new Date(`${date}T23:59:59.999Z`),
          },
        },
      });
      await prisma.doctorLeave.deleteMany({
        where: {
          doctorId: doctor.id,
          date: new Date(`${leaveDate}T00:00:00.000Z`),
        },
      });
      await prisma.user.deleteMany({ where: { phone: walkInPhone } });
    }
  });

  it('generates schedule slots and denies unauthenticated and wrong-role queue access', async () => {
    const specialtyList = await request(app)
      .get('/api/specialties')
      .set('Authorization', `Bearer ${tokenFor(patient)}`);
    expect(specialtyList.status).toBe(200);
    expect(specialtyList.body.data.length).toBeGreaterThan(0);
    const doctorList = await request(app)
      .get('/api/doctors')
      .query({ specialtyId: doctor.specialtyId })
      .set('Authorization', `Bearer ${tokenFor(patient)}`);
    expect(doctorList.status).toBe(200);
    expect(doctorList.body.data.some((item) => item.id === doctor.id)).toBe(
      true,
    );
    const doctorDetail = await request(app)
      .get(`/api/doctors/${doctor.id}`)
      .set('Authorization', `Bearer ${tokenFor(patient)}`);
    expect(doctorDetail.status).toBe(200);

    const slots = await request(app)
      .get(`/api/doctors/${doctor.id}/slots`)
      .query({ date })
      .set('Authorization', `Bearer ${tokenFor(patient)}`);
    expect(slots.status).toBe(200);
    expect(
      slots.body.data.some((slot) => slot.start === slotStart.toISOString()),
    ).toBe(true);

    const unauthorized = await request(app)
      .get('/api/queue')
      .query({ doctorId: doctor.id, date });
    expect(unauthorized.status).toBe(401);
    const forbidden = await request(app)
      .get('/api/queue')
      .query({ doctorId: doctor.id, date })
      .set('Authorization', `Bearer ${tokenFor(patient)}`);
    expect(forbidden.status).toBe(403);
  });

  it('allows exactly one concurrent booking for the same slot and runs it through the operator queue', async () => {
    const payload = {
      doctorId: doctor.id,
      slotStart: slotStart.toISOString(),
      reason: 'Routine consultation',
    };
    const responses = await Promise.all(
      [patient, patient].map((user) =>
        request(app)
          .post('/api/appointments')
          .set('Authorization', `Bearer ${tokenFor(user)}`)
          .send(payload),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const booked = responses.find((response) => response.status === 200).body
      .data;
    expect(booked.reason).toBe('Routine consultation');

    const unavailable = await request(app)
      .get(`/api/doctors/${doctor.id}/slots`)
      .query({ date })
      .set('Authorization', `Bearer ${tokenFor(patient)}`);
    expect(
      unavailable.body.data.some(
        (slot) => slot.start === slotStart.toISOString(),
      ),
    ).toBe(false);

    const confirmed = await request(app)
      .post(`/api/appointments/${booked.id}/confirm`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({});
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('CONFIRMED');

    const estimate = await request(app)
      .get(`/api/doctors/${doctor.id}/queue-info`)
      .query({
        date,
        slotStart: new Date(slotStart.getTime() + 15 * 60_000).toISOString(),
      })
      .set('Authorization', `Bearer ${tokenFor(patient)}`);
    expect(estimate.status).toBe(200);
    expect(estimate.body.data).toMatchObject({
      patientsAhead: 1,
      estimatedWaitMinRange: [12, 20],
    });

    const checkedIn = await request(app)
      .post(`/api/appointments/${booked.id}/check-in`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({});
    expect(checkedIn.status).toBe(200);
    expect(checkedIn.body.data.queueEntry.position).toBe(1);

    const appointmentList = await request(app)
      .get('/api/appointments')
      .query({ doctorId: doctor.id, date })
      .set('Authorization', `Bearer ${tokenFor(operator)}`);
    expect(appointmentList.status).toBe(200);
    expect(
      appointmentList.body.data.some((item) => item.id === booked.id),
    ).toBe(true);
    expect(
      appointmentList.body.data.find((item) => item.id === booked.id),
    ).not.toHaveProperty('reason');
    const myAppointments = await request(app)
      .get('/api/appointments/me')
      .set('Authorization', `Bearer ${tokenFor(patient)}`);
    expect(myAppointments.status).toBe(200);
    expect(myAppointments.body.data.some((item) => item.id === booked.id)).toBe(
      true,
    );
    expect(
      myAppointments.body.data.find((item) => item.id === booked.id).reason,
    ).toBe('Routine consultation');

    const later = [
      new Date(slotStart.getTime() - 30 * 60_000),
      new Date(slotStart.getTime() - 15 * 60_000),
    ];
    const moreAppointments = [];
    for (const nextSlot of later) {
      const created = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${tokenFor(patient)}`)
        .send({ ...payload, slotStart: nextSlot.toISOString() });
      expect(created.status).toBe(200);
      const confirmedNext = await request(app)
        .post(`/api/appointments/${created.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${tokenFor(operator)}`)
        .send({});
      expect(confirmedNext.status).toBe(200);
      const checkedNext = await request(app)
        .post(`/api/appointments/${created.body.data.id}/check-in`)
        .set('Authorization', `Bearer ${tokenFor(operator)}`)
        .send({});
      expect(checkedNext.status).toBe(200);
      moreAppointments.push(checkedNext.body.data);
    }

    const reordered = await request(app)
      .post(`/api/queue/${moreAppointments[1].queueEntry.id}/reorder`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({ position: 1, reason: 'Patient has an earlier transport pickup' });
    expect(reordered.status).toBe(200);
    expect(reordered.body.data[0].id).toBe(moreAppointments[1].queueEntry.id);
    expect(reordered.body.data[0].reorderReason).toBe(
      'Patient has an earlier transport pickup',
    );

    const noShow = await request(app)
      .post(`/api/queue/${moreAppointments[1].queueEntry.id}/no-show`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({});
    expect(noShow.status).toBe(200);
    expect(noShow.body.data.status).toBe('SKIPPED');

    const queue = await request(app)
      .get('/api/queue')
      .query({ doctorId: doctor.id, date })
      .set('Authorization', `Bearer ${tokenFor(operator)}`);
    expect(queue.status).toBe(200);
    expect(queue.body.data).toHaveLength(3);
    expect(queue.body.data[0].appointment).not.toHaveProperty('reason');
    const skipped = await request(app)
      .post(`/api/queue/${checkedIn.body.data.queueEntry.id}/skip`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({});
    expect(skipped.status).toBe(200);
    expect(skipped.body.data.status).toBe('SKIPPED');

    const cancelledBooking = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${tokenFor(patient)}`)
      .send({
        ...payload,
        slotStart: new Date(slotStart.getTime() - 45 * 60_000).toISOString(),
      });
    expect(cancelledBooking.status).toBe(200);
    const cancelled = await request(app)
      .post(`/api/appointments/${cancelledBooking.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(patient)}`)
      .send({});
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    const walkIn = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({
        ...payload,
        slotStart: new Date(slotStart.getTime() - 60 * 60_000).toISOString(),
        patient: { name: 'Walk In Test', phone: walkInPhone },
      });
    expect(walkIn.status).toBe(200);
    expect(walkIn.body.data.patient.phone).toBe(walkInPhone);
    const cancelledWalkIn = await request(app)
      .post(`/api/appointments/${walkIn.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(operator)}`)
      .send({});
    expect(cancelledWalkIn.status).toBe(200);
  });

  it('lets a doctor edit schedule, leave, and status; releases expired holds', async () => {
    const schedules = await prisma.doctorSchedule.findMany({
      where: { doctorId: doctor.id },
      select: {
        weekday: true,
        startTime: true,
        endTime: true,
        slotMinutes: true,
      },
    });
    const scheduleUpdate = await request(app)
      .put('/api/doctors/me/schedule')
      .set('Authorization', `Bearer ${tokenFor(doctorUser)}`)
      .send({ schedules });
    expect(scheduleUpdate.status).toBe(200);

    const leave = await request(app)
      .post('/api/doctors/me/leave')
      .set('Authorization', `Bearer ${tokenFor(doctorUser)}`)
      .send({ date: leaveDate });
    expect(leave.status).toBe(200);
    const closedSlots = await request(app)
      .get(`/api/doctors/${doctor.id}/slots`)
      .query({ date: leaveDate })
      .set('Authorization', `Bearer ${tokenFor(patient)}`);
    expect(closedSlots.body.data).toEqual([]);

    const status = await request(app)
      .put('/api/doctors/me/status')
      .set('Authorization', `Bearer ${tokenFor(doctorUser)}`)
      .send({ status: 'BUSY' });
    expect(status.status).toBe(200);
    expect(status.body.data.status).toBe('BUSY');
    const wrongRole = await request(app)
      .put('/api/doctors/me/status')
      .set('Authorization', `Bearer ${tokenFor(patient)}`)
      .send({ status: 'AVAILABLE' });
    expect(wrongRole.status).toBe(403);
    await request(app)
      .put('/api/doctors/me/status')
      .set('Authorization', `Bearer ${tokenFor(doctorUser)}`)
      .send({ status: 'AVAILABLE' });

    const expiredStart = new Date(`${date}T04:00:00.000Z`);
    const expired = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        slotStart: expiredStart,
        slotEnd: new Date(expiredStart.getTime() + 15 * 60_000),
        reason: 'Expired hold test',
        bookedByUserId: patient.id,
        status: 'HELD',
        heldUntil: new Date(Date.now() - 60_000),
      },
    });
    expect(await releaseExpiredHolds()).toBeGreaterThanOrEqual(1);
    const released = await prisma.appointment.findUnique({
      where: { id: expired.id },
    });
    expect(released.status).toBe('CANCELLED');
  });
});
