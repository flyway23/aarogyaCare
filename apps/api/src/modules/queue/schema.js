import { z } from 'zod';

export const emptyObjectSchema = z.object({}).strict();
export const queueListSchema = z
  .object({ doctorId: z.string().uuid(), date: z.string().date() })
  .strict();
export const queueIdSchema = z.object({ id: z.string().uuid() }).strict();
export const reorderSchema = z
  .object({
    position: z.number().int().positive(),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();
