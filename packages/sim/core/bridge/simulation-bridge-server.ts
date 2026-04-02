/**
 * Simulation Bridge Server
 *
 * HTTP server that exposes the Babylon game engine to the Python online RL
 * training pipeline. The Python client is at:
 *   packages/training/python/src/training/simulation_bridge.py
 *
 * Endpoints:
 *   POST /init              - Initialize simulation with NPCs
 *   GET  /health             - Health check
 *   GET  /scenario/:npcId    - Get current scenario for an NPC
 *   POST /execute            - Execute action, return outcome
 *   POST /tick               - Advance game tick
 *   POST /reset              - Reset simulation state
 *   GET  /npcs               - List all NPCs with archetypes
 *   GET  /scenarios          - Get all scenarios (batch)
 *
 * Start:
 *   bun run packages/sim/core/bridge/simulation-bridge-server.ts
 *   # or: cd packages/sim && bun run bridge-server
 *
 * Environment:
 *   SIMULATION_BRIDGE_PORT (default: 3001)
 *   DATABASE_URL (required for live game data)
 */

import {
  db,
  eq,
  desc,
  questions,
  positions as positionsTable,
  perpPositions,
} from '@babylon/db';
import { executeGameTick } from '@babylon/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NPCState {
  npcId: string;
  archetype: string;
  balance: number;
}

interface SimulationState {
  initialized: boolean;
  tickNumber: number;
  npcs: Map<string, NPCState>;
  seed: number;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state: SimulationState = {
  initialized: false,
  tickNumber: 0,
  npcs: new Map(),
  seed: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ARCHETYPE_POOL = [
  'trader', 'degen', 'analyst', 'whale', 'influencer',
  'scammer', 'conservative', 'arbitrageur',
];

function assignArchetypes(
  npcIds: string[],
  requested?: string[],
  seed?: number,
): Record<string, string> {
  const result: Record<string, string> = {};
  const rng = seed ?? Date.now();
  for (let i = 0; i < npcIds.length; i++) {
    if (requested && i < requested.length) {
      result[npcIds[i]!] = requested[i]!;
    } else {
      result[npcIds[i]!] = ARCHETYPE_POOL[(rng + i) % ARCHETYPE_POOL.length]!;
    }
  }
  return result;
}

async function getPredictionMarketsData() {
  try {
    const activeQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.status, 'active'))
      .orderBy(desc(questions.createdAt))
      .limit(20);

    return activeQuestions.map((q) => ({
      id: q.id,
      question: q.text ?? 'Unknown',
      yesPrice: Number((q as Record<string, unknown>).yesPrice ?? (q as Record<string, unknown>).currentYesPrice ?? 50),
      noPrice: Number((q as Record<string, unknown>).noPrice ?? (q as Record<string, unknown>).currentNoPrice ?? 50),
    }));
  } catch {
    return [];
  }
}

async function getPositionsForUser(npcId: string) {
  try {
    const predPositions = await db
      .select()
      .from(positionsTable)
      .where(eq(positionsTable.userId, npcId));

    const perpPos = await db
      .select()
      .from(perpPositions)
      .where(eq(perpPositions.userId, npcId));

    return [
      ...predPositions.map((p) => ({
        id: p.id,
        marketType: 'prediction' as const,
        marketId: String(p.questionId ?? ''),
        side: p.side ? 'yes' : 'no',
        size: Number(p.shares ?? 0),
        unrealizedPnL: Number(p.pnl ?? 0),
      })),
      ...perpPos.map((p) => ({
        id: p.id,
        marketType: 'perp' as const,
        ticker: p.ticker ?? '',
        side: p.side ?? 'long',
        size: Number(p.size ?? 0),
        unrealizedPnL: Number(p.unrealizedPnL ?? 0),
      })),
    ];
  } catch {
    return [];
  }
}

