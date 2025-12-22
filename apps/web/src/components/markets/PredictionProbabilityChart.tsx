/**
 * PredictionProbabilityChart - Displays probability history for a prediction market
 *
 * TODO: Implement chart visualization using lightweight-charts or similar
 */

'use client';

interface PredictionProbabilityChartProps {
  marketId: string | number;
  height?: number;
}

export function PredictionProbabilityChart({
  marketId,
  height = 200,
}: PredictionProbabilityChartProps) {
  // Placeholder - implement chart
  void marketId;

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
