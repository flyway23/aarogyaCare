import { Queue } from 'bullmq';
import { bullConnection } from '../../lib/queue.js';
import { prisma } from '../../lib/prisma.js';
import { eventBus } from '../../lib/eventBus.js';

export const paymentEmailQueue = new Queue('payment-emails', {
  connection: bullConnection(),
});
eventBus.on('payment.paid', ({ paymentId }) => {
  void prisma.payment
    .findUnique({
      where: { id: paymentId },
      include: {
        appointment: {
          include: { patient: true, doctor: { include: { user: true } } },
        },
      },
    })
    .then(
      (payment) =>
        payment &&
        paymentEmailQueue.add(
          'payment-confirmation',
          {
            to: payment.appointment.patient.email,
            subject: 'AarogyaCare payment receipt',
            text: `Hello ${payment.appointment.patient.name}, your payment of INR ${payment.amountInr} was received. Receipt: ${payment.receiptNo}. Doctor: ${payment.appointment.doctor.user.name}.`,
          },
          {
            jobId: `payment-confirmation-${payment.id}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        ),
    )
    .catch((error) =>
      console.error('Failed to enqueue payment email', error.message),
    );
});
export const closePaymentEmailQueue = () => paymentEmailQueue.close();
