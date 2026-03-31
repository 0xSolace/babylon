import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DagNode } from './DagNode';
import { DAG_EDGES, DAG_NODES, PHASE_COLORS } from './dag-definition';
import { NodeDetailPanel } from './NodeDetailPanel';
import type {
  LLMCallFull,
  NPCTrajectory,
  TraceData,
  TraceNodeData,
  TraceSummary,
} from './types';

const nodeTypes = { dagNode: DagNode };
const W = 190;
const H = 72;
const AGENT_W = 160;
const AGENT_H = 60;

const API = 'http://localhost:4001';

async function fetchTraceList(): Promise<TraceSummary[]> {
  try {
    const r = await fetch(`${API}/traces`);
    return (await r.json()) as TraceSummary[];
  } catch {
    return [];
  }
}

async function fetchTrace(dir: string): Promise<TraceData | null> {
  try {
    const r = await fetch(`${API}/traces/${dir}`);
    return (await r.json()) as TraceData;
  } catch {
    return null;
  }
}

// Build React Flow graph from trace data, including per-NPC agent nodes
function buildGraph(
  traceNodes: TraceNodeData[],
  npcs: NPCTrajectory[]
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    nodesep: 30,
    ranksep: 65,
    marginx: 20,
    marginy: 20,
  });

  const traceMap = new Map(traceNodes.map((n) => [n.nodeId, n]));
  const completed = new Set(
    traceNodes
      .filter((n) => n.status === 'success' || n.status === 'error')
      .map((n) => n.nodeId)
  );

  // Add all system nodes
  const validIds = new Set(DAG_NODES.map((n) => n.id));
  for (const dn of DAG_NODES) g.setNode(dn.id, { width: W, height: H });

  // Add system edges
  for (const e of DAG_EDGES) {
    if (
      validIds.has(e.source) &&
      validIds.has(e.target) &&
      e.source !== e.target
    )
      g.setEdge(e.source, e.target);
  }

  // Add NPC agent nodes: market-decisions -> [agent] -> trade-execution
  const agentNodeIds: string[] = [];
  for (const npc of npcs) {
    const agentId = `agent-${npc.npcId}`;
    agentNodeIds.push(agentId);
    g.setNode(agentId, { width: AGENT_W, height: AGENT_H });
    g.setEdge('market-decisions', agentId);
    g.setEdge(agentId, 'trade-execution');
  }

  // If there are agent nodes, remove the direct market-decisions -> trade-execution edge
  // so dagre routes through the agents
  if (agentNodeIds.length > 0) {
    g.removeEdge('market-decisions', 'trade-execution');
  }

  dagre.layout(g);

  // Build flow nodes
  const flowNodes: Node[] = [];

  // System nodes
  for (const dn of DAG_NODES) {
    const pos = g.node(dn.id);
    const t = traceMap.get(dn.id);
    flowNodes.push({
      id: dn.id,
      type: 'dagNode',
      position: { x: (pos?.x ?? 0) - W / 2, y: (pos?.y ?? 0) - H / 2 },
      data: {
        label: dn.name,
        phase: dn.phase,
        phaseColor: PHASE_COLORS[dn.phase] ?? '#6b7280',
        description: dn.description,
        status: t?.status ?? 'pending',
        durationMs: t?.durationMs ?? 0,
        llmCallCount: t?.llmCallIds?.length ?? 0,
        hasError: t?.status === 'error',
        isCompleted: completed.has(dn.id),
        isAgent: false,
      },
    });
  }

  // NPC agent nodes
  for (const npc of npcs) {
    const agentId = `agent-${npc.npcId}`;
    const pos = g.node(agentId);
    const hasTrades = (npc.trades?.length ?? 0) > 0;
    const hasDecisions = (npc.decisions?.length ?? 0) > 0;
    const action = npc.decisions?.[0]?.action ?? 'idle';
    const confidence = npc.decisions?.[0]?.confidence ?? 0;
    const amount = npc.decisions?.[0]?.amount ?? 0;
    const ticker = npc.decisions?.[0]?.ticker ?? '';
    const success = npc.trades?.every((t) => t.success) ?? true;

    flowNodes.push({
      id: agentId,
      type: 'dagNode',
      position: {
        x: (pos?.x ?? 0) - AGENT_W / 2,
        y: (pos?.y ?? 0) - AGENT_H / 2,
      },
      data: {
        label: npc.npcName,
        phase: 'Agent',
        phaseColor: PHASE_COLORS.Agent,
        description: hasDecisions
          ? `${action} ${ticker} $${amount.toLocaleString()} (${(confidence * 100).toFixed(0)}%)`
          : 'No decisions',
        status: hasTrades
          ? success
            ? 'success'
            : 'error'
          : hasDecisions
            ? 'success'
            : 'skipped',
        durationMs: 0,
        llmCallCount: 0,
        hasError: !success,
        isCompleted: hasDecisions,
        isAgent: true,
        npcId: npc.npcId,
        action,
        ticker,
        amount,
        confidence,
        reasoning: npc.decisions?.[0]?.reasoning ?? '',
      },
    });
  }

  // Build flow edges
  const flowEdges: Edge[] = [];
  let edgeIdx = 0;

  // System edges
  for (const e of DAG_EDGES) {
    if (
      !validIds.has(e.source) ||
      !validIds.has(e.target) ||
      e.source === e.target
    )
      continue;
    // Skip direct market-decisions -> trade-execution if we have agents
    if (
      agentNodeIds.length > 0 &&
      e.source === 'market-decisions' &&
      e.target === 'trade-execution'
    )
      continue;

    const both = completed.has(e.source) && completed.has(e.target);
    flowEdges.push({
      id: `e${edgeIdx++}`,
      source: e.source,
      target: e.target,
      label: e.label || undefined,
      animated: both,
      style: {
        stroke: both ? '#3b82f6' : '#334155',
        strokeWidth: both ? 2 : 1.2,
      },
      labelStyle: { fontSize: 9, fill: '#64748b' },
    });
  }

  // Agent edges: market-decisions -> agent -> trade-execution
  for (const npc of npcs) {
    const agentId = `agent-${npc.npcId}`;
    const hasDecision = (npc.decisions?.length ?? 0) > 0;
    const action = npc.decisions?.[0]?.action ?? '';
    const isHold = action === 'hold' || action === 'wait';

    // market-decisions -> agent
    flowEdges.push({
      id: `e${edgeIdx++}`,
      source: 'market-decisions',
      target: agentId,
      animated: hasDecision,
      style: {
        stroke: hasDecision ? '#ec4899' : '#334155',
        strokeWidth: hasDecision ? 2 : 1,
      },
    });

    // agent -> trade-execution (only if not hold)
    if (!isHold) {
      flowEdges.push({
        id: `e${edgeIdx++}`,
        source: agentId,
        target: 'trade-execution',
        animated: hasDecision,
        style: {
          stroke: hasDecision ? '#ec4899' : '#334155',
          strokeWidth: hasDecision ? 2 : 1,
        },
      });
    }
  }

  return { nodes: flowNodes, edges: flowEdges };
}

