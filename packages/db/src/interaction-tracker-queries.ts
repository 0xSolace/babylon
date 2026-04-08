/**
 * Inserts for `InteractionTracker` (NPC–NPC interaction log).
 *
 * **Why here:** Keeps `npcInteractions` writes under `asSystem`.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { asSystem } from './db';
import { npcInteractions } from './tables/npc-interactions';
import type { InputJsonValue } from './types';

export async function insertNpcInteractionRow(params: {
  actor1Id: string;
  actor2Id: string;
  interactionType: string;
  sentiment: number;
  context: string;
  metadata: InputJsonValue;
  timestamp: Date;
  traceLabel:
    | 'interaction-tracker-post-mention'
    | 'interaction-tracker-reply'
    | 'interaction-tracker-article-mention'
    | 'interaction-tracker-event-involvement';
}): Promise<void> {
  const { traceLabel, ...row } = params;
  await asSystem(
    async (c) =>
      c.insert(npcInteractions).values({
        id: await generateSnowflakeId(),
        actor1Id: row.actor1Id,
        actor2Id: row.actor2Id,
        interactionType: row.interactionType,
        sentiment: row.sentiment,
        context: row.context,
        metadata: row.metadata,
        timestamp: row.timestamp,
      }),
    traceLabel
  );
}
