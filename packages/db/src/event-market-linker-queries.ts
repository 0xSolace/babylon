/**
 * Reads for `EventMarketLinkerService` (world events ↔ prediction markets).
 *
 * **Why here:** Keeps `WorldEvent` / `Question` / `Market` SQL under `asSystem`.
 */

import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { asSystem } from './db';
import { markets } from './tables/markets';
import { questions } from './tables/questions';
import { worldEvents } from './tables/world-events';

export type EventLinkerMarketEventRow = {
  id: string;
  type: string;
  description: string;
  pointsToward: string | null;
  timestamp: Date;
};

export type EventLinkerQuestionRow = {
  id: string;
  text: string;
  questionNumber: number;
};

export type EventLinkerMarketSlice = {
  id: string;
  yesShares: unknown;
  noShares: unknown;
};

export async function fetchEventMarketLinkerPayloadForMarket(params: {
  questionNumber: number;
  lookbackDate: Date;
}): Promise<{
  events: EventLinkerMarketEventRow[];
  question: EventLinkerQuestionRow | null;
  market: EventLinkerMarketSlice | null;
}> {
  return asSystem(async (c) => {
    const evs = await c
      .select({
        id: worldEvents.id,
        type: worldEvents.eventType,
        description: worldEvents.description,
        pointsToward: worldEvents.pointsToward,
        timestamp: worldEvents.timestamp,
      })
      .from(worldEvents)
      .where(
        and(
          eq(worldEvents.relatedQuestion, params.questionNumber),
          gte(worldEvents.timestamp, params.lookbackDate)
        )
      )
      .orderBy(desc(worldEvents.timestamp))
      .limit(20);

    const [q] = await c
      .select({
        id: questions.id,
        text: questions.text,
        questionNumber: questions.questionNumber,
      })
      .from(questions)
      .where(eq(questions.questionNumber, params.questionNumber))
      .limit(1);

    if (!q) {
      return { events: evs, question: null, market: null };
    }

    const [m] = await c
      .select({
        id: markets.id,
        yesShares: markets.yesShares,
        noShares: markets.noShares,
      })
      .from(markets)
      .where(eq(markets.id, q.id))
      .limit(1);

    return { events: evs, question: q, market: m ?? null };
  }, 'event-market-linker-for-market');
}

export type EventLinkerSummaryEventRow = {
  eventId: string;
  eventType: string;
  description: string;
  pointsToward: string | null;
  relatedQuestion: number | null;
  timestamp: Date;
};

export type EventLinkerSummaryQuestionRow = {
  id: string;
  text: string;
  questionNumber: number;
  status: string | null;
};

export type EventLinkerSummaryMarketRow = {
  id: string;
  yesShares: unknown;
  noShares: unknown;
  resolved: boolean;
};

export async function fetchEventMarketLinkerSummariesPayload(params: {
  lookbackDate: Date;
}): Promise<{
  eventsWithQuestions: EventLinkerSummaryEventRow[];
  questionsWithEvents: EventLinkerSummaryQuestionRow[];
  marketsList: EventLinkerSummaryMarketRow[];
}> {
  return asSystem(async (c) => {
    const evs = await c
      .select({
        eventId: worldEvents.id,
        eventType: worldEvents.eventType,
        description: worldEvents.description,
        pointsToward: worldEvents.pointsToward,
        relatedQuestion: worldEvents.relatedQuestion,
        timestamp: worldEvents.timestamp,
      })
      .from(worldEvents)
      .where(
        and(
          gte(worldEvents.timestamp, params.lookbackDate),
          gte(worldEvents.relatedQuestion, 1)
        )
      )
      .orderBy(desc(worldEvents.timestamp))
      .limit(100);

    if (evs.length === 0) {
      return {
        eventsWithQuestions: evs,
        questionsWithEvents: [],
        marketsList: [],
      };
    }

    const eventsByQ = new Map<number, typeof evs>();
    for (const event of evs) {
      if (event.relatedQuestion === null) continue;
      const existing = eventsByQ.get(event.relatedQuestion) || [];
      existing.push(event);
      eventsByQ.set(event.relatedQuestion, existing);
    }

    const questionNumbers = Array.from(eventsByQ.keys());
    if (questionNumbers.length === 0) {
      return {
        eventsWithQuestions: evs,
        questionsWithEvents: [],
        marketsList: [],
      };
    }

    const qs = await c
      .select({
        id: questions.id,
        text: questions.text,
        questionNumber: questions.questionNumber,
        status: questions.status,
      })
      .from(questions)
      .where(
        and(
          eq(questions.status, 'active'),
          inArray(questions.questionNumber, questionNumbers)
        )
      )
      .limit(50);

    const qIds = qs.map((q) => q.id);
    if (qIds.length === 0) {
      return {
        eventsWithQuestions: evs,
        questionsWithEvents: qs,
        marketsList: [],
      };
    }

    const mks = await c
      .select({
        id: markets.id,
        yesShares: markets.yesShares,
        noShares: markets.noShares,
        resolved: markets.resolved,
      })
      .from(markets)
      .where(and(eq(markets.resolved, false), inArray(markets.id, qIds)))
      .limit(50);

    return {
      eventsWithQuestions: evs,
      questionsWithEvents: qs,
      marketsList: mks,
    };
  }, 'event-market-linker-summaries');
}
