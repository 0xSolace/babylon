'use client';

import { cn } from '@babylon/shared';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface PricePoint {
  time: number;
  price: number;
}

interface PerpPriceChartProps {
  data: PricePoint[];
  currentPrice: number;
  ticker: string;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function PerpPriceChart({
  data,
  currentPrice,
  ticker,
}: PerpPriceChartProps) {
  // Use currentPrice as fallback for display (e.g., when no historical data)
  void currentPrice;

  const { chartData, priceChange, isPositive, domain } = useMemo(() => {
    if (data.length < 2) {
      return {
        chartData: [],
        priceChange: 0,
        isPositive: true,
        domain: [0, 100] as [number, number],
      };
    }

    const firstPoint = data.at(0);
    const lastPoint = data.at(-1);
    if (!firstPoint || !lastPoint) {
      return {
        chartData: [],
        priceChange: 0,
        isPositive: true,
        domain: [0, 100] as [number, number],
      };
    }
    const firstPrice = firstPoint.price;
    const lastPrice = lastPoint.price;
    const change = ((lastPrice - firstPrice) / firstPrice) * 100;

    const prices = data.map((d) => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const padding = (maxPrice - minPrice) * 0.1;

    return {
      chartData: data.map((point) => ({
        time: point.time,
        price: point.price,
        formattedTime: formatTime(point.time),
      })),
      priceChange: change,
      isPositive: change >= 0,
      domain: [minPrice - padding, maxPrice + padding] as [number, number],
    };
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading chart data...
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient
              id={`gradient-${ticker}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={isPositive ? '#16a34a' : '#dc2626'}
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor={isPositive ? '#16a34a' : '#dc2626'}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="formattedTime"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            domain={domain}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => `$${value.toFixed(0)}`}
            width={60}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as (typeof chartData)[0];
              return (
                <div className="rounded-lg border border-border bg-background p-2 shadow-lg">
                  <p className="font-medium text-sm">
                    {formatPrice(point.price)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {point.formattedTime}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={isPositive ? '#16a34a' : '#dc2626'}
            strokeWidth={2}
            fill={`url(#gradient-${ticker})`}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">${ticker}</span>
        <span
          className={cn(
            'font-medium',
            isPositive ? 'text-green-600' : 'text-red-600'
          )}
        >
          {isPositive ? '+' : ''}
          {priceChange.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
