'use client';

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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { DagNode } from './DagNode';
import { NodeDetailPanel } from './NodeDetailPanel';
import { TickSelector } from './TickSelector';
import { TickTimeline } from './TickTimeline';

const PHASE_COLORS: Record<string, string> = {
  Bootstrap: '#3b82f6',
  Questions: '#06b6d4',
  Events: '#f97316',
  Markets: '#22c55e',
  Rebalancing: '#eab308',
  ContentMaintenance: '#6b7280',
  Social: '#a855f7',
  Finalize: '#ef4444',
};

interface TraceSummary {
  dirName: string;
  tickId: string;
  tickNumber?: number;
  timestamp?: string;
  durationMs?: number;
  nodeCount?: number;
  llmCallCount?: number;
  npcTrajectoryCount?: number;
}

interface TraceData {
  tickId: string;
  tickNumber: number;
  timestamp: string;
  durationMs: number;
  dag: {
    nodes: Array<{
      id: string;
      name: string;
      phase: string;
      phaseNumber: number;
      description: string;
    }>;
    edges: Array<{ source: string; target: string; label: string }>;
  };
  nodes: Array<{
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
  }>;
  llmCallSummaries: Array<{
    callId: string;
    nodeId: string;
    promptType: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    success: boolean;
  }>;
  llmCallsFull?: Array<Record<string, unknown>>;
  npcTrajectories?: Array<Record<string, unknown>>;
  tokenStats: {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    estimatedCostUSD: number;
  };
  gameTickResult: Record<string, unknown>;
}

const nodeTypes = { dagNode: DagNode };

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

