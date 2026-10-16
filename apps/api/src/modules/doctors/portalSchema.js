import { z } from 'zod';

export const patientIdParams = z.object({ id: z.string().uuid() }).strict();
export const consultationParams = z
  .object({ appointmentId: z.string().uuid() })
  .strict();
export const consultationReportSchema = z
  .object({
    diagnosis: z.string().trim().min(2).max(2000),
    notes: z.string().trim().max(10000).default(''),
    followUpDate: z.string().date().optional().nullable(),
    medicines: z
      .array(
        z
          .object({
            medicine: z.string().trim().min(1).max(200),
            dosage: z.string().trim().min(1).max(100),
            frequency: z.string().trim().min(1).max(100),
            duration: z.string().trim().min(1).max(100),
            instructions: z.string().trim().max(1000).optional().nullable(),
          })
          .strict(),
      )
      .max(30)
      .default([]),
  })
  .strict();
