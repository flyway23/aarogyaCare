import { z } from 'zod';

export const createOrderSchema = z
  .object({ appointmentId: z.string().uuid() })
  .strict();
export const verifySchema = z
  .object({
    orderId: z.string().min(1).max(100),
    paymentId: z.string().min(1).max(100),
    signature: z.string().min(1).max(200),
  })
  .strict();
export const offlineSchema = z
  .object({
    appointmentId: z.string().uuid(),
    method: z.enum(['CASH', 'UPI', 'CARD']),
  })
  .strict();
export const refundSchema = z
  .object({ reason: z.string().trim().min(3).max(500) })
  .strict();
export const paymentIdSchema = z.object({ id: z.string().uuid() }).strict();
export const emptyObjectSchema = z.object({}).strict();
export const webhookSchema = z
  .object({
    event: z.string(),
    payload: z
      .object({
        payment: z
          .object({
            entity: z
              .object({
                id: z.string(),
                order_id: z.string(),
                status: z.string().optional(),
              })
              .passthrough(),
          })
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();
