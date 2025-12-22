/**
 * PredictionProbabilityChart - Displays probability history for a prediction market
 *
 * Placeholder component - chart visualization will be implemented using
 * lightweight-charts or similar charting library when probability history
 * tracking is added to the prediction market service.
 */

'use client';

import type { PredictionHistoryPoint } from '@/hooks/usePredictionHistory';

export interface PredictionProbabilityChartProps {
  marketId: string | number;
  data?: PredictionHistoryPoint[];
  showBrush?: boolean;
  height?: number;
}

export function PredictionProbabilityChart({
  marketId,
  data,
  showBrush,
  height = 200,
}: PredictionProbabilityChartProps) {
  // Placeholder - implement chart
  void marketId;
  void data;
  void showBrush;

  return (
    <div
      className="flex items-center justify-center rounded bg-muted/30"
      style={{ height }}
    >
      <span className="text-muted-foreground text-sm">
        Probability chart coming soon
      </span>
    </div>
  );
}
