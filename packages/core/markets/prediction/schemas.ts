import { z } from 'zod';

// Domain schemas for prediction market inputs

export const PredictionSideSchema = z.enum(['yes', 'no']);

export const PredictionBuyInputSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  marketId: z.string().min(1, 'marketId is required'),
  side: PredictionSideSchema,
  amount: z.number().positive('Amount must be positive'),
});

export const PredictionSellInputSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  marketId: z.string().min(1, 'marketId is required'),
  shares: z.number().positive('Shares must be positive'),
  positionId: z.string().min(1).optional(),
});

export const PredictionResolveInputSchema = z.object({
  marketId: z.string().min(1, 'marketId is required'),
  winningSide: PredictionSideSchema,
  resolvedAt: z.date().optional(),
  resolutionProofUrl: z.string().url().optional(),
  resolutionDescription: z.string().optional(),
});

// Infer types from schemas
export type PredictionSide = z.infer<typeof PredictionSideSchema>;
export type PredictionBuyInput = z.infer<typeof PredictionBuyInputSchema>;
export type PredictionSellInput = z.infer<typeof PredictionSellInputSchema>;
export type PredictionResolveInput = z.infer<
  typeof PredictionResolveInputSchema
>;