// ============================================================
export function App() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceData | null>(null);
  const [selNodeId, setSelNodeId] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const lastRef = useRef<string | null>(null);
  const userPicked = useRef(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Poll trace list
  const refresh = useCallback(async () => {
    const list = await fetchTraceList();
    setTraces(list);
    if (list.length > 0) {
      const newest = list[0]!.dirName;
      if (live && !userPicked.current && newest !== lastRef.current) {
        lastRef.current = newest;
        setSelected(newest);
      } else if (!selected) {
        setSelected(newest);
      }
    }
  }, [live, selected]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [live, refresh]);

  // Load trace
  useEffect(() => {
    if (!selected) return;
    fetchTrace(selected).then((d) => {
      if (!d) return;
      setTrace(d);
      const npcs: NPCTrajectory[] = d.npcTrajectories ?? [];
      const g = buildGraph(d.nodes, npcs);
      setNodes(g.nodes);
      setEdges(g.edges);
    });
  }, [selected, setNodes, setEdges]);

  // Selected node - could be system or agent
  const selNode = useMemo(() => {
    if (!selNodeId || !trace) return null;
    // System node
    const sys = trace.nodes.find((n) => n.nodeId === selNodeId);
    if (sys) return sys;
    // Agent node - create a synthetic TraceNodeData
    if (selNodeId.startsWith('agent-')) {
      const npcId = selNodeId.replace('agent-', '');
      const npc = trace.npcTrajectories?.find((n) => n.npcId === npcId);
      if (npc) {
        return {
          nodeId: selNodeId,
          name: npc.npcName,
          phase: 'Agent',
          phaseNumber: 450,
          startMs: 0,
          endMs: 0,
          durationMs: 0,
          status: 'success' as const,
          inputs: {
            decisions: npc.decisions,
          },
          outputs: {
            trades: npc.trades,
            posts: npc.posts,
            groupMessages: npc.groupMessages,
          },
          llmCallIds: [],
        };
      }
    }
    return null;
  }, [selNodeId, trace]);

  const selLLM = useMemo(() => {
    if (!selNode || !trace?.llmCallsFull) return [];
    const ids = new Set(selNode.llmCallIds);
    return trace.llmCallsFull.filter((c) => ids.has(c.callId)) as LLMCallFull[];
  }, [selNode, trace]);

  // Get NPC data for the selected agent node
  const selNPC = useMemo(() => {
    if (!selNodeId?.startsWith('agent-') || !trace?.npcTrajectories)
      return null;
    const npcId = selNodeId.replace('agent-', '');
    return trace.npcTrajectories.find((n) => n.npcId === npcId) ?? null;
  }, [selNodeId, trace]);

  const onNodeClick = useCallback(
    (_: unknown, n: Node) => setSelNodeId(n.id),
    []
  );
  const maxDur = Math.max(...(trace?.nodes ?? []).map((n) => n.durationMs), 1);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0f172a',
      }}
    >
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .react-flow__edge.animated path { stroke-dasharray:8; animation:dash .6s linear infinite }
        @keyframes dash { to{stroke-dashoffset:-16} }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700 }}>
          Babylon DAG
        </span>

        <select
          value={selected ?? ''}
          onChange={(e) => {
            userPicked.current = true;
            setSelected(e.target.value);
          }}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 4,
            color: '#e2e8f0',
            padding: '3px 6px',
            fontSize: 12,
            minWidth: 220,
          }}
        >
          {traces.map((t) => (
            <option key={t.dirName} value={t.dirName}>
              {t.timestamp ? new Date(t.timestamp).toLocaleString() : t.dirName}
              {t.durationMs ? ` (${t.durationMs}ms)` : ''}
            </option>
          ))}
          {!traces.length && <option value="">No traces</option>}
        </select>

        {traces.length > 1 && (
          <>
            <button
              onClick={() => {
                const i = traces.findIndex((t) => t.dirName === selected);
                if (i < traces.length - 1) {
                  userPicked.current = true;
                  setSelected(traces[i + 1]!.dirName);
                }
              }}
              style={btnStyle}
            >
              &larr;
            </button>
            <button
              onClick={() => {
                const i = traces.findIndex((t) => t.dirName === selected);
                if (i > 0) {
                  userPicked.current = true;
                  setSelected(traces[i - 1]!.dirName);
                }
              }}
              style={btnStyle}
            >
              &rarr;
            </button>
          </>
        )}

        <button
          onClick={() =>
            setLive((p) => {
              if (!p) userPicked.current = false;
              return !p;
            })
          }
          style={{
            background: live ? '#16a34a22' : '#1e293b',
            border: `1px solid ${live ? '#16a34a' : '#334155'}`,
            borderRadius: 6,
            color: live ? '#4ade80' : '#94a3b8',
            padding: '3px 10px',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: live ? '#4ade80' : '#475569',
              animation: live ? 'pulse 2s infinite' : 'none',
            }}
          />
          {live ? 'LIVE' : 'PAUSED'}
        </button>

        {trace && (
          <div
            style={{
              color: '#94a3b8',
              fontSize: 11,
              marginLeft: 'auto',
              display: 'flex',
              gap: 12,
            }}
          >
            <span>
              {traces.findIndex((t) => t.dirName === selected) + 1}/
              {traces.length} ticks
            </span>
            <span>{trace.durationMs}ms</span>
            <span>LLM:{trace.llmCallSummaries?.length ?? 0}</span>
            <span>
              {(trace.tokenStats?.totalTokens ?? 0).toLocaleString()} tok
            </span>
            {trace.tokenStats?.estimatedCostUSD != null && (
              <span>${trace.tokenStats.estimatedCostUSD.toFixed(4)}</span>
            )}
            <span style={{ color: '#ec4899' }}>
              {trace.npcTrajectories?.length ?? 0} agents
            </span>
          </div>
        )}
      </div>

      {/* Timeline */}
      {trace && (
        <div
          style={{
            borderBottom: '1px solid #1e293b',
            padding: '4px 16px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
            height: 36,
          }}
        >
          {trace.nodes
            .filter((n) => n.status !== 'skipped')
            .map((n) => {
              const h = Math.max(3, (n.durationMs / maxDur) * 28);
              const c = PHASE_COLORS[n.phase] ?? '#6b7280';
              return (
                <button
                  key={n.nodeId}
                  onClick={() => setSelNodeId(n.nodeId)}
                  title={`${n.name}: ${n.durationMs}ms`}
                  style={{
                    width: 14,
                    height: h,
                    background: n.status === 'error' ? '#ef4444' : c,
                    borderRadius: '2px 2px 0 0',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0.8,
                    padding: 0,
                  }}
                />
              );
            })}
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex' }}>
        {!trace ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 16, color: '#e2e8f0' }}>
              No trace data yet
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Run:{' '}
              <code
                style={{
                  background: '#1e293b',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                BABYLON_DAG_TRACE=true bun run scripts/run-traced-tick.ts
              </code>
            </div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1 }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.15}
                maxZoom={2.5}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#1e293b" gap={20} />
                <Controls
                  style={{ background: '#1e293b', borderColor: '#334155' }}
                />
                <MiniMap
                  style={{ background: '#1e293b' }}
                  nodeColor={(n) =>
                    (n.data as Record<string, string>).phaseColor ?? '#6b7280'
                  }
                  maskColor="rgba(0,0,0,.6)"
                />
              </ReactFlow>
            </div>
            {selNode && (
              <NodeDetailPanel
                node={selNode}
                llmCalls={selLLM}
                npcs={selNPC ? [selNPC] : (trace.npcTrajectories ?? [])}
                onClose={() => setSelNodeId(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 4,
  color: '#e2e8f0',
  padding: '3px 8px',
  cursor: 'pointer',
  fontSize: 12,
};
