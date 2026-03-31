/**
 * Types for the DAG trace instrumentation layer.
 * Captures all inputs/outputs at every node during a game tick.
 */

export interface TickTrace {
  tickId: string;
  tickNumber: number;
  timestamp: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  dag: DagDefinition;
  nodes: NodeTrace[];
  llmCalls: LLMCallTrace[];
  npcTrajectories: NPCTickTrajectory[];
  tokenStats: TokenStatsSummary;
  gameTickResult: Record<string, unknown>;
}

export interface DagDefinition {
  nodes: DagNodeDefinition[];
  edges: EdgeDefinition[];
}

export interface DagNodeDefinition {
  id: string;
  name: string;
  phase: string;
  phaseNumber: number;
  description: string;
}

export interface EdgeDefinition {
  source: string;
  target: string;
  label: string;
}

export interface NodeTrace {
  nodeId: string;
  name: string;
  phase: string;
  phaseNumber: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  status: 'success' | 'error' | 'skipped';
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  error?: string;
  llmCallIds: string[];
}

export interface LLMCallTrace {
  callId: string;
  nodeId: string;
  timestamp: number;
  provider: string;
  model: string;
  promptType: string;
  format: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  userPrompt: string;
  rawResponse: string;
  parsedResponse: unknown;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface NPCTickTrajectory {
  npcId: string;
  npcName: string;
  decisions: NPCDecision[];
  trades: NPCTrade[];
  posts: NPCPost[];
  groupMessages: NPCGroupMessage[];
}

export interface NPCDecision {
  marketId?: string;
  ticker?: string;
  action: string;
  amount: number;
  confidence: number;
  reasoning: string;
}

export interface NPCTrade {
  marketId?: string;
  ticker?: string;
  action: string;
  amount: number;
  success: boolean;
  error?: string;
}

export interface NPCPost {
  postId: string;
  content: string;
  type: string;
}

export interface NPCGroupMessage {
  groupId: string;
  groupName: string;
  content: string;
}

export interface TokenStatsSummary {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  byPromptType: Record<
    string,
    { calls: number; inputTokens: number; outputTokens: number }
  >;
}

export interface LLMCallInput {
  provider: string;
  model: string;
  promptType: string;
  format: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  userPrompt: string;
  rawResponse: string;
  parsedResponse: unknown;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  success: boolean;
  error?: string;
}