async function buildScenario(npcId: string): Promise<Record<string, unknown>> {
  const npc = state.npcs.get(npcId);
  if (!npc) {
    throw new Error(`NPC ${npcId} not found`);
  }

  const [predData, posData] = await Promise.all([
    getPredictionMarketsData(),
    getPositionsForUser(npc.npcId),
  ]);

  return {
    npcId: npc.npcId,
    archetype: npc.archetype,
    balance: npc.balance,
    marketState: {
      perpMarkets: [],
      predictionMarkets: predData,
    },
    positions: posData,
    recentNews: [],
    socialContext: {
      relationships: [],
      groupChats: [],
      recentMessages: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const port = parseInt(process.env.SIMULATION_BRIDGE_PORT ?? '3001', 10);

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method;
    const path = url.pathname;

    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    };

    try {
      // GET /health
      if (method === 'GET' && path === '/health') {
        return Response.json({
          status: 'ok',
          initialized: state.initialized,
          tickNumber: state.tickNumber,
          npcCount: state.npcs.size,
        }, { headers });
      }

      // POST /init
      if (method === 'POST' && path === '/init') {
        const body = await req.json() as {
          numNPCs?: number;
          seed?: number;
          archetypes?: string[];
        };

        const numNPCs = body.numNPCs ?? 20;
        const seed = body.seed ?? Date.now();
        const npcIds = Array.from({ length: numNPCs }, (_, i) => `npc-${String(i).padStart(3, '0')}`);
        const archetypeMap = assignArchetypes(npcIds, body.archetypes, seed);

        state.npcs.clear();
        for (const npcId of npcIds) {
          state.npcs.set(npcId, {
            npcId,
            archetype: archetypeMap[npcId] ?? 'trader',
            balance: 10_000,
          });
        }

        state.initialized = true;
        state.tickNumber = 0;
        state.seed = seed;

        return Response.json({
          status: 'initialized',
          npcIds,
          archetypes: archetypeMap,
          seed,
        }, { headers });
      }

      // GET /scenario/:npcId
      if (method === 'GET' && path.startsWith('/scenario/')) {
        const npcId = path.slice('/scenario/'.length);
        if (!state.initialized) {
          return Response.json(
            { error: 'Not initialized. Call POST /init first.' },
            { status: 400, headers },
          );
        }
        const scenario = await buildScenario(npcId);
        return Response.json(scenario, { headers });
      }

      // POST /execute
      if (method === 'POST' && path === '/execute') {
        const body = await req.json() as {
          npcId: string;
          action: {
            type: string;
            ticker?: string;
            marketId?: string;
            amount?: number;
            side?: string;
            positionId?: string;
          };
          reasoning?: string;
        };

        const npc = state.npcs.get(body.npcId);
        if (!npc) {
          return Response.json(
            { error: `NPC ${body.npcId} not found` },
            { status: 404, headers },
          );
        }

        const action = body.action;
        let pnl = 0;
        let success = true;
        let error: string | undefined;

        switch (action.type) {
          case 'open_long':
          case 'open_short':
          case 'buy_yes':
          case 'buy_no':
          case 'sell_yes':
          case 'sell_no': {
            const amount = action.amount ?? 100;
            if (amount > npc.balance) {
              success = false;
              error = 'Insufficient balance';
            } else {
              npc.balance -= amount;
            }
            break;
          }
          case 'close_long':
          case 'close_short':
          case 'close_position': {
            const closeAmount = action.amount ?? 100;
            // Simulate P&L with slight positive bias
            pnl = (Math.random() - 0.4) * closeAmount * 0.2;
            npc.balance += closeAmount + pnl;
            break;
          }
          case 'wait':
          case 'hold':
            break;
          default:
            success = false;
            error = `Unknown action type: ${action.type}`;
        }

        return Response.json({
          success,
          pnl,
          newBalance: npc.balance,
          newPositions: [],
          socialImpact: {},
          events: [],
          error,
        }, { headers });
      }

      // POST /tick
      if (method === 'POST' && path === '/tick') {
        if (!state.initialized) {
          return Response.json(
            { error: 'Not initialized. Call POST /init first.' },
            { status: 400, headers },
          );
        }

        let events: Record<string, unknown>[] = [];
        const marketChanges: Record<string, unknown>[] = [];

        try {
          const result = await executeGameTick(false);
          state.tickNumber++;
          events = [
            { type: 'tick_completed', tick: state.tickNumber },
            ...(result.questionsResolved > 0
              ? [{ type: 'questions_resolved', count: result.questionsResolved }]
              : []),
          ];
          marketChanges.push({ marketsUpdated: result.marketsUpdated });
        } catch {
          state.tickNumber++;
          events = [{ type: 'tick_simulated', tick: state.tickNumber }];
        }

        return Response.json({
          tickNumber: state.tickNumber,
          events,
          marketChanges,
        }, { headers });
      }

      // POST /reset
      if (method === 'POST' && path === '/reset') {
        state.initialized = false;
        state.tickNumber = 0;
        state.npcs.clear();
        state.seed = 0;
        return Response.json({ status: 'reset' }, { headers });
      }

      // GET /npcs
      if (method === 'GET' && path === '/npcs') {
        const npcs = Array.from(state.npcs.values()).map((npc) => ({
          npcId: npc.npcId,
          archetype: npc.archetype,
          balance: npc.balance,
        }));
        return Response.json({ npcs }, { headers });
      }

      // GET /scenarios
      if (method === 'GET' && path === '/scenarios') {
        if (!state.initialized) {
          return Response.json(
            { error: 'Not initialized. Call POST /init first.' },
            { status: 400, headers },
          );
        }
        const scenarios = Array.from(state.npcs.keys()).map((npcId) => ({ npcId }));
        return Response.json({ scenarios }, { headers });
      }

      return Response.json(
        { error: `Unknown route: ${method} ${path}` },
        { status: 404, headers },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Bridge error: ${method} ${path}:`, message);
      return Response.json({ error: message }, { status: 500, headers });
    }
  },
});

console.log(`Simulation bridge server running on http://localhost:${port}`);
console.log('Endpoints: /health /init /scenario/:id /execute /tick /reset /npcs /scenarios');
