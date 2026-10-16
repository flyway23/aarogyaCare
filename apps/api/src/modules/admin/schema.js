import { z } from 'zod';

export const emptyQuerySchema = z.object({}).strict();
export const resourceParams = z.object({ resource: z.string().min(1).max(50) }).strict();
export const resourceItemParams = resourceParams.extend({ id: z.string().uuid() }).strict();
export const itemParams = z.object({ id: z.string().uuid() }).strict();
export const resourceQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(''),
  sort: z.string().trim().min(1).max(50).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  includeDeleted: z.coerce.boolean().default(false),
}).strict();
export const resourceBody = z.record(z.string(), z.unknown());
