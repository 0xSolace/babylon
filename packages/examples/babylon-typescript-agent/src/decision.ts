/**
 * Agent Decision Maker
 *
 * Uses Jeju Compute Marketplace for ALL LLM inference.
 * NO FALLBACKS - Decentralized compute is required.
 */

import type { A2APerpPosition } from '@babylon/a2a';
import type { JsonValue } from '@babylon/shared';
import type { Address } from 'viem';
import { z } from 'zod';
import type { MemoryEntry } from './memory';

// ============================================================================
// LLM Response Validation Schemas
// ============================================================================

/**
 * Action types for agent decisions
 */
const ActionTypeSchema = z.enum([
  'BUY_YES',
  'BUY_NO',
  'SELL',
  'OPEN_LONG',
  'OPEN_SHORT',
  'CLOSE_POSITION',
  'CREATE_POST',
  'CREATE_COMMENT',
  'HOLD',
]);

/**
 * Decision response schema for LLM outputs
 */
const DecisionResponseSchema = z.object({
  action: ActionTypeSchema,
  params: z.record(z.string(), z.unknown()).optional(),
  reasoning: z.string().optional(),
});

export interface PredictionMarket {
  id?: string;
  question: string;
  yesShares: number;
  noShares: number;
}

export interface PerpMarket {
  ticker?: string;
  name: string;
  currentPrice: number;
}

export interface FeedPost {
  id?: string;
  content: string;
  authorId?: string;
}

export interface DecisionContext {
  portfolio: { balance: number; positions: A2APerpPosition[]; pnl: number };
  markets: { predictions: PredictionMarket[]; perps: PerpMarket[] };
  feed: { posts: FeedPost[] };
  memory: MemoryEntry[];
}

export interface Decision {
  action:
    | 'BUY_YES'
    | 'BUY_NO'
    | 'SELL'
    | 'OPEN_LONG'
    | 'OPEN_SHORT'
    | 'CLOSE_POSITION'
    | 'CREATE_POST'
    | 'CREATE_COMMENT'
    | 'HOLD';
  params?: Record<string, JsonValue>;
  reasoning?: string;
}

type Strategy = 'conservative' | 'balanced' | 'aggressive' | 'social';

export interface DecisionMakerConfig {
  strategy: Strategy;
  /** Jeju Gateway URL (defaults to JEJU_GATEWAY_URL env var) */
  jejuGatewayUrl?: string;
  /** User wallet address for billing (defaults to AGENT_WALLET_ADDRESS env var) */
  userAddress?: Address;
}

const STRATEGY_INSTRUCTIONS: Record<Strategy, string> = {
  conservative:
    'Only trade with high confidence. Prefer holding cash. Risk tolerance: Low.',
  balanced:
    'Balance risk and reward. Trade moderately. Risk tolerance: Medium.',
  aggressive: 'Seek maximum returns. Trade actively. Risk tolerance: High.',
  social:
    'Focus on social engagement. Post and comment frequently. Trade occasionally.',
} as const;

const MAX_DISPLAY_ITEMS = 3;
const MAX_CONTENT_LENGTH = 80;
const MAX_RESULT_LENGTH = 60;

interface JejuInferenceResponse {
  id: string;
  model: string;
  choices: Array<{ message: { content: string } }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class AgentDecisionMaker {
  private config: DecisionMakerConfig;
  private gatewayUrl: string;
  private userAddress: Address;

  constructor(config: DecisionMakerConfig) {
    this.config = config;
    this.gatewayUrl =
      config.jejuGatewayUrl ??
      process.env.JEJU_GATEWAY_URL ??
      process.env.JEJU_COMPUTE_ENDPOINT ??
      'http://localhost:4200';

    this.userAddress =
      config.userAddress ??
      (process.env.AGENT_WALLET_ADDRESS as Address) ??
      (process.env.JEJU_USER_ADDRESS as Address) ??
      ('0x0000000000000000000000000000000000000000' as Address);

    console.log(`🤖 Using Jeju Compute Marketplace: ${this.gatewayUrl}`);
  }

  /**
   * Get the current provider name
   */
  getProvider(): string {
    return `Jeju Compute (${this.gatewayUrl})`;
  }

  /**
   * Make decision based on current context
   */
  async decide(context: DecisionContext): Promise<Decision> {
    const prompt = this.buildPrompt(context);

    const response = await fetch(`${this.gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jeju-address': this.userAddress,
      },
      body: JSON.stringify({
        model: 'llama-8b', // Will be resolved by marketplace
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Jeju Compute error: ${response.status}. ` +
          'Ensure Jeju is running: cd /path/to/jeju && bun run dev'
      );
    }

    const data = (await response.json()) as JejuInferenceResponse;
    const text = data.choices[0]?.message?.content ?? '';

    return this.parseDecision(text);
  }

