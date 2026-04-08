/**
 * `ActorRelationship` and `NPCInteraction` reads/writes for `RelationshipEvolutionEngine`.
 *
 * **Why here:** Keeps evolution SQL under `asSystem`. LLM prompts and static registry mapping stay in engine.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { and, desc, eq, gte, or } from 'drizzle-orm';
import { asSystem } from './db';
import type { ActorRelationship } from './tables/actor-relationships';
import { actorRelationships } from './tables/actor-relationships';
import type { NPCInteraction } from './tables/npc-interactions';
import { npcInteractions } from './tables/npc-interactions';

function bidirectionalPairCondition(actor1Id: string, actor2Id: string) {
  return or(
    and(
      eq(actorRelationships.actor1Id, actor1Id),
      eq(actorRelationships.actor2Id, actor2Id)
    ),
    and(
      eq(actorRelationships.actor1Id, actor2Id),
      eq(actorRelationships.actor2Id, actor1Id)
    )
  );
}

export async function fetchActorRelationshipBidirectional(
  actor1Id: string,
  actor2Id: string,
  traceLabel:
    | 'relationship-engine-llm-path-existing'
    | 'relationship-engine-get-relationship'
    | 'npc-social-pair-sentiment'
    | 'npc-social-relationship-prompt'
    | 'npc-social-infer-sentiment'
    | 'post-gen-discourse-relationship'
): Promise<ActorRelationship | undefined> {
  const [row] = await asSystem(
    async (c) =>
      c
        .select()
        .from(actorRelationships)
        .where(bidirectionalPairCondition(actor1Id, actor2Id))
        .limit(1),
    traceLabel
  );

  return row;
}

export async function insertActorRelationshipIfMissing(params: {
  actor1Id: string;
  actor2Id: string;
  relationshipType: string;
  strength: number;
  sentiment: number;
  history: string;
}): Promise<void> {
  const { actor1Id, actor2Id, relationshipType, strength, sentiment, history } =
    params;

  await asSystem(async (c) => {
    const [existingRel] = await c
      .select({ id: actorRelationships.id })
      .from(actorRelationships)
      .where(bidirectionalPairCondition(actor1Id, actor2Id))
      .limit(1);

    if (!existingRel) {
      await c.insert(actorRelationships).values({
        id: await generateSnowflakeId(),
        actor1Id,
        actor2Id,
        relationshipType,
        strength,
        sentiment,
        history,
        isPublic: true,
        updatedAt: new Date(),
        interactionCount: 0,
        evolutionCount: 0,
      });
    }
  }, 'relationship-engine-create-initial');
}

export async function insertRelationshipEvolutionNpcInteraction(params: {
  actor1Id: string;
  actor2Id: string;
  interactionType: string;
  sentiment: number;
  context: string;
}): Promise<void> {
  const sorted = [params.actor1Id, params.actor2Id].sort();
  const [id1, id2] = sorted as [string, string];

  await asSystem(
    async (c) =>
      c.insert(npcInteractions).values({
        id: await generateSnowflakeId(),
        actor1Id: id1,
        actor2Id: id2,
        interactionType: params.interactionType,
        sentiment: params.sentiment,
        context: params.context,
        timestamp: new Date(),
      }),
    'relationship-engine-track-interaction'
  );
}

export async function listRecentNpcInteractionsSince(
  since: Date,
  limit: number
): Promise<NPCInteraction[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(npcInteractions)
        .where(gte(npcInteractions.timestamp, since))
        .orderBy(desc(npcInteractions.timestamp))
        .limit(limit),
    'relationship-engine-recent-interactions'
  );
}

export async function fetchActorRelationshipOrdered(
  actor1Id: string,
  actor2Id: string
): Promise<ActorRelationship | undefined> {
  const [row] = await asSystem(
    async (c) =>
      c
        .select()
        .from(actorRelationships)
        .where(
          and(
            eq(actorRelationships.actor1Id, actor1Id),
            eq(actorRelationships.actor2Id, actor2Id)
          )
        )
        .limit(1),
    'relationship-engine-analyze-existing'
  );

  return row;
}

export async function updateActorRelationshipEvolved(params: {
  id: string;
  history: string;
  relationshipType: string;
  sentiment: number;
  strength: number;
  lastInteraction: Date;
  interactionCount: number;
  evolutionCount: number;
}): Promise<void> {
  const {
    id,
    history,
    relationshipType,
    sentiment,
    strength,
    lastInteraction,
    interactionCount,
    evolutionCount,
  } = params;

  await asSystem(
    async (c) =>
      c
        .update(actorRelationships)
        .set({
          history,
          relationshipType,
          sentiment,
          strength,
          lastInteraction,
          interactionCount,
          evolutionCount,
          updatedAt: new Date(),
        })
        .where(eq(actorRelationships.id, id)),
    'relationship-engine-evolve-update'
  );
}

export async function insertActorRelationshipEvolved(params: {
  actor1Id: string;
  actor2Id: string;
  relationshipType: string;
  strength: number;
  sentiment: number;
  history: string;
  lastInteraction: Date;
  interactionCount: number;
}): Promise<void> {
  const {
    actor1Id,
    actor2Id,
    relationshipType,
    strength,
    sentiment,
    history,
    lastInteraction,
    interactionCount,
  } = params;

  await asSystem(
    async (c) =>
      c.insert(actorRelationships).values({
        id: await generateSnowflakeId(),
        actor1Id,
        actor2Id,
        relationshipType,
        strength,
        sentiment,
        history,
        isPublic: true,
        lastInteraction,
        interactionCount,
        evolutionCount: 0,
        updatedAt: new Date(),
      }),
    'relationship-engine-evolve-insert'
  );
}

export async function listActorRelationshipsTopByStrengthForPrompt(
  actorId: string,
  limit: number
): Promise<ActorRelationship[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(actorRelationships)
        .where(
          or(
            eq(actorRelationships.actor1Id, actorId),
            eq(actorRelationships.actor2Id, actorId)
          )
        )
        .orderBy(desc(actorRelationships.strength))
        .limit(limit),
    'relationship-engine-context-for-actor'
  );
}

export async function listActorRelationshipsForActor(
  actorId: string
): Promise<ActorRelationship[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(actorRelationships)
        .where(
          or(
            eq(actorRelationships.actor1Id, actorId),
            eq(actorRelationships.actor2Id, actorId)
          )
        ),
    'relationship-engine-get-actor-relationships'
  );
}
