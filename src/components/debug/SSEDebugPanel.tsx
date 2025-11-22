/** SSE Debug Panel
 *
 * Lightweight client-only debug widget to inspect SSE connectivity and events.
 * Usage: render on any page when you want to debug SSE (e.g. behind a query param).
 *
 * Props:
 * - channels: array of channels to subscribe to (default: ['markets'])
 * - filterMarketId: optional marketId filter to surface only matching events
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSSE } from '@/hooks/useSSE'
import type { Channel, SSEMessage } from '@/hooks/useSSE'

interface SSEDebugPanelProps {
  channels?: Channel[]
  filterMarketId?: string | null
}

type LoggedEvent = {
  ts: number
  channel: Channel
  type: string
  payload: Record<string, unknown>
}

export function SSEDebugPanel({ channels = ['markets'], filterMarketId }: SSEDebugPanelProps) {
  const [events, setEvents] = useState<LoggedEvent[]>([])

  const { isConnected, error, subscribe, unsubscribe } = useSSE({
    channels,
    autoReconnect: true,
  })

  const subscribeChannels = useMemo(() => channels, [channels])

  useEffect(() => {
    const handlers: Array<{ channel: Channel }> = []

    for (const ch of subscribeChannels) {
      const handler = (msg: SSEMessage) => {
        const payload = msg.data || {}
        if (filterMarketId) {
          const mid = (payload as { marketId?: string }).marketId
          if (mid !== filterMarketId) return
        }
        setEvents((prev) => {
          const next: LoggedEvent[] = [
            {
              ts: Date.now(),
              channel: msg.channel,
              type: msg.type,
              payload: payload as Record<string, unknown>,
            },
            ...prev,
          ].slice(0, 30) // keep last 30
          return next
        })
      }
      subscribe(ch, handler)
      handlers.push({ channel: ch })
    }

    return () => {
      handlers.forEach(({ channel, handler }) => {
        unsubscribe(channel)
      })
    }
  }, [subscribeChannels, subscribe, unsubscribe, filterMarketId])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        width: '360px',
        maxHeight: '60vh',
        overflow: 'auto',
        background: 'rgba(0,0,0,0.8)',
        color: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 12,
        zIndex: 9999,
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <strong>SSE Debug</strong>{' '}
          <span style={{ color: isConnected ? '#4ade80' : '#f87171' }}>
            {isConnected ? 'connected' : 'disconnected'}
          </span>
          {filterMarketId ? ` · market:${filterMarketId}` : ''}
        </div>
        {error && <span style={{ color: '#fbbf24' }}>err: {error}</span>}
      </div>
      <div style={{ marginBottom: 8 }}>
        <div>Channels: {subscribeChannels.join(', ')}</div>
        <div>Events (latest first, max 30)</div>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {events.map((ev, idx) => (
          <div
            key={`${ev.ts}-${idx}`}
            style={{
              padding: 8,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{new Date(ev.ts).toLocaleTimeString()}</span>
              <span>
                {ev.channel} · {ev.type}
              </span>
            </div>
            <pre
              style={{
                marginTop: 4,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'Menlo, monospace',
              }}
            >
              {JSON.stringify(ev.payload, null, 2)}
            </pre>
          </div>
        ))}
        {events.length === 0 && <div style={{ color: '#9ca3af' }}>No events yet…</div>}
      </div>
    </div>
  )
}