function layoutDag(
  dagNodes: TraceData['dag']['nodes'],
  dagEdges: TraceData['dag']['edges'],
  traceNodes: TraceData['nodes']
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 80 });

  const traceMap = new Map(traceNodes.map((n) => [n.nodeId, n]));

  for (const dn of dagNodes) {
    g.setNode(dn.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const validNodeIds = new Set(dagNodes.map((n) => n.id));
  for (const edge of dagEdges) {
    if (
      validNodeIds.has(edge.source) &&
      validNodeIds.has(edge.target) &&
      edge.source !== edge.target
    ) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const flowNodes: Node[] = dagNodes.map((dn) => {
    const pos = g.node(dn.id);
    const trace = traceMap.get(dn.id);
    return {
      id: dn.id,
      type: 'dagNode',
      position: {
        x: (pos?.x ?? 0) - NODE_WIDTH / 2,
        y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
      },
      data: {
        label: dn.name,
        phase: dn.phase,
        phaseColor: PHASE_COLORS[dn.phase] ?? '#6b7280',
        description: dn.description,
        status: trace?.status ?? 'skipped',
        durationMs: trace?.durationMs ?? 0,
        llmCallCount: trace?.llmCallIds?.length ?? 0,
        hasError: trace?.status === 'error',
      },
    };
  });

  const flowEdges: Edge[] = dagEdges
    .filter(
      (e) =>
        validNodeIds.has(e.source) &&
        validNodeIds.has(e.target) &&
        e.source !== e.target
    )
    .map((e, i) => ({
      id: `edge-${i}`,
      source: e.source,
      target: e.target,
      label: e.label || undefined,
      style: { stroke: '#64748b', strokeWidth: 1.5 },
      labelStyle: { fontSize: 10, fill: '#94a3b8' },
      animated: false,
    }));

  return { nodes: flowNodes, edges: flowEdges };
}

export function DagVisualizerClient() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [traceData, setTraceData] = useState<TraceData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const lastKnownTraceRef = useRef<string | null>(null);
  const userSelectedRef = useRef(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Fetch trace list (initial + polling in live mode)
  const fetchTraceList = useCallback(() => {
    fetch('/api/admin/dag-traces')
      .then((r) => r.json())
      .then((data) => {
        const list: TraceSummary[] = data.data?.traces ?? data.traces ?? [];
        setTraces(list);

        // Auto-select newest trace in live mode (or on first load)
        if (list.length > 0) {
          const newest = list[0]!.dirName;
          if (
            liveMode &&
            !userSelectedRef.current &&
            newest !== lastKnownTraceRef.current
          ) {
            lastKnownTraceRef.current = newest;
            setSelectedTrace(newest);
          } else if (!selectedTrace) {
            setSelectedTrace(newest);
          }
        }
      })
      .catch(() => {});
  }, [liveMode, selectedTrace]);

  // Initial fetch
  useEffect(() => {
    fetchTraceList();
  }, [fetchTraceList]);

  // Poll for new traces every 5s in live mode
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(fetchTraceList, 5000);
    return () => clearInterval(interval);
  }, [liveMode, fetchTraceList]);

  // When user manually selects a trace, stop auto-jumping
  const handleUserSelect = useCallback((dirName: string) => {
    userSelectedRef.current = true;
    setSelectedTrace(dirName);
  }, []);

  // When live mode is toggled back on, resume auto-jumping
  const handleToggleLive = useCallback(() => {
    setLiveMode((prev) => {
      if (!prev) {
        // Turning live ON — reset user override and jump to latest
        userSelectedRef.current = false;
        if (traces.length > 0) {
          setSelectedTrace(traces[0]!.dirName);
        }
      }
      return !prev;
    });
  }, [traces]);

  // Fetch trace data when selected
  useEffect(() => {
    if (!selectedTrace) return;
    setLoading(true);
    fetch(`/api/admin/dag-traces/${selectedTrace}?include=llm-calls,npc`)
      .then((r) => r.json())
      .then((data) => {
        const trace = data.data ?? data;
        setTraceData(trace);
        if (trace.dag && trace.nodes) {
          const layout = layoutDag(
            trace.dag.nodes,
            trace.dag.edges,
            trace.nodes
          );
          setNodes(layout.nodes);
          setEdges(layout.edges);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedTrace, setNodes, setEdges]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !traceData) return null;
    return traceData.nodes.find((n) => n.nodeId === selectedNodeId) ?? null;
  }, [selectedNodeId, traceData]);

  const selectedNodeLLMCalls = useMemo(() => {
    if (!selectedNode || !traceData?.llmCallsFull) return [];
    const callIds = new Set(selectedNode.llmCallIds);
    return traceData.llmCallsFull.filter((c) =>
      callIds.has(c.callId as string)
    );
  }, [selectedNode, traceData]);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0f172a',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: '#0f172a',
        }}
      >
        <h1
          style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 600, margin: 0 }}
        >
          DAG Visualizer
        </h1>
        <TickSelector
          traces={traces}
          selected={selectedTrace}
          onSelect={handleUserSelect}
        />
        <button
          onClick={handleToggleLive}
          style={{
            background: liveMode ? '#16a34a22' : '#1e293b',
            border: `1px solid ${liveMode ? '#16a34a' : '#334155'}`,
            borderRadius: 6,
            color: liveMode ? '#4ade80' : '#94a3b8',
            padding: '4px 12px',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: liveMode ? '#4ade80' : '#475569',
              display: 'inline-block',
              animation: liveMode ? 'pulse 2s infinite' : 'none',
            }}
          />
          {liveMode ? 'LIVE' : 'PAUSED'}
        </button>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        {traceData && (
          <div
            style={{
              color: '#94a3b8',
              fontSize: 13,
              marginLeft: 'auto',
              display: 'flex',
              gap: 16,
            }}
          >
            <span>Tick {traces.findIndex((t) => t.dirName === selectedTrace) + 1}/{traces.length}</span>
            <span>Duration: {traceData.durationMs}ms</span>
            <span>LLM Calls: {traceData.llmCallSummaries?.length ?? 0}</span>
            <span>
              Tokens:{' '}
              {(traceData.tokenStats?.totalTokens ?? 0).toLocaleString()}
            </span>
            {traceData.tokenStats?.estimatedCostUSD !== undefined && (
              <span>
                Cost: ${traceData.tokenStats.estimatedCostUSD.toFixed(4)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      {traceData && (
        <div style={{ borderBottom: '1px solid #1e293b', padding: '8px 20px' }}>
          <TickTimeline
            nodes={traceData.nodes}
            onNodeClick={setSelectedNodeId}
          />
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
        {loading ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
            }}
          >
            Loading trace data...
          </div>
        ) : !traceData ? (
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
            <div style={{ fontSize: 16 }}>No trace data available</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Enable with BABYLON_DAG_TRACE=true and run a game tick
            </div>
          </div>
        ) : (
          <>
            {/* Graph */}
            <div style={{ flex: 1 }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.3}
                maxZoom={2}
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
                  maskColor="rgba(0,0,0,0.6)"
                />
              </ReactFlow>
            </div>

            {/* Detail panel */}
            {selectedNode && (
              <NodeDetailPanel
                node={selectedNode}
                llmCalls={selectedNodeLLMCalls}
                npcTrajectories={traceData.npcTrajectories ?? []}
                onClose={() => setSelectedNodeId(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
