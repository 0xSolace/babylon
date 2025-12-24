/**
 * Zod Schemas for LLM Response Validation
 *
 * These schemas validate the JSON responses from LLM calls in autonomous services.
 * Using Zod ensures type safety at runtime when parsing untrusted LLM output.
 */

import { z } from 'zod'

// =============================================================================
// Trade Decision Schemas (AutonomousTradingService)
// =============================================================================

/**
 * Trade details for prediction markets
 */
export const PredictionTradeSchema = z.object({
  type: z.literal('prediction'),
  market: z.string(),
  action: z.enum(['buy_yes', 'buy_no']),
  amount: z.number().positive(),
  reasoning: z.string().optional(),
})

/**
 * Trade details for perpetual markets
 */
export const PerpTradeSchema = z.object({
  type: z.literal('perp'),
  market: z.string(),
  action: z.enum(['open_long', 'open_short']),
  amount: z.number().positive(),
  reasoning: z.string().optional(),
})

/**
 * Combined trade schema
 */
export const TradeDetailsSchema = z.discriminatedUnion('type', [
  PredictionTradeSchema,
  PerpTradeSchema,
])

/**
 * Trade decision from LLM (AutonomousTradingService)
 */
export const TradeDecisionSchema = z.object({
  action: z.enum(['hold', 'trade']),
  trade: z
    .object({
      type: z.enum(['prediction', 'perp']).optional(),
      market: z.string().optional(),
      action: z
        .enum(['buy_yes', 'buy_no', 'open_long', 'open_short'])
        .optional(),
      amount: z.number().optional(),
      reasoning: z.string().optional(),
    })
    .optional(),
})

export type TradeDecision = z.infer<typeof TradeDecisionSchema>

// =============================================================================
// A2A Trade Decision Schemas (AutonomousA2AService)
// =============================================================================

/**
 * A2A trade decision for prediction markets
 */
export const A2APredictionTradeSchema = z.object({
  type: z.literal('prediction').optional(),
  marketId: z.string(),
  outcome: z.enum(['YES', 'NO']),
  amount: z.number().positive(),
  reasoning: z.string(),
})

/**
 * A2A trade decision for perp markets
 */
export const A2APerpTradeSchema = z.object({
  type: z.literal('perp'),
  ticker: z.string(),
  side: z.enum(['LONG', 'SHORT']),
  size: z.number().positive(),
  leverage: z.number().min(1).max(10).optional(),
  reasoning: z.string(),
})

/**
 * A2A trade decision from LLM (AutonomousA2AService)
 */
export const A2ATradeDecisionSchema = z.object({
  action: z.enum(['trade', 'hold']),
  reasoning: z.string().optional(),
  trade: z
    .object({
      type: z.enum(['prediction', 'perp']).optional(),
      marketId: z.string().optional(),
      outcome: z.enum(['YES', 'NO']).optional(),
      amount: z.number().optional(),
      ticker: z.string().optional(),
      side: z.enum(['LONG', 'SHORT']).optional(),
      size: z.number().optional(),
      leverage: z.number().optional(),
      reasoning: z.string(),
    })
    .optional(),
})

export type A2ATradeDecision = z.infer<typeof A2ATradeDecisionSchema>

// =============================================================================
// Multi-Step Decision Schemas (MultiStepExecutor)
// =============================================================================

/**
 * Multi-step decision parameters schema
 */
export const MultiStepParametersSchema = z.record(z.string(), z.unknown())

/**
 * Multi-step decision from LLM (MultiStepExecutor)
 */
export const MultiStepDecisionSchema = z.object({
  isFinish: z.boolean(),
  action: z.string().optional().default(''),
  parameters: MultiStepParametersSchema.optional().default({}),
  thought: z.string().optional().default(''),
})

export type MultiStepDecisionParsed = z.infer<typeof MultiStepDecisionSchema>

// =============================================================================
// Planning Response Schemas (AutonomousPlanningCoordinator)
// =============================================================================

/**
 * Planned action from LLM
 */
export const PlannedActionSchema = z.object({
  type: z.enum(['trade', 'post', 'comment', 'respond', 'message']),
  priority: z.number().min(1).max(10),
  goalId: z.string().optional().nullable(),
  reasoning: z.string(),
  estimatedImpact: z.number().min(0).max(1),
  params: z.record(z.string(), z.unknown()).optional().default({}),
})

/**
 * Action plan response from LLM (AutonomousPlanningCoordinator)
 */
export const ActionPlanResponseSchema = z.object({
  reasoning: z.string(),
  actions: z.array(PlannedActionSchema),
})

export type ActionPlanResponse = z.infer<typeof ActionPlanResponseSchema>

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Safely parse JSON from LLM response and validate with schema
 *
 * @param response - Raw LLM response text
 * @param schema - Zod schema to validate against
 * @returns Parsed and validated result, or null if invalid
 */
export function parseLLMResponse<T>(
  response: string,
  schema: z.ZodType<T>,
): T | null {
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return null
  }

  const parseResult = schema.safeParse(JSON.parse(jsonMatch[0]))
  if (!parseResult.success) {
    return null
  }

  return parseResult.data
}

/**
 * Safely parse JSON from LLM response and validate with schema
 * Returns default value on failure instead of null
 *
 * @param response - Raw LLM response text
 * @param schema - Zod schema to validate against
 * @param defaultValue - Default value to return on failure
 * @returns Parsed and validated result, or default value if invalid
 */
export function parseLLMResponseWithDefault<T>(
  response: string,
  schema: z.ZodType<T>,
  defaultValue: T,
): T {
  const result = parseLLMResponse(response, schema)
  return result ?? defaultValue
}
