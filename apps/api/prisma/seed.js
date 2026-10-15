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
  }
  console.log('Seeded demo accounts (all use password Pass@1234):');
  for (const user of demoUsers)
    console.log(`${user.role.toLowerCase()}: ${user.email}`);
  console.log(`password: ${password}`);
} finally {
  await prisma.$disconnect();
}
