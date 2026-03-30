'use client';

import { Handle, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';

interface DagNodeData {
  label: string;
  phase: string;
  phaseColor: string;
  description: string;
  status: 'success' | 'error' | 'skipped';
  durationMs: number;
  llmCallCount: number;
  hasError: boolean;
}

const statusIcons: Record<string, string> = {
  success: '\u2713',
  error: '\u2717',
  skipped: '\u2014',
};

export const DagNode = memo(function DagNode({ data }: NodeProps) {
  const d = data as unknown as DagNodeData;
  const borderColor =
    d.status === 'error'
      ? '#ef4444'
      : d.status === 'skipped'
        ? '#475569'
        : d.phaseColor;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#475569', width: 6, height: 6 }}
      />

      <div
        style={{
          background: '#1e293b',
          border: `2px solid ${borderColor}`,
          borderRadius: 8,
          padding: '8px 12px',
          width: 200,
          opacity: d.status === 'skipped' ? 0.5 : 1,
          cursor: 'pointer',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              color: borderColor,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {statusIcons[d.status] ?? ''} {d.label}
          </span>
        </div>

        {/* Meta row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
            fontSize: 11,
            color: '#94a3b8',
          }}
        >
          <span
            style={{
              background: d.phaseColor + '22',
              color: d.phaseColor,
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 10,
            }}
          >
            {d.phase}
          </span>
          {d.durationMs > 0 && <span>{d.durationMs}ms</span>}
          {d.llmCallCount > 0 && (
            <span
              style={{
                background: '#7c3aed22',
                color: '#a78bfa',
                padding: '1px 6px',
                borderRadius: 4,
              }}
            >
              LLM x{d.llmCallCount}
            </span>
          )}
        </div>

        {d.hasError && (
          <div style={{ color: '#ef4444', fontSize: 10, marginTop: 2 }}>
            Error occurred
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#475569', width: 6, height: 6 }}
      />
    </>
  );
});
