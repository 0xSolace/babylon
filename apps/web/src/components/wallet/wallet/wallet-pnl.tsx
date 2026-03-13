'use client';

import { cn, formatCurrency } from '@babylon/shared/utils';
import { ChevronDown, HelpCircle, Maximize2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { useUserPositions } from '@/stores/userPositionsStore';
import { useWalletBalance } from '@/stores/walletBalanceStore';

interface WalletPnLProps {
  userId: string;
  mode?: 'sidebar' | 'page';
}

interface EntityPnL {
  name: string;
  currentPnl: number;
  lifetimePnl: number;
  unrealized: number;
  isSelected?: boolean;
}

const timeframes = ['1H', '4H', '1D', '1W', 'ALL'];

export function WalletPnL({ userId, mode = 'page' }: WalletPnLProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [selectedEntity] = useState('Team');
  const { lifetimePnL, loading: balanceLoading } = useWalletBalance(userId);
  const {
    perpPositions,
    predictionPositions,
    loading: positionsLoading,
  } = useUserPositions(userId);

  const isSidebar = mode === 'sidebar';
  const loading = balanceLoading || positionsLoading;

  // Build entity P&L list by grouping positions by agent
  const entities = useMemo(() => {
    let ownerUnrealized = 0;
    const agentUnrealized = new Map<string, number>();

    for (const pos of perpPositions) {
      if (pos.isAgentPosition && pos.agentName) {
        agentUnrealized.set(
          pos.agentName,
          (agentUnrealized.get(pos.agentName) ?? 0) + pos.unrealizedPnL
        );
      } else {
        ownerUnrealized += pos.unrealizedPnL;
      }
    }

    for (const pos of predictionPositions) {
      const costBasis = pos.costBasis ?? pos.shares * pos.avgPrice;
      const currentValue = pos.currentValue ?? pos.shares * pos.currentPrice;
      const pnl = pos.unrealizedPnL ?? currentValue - costBasis;

      if (pos.isAgentPosition && pos.agentName) {
        agentUnrealized.set(
          pos.agentName,
          (agentUnrealized.get(pos.agentName) ?? 0) + pnl
        );
      } else {
        ownerUnrealized += pnl;
      }
    }

    const totalUnrealized =
      ownerUnrealized +
      Array.from(agentUnrealized.values()).reduce((s, v) => s + v, 0);

    const list: EntityPnL[] = [
      {
        name: 'Team',
        currentPnl: lifetimePnL,
        lifetimePnl: lifetimePnL,
        unrealized: totalUnrealized,
        isSelected: selectedEntity === 'Team',
      },
      {
        name: 'You (Owner)',
        currentPnl: lifetimePnL, // Best approximation without per-entity lifetime data
        lifetimePnl: lifetimePnL,
        unrealized: ownerUnrealized,
        isSelected: selectedEntity === 'You (Owner)',
      },
    ];

    for (const [agentName, unrealized] of agentUnrealized) {
      list.push({
        name: agentName,
        currentPnl: unrealized, // Only unrealized data available
        lifetimePnl: unrealized,
        unrealized,
        isSelected: selectedEntity === agentName,
      });
    }

    return list;
  }, [perpPositions, predictionPositions, lifetimePnL, selectedEntity]);

  // TODO: Replace with real P&L history data from `GET /api/users/[userId]/pnl-history`
  // The chart currently uses placeholder data. When the API endpoint is built,
  // wire it to fetch historical P&L data based on selectedTimeframe and selectedEntity.
  const chartData = useMemo(
    () => [
      { time: '20:12', value: 394 },
      { time: '20:30', value: 395 },
      { time: '20:45', value: 393 },
      { time: '21:00', value: 396 },
      { time: '21:15', value: 394 },
      { time: '21:30', value: 395 },
      { time: '21:45', value: 397 },
      { time: '22:00', value: 395 },
      { time: '22:01', value: 396.43 },
    ],
    []
  );

  const fmtPnl = (value: number) => {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}${formatCurrency(Math.abs(value), { useThousandsSeparator: true })}`;
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div
          className={cn(
            'animate-pulse rounded bg-muted',
            isSidebar ? 'h-[160px]' : 'h-[240px]'
          )}
        />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <Button variant="outline" className="gap-2">
          {selectedEntity}
          <ChevronDown className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-muted p-0.5">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium text-xs transition-colors',
                  selectedTimeframe === tf
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tf}
              </button>
            ))}
          </div>
          {!isSidebar && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <div
        className={cn(
          'relative mb-6 w-full',
          isSidebar ? 'h-[160px]' : 'h-[240px]'
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 50, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              dy={10}
            />
            <YAxis
              domain={[380, 402]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={(value) => `b${value}`}
              orientation="right"
              dx={10}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded bg-foreground px-2 py-1 text-background text-xs">
                      b{payload[0].value}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#pnlGradient)"
              strokeDasharray="0"
            />
            {/* Reference Line */}
            <line
              x1="0%"
              y1="30%"
              x2="100%"
              y2="30%"
              stroke="#f87171"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Current Value Label */}
        <div className="absolute top-[15%] right-0 rounded bg-foreground px-2 py-0.5 font-medium text-background text-xs">
          b396.43
        </div>
      </div>

      {/* Table */}
      {isSidebar ? (
        // Compact: Entity + Current P&L only
        <table className="w-full">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className="pb-3 font-normal">Entity</th>
              <th className="pb-3 font-normal">Current P&L</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((entity) => (
              <tr
                key={entity.name}
                className="border-border border-b last:border-0"
              >
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    {entity.isSelected && (
                      <div className="h-2 w-2 rounded-full bg-sky-500" />
                    )}
                    <span className="font-medium text-sm">{entity.name}</span>
                  </div>
                </td>
                <td className="py-3">
                  <div
                    className={cn(
                      'font-semibold text-sm',
                      entity.currentPnl >= 0
                        ? 'text-emerald-500'
                        : 'text-rose-500'
                    )}
                  >
                    {fmtPnl(entity.currentPnl)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // Full table
        <table className="w-full">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className="pb-3 font-normal">Entity</th>
              <th className="pb-3 font-normal">Current P&L</th>
              <th className="pb-3 font-normal">Lifetime P&L</th>
              <th className="pb-3 font-normal">Unrealized</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((entity) => (
              <tr
                key={entity.name}
                className="border-border border-b last:border-0"
              >
                <td className="py-4">
                  <div className="flex items-center gap-2">
                    {entity.isSelected && (
                      <div className="h-2 w-2 rounded-full bg-sky-500" />
                    )}
                    <span className="font-medium text-sm">{entity.name}</span>
                  </div>
                </td>
                <td className="py-4">
                  <div
                    className={cn(
                      'font-semibold text-sm',
                      entity.currentPnl >= 0
                        ? 'text-emerald-500'
                        : 'text-rose-500'
                    )}
                  >
                    {fmtPnl(entity.currentPnl)}
                  </div>
                </td>
                <td className="py-4">
                  <div
                    className={cn(
                      'font-semibold text-sm',
                      entity.lifetimePnl >= 0
                        ? 'text-emerald-500'
                        : 'text-rose-500'
                    )}
                  >
                    {fmtPnl(entity.lifetimePnl)}
                  </div>
                </td>
                <td className="py-4">
                  <div
                    className={cn(
                      'font-semibold text-sm',
                      entity.unrealized >= 0
                        ? 'text-emerald-500'
                        : 'text-rose-500'
                    )}
                  >
                    {fmtPnl(entity.unrealized)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
