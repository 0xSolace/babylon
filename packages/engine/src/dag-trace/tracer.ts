/**
 * TickTracer - captures inputs/outputs at every DAG node during a game tick.
 *
 * Singleton-per-tick using the same global pattern as tokenStatsService.
 * All calls are null-safe: getActiveTracer() returns null when tracing is disabled.
 */

import { logger } from '@babylon/shared';
import { GAME_TICK_DAG } from './dag-definition';
import type {
  LLMCallInput,
  LLMCallTrace,
  NodeTrace,
  NPCDecision,
  NPCGroupMessage,
  NPCPost,
  NPCTickTrajectory,
  NPCTrade,
  TickTrace,
  TokenStatsSummary,
} from './types';

let activeTracer: TickTracer | null = null;

export function startTrace(tickId: string, tickNumber: number): void {
  activeTracer = new TickTracer(tickId, tickNumber);
}

export function getActiveTracer(): TickTracer | null {
  return activeTracer;
}

export function endTrace(): TickTrace | null {
  if (!activeTracer) return null;
  const trace = activeTracer.finalize();
  activeTracer = null;
  return trace;
}

export class TickTracer {
  private readonly tickId: string;
  private readonly tickNumber: number;
  private readonly startMs: number;
  private readonly nodes: Map<string, NodeTrace> = new Map();
  private readonly llmCalls: LLMCallTrace[] = [];
  private currentNodeId: string | null = null;
  private llmCallCounter = 0;
  private tokenStats: TokenStatsSummary = {
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    estimatedCostUSD: 0,
    byPromptType: {},
  };

  // NPC trajectory accumulators
  private readonly npcDecisions: Map<string, NPCDecision[]> = new Map();
  private readonly npcTrades: Map<string, NPCTrade[]> = new Map();
  private readonly npcPosts: Map<string, NPCPost[]> = new Map();
  private readonly npcGroupMessages: Map<string, NPCGroupMessage[]> = new Map();
  private readonly npcNames: Map<string, string> = new Map();

  private gameTickResult: Record<string, unknown> = {};

  constructor(tickId: string, tickNumber: number) {
    this.tickId = tickId;
    this.tickNumber = tickNumber;
    this.startMs = Date.now();
  }

  getCurrentNodeId(): string | null {
    return this.currentNodeId;
  }

  startNode(nodeId: string, inputs: Record<string, unknown> = {}): void {
    const dagNode = GAME_TICK_DAG.nodes.find((n) => n.id === nodeId);
    this.currentNodeId = nodeId;

    this.nodes.set(nodeId, {
      nodeId,
      name: dagNode?.name ?? nodeId,
      phase: dagNode?.phase ?? 'Unknown',
      phaseNumber: dagNode?.phaseNumber ?? 0,
      startMs: Date.now(),
      endMs: 0,
      durationMs: 0,
      status: 'success',
      inputs: this.safeSerialize(inputs),
      outputs: {},
      llmCallIds: [],
    });
  }

  endNode(nodeId: string, outputs: Record<string, unknown> = {}): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.endMs = Date.now();
    node.durationMs = node.endMs - node.startMs;
    node.outputs = this.safeSerialize(outputs);
    node.status = 'success';

