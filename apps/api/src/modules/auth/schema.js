import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
  phone: z.string().trim().max(30).optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(72),
});

export const emptyBodySchema = z.object({}).strict().optional().default({});
