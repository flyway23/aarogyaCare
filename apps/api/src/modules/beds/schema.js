import { z } from 'zod';

export const bedIdSchema = z.object({ id: z.string().uuid() }).strict();
export const emptyObjectSchema = z.object({}).strict();
export const assignmentSchema = z
  .object({
    patientId: z.string().uuid().optional(),
    phone: z.string().trim().min(7).max(30).optional(),
    emergencyCaseId: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    (value) =>
      [value.patientId, value.phone, value.emergencyCaseId].filter(Boolean)
        .length === 1,
    {
      message: 'Choose either a patient or an emergency case',
    },
  );
export const bedStatusSchema = z
  .object({ status: z.enum(['AVAILABLE', 'CLEANING', 'OUT_OF_SERVICE']) })
  .strict();
