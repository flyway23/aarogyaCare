import { z } from 'zod';

export const emptyQuery = z.object({}).strict();
export const appointmentParams = z
  .object({ appointmentId: z.string().uuid() })
  .strict();
export const idParams = z.object({ id: z.string().uuid() }).strict();
export const messageSchema = z
  .object({ text: z.string().trim().min(1).max(2000) })
  .strict();
export const feedbackSchema = z
  .object({
    appointmentId: z.string().uuid(),
    text: z.string().trim().min(5).max(2000),
  })
  .strict();
export const rescheduleSchema = z
  .object({ slotStart: z.string().datetime({ offset: true }) })
  .strict();
export const consentSchema = z
  .object({ doctorId: z.string().uuid(), granted: z.boolean() })
  .strict();
export const notificationParams = z.object({ id: z.string().uuid() }).strict();
