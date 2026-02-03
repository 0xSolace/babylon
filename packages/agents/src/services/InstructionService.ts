/**
 * InstructionService
 *
 * Manages owner-provided instructions for agents.
 * Instructions are parsed from team chat messages and injected into agent decision prompts.
 *
 * Key responsibilities:
 * - Parse user messages to detect strategic instructions
 * - Store and retrieve active instructions
 * - Evaluate conditions for conditional instructions
 * - Expire and revoke instructions
 *
 * @packageDocumentation
 */

import {
  type AgentInstruction,
  agentInstructions,
  and,
  db,
  eq,
  generateSnowflakeId,
  gt,
  type InstructionCategory,
  type InstructionCondition,
  type InstructionDirectiveType,
  isNull,
  lt,
  type NewAgentInstruction,
  or,
} from '@babylon/db';
import { logger } from '@babylon/shared';
import type { PerpMarketContext } from '../autonomous/templates/multi-step-decision';
import { callGroqDirect } from '../llm/direct-groq';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of parsing a user message for instruction content.
 */
export interface ParsedInstruction {
  /** Whether the message contains an instruction */
  isInstruction: boolean;
  /** Confidence score from LLM (0-1) */
  confidence: number;
  /** The extracted rule in imperative form */
  rule: string;
  /** Category of the instruction */
  category: InstructionCategory;
  /** Type of directive (always, never, prefer, avoid, until) */
  directiveType: InstructionDirectiveType;
  /** Priority level 1-10 */
  priority: number;
  /** Optional expiry date (ISO string) */
  validUntil?: string;
  /** Optional conditions for the instruction to apply */
  conditions?: InstructionCondition;
}

/**
 * Result of evaluating an instruction's conditions.
 */
export interface ConditionEvaluationResult {
  /** Whether all conditions are met */
  met: boolean;
  /** Human-readable reason if not met */
  reason?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum confidence score required to treat a message as an instruction */
const CONFIDENCE_THRESHOLD = 0.7;

/** Maximum number of active instructions per agent */
const MAX_INSTRUCTIONS_PER_AGENT = 15;

// =============================================================================
// LLM Parsing
// =============================================================================

/**
 * Prompt template for instruction parsing.
 * Uses few-shot examples to improve classification accuracy.
 */
const PARSING_PROMPT = `You are analyzing a message from a user to their trading agent.
Determine if this message contains a strategic instruction or rule that the agent should follow.

INSTRUCTION EXAMPLES (these ARE instructions):
- "Don't buy any more BitcAIn" → directive to avoid a specific asset
- "Focus on prediction markets instead of perps" → trading strategy preference
- "Be more aggressive with your trades" → behavior modification
- "Stop trading until tomorrow" → time-based restriction
- "Only buy if the price drops below $100k" → conditional trading rule
- "Prioritize responding to comments over trading" → activity preference

CONVERSATIONAL EXAMPLES (these are NOT instructions):
- "How are you doing?" → question, not instruction
- "What's your P&L?" → information request
- "Thanks!" → acknowledgment
- "Show me your positions" → query, not instruction
- "Hello" → greeting
- "Can you check the markets?" → request for information

CRITICAL RULES:
1. If the message tells the agent to DO something or NOT DO something, it's an instruction
2. If the message asks for information or is conversational, it's NOT an instruction
3. Be conservative - only mark as instruction if you're confident

MESSAGE TO ANALYZE:
"{MESSAGE}"

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "isInstruction": boolean,
  "confidence": 0.0 to 1.0,
  "rule": "imperative form of the rule" or null if not instruction,
  "category": "trading" | "social" | "behavior" | "general",
  "directiveType": "always" | "never" | "prefer" | "avoid" | "until",
  "priority": 1 to 10 (higher = more important),
  "validUntil": "ISO date string" or null,
  "conditions": { "priceBelow": { "ticker": "BTCN", "value": 100000 } } or null
}`;

/**
 * Parse a user message to determine if it contains an instruction.
 * Uses LLM to extract intent, category, and conditions.
 *
 * @param messageContent - The raw message content from the user
 * @returns Parsed instruction data if detected, null otherwise
 */
export async function parseUserMessage(
  messageContent: string
): Promise<ParsedInstruction | null> {
  const trimmedContent = messageContent.trim();

  // Skip very short messages - they're almost never instructions
  if (trimmedContent.length < 5) {
    return null;
  }

  // Skip messages that are clearly questions
  if (
    trimmedContent.endsWith('?') &&
    !trimmedContent.toLowerCase().includes("don't") &&
    !trimmedContent.toLowerCase().includes('do not') &&
    !trimmedContent.toLowerCase().includes('stop')
  ) {
    return null;
  }

  const prompt = PARSING_PROMPT.replace(
    '{MESSAGE}',
    trimmedContent.slice(0, 500)
  );

  const response = await callGroqDirect({
    prompt,
    system:
      'You are a message classifier. Output only valid JSON, no markdown or explanation.',
    temperature: 0.2, // Low temperature for consistent classification
    maxTokens: 300,
    actionType: 'parse_instruction',
    purpose: 'reasoning',
  });

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.debug(
      'No JSON found in instruction parsing response',
      { responseLength: response.length },
      'InstructionService'
    );
    return null;
  }

