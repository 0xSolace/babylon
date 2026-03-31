#!/usr/bin/env bun
/**
 * Lightweight Bun server that serves DAG trace JSON files.
 * Runs on port 4001, CORS-enabled for the Vite dev server on :4000.
 *
 * Usage: bun run apps/dag-visualizer/serve-traces.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const TRACE_DIR = path.resolve(import.meta.dir, '../../runs/dag-traces');
const PORT = 4001;

function cors(res: Response): Response {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(res.body, { status: res.status, headers: h });
}

function json(data: unknown, status = 200): Response {
  return cors(Response.json(data, { status }));
}

Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS')
      return cors(new Response(null, { status: 204 }));

    // GET /traces - list all traces
    if (url.pathname === '/traces') {
      if (!fs.existsSync(TRACE_DIR)) return json([]);
      const entries = fs
        .readdirSync(TRACE_DIR)
        .filter(
          (e) =>
            e.startsWith('tick-') &&
            fs.statSync(path.join(TRACE_DIR, e)).isDirectory()
        )
        .sort()
        .reverse();

      const traces = entries.map((dirName) => {
        const sp = path.join(TRACE_DIR, dirName, 'tick-summary.json');
        if (!fs.existsSync(sp)) return { dirName, tickId: dirName };
        try {
          const s = JSON.parse(fs.readFileSync(sp, 'utf-8'));
          return {
            dirName,
            tickId: s.tickId,
            tickNumber: s.tickNumber,
            timestamp: s.timestamp,
            durationMs: s.durationMs,
            nodeCount: s.nodes?.length ?? 0,
            llmCallCount: s.llmCallSummaries?.length ?? 0,
          };
        } catch {
          return { dirName, tickId: dirName };
        }
      });
      return json(traces);
    }

    // GET /traces/:dirName - full trace data
    const match = url.pathname.match(/^\/traces\/(.+)$/);
    if (match) {
      const dirName = match[1]!;
      const traceDir = path.join(TRACE_DIR, dirName);
      if (!fs.existsSync(traceDir)) return json({ error: 'not found' }, 404);

      const summaryPath = path.join(traceDir, 'tick-summary.json');
      if (!fs.existsSync(summaryPath))
        return json({ error: 'no summary' }, 404);

      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));

      // Inline LLM calls
      const llmDir = path.join(traceDir, 'llm-calls');
      if (fs.existsSync(llmDir)) {
        summary.llmCallsFull = fs
          .readdirSync(llmDir)
          .filter((f) => f.endsWith('.json'))
          .map((f) =>
            JSON.parse(fs.readFileSync(path.join(llmDir, f), 'utf-8'))
          );
      }

      // Inline node data
      const nodesDir = path.join(traceDir, 'nodes');
      if (fs.existsSync(nodesDir)) {
        summary.nodesFull = fs
          .readdirSync(nodesDir)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .map((f) =>
            JSON.parse(fs.readFileSync(path.join(nodesDir, f), 'utf-8'))
          );
      }

      // Inline NPC trajectories
      const npcDir = path.join(traceDir, 'npc-trajectories');
      if (fs.existsSync(npcDir)) {
        summary.npcTrajectories = fs
          .readdirSync(npcDir)
          .filter((f) => f.endsWith('.json'))
          .map((f) =>
            JSON.parse(fs.readFileSync(path.join(npcDir, f), 'utf-8'))
          );
      }

      return json(summary);
    }

    return json({ error: 'not found' }, 404);
  },
});

process.stdout.write(`DAG trace server running on http://localhost:${PORT}\n`);
process.stdout.write(`Watching: ${TRACE_DIR}\n`);
