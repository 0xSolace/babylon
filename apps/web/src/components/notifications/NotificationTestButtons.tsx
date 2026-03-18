'use client';

import { useOutcomeNotification } from '@/components/providers/OutcomeNotificationProvider';
import {
  MarketClosingSoonCard,
  TopGainerCard,
  TopLoserCard,
} from './FeedSignalCards';

/**
 * DEV ONLY — Remove before merging.
 * Test buttons for triggering outcome notification pop-ups
 * and previewing feed signal cards.
 */
export function NotificationTestButtons() {
  const { showOutcome, showBatchOutcomes } = useOutcomeNotification();

  return (
    <div className="border-border border-b p-3">
      <p className="mb-2 font-medium text-muted-foreground text-xs uppercase">
        Notification test
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            showOutcome({
              marketId: 'm1',
              marketName: 'Will ETH hit $5,000 by March 2026?',
              outcome: 'win',
              points: 1250,
              deepLink: '/markets/m1',
            })
          }
          className="rounded-md bg-green-600 px-3 py-1.5 text-white text-xs"
        >
          Win
        </button>
        <button
          onClick={() =>
            showOutcome({
              marketId: 'm2',
              marketName: 'Will Bitcoin dominance fall below 40%?',
              outcome: 'loss',
              points: -800,
              deepLink: '/markets/m2',
            })
          }
          className="rounded-md bg-red-600 px-3 py-1.5 text-white text-xs"
        >
          Loss
        </button>
        <button
          onClick={() =>
            showOutcome({
              marketId: 'm3',
              marketName: 'Will SOL flip ETH in daily volume?',
              outcome: 'win',
              points: 3200,
              agentName: 'Ares',
              deepLink: '/markets/m3',
            })
          }
          className="rounded-md bg-green-700 px-3 py-1.5 text-white text-xs"
        >
          Win (Agent)
        </button>
        <button
          onClick={() =>
            showOutcome({
              marketId: 'm4',
              marketName: 'Will the Fed cut rates in Q1?',
              outcome: 'loss',
              points: -450,
              agentName: 'Athena',
              deepLink: '/markets/m4',
            })
          }
          className="rounded-md bg-red-700 px-3 py-1.5 text-white text-xs"
        >
          Loss (Agent)
        </button>
        <button
          onClick={() => {
            showOutcome({
              marketId: 'm5',
              marketName: 'Rain tomorrow in NYC?',
              outcome: 'win',
              points: 50,
              deepLink: '/markets/m5',
            });
            showOutcome({
              marketId: 'm6',
              marketName: 'Will AI pass the Turing test by 2027?',
              outcome: 'loss',
              points: -2100,
              agentName: 'Hermes',
              deepLink: '/markets/m6',
            });
            showOutcome({
              marketId: 'm7',
              marketName: 'Will the total crypto market cap exceed $10T?',
              outcome: 'win',
              points: 25000,
              agentName: 'Zeus',
              deepLink: '/markets/m7',
            });
          }}
          className="rounded-md bg-primary px-3 py-1.5 text-white text-xs"
        >
          Queue (3)
        </button>
        <button
          onClick={() =>
            showBatchOutcomes([
              {
                marketId: 'm1',
                marketName: 'Will ETH hit $5,000 by March 2026?',
                outcome: 'win',
                points: 1250,
                deepLink: '/markets/m1',
              },
              {
                marketId: 'm2',
                marketName: 'Will Bitcoin dominance fall below 40%?',
                outcome: 'loss',
                points: -800,
                deepLink: '/markets/m2',
              },
              {
                marketId: 'm3',
                marketName: 'Will SOL flip ETH in daily volume?',
                outcome: 'win',
                points: 3200,
                agentName: 'Ares',
                deepLink: '/markets/m3',
              },
              {
                marketId: 'm4',
                marketName: 'Will the Fed cut rates in Q1?',
                outcome: 'loss',
                points: -450,
                agentName: 'Athena',
                deepLink: '/markets/m4',
              },
              {
                marketId: 'm5',
                marketName: 'Rain tomorrow in NYC?',
                outcome: 'win',
                points: 50,
                deepLink: '/markets/m5',
              },
            ])
          }
          className="rounded-md bg-purple-600 px-3 py-1.5 text-white text-xs"
        >
          Stacked (5)
        </button>
      </div>
    </div>
  );
}

/**
 * DEV ONLY — Remove before merging.
 * Feed signal card previews rendered inline in the feed.
 */
export function FeedSignalCardPreviews() {
  return (
    <>
      <MarketClosingSoonCard
        marketId="mc1"
        marketName="Will ETH hit $5,000 by March 2026?"
        closesAt={new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString()}
        positionSide="YES"
        currentPrice={0.72}
        entryPrice={0.45}
      />
      <TopGainerCard
        marketId="mg1"
        marketName="Will SOL flip ETH in daily volume?"
        pointsGained={3200}
        gainPercent={42.5}
        agentName="Ares"
      />
      <TopLoserCard
        marketId="ml1"
        marketName="Will the Fed cut rates in Q1?"
        pointsLost={-1800}
        lossPercent={-23.4}
        agentName="Athena"
      />
    </>
  );
}
