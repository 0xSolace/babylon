/**
 * Actor Context Builder
 *
 * Single source of truth for assembling everything an NPC actor knows.
 * Replaces the fragmented context pipelines where posting, trading, and
 * engagement each built their own partial view of the world.
 *
 * Used by: FeedGenerator, MarketDecisionEngine, social engagement,
 * and any future actor action system.
 */

import {
  actorRelationships,
  and,
  db,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
  posts,
  questions,
  worldEvents,
} from '@babylon/db';
import { logger } from '@babylon/shared';
import type {
  EventContext,
  FeedPostContext,
  RelationshipContext,
} from '../types/market-context';
import {
  formatActorFinanceGuardrails,
  formatActorToneGuardrails,
} from '../utils/shared-utils';
import { getAvoidedPatternsContext } from './npc-anti-repetition-service';
import { NpcMemoryService } from './npc-memory-service';
import { StaticDataRegistry } from './static-data-registry';

export interface ActorContext {
  // Identity
  identity: {
    id: string;
    name: string;
    personality: string;
    voice: string;
    postStyle: string;
    postExamples: string[];
    domains: string[];
    ignoreTopics: string[];
    affiliations: string[];
    tier: string;
    description: string;
  };

  // What they know right now
  awareness: {
    recentPosts: FeedPostContext[];
    personalEvents: EventContext[];
    worldEvents: EventContext[];
    resolvedQuestions: Array<{ text: string; outcome: string }>;
    trendingTopics: string[];
  };

  // Relationships
  relationships: RelationshipContext[];

  // State
  state: {
    mood: string;
    memories: string;
    avoidPatterns: string;
  };

  // Per-actor rules
  rules: {
    ignoreTopicsRule: string;
    toneGuardrails: string;
    financeGuardrails: string;
  };
}

function resolveActorName(actorId: string): string {
  const actor = StaticDataRegistry.getActor(actorId);
  return actor?.name ?? actorId;
}

export class ActorContextBuilder {
  private memoryService = new NpcMemoryService();

  /**
   * Build complete context for an actor. One call, everything they need.
   */
  async buildContext(actorId: string): Promise<ActorContext | null> {
    const actor = StaticDataRegistry.getActor(actorId);
    if (!actor) {
      logger.warn('Actor not found', { actorId }, 'ActorContextBuilder');
      return null;
    }

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const affiliations = actor.affiliations || [];

    // Parallel fetch all data
    const [
      relevantPosts,
      personalEvents,
      recentWorldEvents,
      resolvedQs,
      actorRelations,
      memories,
    ] = await Promise.all([
      this.getRelevantPosts(actorId, affiliations, twoDaysAgo, now),
      this.getPersonalEvents(actorId, actor.name, now),
      this.getRecentWorldEvents(twoDaysAgo, now),
      this.getResolvedQuestions(),
      this.getRelationships(actorId),
      this.getMemories(actorId),
    ]);

    // Build per-actor rules
    const avoidPatterns = getAvoidedPatternsContext(actorId);
    const toneGuardrails = formatActorToneGuardrails(actor);
    const financeGuardrails = formatActorFinanceGuardrails(actor);
    const ignoreTopicsRule =
      actor.ignoreTopics && actor.ignoreTopics.length > 0
        ? `You never talk about: ${actor.ignoreTopics.join(', ')}`
        : '';

    return {
      identity: {
        id: actor.id,
        name: actor.name,
        personality: actor.personality || '',
        voice: actor.voice || '',
        postStyle: actor.postStyle || '',
        postExamples: actor.postExample || [],
        domains: actor.domain || [],
        ignoreTopics: actor.ignoreTopics || [],
        affiliations,
        tier: actor.tier || '',
        description: actor.description || '',
      },
      awareness: {
        recentPosts: relevantPosts,
        personalEvents,
        worldEvents: recentWorldEvents,
        resolvedQuestions: resolvedQs,
        trendingTopics: [],
      },
      relationships: actorRelations,
      state: {
        mood: 'neutral',
        memories,
        avoidPatterns,
      },
      rules: {
        ignoreTopicsRule,
        toneGuardrails,
        financeGuardrails,
      },
    };
  }

