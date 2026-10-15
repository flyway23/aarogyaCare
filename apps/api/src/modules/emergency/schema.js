import { z } from 'zod';

const text = (min, max) => z.string().trim().min(min).max(max);
export const emergencyIdSchema = z.object({ id: z.string().uuid() }).strict();
export const escalationParamsSchema = z
  .object({ id: z.string().uuid() })
  .strict();
export const emptyObjectSchema = z.object({}).strict();
export const raiseEmergencySchema = z
  .object({
    name: text(2, 100),
    phone: text(7, 30),
    complaint: text(3, 1000),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    location: text(2, 200),
  })
  .strict();
export const reserveEmergencyBedSchema = z
  .object({ bedId: z.string().uuid() })
  .strict();
export const escalateSchema = z
  .object({
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
    location: text(2, 200),
  })
  .strict();
