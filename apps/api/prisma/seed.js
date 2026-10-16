import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/lib/prisma.js';

const password = 'Pass@1234';
const demoUsers = [
  { email: 'admin@aarogyacare.demo', name: 'Aarogya Admin', role: 'ADMIN' },
  ...[
    ['Dr. Asha Mehta', 'General Medicine'],
    ['Dr. Rohan Iyer', 'Cardiology'],
    ['Dr. Kavya Rao', 'General Medicine'],
    ['Dr. Arjun Nair', 'General Medicine'],
    ['Dr. Neha Shah', 'Cardiology'],
    ['Dr. Vivek Menon', 'Cardiology'],
    ['Dr. Isha Kapoor', 'Dermatology'],
    ['Dr. Kabir Das', 'Dermatology'],
    ['Dr. Meera Joshi', 'Dermatology'],
    ['Dr. Sana Khan', 'General Medicine'],
  ].map(([name], index) => ({
    email: `doctor${index + 1}@aarogyacare.demo`,
    name,
    role: 'DOCTOR',
  })),
  {
    email: 'operator@aarogyacare.demo',
    name: 'Care Operator',
    role: 'OPERATOR',
  },
  { email: 'patient@aarogyacare.demo', name: 'Demo Patient', role: 'PATIENT' },
];

const passwordHash = await bcrypt.hash(password, 12);

