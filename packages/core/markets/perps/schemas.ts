import { z } from 'zod';

// Domain schemas for perpetual market inputs

export const PerpSideSchema = z.enum(['long', 'short']);

export const PerpOpenInputSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  ticker: z.string().min(1).max(20),
  side: PerpSideSchema,
  size: z.number().positive('Size must be positive'),
  leverage: z.number().int().min(1).max(100),
  maxSlippage: z.number().min(0).max(1).optional(),
});

export const PerpCloseInputSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  positionId: z.string().min(1, 'positionId is required'),
  percentage: z.number().min(0).max(1).optional(),
  exitPriceOverride: z.number().positive().optional(),
  maxSlippage: z.number().min(0).max(1).optional(),
});

// Infer types from schemas
export type PerpSide = z.infer<typeof PerpSideSchema>;
export type PerpOpenInput = z.infer<typeof PerpOpenInputSchema>;
export type PerpCloseInput = z.infer<typeof PerpCloseInputSchema>;
