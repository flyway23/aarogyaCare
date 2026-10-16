import { Queue } from 'bullmq';
import { bullConnection } from '../../lib/queue.js';
import { eventBus } from '../../lib/eventBus.js';
import { prisma } from '../../lib/prisma.js';

export const appointmentReminderQueue = new Queue('appointment-reminders', {
  connection: bullConnection(),
});

const notify = (userId, title, body) =>
  prisma.notification.create({ data: { userId, title, body } });
const reminder = async (appointmentId) => {
  const item = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: { select: { email: true, name: true } } },
  });
  if (!item || item.status === 'CANCELLED') return;
  const delay = item.slotStart.getTime() - 24 * 60 * 60_000 - Date.now();
  if (delay <= 0) return;
  const existing = await appointmentReminderQueue.getJob(
    `appointment-reminder-${item.id}`,
  );
  if (existing) await existing.remove().catch(() => {});
  await appointmentReminderQueue.add(
    'appointment-reminder',
    {
      appointmentId: item.id,
      to: item.patient.email,
      subject: 'AarogyaCare appointment reminder',
      text: `Hello ${item.patient.name}, this is a reminder for your upcoming AarogyaCare appointment.`,
    },
    {
      delay,
      jobId: `appointment-reminder-${item.id}`,
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );
};

eventBus.on('appointment.booked', ({ appointmentId }) => {
  void reminder(appointmentId).catch((error) =>
    console.error('Failed to process appointment booking event', error.message),
  );
});
eventBus.on('appointment.rescheduled', ({ appointmentId }) => {
  void Promise.resolve()
    .then(() => prisma.appointment.findUnique({ where: { id: appointmentId } }))
    .then(
      (item) =>
        item &&
        notify(
          item.patientId,
          'Appointment rescheduled',
          'Your appointment time has been updated.',
        ),
    )
    .then(() => reminder(appointmentId))
    .catch((error) =>
      console.error(
        'Failed to process appointment reschedule event',
        error.message,
      ),
    );
});
eventBus.on('payment.paid', ({ paymentId }) => {
  void Promise.resolve()
    .then(() =>
      prisma.payment.findUnique({
        where: { id: paymentId },
        include: { appointment: true },
      }),
    )
    .then(
      (item) =>
        item &&
        Promise.all([
          notify(
            item.appointment.patientId,
            'Appointment confirmed',
            'Your appointment has been confirmed.',
          ),
          notify(
            item.appointment.patientId,
            'Payment received',
            'Your appointment payment was received.',
          ),
        ]),
    )
    .catch((error) =>
      console.error('Failed to create payment notification', error.message),
    );
});
eventBus.on('consultation.completed', ({ patientId }) => {
  void Promise.resolve()
    .then(() =>
      notify(
        patientId,
        'Consultation completed',
        'Your consultation record is available.',
      ),
    )
    .catch((error) =>
      console.error(
        'Failed to create consultation notification',
        error.message,
      ),
    );
});
eventBus.on('consultation.report.ready', ({ patientId }) => {
  void Promise.resolve()
    .then(() =>
      notify(
        patientId,
        'Visit report ready',
        'Your doctor has added a consultation report.',
      ),
    )
    .catch((error) =>
      console.error('Failed to create report notification', error.message),
    );
});
eventBus.on('document.processed', ({ patientId }) => {
  void Promise.resolve()
    .then(() =>
      notify(
        patientId,
        'Document ready',
        'Your uploaded document has finished processing.',
      ),
    )
    .catch((error) =>
      console.error('Failed to create document notification', error.message),
    );
});