try {
  const specialties = await Promise.all(
    ['General Medicine', 'Cardiology', 'Dermatology'].map((name) =>
      prisma.specialty.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );
  for (const user of demoUsers) {
    const savedUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash,
        isActive: true,
        deletedAt: null,
      },
      create: {
        ...user,
        passwordHash,
        ...(user.role === 'PATIENT' ? { patientProfile: { create: {} } } : {}),
      },
    });
    if (user.role === 'PATIENT') {
      await prisma.patientProfile.upsert({
        where: { userId: savedUser.id },
        create: { user: { connect: { id: savedUser.id } } },
        update: {
          dob: null,
          gender: null,
          bloodGroup: 'O+',
          allergies: 'No known drug allergies (demo)',
          emergencyContactName: null,
          emergencyContactPhone: null,
        },
      });
    }
    if (user.role === 'DOCTOR') {
      const doctorIndex = Number(user.email.match(/doctor(\d+)/)[1]) - 1;
      const specialtyIndex = doctorIndex < 4 ? 0 : doctorIndex < 7 ? 1 : 2;
      const feeInr = specialtyIndex === 1 ? 800 : 500;
      const bio = `Demo ${specialties[specialtyIndex].name.toLowerCase()} consultation.`;
      const profile = await prisma.doctorProfile.upsert({
        where: { userId: savedUser.id },
        update: {
          specialtyId: specialties[specialtyIndex].id,
          feeInr,
          bio,
          avgConsultMinutes: 15,
          status: 'AVAILABLE',
        },
        create: {
          userId: savedUser.id,
          specialtyId: specialties[specialtyIndex].id,
          feeInr,
          bio,
          avgConsultMinutes: 15,
          status: 'AVAILABLE',
        },
      });
      await prisma.doctorSchedule.deleteMany({
        where: { doctorId: profile.id },
      });
      for (const weekday of [1, 2, 3, 4, 5]) {
        await prisma.doctorSchedule.create({
          data: {
            doctorId: profile.id,
            weekday,
            startTime: doctorIndex % 2 === 0 ? '09:00' : '13:00',
            endTime: doctorIndex % 2 === 0 ? '13:00' : '17:00',
            slotMinutes: 15,
          },
        });
      }
    }
  }
  for (const [type, name] of [
    ['GENERAL', 'General Ward'],
    ['PRIVATE', 'Private Ward'],
    ['SEMI_PRIVATE', 'Semi Private Ward'],
    ['ICU', 'Intensive Care'],
    ['EMERGENCY', 'Emergency Ward'],
  ]) {
    const ward = await prisma.ward.upsert({
      where: { name_type: { name, type } },
      update: {},
      create: { name, type },
    });
    for (const bedNumber of ['01', '02', '03', '04', '05', '06']) {
      await prisma.bed.upsert({
        where: { wardId_bedNumber: { wardId: ward.id, bedNumber } },
        update: {},
        create: { wardId: ward.id, bedNumber },
      });
    }
  }
  const patient = await prisma.user.findUniqueOrThrow({
    where: { email: 'patient@aarogyacare.demo' },
  });
  const demoDoctor = await prisma.doctorProfile.findUniqueOrThrow({
    where: {
      userId: (
        await prisma.user.findUniqueOrThrow({
          where: { email: 'doctor1@aarogyacare.demo' },
        })
      ).id,
    },
  });
  // A completed fictional visit makes the doctor records and summary screens useful on first login.
  const pastSlot = new Date(Date.now() - 7 * 86400000);
  pastSlot.setUTCHours(4, 0, 0, 0);
  let completed = await prisma.appointment.findFirst({
    where: {
      patientId: patient.id,
      doctorId: demoDoctor.id,
      reason: 'Demo follow-up visit',
    },
  });
  if (!completed) {
    completed = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: demoDoctor.id,
        slotStart: pastSlot,
        slotEnd: new Date(pastSlot.getTime() + 15 * 60000),
        status: 'COMPLETED',
        reason: 'Demo follow-up visit',
        bookedByUserId: patient.id,
      },
    });
  }
  await prisma.visitSummary.upsert({
    where: { appointmentId: completed.id },
    update: {},
    create: {
      patientId: patient.id,
      appointmentId: completed.id,
      content:
        'Fictional demo summary: patient reports feeling well. Review the attached sample lab report.',
    },
  });
  await prisma.consultationReport.upsert({
    where: { appointmentId: completed.id },
    update: {},
    create: {
      appointmentId: completed.id,
      patientId: patient.id,
      doctorId: demoDoctor.userId,
      diagnosis: 'Routine wellness review (demo)',
      notes: 'Fictional data for demonstrating the doctor record workflow.',
    },
  });
  const nextClinicDay = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
    const day = new Date(
      Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
    );
    do day.setUTCDate(day.getUTCDate() + 1);
    while ([0, 6].includes(day.getUTCDay()));
    return day;
  };
  const clinicDay = nextClinicDay();
  const demoDoctors = await prisma.doctorProfile.findMany({
    where: {
      user: {
        email: { in: ['doctor1@aarogyacare.demo', 'doctor2@aarogyacare.demo'] },
      },
    },
    include: { user: true },
  });
  for (const [index, doctor] of demoDoctors.entries()) {
    const slot = new Date(
      Date.UTC(
        clinicDay.getUTCFullYear(),
        clinicDay.getUTCMonth(),
        clinicDay.getUTCDate(),
        index ? 7 : 3,
        index ? 30 : 30,
      ),
    );
    const reason = `Demo appointment ${index + 1}`;
    let appointment = await prisma.appointment.findFirst({
      where: { patientId: patient.id, doctorId: doctor.id, reason },
    });
    if (!appointment)
      appointment = await prisma.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          slotStart: slot,
          slotEnd: new Date(slot.getTime() + 15 * 60000),
          status: 'CONFIRMED',
          reason,
          bookedByUserId: patient.id,
        },
      });
    await prisma.payment.upsert({
      where: { appointmentId: appointment.id },
      update: {},
      create: {
        appointmentId: appointment.id,
        amountInr: doctor.feeInr,
        method: 'MOCK',
        status: 'PAID',
        receiptNo: `DEMO-${index + 1}-${appointment.id}`,
      },
    });
  }
  const samplePath = fileURLToPath(
    new URL('../samples/fake-lab-report.pdf', import.meta.url),
  );
  const sample = await readFile(samplePath);
  if (
    !(await prisma.document.findFirst({
      where: {
        patientId: patient.id,
        originalName: 'Demo lab report (fictional).pdf',
      },
    }))
  ) {
    const doc = await prisma.document.create({
      data: {
        patientId: patient.id,
        appointmentId: completed.id,
        originalName: 'Demo lab report (fictional).pdf',
        mimeType: 'application/pdf',
        storagePath: samplePath,
        sha256: createHash('sha256').update(sample).digest('hex'),
        status: 'READY',
        type: 'LAB_REPORT',
        extractedText:
          'Fictional demo sample. See the attached source PDF for all details.',
      },
    });
    await prisma.timelineEvent.create({
      data: {
        patientId: patient.id,
        documentId: doc.id,
        eventDate: completed.slotStart,
        description: 'Fictional demo lab report uploaded',
      },
    });
  }
  if (
    !(await prisma.emergencyCase.findFirst({
      where: { patientId: patient.id, complaint: 'Demo: mild dehydration' },
    }))
  ) {
    await prisma.emergencyCase.create({
      data: {
        patientId: patient.id,
        name: patient.name,
        phone: patient.phone ?? '0000000000',
        complaint: 'Demo: mild dehydration',
        severity: 'LOW',
        location: 'Demo reception',
        raisedByUserId: patient.id,
      },
    });
  }
  console.log('Seeded demo accounts (all use password Pass@1234):');
  for (const user of demoUsers)
    console.log(`${user.role.toLowerCase()}: ${user.email}`);
  console.log(`password: ${password}`);
} finally {
  await prisma.$disconnect();
}
