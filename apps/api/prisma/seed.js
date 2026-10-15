import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

const password = 'Pass@1234';
const demoUsers = [
  { email: 'admin@aarogyacare.demo', name: 'Aarogya Admin', role: 'ADMIN' },
  { email: 'doctor1@aarogyacare.demo', name: 'Dr. Asha Mehta', role: 'DOCTOR' },
  { email: 'doctor2@aarogyacare.demo', name: 'Dr. Rohan Iyer', role: 'DOCTOR' },
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
          bloodGroup: null,
          allergies: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
        },
      });
    }
    if (user.role === 'DOCTOR') {
      const doctorIndex = user.email === 'doctor1@aarogyacare.demo' ? 0 : 1;
      const profile = await prisma.doctorProfile.upsert({
        where: { userId: savedUser.id },
        update: {
          specialtyId: specialties[doctorIndex].id,
          feeInr: doctorIndex === 0 ? 500 : 800,
          bio:
            doctorIndex === 0
              ? 'Primary care and family medicine.'
              : 'Heart health and preventive cardiology.',
          avgConsultMinutes: 15,
          status: 'AVAILABLE',
        },
        create: {
          userId: savedUser.id,
          specialtyId: specialties[doctorIndex].id,
          feeInr: doctorIndex === 0 ? 500 : 800,
          bio:
            doctorIndex === 0
              ? 'Primary care and family medicine.'
              : 'Heart health and preventive cardiology.',
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
            startTime: doctorIndex === 0 ? '09:00' : '13:00',
            endTime: doctorIndex === 0 ? '13:00' : '17:00',
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
    for (const bedNumber of ['01', '02']) {
      await prisma.bed.upsert({
        where: { wardId_bedNumber: { wardId: ward.id, bedNumber } },
        update: {},
        create: { wardId: ward.id, bedNumber },
      });
    }
  }
  console.log('Seeded demo accounts (all use password Pass@1234):');
  for (const user of demoUsers)
    console.log(`${user.role.toLowerCase()}: ${user.email}`);
  console.log(`password: ${password}`);
} finally {
  await prisma.$disconnect();
}
