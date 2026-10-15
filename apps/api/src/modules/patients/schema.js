import { z } from 'zod';

export const profileSchema = z
  .object({
    dob: z.string().date().nullable().optional(),
    gender: z.string().trim().max(40).nullable().optional(),
    bloodGroup: z.string().trim().max(8).nullable().optional(),
    allergies: z.string().trim().max(5000).nullable().optional(),
    emergencyContactName: z.string().trim().max(100).nullable().optional(),
    emergencyContactPhone: z.string().trim().max(30).nullable().optional(),
  })
  .strict();