  let parsed: ParsedInstruction;
  try {
    parsed = JSON.parse(jsonMatch[0]) as ParsedInstruction;
  } catch {
    logger.debug(
      'Failed to parse instruction JSON',
      { json: jsonMatch[0].slice(0, 200) },
      'InstructionService'
    );
    return null;
  }

  // Apply confidence threshold
  if (!parsed.isInstruction || parsed.confidence < CONFIDENCE_THRESHOLD) {
    logger.debug(
      'Message not classified as instruction',
      {
        isInstruction: parsed.isInstruction,
        confidence: parsed.confidence,
        threshold: CONFIDENCE_THRESHOLD,
      },
      'InstructionService'
    );
    return null;
  }

  // Validate required fields
  if (!parsed.rule || !parsed.category || !parsed.directiveType) {
    logger.warn(
      'Parsed instruction missing required fields',
      { parsed },
      'InstructionService'
    );
    return null;
  }

  // Clamp priority to valid range
  parsed.priority = Math.max(1, Math.min(10, parsed.priority || 5));

  return parsed;
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Create a new instruction from parsed data.
 *
 * @param agentUserId - The agent this instruction applies to
 * @param ownerId - The human user who created the instruction
 * @param parsed - The parsed instruction data
 * @param originalContent - The original message content
 * @param sourceMessageId - Optional ID of the source message
 * @returns The created instruction
 */
export async function createInstruction(
  agentUserId: string,
  ownerId: string,
  parsed: ParsedInstruction,
  originalContent: string,
  sourceMessageId?: string
): Promise<AgentInstruction> {
  const id = await generateSnowflakeId();
  const now = new Date();

  const values: NewAgentInstruction = {
    id,
    agentUserId,
    ownerId,
    content: originalContent,
    parsedRule: parsed.rule,
    category: parsed.category,
    directiveType: parsed.directiveType,
    priority: parsed.priority,
    status: 'active',
    validFrom: now,
    validUntil: parsed.validUntil ? new Date(parsed.validUntil) : null,
    conditions: parsed.conditions || null,
    sourceMessageId: sourceMessageId || null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.insert(agentInstructions).values(values).returning();

  const instruction = result[0];
  if (!instruction) {
    throw new Error(`Failed to create instruction for agent ${agentUserId}`);
  }

  logger.info(
    'Created instruction',
    {
      id,
      agentUserId,
      ownerId,
      rule: parsed.rule,
      category: parsed.category,
      priority: parsed.priority,
    },
    'InstructionService'
  );

  return instruction;
}

/**
 * Get all active instructions for an agent.
 * Filters out expired instructions and applies the per-agent limit.
 *
 * @param agentUserId - The agent to get instructions for
 * @returns Array of active instructions, sorted by priority (highest first)
 */
export async function getActiveInstructions(
  agentUserId: string
): Promise<AgentInstruction[]> {
  const now = new Date();

  // First, expire any stale instructions for this agent
  await db
    .update(agentInstructions)
    .set({
      status: 'expired',
      updatedAt: now,
    })
    .where(
      and(
        eq(agentInstructions.agentUserId, agentUserId),
        eq(agentInstructions.status, 'active'),
        lt(agentInstructions.validUntil, now)
      )
    );

  // Then fetch active instructions
  const instructions = await db
    .select()
    .from(agentInstructions)
    .where(
      and(
        eq(agentInstructions.agentUserId, agentUserId),
        eq(agentInstructions.status, 'active'),
        or(
          isNull(agentInstructions.validUntil),
          gt(agentInstructions.validUntil, now)
        )
      )
    )
    .orderBy(agentInstructions.priority)
    .limit(MAX_INSTRUCTIONS_PER_AGENT);

  // Sort by priority descending (highest first) since orderBy is ascending
  return instructions.sort((a, b) => b.priority - a.priority);
}

/**
 * Revoke an instruction.
 * Validates that the requester is the owner.
 *
 * @param instructionId - The instruction to revoke
 * @param ownerId - The owner requesting revocation
 * @returns True if revoked, false if not found or unauthorized
 */
export async function revokeInstruction(
  instructionId: string,
  ownerId: string
): Promise<boolean> {
  const now = new Date();

  const result = await db
    .update(agentInstructions)
    .set({
      status: 'revoked',
      revokedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(agentInstructions.id, instructionId),
        eq(agentInstructions.ownerId, ownerId),
        eq(agentInstructions.status, 'active')
      )
    )
    .returning({ id: agentInstructions.id });

  if (result.length > 0) {
    logger.info(
      'Revoked instruction',
      { instructionId, ownerId },
      'InstructionService'
    );
    return true;
  }

  return false;
}

/**
 * Mark an instruction as completed.
 * Used when a condition-based instruction's conditions are permanently met.
 *
 * @param instructionId - The instruction to mark as completed
 * @returns True if marked, false if not found
 */
export async function completeInstruction(
  instructionId: string
): Promise<boolean> {
  const now = new Date();

  const result = await db
    .update(agentInstructions)
    .set({
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(agentInstructions.id, instructionId),
        eq(agentInstructions.status, 'active')
      )
    )
    .returning({ id: agentInstructions.id });

  if (result.length > 0) {
    logger.info(
      'Completed instruction',
      { instructionId },
      'InstructionService'
    );
    return true;
  }

  return false;
}

/**
 * Expire all stale instructions across all agents.
 * Intended to be called by a cron job or background worker.
 *
 * @returns Number of instructions expired
 */
export async function expireStaleInstructions(): Promise<number> {
  const now = new Date();

  const result = await db
    .update(agentInstructions)
    .set({
      status: 'expired',
      updatedAt: now,
    })
    .where(
      and(
        eq(agentInstructions.status, 'active'),
        lt(agentInstructions.validUntil, now)
      )
    )
    .returning({ id: agentInstructions.id });

  if (result.length > 0) {
    logger.info(
      `Expired ${result.length} stale instructions`,
      { count: result.length },
      'InstructionService'
    );
  }

  return result.length;
}

// =============================================================================
// Condition Evaluation
// =============================================================================

/**
 * Evaluate if an instruction's conditions are currently met.
 * Uses market data from the tick context.
 *
 * @param instruction - The instruction to evaluate
 * @param perpMarkets - Current perp market data from tick context
 * @returns Evaluation result with met status and optional reason
 */
export function evaluateConditions(
  instruction: AgentInstruction,
  perpMarkets: PerpMarketContext[]
): ConditionEvaluationResult {
  const conditions = instruction.conditions;

  // No conditions = always applies
  if (!conditions) {
    return { met: true };
  }

  const now = new Date();

  // Check afterDate condition
  if (conditions.afterDate) {
    const afterDate = new Date(conditions.afterDate);
    if (now < afterDate) {
      return {
        met: false,
        reason: `Waiting until ${conditions.afterDate}`,
      };
    }
  }

  // Check beforeDate condition
  if (conditions.beforeDate) {
    const beforeDate = new Date(conditions.beforeDate);
    if (now > beforeDate) {
      return {
        met: false,
        reason: `Expired on ${conditions.beforeDate}`,
      };
    }
  }

  // Check priceBelow condition
  if (conditions.priceBelow) {
    const { ticker, value } = conditions.priceBelow;
    const market = perpMarkets.find((m) => m.ticker === ticker);

    if (!market) {
      return {
        met: false,
        reason: `Ticker ${ticker} not found in market data`,
      };
    }

    if (market.currentPrice >= value) {
      return {
        met: false,
        reason: `${ticker} price ($${market.currentPrice.toFixed(2)}) is not below $${value}`,
      };
    }
  }

  // Check priceAbove condition
  if (conditions.priceAbove) {
    const { ticker, value } = conditions.priceAbove;
    const market = perpMarkets.find((m) => m.ticker === ticker);

    if (!market) {
      return {
        met: false,
        reason: `Ticker ${ticker} not found in market data`,
      };
    }

    if (market.currentPrice <= value) {
      return {
        met: false,
        reason: `${ticker} price ($${market.currentPrice.toFixed(2)}) is not above $${value}`,
      };
    }
  }

  return { met: true };
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Instruction service singleton for managing agent instructions.
 */
export const instructionService = {
  parseUserMessage,
  createInstruction,
  getActiveInstructions,
  revokeInstruction,
  completeInstruction,
  expireStaleInstructions,
  evaluateConditions,
};
