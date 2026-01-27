'use client';

import type { UserPredictionPosition } from '@babylon/shared';
import { PerpPositionsList } from '@/components/markets/PerpPositionsList';
import { PredictionPositionsList } from '@/components/markets/PredictionPositionsList';
import type { DisplayPerpPosition } from '@/types/markets';

interface PositionsPanelProps {
  activeTab: 'perps' | 'predictions' | 'dashboard';
  perpPositions: DisplayPerpPosition[];
  predictionPositions: UserPredictionPosition[];
  onPositionClosed?: () => void;
  onPositionSold?: () => void;
  className?: string;
}

export function PositionsPanel({
  activeTab,
  perpPositions,
  predictionPositions,
  onPositionClosed,
  onPositionSold,
  className,
}: PositionsPanelProps) {
  if (activeTab === 'dashboard') {
    return (
      <div className={className}>
        <div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
          Select Perps or Predictions tab to view active positions
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between border-white/5 border-b bg-muted/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-foreground text-xs uppercase tracking-wider">
            Active Positions
          </h3>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/20 font-bold text-[10px]">
            {activeTab === 'perps'
              ? perpPositions.length
              : predictionPositions.length}
          </span>
        </div>
        <div className="flex gap-2">{/* Action buttons can go here */}</div>
      </div>

      <div className="h-[calc(100%-48px)] overflow-y-auto p-0">
        {activeTab === 'perps' && (
          <PerpPositionsList
            positions={perpPositions}
            onPositionClosed={onPositionClosed}
          />
        )}

        {activeTab === 'predictions' && (
          <PredictionPositionsList
            positions={predictionPositions}
            onPositionSold={onPositionSold}
          />
        )}
      </div>
    </div>
  );
}