    if (this.currentNodeId === nodeId) {
      this.currentNodeId = null;
    }
  }

  skipNode(nodeId: string, reason?: string): void {
    const dagNode = GAME_TICK_DAG.nodes.find((n) => n.id === nodeId);
    this.nodes.set(nodeId, {
      nodeId,
      name: dagNode?.name ?? nodeId,
      phase: dagNode?.phase ?? 'Unknown',
      phaseNumber: dagNode?.phaseNumber ?? 0,
      startMs: Date.now(),
      endMs: Date.now(),
      durationMs: 0,
      status: 'skipped',
      inputs: {},
      outputs: {},
      error: reason,
      llmCallIds: [],
    });
  }

  failNode(nodeId: string, error: unknown): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.endMs = Date.now();
      node.durationMs = node.endMs - node.startMs;
      node.status = 'error';
      node.error = error instanceof Error ? error.message : String(error);
    }
    if (this.currentNodeId === nodeId) {
      this.currentNodeId = null;
    }
  }

  recordLLMCall(call: LLMCallInput): string {
    this.llmCallCounter++;
    const callId = `call-${String(this.llmCallCounter).padStart(3, '0')}-${call.promptType}`;
    const nodeId = this.currentNodeId ?? 'unknown';

    const trace: LLMCallTrace = {
      callId,
      nodeId,
      timestamp: Date.now(),
      ...call,
    };

    this.llmCalls.push(trace);

    // Associate with current node
    const node = this.nodes.get(nodeId);
    if (node) {
      node.llmCallIds.push(callId);
    }

    // Update token stats
    this.tokenStats.totalCalls++;
    this.tokenStats.totalInputTokens += call.inputTokens;
    this.tokenStats.totalOutputTokens += call.outputTokens;
    this.tokenStats.totalTokens += call.totalTokens;

    const pt = this.tokenStats.byPromptType[call.promptType] ?? {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    pt.calls++;
    pt.inputTokens += call.inputTokens;
    pt.outputTokens += call.outputTokens;
    this.tokenStats.byPromptType[call.promptType] = pt;

    return callId;
  }

  // --- NPC trajectory recording ---

  recordNPCDecision(
    npcId: string,
    npcName: string,
    decision: NPCDecision
  ): void {
    this.npcNames.set(npcId, npcName);
    const arr = this.npcDecisions.get(npcId) ?? [];
    arr.push(decision);
    this.npcDecisions.set(npcId, arr);
  }

  recordNPCTrade(npcId: string, npcName: string, trade: NPCTrade): void {
    this.npcNames.set(npcId, npcName);
    const arr = this.npcTrades.get(npcId) ?? [];
    arr.push(trade);
    this.npcTrades.set(npcId, arr);
  }

  recordNPCPost(npcId: string, npcName: string, post: NPCPost): void {
    this.npcNames.set(npcId, npcName);
    const arr = this.npcPosts.get(npcId) ?? [];
    arr.push(post);
    this.npcPosts.set(npcId, arr);
  }

  recordNPCGroupMessage(
    npcId: string,
    npcName: string,
    msg: NPCGroupMessage
  ): void {
    this.npcNames.set(npcId, npcName);
    const arr = this.npcGroupMessages.get(npcId) ?? [];
    arr.push(msg);
    this.npcGroupMessages.set(npcId, arr);
  }

  setGameTickResult(result: Record<string, unknown>): void {
    this.gameTickResult = this.safeSerialize(result);
  }

  setTokenStats(stats: TokenStatsSummary): void {
    // Merge with LLM-call-derived stats (prefer the official stats if provided)
    this.tokenStats = { ...this.tokenStats, ...stats };
  }

  finalize(): TickTrace {
    const endMs = Date.now();

    // Build NPC trajectories
    const allNpcIds = new Set([
      ...this.npcDecisions.keys(),
      ...this.npcTrades.keys(),
      ...this.npcPosts.keys(),
      ...this.npcGroupMessages.keys(),
    ]);

    const npcTrajectories: NPCTickTrajectory[] = [];
    for (const npcId of allNpcIds) {
      npcTrajectories.push({
        npcId,
        npcName: this.npcNames.get(npcId) ?? npcId,
        decisions: this.npcDecisions.get(npcId) ?? [],
        trades: this.npcTrades.get(npcId) ?? [],
        posts: this.npcPosts.get(npcId) ?? [],
        groupMessages: this.npcGroupMessages.get(npcId) ?? [],
      });
    }

    return {
      tickId: this.tickId,
      tickNumber: this.tickNumber,
      timestamp: new Date(this.startMs).toISOString(),
      startMs: this.startMs,
      endMs,
      durationMs: endMs - this.startMs,
      dag: GAME_TICK_DAG,
      nodes: [...this.nodes.values()],
      llmCalls: this.llmCalls,
      npcTrajectories,
      tokenStats: this.tokenStats,
      gameTickResult: this.gameTickResult,
    };
  }

  /**
   * Safe serialization - handles circular refs, BigInts, Errors, and truncates large strings.
   */
  private safeSerialize(obj: Record<string, unknown>): Record<string, unknown> {
    const MAX_STRING_LENGTH = 50_000;
    const seen = new WeakSet();

    const replacer = (_key: string, value: unknown): unknown => {
      if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack };
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
        return (
          value.slice(0, MAX_STRING_LENGTH) +
          `... [truncated ${value.length - MAX_STRING_LENGTH} chars]`
        );
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    };

    try {
      return JSON.parse(JSON.stringify(obj, replacer));
    } catch {
      logger.warn('Failed to serialize trace data', undefined, 'DagTrace');
      return { _serializationError: true };
    }
  }
}
