import { z } from 'zod';

export const emptyObjectSchema = z.object({}).strict();
export const doctorListSchema = z
  .object({ specialtyId: z.string().uuid().optional() })
  .strict();
export const doctorIdSchema = z.object({ id: z.string().uuid() }).strict();
export const dateQuerySchema = z
  .object({
    date: z.string().date(),
    slotStart: z.string().datetime({ offset: true }).optional(),
  })
  .strict();
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const scheduleSchema = z
  .object({
    schedules: z
      .array(
        z
          .object({
            weekday: z.number().int().min(0).max(6),
            startTime: time,
            endTime: time,
            slotMinutes: z.number().int().min(5).max(120),
          })
          .strict(),
      )
      .max(14),
  })
  .strict();
export const leaveSchema = z.object({ date: z.string().date() }).strict();
export const statusSchema = z
  .object({ status: z.enum(['AVAILABLE', 'BUSY', 'AWAY']) })
  .strict();