  private async getRelevantPosts(
    actorId: string,
    affiliations: string[],
    since: Date,
    now: Date
  ): Promise<FeedPostContext[]> {
    // Find related actors by affiliation
    const relatedActorIds: string[] = [];
    if (affiliations.length > 0) {
      for (const other of StaticDataRegistry.getAllActors()) {
        if (other.id === actorId) continue;
        if (other.affiliations?.some((a) => affiliations.includes(a))) {
          relatedActorIds.push(other.id);
        }
      }
    }

    // Fetch from related actors first, then fill with general
    let relevantPosts: (typeof posts.$inferSelect)[] = [];
    if (relatedActorIds.length > 0) {
      relevantPosts = await db
        .select()
        .from(posts)
        .where(
          and(
            isNull(posts.deletedAt),
            lte(posts.timestamp, now),
            gte(posts.timestamp, since),
            inArray(posts.authorId, relatedActorIds)
          )
        )
        .orderBy(desc(posts.timestamp))
        .limit(10);
    }

    const remainingSlots = 15 - relevantPosts.length;
    if (remainingSlots > 0) {
      const existingIds = new Set(relevantPosts.map((p) => p.id));
      const general = await db
        .select()
        .from(posts)
        .where(
          and(
            isNull(posts.deletedAt),
            lte(posts.timestamp, now),
            gte(posts.timestamp, since)
          )
        )
        .orderBy(desc(posts.timestamp))
        .limit(remainingSlots + relevantPosts.length);

      relevantPosts.push(
        ...general
          .filter((p) => !existingIds.has(p.id))
          .slice(0, remainingSlots)
      );
    }

    return relevantPosts.map((post) => ({
      author: post.authorId,
      authorName: resolveActorName(post.authorId),
      content:
        post.content.length > 500
          ? post.content.slice(0, 500) + '...'
          : post.content,
      timestamp: post.timestamp.toISOString(),
      articleTitle: post.articleTitle || undefined,
    }));
  }

  private async getPersonalEvents(
    actorId: string,
    actorName: string,
    now: Date
  ): Promise<EventContext[]> {
    const events = await db
      .select()
      .from(worldEvents)
      .where(lte(worldEvents.timestamp, now))
      .orderBy(desc(worldEvents.timestamp))
      .limit(50);

    return events
      .filter((e) => {
        const actors = e.actors as string[] | null;
        return actors?.includes(actorId) || actors?.includes(actorName);
      })
      .slice(0, 10)
      .map((e) => ({
        type: e.eventType,
        description:
          e.description.length > 300
            ? e.description.slice(0, 300) + '...'
            : e.description,
        timestamp: e.timestamp.toISOString(),
        relatedQuestion: e.relatedQuestion || undefined,
        pointsToward: e.pointsToward || undefined,
      }));
  }

  private async getRecentWorldEvents(
    since: Date,
    now: Date
  ): Promise<EventContext[]> {
    const events = await db
      .select()
      .from(worldEvents)
      .where(
        and(lte(worldEvents.timestamp, now), gte(worldEvents.timestamp, since))
      )
      .orderBy(desc(worldEvents.timestamp))
      .limit(20);

    return events.map((e) => ({
      type: e.eventType,
      description:
        e.description.length > 300
          ? e.description.slice(0, 300) + '...'
          : e.description,
      timestamp: e.timestamp.toISOString(),
      relatedQuestion: e.relatedQuestion || undefined,
      pointsToward: e.pointsToward || undefined,
    }));
  }

  private async getResolvedQuestions(): Promise<
    Array<{ text: string; outcome: string }>
  > {
    const resolved = await db
      .select()
      .from(questions)
      .where(eq(questions.status, 'resolved'))
      .orderBy(desc(questions.resolutionDate))
      .limit(10);

    return resolved
      .filter((q) => q.resolvedOutcome != null)
      .map((q) => ({
        text: q.text,
        outcome: q.resolvedOutcome ? 'YES' : 'NO',
      }));
  }

  private async getRelationships(
    actorId: string
  ): Promise<RelationshipContext[]> {
    const rels = await db
      .select()
      .from(actorRelationships)
      .where(
        or(
          eq(actorRelationships.actor1Id, actorId),
          eq(actorRelationships.actor2Id, actorId)
        )
      )
      .limit(10);

    return rels.map((r) => {
      const otherId = r.actor1Id === actorId ? r.actor2Id : r.actor1Id;
      return {
        actorId: otherId,
        actorName: resolveActorName(otherId),
        relationshipType: r.relationshipType || 'acquaintance',
        strength: r.strength ?? 0.5,
        sentiment: r.sentiment ?? 0,
        history: r.history || undefined,
      };
    });
  }

  private async getMemories(actorId: string): Promise<string> {
    const memories = await this.memoryService.getRecentMemories(actorId, 8);
    return this.memoryService.formatMemoriesForPrompt(memories);
  }
}

export const actorContextBuilder = new ActorContextBuilder();
