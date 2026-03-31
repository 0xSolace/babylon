import { Handle, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';

interface D {
  label: string;
  phase: string;
  phaseColor: string;
  description: string;
  status: string;
  durationMs: number;
  llmCallCount: number;
  hasError: boolean;
  isCompleted: boolean;
  isAgent?: boolean;
  action?: string;
  ticker?: string;
  amount?: number;
  confidence?: number;
  reasoning?: string;
}

const ACTION_EMOJI: Record<string, string> = {
  open_long: '\u2191', // up arrow
  open_short: '\u2193', // down arrow
  buy_yes: '\u2713', // check
  buy_no: '\u2717', // x
  close_position: '\u21BA', // return
  hold: '\u23F8', // pause
  wait: '\u23F8',
};

export const DagNode = memo(function DagNode({ data }: NodeProps) {
  const d = data as unknown as D;
  const done = d.isCompleted;
  const skip = d.status === 'skipped' || d.status === 'pending';
  const err = d.status === 'error';
  const border = err ? '#ef4444' : done ? d.phaseColor : '#334155';

  // Agent node rendering
  if (d.isAgent) {
    const actionIcon = ACTION_EMOJI[d.action ?? ''] ?? '\u25CB';
    const isHold = d.action === 'hold' || d.action === 'wait';

    return (
      <>
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: '#ec4899', width: 5, height: 5 }}
        />
        <div
          style={{
            background: isHold ? '#1a1a2e' : '#1e1030',
            border: `2px solid ${err ? '#ef4444' : isHold ? '#6b7280' : '#ec4899'}`,
            borderRadius: 10,
            padding: '5px 10px',
            width: 160,
            opacity: isHold ? 0.6 : 1,
            cursor: 'pointer',
            transition: 'all .25s',
            ...(done && !isHold
              ? { boxShadow: '0 0 10px rgba(236,72,153,.3)' }
              : {}),
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ec4899' }}>
              {actionIcon}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#f9a8d4',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {d.label}
            </span>
          </div>
          {!isHold && d.ticker && (
            <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 2 }}>
              {d.action} {d.ticker} ${(d.amount ?? 0).toLocaleString()}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 2,
              fontSize: 9,
              color: '#94a3b8',
            }}
          >
            {d.confidence != null && d.confidence > 0 && (
              <span
                style={{
                  background:
                    d.confidence > 0.7
                      ? '#16a34a22'
                      : d.confidence > 0.4
                        ? '#eab30822'
                        : '#ef444422',
                  color:
                    d.confidence > 0.7
                      ? '#4ade80'
                      : d.confidence > 0.4
                        ? '#facc15'
                        : '#f87171',
                  padding: '0 4px',
                  borderRadius: 3,
                }}
              >
                {(d.confidence * 100).toFixed(0)}% conf
              </span>
            )}
            {isHold && <span style={{ color: '#6b7280' }}>holding</span>}
          </div>
        </div>
        {!isHold && (
          <Handle
            type="source"
            position={Position.Bottom}
            style={{ background: '#ec4899', width: 5, height: 5 }}
          />
        )}
      </>
    );
  }

  // System node rendering
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#475569', width: 5, height: 5 }}
      />
      <div
        style={{
          background: '#1e293b',
          border: `2px solid ${border}`,
          borderRadius: 7,
          padding: '6px 10px',
          width: 190,
          opacity: skip ? 0.4 : 1,
          cursor: 'pointer',
          transition: 'all .25s',
          ...(done && !err ? { boxShadow: `0 0 8px ${d.phaseColor}44` } : {}),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: err ? '#ef4444' : done ? d.phaseColor : '#94a3b8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {err ? '\u2717' : done ? '\u2713' : '\u25CB'} {d.label}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginTop: 3,
            fontSize: 9.5,
            color: '#94a3b8',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              background: `${d.phaseColor}22`,
              color: d.phaseColor,
              padding: '0 4px',
              borderRadius: 3,
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
                padding: '0 4px',
                borderRadius: 3,
              }}
            >
              LLM x{d.llmCallCount}
            </span>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#475569', width: 5, height: 5 }}
      />
    </>
  );
});
