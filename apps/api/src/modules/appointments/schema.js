import { z } from 'zod';

export const emptyObjectSchema = z.object({}).strict();
export const createAppointmentSchema = z
  .object({
    doctorId: z.string().uuid(),
    slotStart: z.string().datetime({ offset: true }),
    reason: z.string().trim().min(3).max(1000),
    patient: z
      .object({
        name: z.string().trim().min(2).max(100),
        phone: z.string().trim().min(7).max(30),
        email: z.string().email().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const appointmentIdSchema = z.object({ id: z.string().uuid() }).strict();
export const appointmentListSchema = z
  .object({ doctorId: z.string().uuid(), date: z.string().date() })
  .strict();