  /**
   * Build prompt for LLM
   */
  private buildPrompt(context: DecisionContext): string {
    const formatPredictionMarket = (m: PredictionMarket) => {
      const total = m.yesShares + m.noShares;
      const yesPercent =
        total > 0 ? ((m.yesShares / total) * 100).toFixed(0) : '50';
      return `- "${m.question}" (YES: ${yesPercent}%)`;
    };

    const formatPerpMarket = (p: PerpMarket) =>
      `- ${p.name} @ $${p.currentPrice}`;

    const formatPost = (p: FeedPost) =>
      `- "${p.content.substring(0, MAX_CONTENT_LENGTH)}..."`;

    const formatMemory = (m: MemoryEntry) =>
      `- ${m.action}: ${JSON.stringify(m.result).substring(0, MAX_RESULT_LENGTH)}`;

    return `You are an autonomous trading agent for Babylon prediction markets.

Strategy: ${this.config.strategy}
${STRATEGY_INSTRUCTIONS[this.config.strategy]}

Current Portfolio:
- Balance: $${context.portfolio.balance}
- Open Positions: ${context.portfolio.positions.length}
- P&L: $${context.portfolio.pnl}

Available Prediction Markets (top ${MAX_DISPLAY_ITEMS}):
${context.markets.predictions.slice(0, MAX_DISPLAY_ITEMS).map(formatPredictionMarket).join('\n') || 'None'}

Available Perp Markets (top ${MAX_DISPLAY_ITEMS}):
${context.markets.perps.slice(0, MAX_DISPLAY_ITEMS).map(formatPerpMarket).join('\n') || 'None'}

Recent Feed Activity:
${context.feed.posts.slice(0, MAX_DISPLAY_ITEMS).map(formatPost).join('\n') || 'None'}

Recent Memory (last ${MAX_DISPLAY_ITEMS} actions):
${context.memory.map(formatMemory).join('\n') || 'No recent actions'}

Decision Task:
Analyze the above context and decide what action to take this tick.

Respond in JSON format:
{
  "action": "BUY_YES" | "BUY_NO" | "SELL" | "OPEN_LONG" | "OPEN_SHORT" | "CLOSE_POSITION" | "CREATE_POST" | "CREATE_COMMENT" | "HOLD",
  "params": {
    "marketId": "...",
    "amount": 50,
    "content": "...",
    etc.
  },
  "reasoning": "Brief explanation of why"
}

Examples:
- If you see underpriced opportunity: {"action": "BUY_YES", "params": {"marketId": "...", "amount": 50}, "reasoning": "YES undervalued at 35%"}
- If no good opportunities: {"action": "HOLD", "reasoning": "No clear opportunities"}
- If social strategy: {"action": "CREATE_POST", "params": {"content": "..."}, "reasoning": "Share market insights"}

Your decision (JSON only):`;
  }

  /**
   * Parse LLM response into Decision
   * Uses Zod schema validation with HOLD fallback for malformed responses
   */
  private parseDecision(text: string): Decision {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in LLM response, defaulting to HOLD');
      return {
        action: 'HOLD',
        reasoning: 'Failed to parse LLM response: no JSON found',
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.warn('Failed to parse JSON from LLM response:', parseError);
      return {
        action: 'HOLD',
        reasoning: 'Failed to parse LLM response: invalid JSON',
      };
    }

    // Validate with Zod schema
    const result = DecisionResponseSchema.safeParse(parsed);
    if (!result.success) {
      console.warn('LLM response failed validation:', result.error.format());
      return {
        action: 'HOLD',
        reasoning: `Failed to validate LLM response: ${result.error.issues.map((i) => i.message).join(', ')}`,
      };
    }

    return {
      action: result.data.action,
      params: result.data.params as Record<string, JsonValue> | undefined,
      reasoning: result.data.reasoning,
    };
  }
}
