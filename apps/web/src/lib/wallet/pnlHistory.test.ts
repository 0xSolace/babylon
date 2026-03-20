import { describe, expect, it } from 'bun:test';
import {
  buildScopedPnlHistoryPoints,
  getHourBoundary,
} from './pnlHistory';

describe('buildScopedPnlHistoryPoints', () => {
  it('aggregates snapshots across the full team scope and appends a live point', () => {
    const now = new Date('2026-03-20T20:45:00.000Z');
    const points = buildScopedPnlHistoryPoints({
      now,
      scopeUserIds: ['owner-1', 'agent-1'],
      snapshots: [
        {
          userId: 'owner-1',
          snapshotAt: new Date('2026-03-20T18:00:00.000Z'),
          currentPnL: 10,
        },
        {
          userId: 'agent-1',
          snapshotAt: new Date('2026-03-20T18:00:00.000Z'),
          currentPnL: 5,
        },
        {
          userId: 'owner-1',
          snapshotAt: new Date('2026-03-20T19:00:00.000Z'),
          currentPnL: 12,
        },
        {
          userId: 'agent-1',
          snapshotAt: new Date('2026-03-20T19:00:00.000Z'),
          currentPnL: 8,
        },
      ],
      liveMetricsByUserId: new Map([
        [
          'owner-1',
          {
            userId: 'owner-1',
            lifetimePnL: 0,
            unrealizedPnL: 0,
            currentPnL: 14,
          },
        ],
        [
          'agent-1',
          {
            userId: 'agent-1',
            lifetimePnL: 0,
            unrealizedPnL: 0,
            currentPnL: 9,
          },
        ],
      ]),
    });

    expect(points).toEqual([
      { time: new Date('2026-03-20T18:00:00.000Z').getTime(), value: 15 },
      { time: new Date('2026-03-20T19:00:00.000Z').getTime(), value: 20 },
      { time: now.getTime(), value: 23 },
    ]);
  });

  it('isolates a single agent scope from team snapshots', () => {
    const points = buildScopedPnlHistoryPoints({
      scopeUserIds: ['agent-2'],
      snapshots: [
        {
          userId: 'owner-1',
          snapshotAt: new Date('2026-03-20T18:00:00.000Z'),
          currentPnL: 10,
        },
        {
          userId: 'agent-2',
          snapshotAt: new Date('2026-03-20T18:00:00.000Z'),
          currentPnL: -3,
        },
      ],
    });

    expect(points).toEqual([
      { time: new Date('2026-03-20T18:00:00.000Z').getTime(), value: -3 },
    ]);
  });
});

describe('getHourBoundary', () => {
  it('normalizes dates to the top of the UTC hour', () => {
    expect(getHourBoundary(new Date('2026-03-20T20:45:31.222Z')).toISOString()).toBe(
      '2026-03-20T20:00:00.000Z'
    );
  });
});
