#!/usr/bin/env bun

/**
 * Core World Simulation Runner
 *
 * Executes the real core-world generation pipeline in-process, without a web
 * server and without user agents. It captures prompt inputs/outputs, runs the
 * content-producing cron jobs, builds the public feed surfaces, and writes a
 * report bundle under runs/core-simulations/.
 *
 * Scope:
 * - world facts / RSS / parodies / daily topic
 * - game tick
 * - markets tick
 * - NPC tick
 * - organization tick
 * - article tick
 * - breaking news / trending widgets
 * - stories + for-you feed assembly (public, no user personalization)
 *
 * Explicitly excluded:
 * - agent-tick (user/external agents)
 */

import 'dotenv/config';

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  and,
  closeDatabase,
  db,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  llmCallLogs,
  parodyHeadlines,
  posts,
  predictionPriceHistories,
  questions,
  rssFeedSources,
  rssHeadlines,
  stockPrices,
  tags,
  timeframedMarkets,
  trajectories,
  trendingTags,
  worldEvents,
  worldFacts,
} from '@babylon/db';
import {
  bootstrapGameIfNeeded,
  executeGameTick,
  StaticDataRegistry,
} from '@babylon/engine';
import { logger } from '@babylon/shared';
import { Actions } from '../packages/agents/src/autonomous/templates/multi-step-decision';
import {
  getLLMCallCallback,
  type LLMCallInput,
  setLLMCallCallback,
} from '../packages/engine/src/dag-trace';

type JsonRecord = Record<string, unknown>;

interface JobArtifact {
  name: string;
  cycle: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  success: boolean;
  statusCode?: number;
  body?: unknown;
  error?: string;
}

interface TextItem {
  id: string;
  text: string;
}

interface PromptCallArtifact extends LLMCallInput {
  capturedAt: string;
  source: 'engine' | 'npc';
  actionType?: string;
  trajectoryId?: string;
  agentId?: string;
}

interface ActionAttemptRecord {
  trajectoryId: string;
  agentId: string;
  finalStatus: string;
  stepId: string;
  stepNumber: number;
  timestamp: number;
  actionType: string;
  success: boolean;
  error?: string;
  reasoning?: string;
  result?: JsonRecord;
}

interface TrajectoryAudit {
  trajectories: Array<{
    id: string;
    trajectoryId: string;
    agentId: string;
    createdAt: string;
    finalStatus: string;
    episodeLength: number;
    totalReward: number;
    tradesExecuted: number | null;
    postsCreated: number | null;
  }>;
  llmCalls: PromptCallArtifact[];
  actionAttempts: ActionAttemptRecord[];
  actionSummary: {
    totalAttempts: number;
    totalSuccesses: number;
    totalFailures: number;
    byActionType: Array<{
      actionType: string;
      attempts: number;
      successes: number;
      failures: number;
      uniqueAgents: number;
      exampleErrors: string[];
    }>;
    unusedCoreActions: string[];
  };
}

interface CycleSnapshot {
  counts: {
    posts: number;
    orgPosts: number;
    actorPosts: number;
    articlePosts: number;
    events: number;
    questions: number;
    activeTimeframedMarkets: number;
    rssHeadlines: number;
    parodyHeadlines: number;
    worldFacts: number;
    predictionPriceHistoryRows: number;
    stockPriceRows: number;
  };
  samples: {
    posts: Array<{
      id: string;
      authorId: string;
      content: string;
      type: string | null;
      articleTitle: string | null;
      category: string | null;
      createdAt: Date;
      timestamp: Date | null;
      relatedQuestion: string | null;
    }>;
    events: Array<{
      id: string;
      eventType: string;
      description: string;
      actors: string[] | null;
      relatedQuestion: string | null;
      timestamp: Date;
      createdAt: Date;
    }>;
    questions: Array<{
      id: string;
      questionNumber: number;
      text: string;
      status: string;
      topicKey: string | null;
      topicLabel: string | null;
      createdAt: Date;
      resolutionDate: Date | null;
    }>;
    headlines: Array<{
      id: string;
      title: string;
      publishedAt: Date | null;
      fetchedAt: Date;
    }>;
    parodies: Array<{
      id: string;
      originalTitle: string;
      parodyTitle: string;
      generatedAt: Date;
    }>;
    worldFacts: Array<{
      id: string;
      category: string;
      value: string;
      source: string | null;
      createdAt: Date;
    }>;
    predictionPriceHistory: Array<{
      id: string;
      marketId: string;
      eventType: string;
      source: string | null;
      createdAt: Date;
      yesPrice: string | null;
      noPrice: string | null;
    }>;
    stockPrices: Array<{
      id: string;
      organizationId: string;
      price: string;
      changePercent: string | null;
      volume: string | null;
      timestamp: Date;
    }>;
  };
  duplicateStats: {
    questionTexts: ReturnType<typeof buildDuplicateStats>;
    eventDescriptions: ReturnType<typeof buildDuplicateStats>;
    postBodies: ReturnType<typeof buildDuplicateStats>;
    articleTitles: ReturnType<typeof buildDuplicateStats>;
    activeMarketQuestions: ReturnType<typeof buildDuplicateStats>;
  };
  timeframeBreakdown: Record<string, number>;
}

const CORE_NPC_ACTIONS = [
  Actions.TRADE,
  Actions.POST,
  Actions.COMMENT,
  Actions.REPLY_COMMENT,
  Actions.LIKE,
  Actions.REPOST,
] as const;

const DAG_TRACE_DIR = path.resolve(process.cwd(), 'runs', 'dag-traces');

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonArray(value: string): unknown[] {
  const parsed = safeJsonParse(value);
  return Array.isArray(parsed) ? parsed : [];
}

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'shall',
  'can',
  'to',
  'of',
  'in',
  'for',
  'on',
  'with',
  'at',
  'by',
  'from',
  'as',
  'and',
  'but',
  'or',
  'not',
  'so',
  'if',
  'when',
  'where',
  'how',
  'what',
  'which',
  'who',
  'this',
  'that',
  'these',
  'those',
  'i',
  'me',
  'my',
  'we',
  'us',
  'our',
  'you',
  'your',
  'he',
  'him',
  'his',
  'she',
  'her',
  'it',
  'its',
  'they',
  'them',
  'their',
  'about',
  'up',
  'out',
  'then',
  'here',
  'there',
  'also',
  'over',
  'new',
  'said',
  'says',
  'like',
  'well',
  'back',
  'even',
  'still',
  'way',
  'just',
  'into',
  'than',
  'after',
  'before',
]);

const { values: args } = parseArgs({
  options: {
    cycles: { type: 'string', default: '1' },
    out: { type: 'string', default: '' },
    rss: { type: 'string', default: 'snapshot' },
    'npc-trade-probability': { type: 'string', default: '0.1' },
    help: { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (args.help) {
  console.log(`Usage:
  bun run scripts/run-core-world-simulation.ts [options]

Options:
  --cycles <n>                  Number of back-to-back simulation cycles to run (default: 1)
  --rss <mode>                  snapshot | live (default: snapshot)
  --npc-trade-probability <p>   Simulation-only NPC trading probability (default: 0.1)
  --out <path>                  Output directory (default: runs/core-simulations/<timestamp>)
  --help                        Show this message
`);
  process.exit(0);
}

const cycles = Math.max(1, Number.parseInt(args.cycles, 10) || 1);
const rssMode = args.rss === 'live' ? 'live' : 'snapshot';
const npcTradeProbability = Math.min(
  1,
  Math.max(0, Number.parseFloat(args['npc-trade-probability']) || 0.1)
);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir =
  args.out && args.out.trim().length > 0
    ? path.resolve(args.out)
    : path.resolve(process.cwd(), 'runs', 'core-simulations', runId);
const jobsDir = path.join(outputDir, 'jobs');
const cycleDir = path.join(outputDir, 'cycles');
const promptsDir = path.join(outputDir, 'prompts');
const feedsDir = path.join(outputDir, 'feeds');
const widgetsDir = path.join(outputDir, 'widgets');
const rssCacheDir = path.join(outputDir, 'rss-cache');

mkdirSync(outputDir, { recursive: true });
mkdirSync(jobsDir, { recursive: true });
mkdirSync(cycleDir, { recursive: true });
mkdirSync(promptsDir, { recursive: true });
mkdirSync(feedsDir, { recursive: true });
mkdirSync(widgetsDir, { recursive: true });
mkdirSync(rssCacheDir, { recursive: true });

process.env.BABYLON_DAG_TRACE = 'true';
process.env.DEBUG_SAVE_PROMPTS = 'true';
process.env.GAME_START ??= 'true';
process.env.NODE_ENV ??= 'development';
process.env.VERCEL_ENV ??= 'production';
process.env.REDIRECT_CRON_STAGING = 'false';
process.env.NPC_TRADE_PROBABILITY = npcTradeProbability.toString();

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(' ')
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection++;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function buildDuplicateStats(items: TextItem[], threshold = 0.55) {
  const normalizedGroups = new Map<
    string,
    { ids: string[]; sample: string; count: number }
  >();

  for (const item of items) {
    const normalized = normalizeText(item.text);
    if (!normalized) continue;
    const existing = normalizedGroups.get(normalized);
    if (existing) {
      existing.ids.push(item.id);
      existing.count += 1;
      continue;
    }
    normalizedGroups.set(normalized, {
      ids: [item.id],
      sample: item.text,
      count: 1,
    });
  }

  const exactDuplicates = [...normalizedGroups.entries()]
    .filter(([, group]) => group.count > 1)
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 20)
    .map(([normalized, group]) => ({
      normalized,
      count: group.count,
      ids: group.ids,
      sample: group.sample,
    }));

  const tokenized = items.map((item) => ({
    ...item,
    tokens: tokenize(item.text),
  }));

  const similarPairs: Array<{
    leftId: string;
    rightId: string;
    score: number;
    leftText: string;
    rightText: string;
  }> = [];

  for (let index = 0; index < tokenized.length; index++) {
    const left = tokenized[index];
    if (!left) continue;
    for (let offset = index + 1; offset < tokenized.length; offset++) {
      const right = tokenized[offset];
      if (!right) continue;
      const score = jaccard(left.tokens, right.tokens);
      if (score < threshold) continue;
      similarPairs.push({
        leftId: left.id,
        rightId: right.id,
        score: Number(score.toFixed(3)),
        leftText: left.text,
        rightText: right.text,
      });
    }
  }

  similarPairs.sort((left, right) => right.score - left.score);

  return {
    total: items.length,
    exactDuplicateGroups: exactDuplicates,
    similarPairs: similarPairs.slice(0, 25),
  };
}

function excerpt(text: string, maxLength = 240): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildContextSignalCoverage(calls: PromptCallArtifact[]) {
  const signals = {
    worldFacts: /world facts|world context/i,
    recentEvents: /recent events|world events/i,
    dailyTopic: /daily topic|topic label|topic summary/i,
    headlines: /headline|rss|breaking news|parody/i,
    markets: /market data|prediction market|perp/i,
    actors: /actor|character|persona/i,
  };

  const coverage: Record<string, number> = {};

  for (const [key, pattern] of Object.entries(signals)) {
    const hitCount = calls.filter(
      (call) => pattern.test(call.systemPrompt) || pattern.test(call.userPrompt)
    ).length;
    coverage[key] =
      calls.length === 0 ? 0 : Number((hitCount / calls.length).toFixed(3));
  }

  return coverage;
}

function buildPromptAudit(calls: PromptCallArtifact[]) {
  const byPromptType = new Map<string, PromptCallArtifact[]>();
  for (const call of calls) {
    const existing = byPromptType.get(call.promptType);
    if (existing) {
      existing.push(call);
      continue;
    }
    byPromptType.set(call.promptType, [call]);
  }

  const promptTypes = [...byPromptType.entries()]
    .map(([promptType, group]) => {
      const normalizedInputs = new Map<string, number>();
      const normalizedOutputs = new Map<string, number>();
      for (const call of group) {
        const inputKey = normalizeText(call.userPrompt);
        const outputKey = normalizeText(call.rawResponse);
        normalizedInputs.set(
          inputKey,
          (normalizedInputs.get(inputKey) ?? 0) + 1
        );
        normalizedOutputs.set(
          outputKey,
          (normalizedOutputs.get(outputKey) ?? 0) + 1
        );
      }

      const repeatedInputs = [...normalizedInputs.values()].filter(
        (count) => count > 1
      );
      const repeatedOutputs = [...normalizedOutputs.values()].filter(
        (count) => count > 1
      );

      return {
        promptType,
        calls: group.length,
        successCount: group.filter((call) => call.success).length,
        errorCount: group.filter((call) => !call.success).length,
        avgInputTokens: Math.round(
          group.reduce((sum, call) => sum + call.inputTokens, 0) / group.length
        ),
        avgOutputTokens: Math.round(
          group.reduce((sum, call) => sum + call.outputTokens, 0) / group.length
        ),
        avgDurationMs: Math.round(
          group.reduce((sum, call) => sum + call.durationMs, 0) / group.length
        ),
        uniqueInputs: normalizedInputs.size,
        uniqueOutputs: normalizedOutputs.size,
        repeatedInputCalls: repeatedInputs.reduce(
          (sum, count) => sum + count,
          0
        ),
        repeatedOutputCalls: repeatedOutputs.reduce(
          (sum, count) => sum + count,
          0
        ),
        contextCoverage: buildContextSignalCoverage(group),
        examples: group.slice(0, 2).map((call) => ({
          capturedAt: call.capturedAt,
          success: call.success,
          inputTokens: call.inputTokens,
          outputTokens: call.outputTokens,
          userPromptExcerpt: excerpt(call.userPrompt, 500),
          rawResponseExcerpt: excerpt(call.rawResponse, 300),
        })),
      };
    })
    .sort((left, right) => right.calls - left.calls);

  const repeatedParagraphs = new Map<
    string,
    { count: number; promptTypes: Set<string>; sample: string }
  >();
  for (const call of calls) {
    const seenInCall = new Set<string>();
    const blocks = `${call.systemPrompt}\n\n${call.userPrompt}`
      .split(/\n\s*\n/g)
      .map((block) => block.trim())
      .filter((block) => block.length >= 80);

    for (const block of blocks) {
      const normalized = normalizeText(block);
      if (!normalized || seenInCall.has(normalized)) continue;
      seenInCall.add(normalized);
      const existing = repeatedParagraphs.get(normalized);
      if (existing) {
        existing.count += 1;
        existing.promptTypes.add(call.promptType);
        continue;
      }
      repeatedParagraphs.set(normalized, {
        count: 1,
        promptTypes: new Set([call.promptType]),
        sample: block,
      });
    }
  }

  const repeatedPromptBlocks = [...repeatedParagraphs.values()]
    .filter((value) => value.count >= 3)
    .sort((left, right) => right.count - left.count)
    .slice(0, 25)
    .map((value) => ({
      count: value.count,
      promptTypes: [...value.promptTypes].sort(),
      sample: excerpt(value.sample, 400),
    }));

  const warnings: string[] = [];
  const recommendations: string[] = [];
  for (const promptType of promptTypes) {
    if (promptType.calls >= 2 && promptType.uniqueInputs <= 1) {
      const message = `${promptType.promptType}: all captured inputs were identical across ${promptType.calls} calls`;
      warnings.push(message);
      recommendations.push(
        `${promptType.promptType}: repeated identical inputs suggest stale or missing context; trim duplicated boilerplate and inject fresher world/event state.`
      );
    }
    if (promptType.calls >= 2 && promptType.uniqueOutputs <= 1) {
      const message = `${promptType.promptType}: all captured outputs were identical across ${promptType.calls} calls`;
      warnings.push(message);
      recommendations.push(
        `${promptType.promptType}: repeated identical outputs suggest over-constrained prompting or missing differentiating context.`
      );
    }
    if (promptType.contextCoverage.worldFacts === 0) {
      const message = `${promptType.promptType}: no obvious world-facts/world-context signal was detected in captured prompts`;
      warnings.push(message);
      recommendations.push(
        `${promptType.promptType}: add explicit world-facts or recent-event grounding so outputs stay tied to the current news cycle.`
      );
    }
  }

  for (const block of repeatedPromptBlocks.slice(0, 10)) {
    if (block.promptTypes.length < 2) continue;
    recommendations.push(
      `Repeated prompt block across ${block.promptTypes.join(', ')}: move shared invariant instructions into a reusable character or system layer, and keep per-call prompts focused on changing state.`
    );
  }

  return {
    totalCalls: calls.length,
    successfulCalls: calls.filter((call) => call.success).length,
    failedCalls: calls.filter((call) => !call.success).length,
    promptTypes,
    repeatedPromptBlocks,
    warnings,
    recommendations: [...new Set(recommendations)],
  };
}

async function invokeHandler(
  label: string,
  cycle: number,
  handler: (request: Request) => Promise<Response>,
  request: Request
): Promise<JobArtifact> {
  const startedAt = new Date();
  try {
    const response = await handler(request);
    const completedAt = new Date();
    const bodyText = await response.text();
    const body = bodyText.length > 0 ? safeJsonParse(bodyText) : null;

    return {
      name: label,
      cycle,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      success: response.ok,
      statusCode: response.status,
      body,
    };
  } catch (error) {
    const completedAt = new Date();
    return {
      name: label,
      cycle,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function invokeCronRoute(
  modulePath: string,
  label: string,
  cycle: number,
  urlPath: string
): Promise<JobArtifact> {
  const module = (await import(modulePath)) as {
    POST: (request: Request) => Promise<Response>;
  };
  const request = new Request(`http://localhost${urlPath}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer development',
      'content-type': 'application/json',
      'user-agent': 'babylon-core-sim/1.0',
    },
  });

  return invokeHandler(label, cycle, module.POST, request);
}

async function invokeGetRoute(
  modulePath: string,
  label: string,
  urlPath: string
): Promise<JobArtifact> {
  const module = (await import(modulePath)) as {
    GET: (request: Request) => Promise<Response>;
  };
  const request = new Request(`http://localhost${urlPath}`, {
    method: 'GET',
    headers: {
      'user-agent': 'babylon-core-sim/1.0',
    },
  });

  return invokeHandler(label, 0, module.GET, request);
}

async function installRssFetchCache() {
  const originalFetch = globalThis.fetch.bind(globalThis);
  const sources: Array<{
    id: string;
    name: string;
    feedUrl: string;
  }> = await db
    .select({
      id: rssFeedSources.id,
      name: rssFeedSources.name,
      feedUrl: rssFeedSources.feedUrl,
    })
    .from(rssFeedSources)
    .where(eq(rssFeedSources.isActive, true));

  const sourceByUrl = new Map(
    sources.map((source) => [source.feedUrl, source])
  );

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const source = sourceByUrl.get(url);
    if (!source) {
      return originalFetch(input, init);
    }

    const cachePath = path.join(rssCacheDir, `${source.id}.json`);
    if (rssMode === 'snapshot' && statExists(cachePath)) {
      const cached = JSON.parse(readFileSync(cachePath, 'utf8')) as {
        status: number;
        headers: Record<string, string>;
        body: string;
        fetchedAt: string;
        url: string;
        sourceName: string;
      };
      return new Response(cached.body, {
        status: cached.status,
        headers: cached.headers,
      });
    }

    const response = await originalFetch(input, init);
    const body = await response.text();

    const cached = {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
      fetchedAt: new Date().toISOString(),
      url,
      sourceName: source.name,
    };
    writeJson(cachePath, cached);

    return new Response(body, {
      status: response.status,
      headers: response.headers,
    });
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function statExists(filePath: string): boolean {
  try {
    statSync(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectCycleSnapshot(since: Date) {
  const actorIds = new Set(
    StaticDataRegistry.getAllActors().map((actor) => actor.id)
  );
  const organizationIds = new Set(
    StaticDataRegistry.getAllOrganizations().map((org) => org.id)
  );

  const recentPosts: CycleSnapshot['samples']['posts'] = await db
    .select({
      id: posts.id,
      authorId: posts.authorId,
      content: posts.content,
      type: posts.type,
      articleTitle: posts.articleTitle,
      category: posts.category,
      createdAt: posts.createdAt,
      timestamp: posts.timestamp,
      relatedQuestion: posts.relatedQuestion,
    })
    .from(posts)
    .where(and(gte(posts.createdAt, since), isNull(posts.deletedAt)))
    .orderBy(desc(posts.createdAt))
    .limit(200);

  const recentEvents: CycleSnapshot['samples']['events'] = await db
    .select({
      id: worldEvents.id,
      eventType: worldEvents.eventType,
      description: worldEvents.description,
      actors: worldEvents.actors,
      relatedQuestion: worldEvents.relatedQuestion,
      timestamp: worldEvents.timestamp,
      createdAt: worldEvents.createdAt,
    })
    .from(worldEvents)
    .where(gte(worldEvents.createdAt, since))
    .orderBy(desc(worldEvents.createdAt))
    .limit(200);

  const recentQuestions: CycleSnapshot['samples']['questions'] = await db
    .select({
      id: questions.id,
      questionNumber: questions.questionNumber,
      text: questions.text,
      status: questions.status,
      topicKey: questions.topicKey,
      topicLabel: questions.topicLabel,
      createdAt: questions.createdAt,
      resolutionDate: questions.resolutionDate,
    })
    .from(questions)
    .where(gte(questions.createdAt, since))
    .orderBy(desc(questions.createdAt))
    .limit(200);

  const activeTimeframedMarkets: Array<{
    id: string;
    questionId: string | null;
    timeframe: string;
    granularTimeframe: string | null;
    topicKey: string | null;
    topicLabel: string | null;
    affiliatedActorIds: string[] | null;
    affiliatedOrgIds: string[] | null;
    startTime: Date;
    endTime: Date;
  }> = await db
    .select({
      id: timeframedMarkets.id,
      questionId: timeframedMarkets.questionId,
      timeframe: timeframedMarkets.timeframe,
      granularTimeframe: timeframedMarkets.granularTimeframe,
      topicKey: timeframedMarkets.topicKey,
      topicLabel: timeframedMarkets.topicLabel,
      affiliatedActorIds: timeframedMarkets.affiliatedActorIds,
      affiliatedOrgIds: timeframedMarkets.affiliatedOrgIds,
      startTime: timeframedMarkets.startTime,
      endTime: timeframedMarkets.endTime,
    })
    .from(timeframedMarkets)
    .where(
      and(
        eq(timeframedMarkets.isActive, true),
        eq(timeframedMarkets.isResolved, false)
      )
    )
    .orderBy(desc(timeframedMarkets.createdAt))
    .limit(200);

  const activeQuestionIds = activeTimeframedMarkets
    .map((market) => market.questionId)
    .filter((questionId): questionId is string => Boolean(questionId));

  const linkedQuestions: Array<{
    id: string;
    text: string;
    questionNumber: number;
  }> =
    activeQuestionIds.length > 0
      ? await db
          .select({
            id: questions.id,
            text: questions.text,
            questionNumber: questions.questionNumber,
          })
          .from(questions)
          .where(inArray(questions.id, activeQuestionIds))
      : [];

  const linkedQuestionById = new Map(
    linkedQuestions.map((question) => [question.id, question])
  );

  const recentHeadlines: CycleSnapshot['samples']['headlines'] = await db
    .select({
      id: rssHeadlines.id,
      title: rssHeadlines.title,
      publishedAt: rssHeadlines.publishedAt,
      fetchedAt: rssHeadlines.fetchedAt,
    })
    .from(rssHeadlines)
    .where(gte(rssHeadlines.fetchedAt, since))
    .orderBy(desc(rssHeadlines.fetchedAt))
    .limit(100);

  const recentParodies: CycleSnapshot['samples']['parodies'] = await db
    .select({
      id: parodyHeadlines.id,
      originalTitle: parodyHeadlines.originalTitle,
      parodyTitle: parodyHeadlines.parodyTitle,
      generatedAt: parodyHeadlines.generatedAt,
    })
    .from(parodyHeadlines)
    .where(gte(parodyHeadlines.generatedAt, since))
    .orderBy(desc(parodyHeadlines.generatedAt))
    .limit(100);

  const recentFacts: CycleSnapshot['samples']['worldFacts'] = await db
    .select({
      id: worldFacts.id,
      category: worldFacts.category,
      value: worldFacts.value,
      source: worldFacts.source,
      createdAt: worldFacts.createdAt,
    })
    .from(worldFacts)
    .where(gte(worldFacts.createdAt, since))
    .orderBy(desc(worldFacts.createdAt))
    .limit(200);

  const recentPredictionHistory: CycleSnapshot['samples']['predictionPriceHistory'] =
    await db
      .select({
        id: predictionPriceHistories.id,
        marketId: predictionPriceHistories.marketId,
        eventType: predictionPriceHistories.eventType,
        source: predictionPriceHistories.source,
        createdAt: predictionPriceHistories.createdAt,
        yesPrice: predictionPriceHistories.yesPrice,
        noPrice: predictionPriceHistories.noPrice,
      })
      .from(predictionPriceHistories)
      .where(gte(predictionPriceHistories.createdAt, since))
      .orderBy(desc(predictionPriceHistories.createdAt))
      .limit(200);

  const recentStockPrices: CycleSnapshot['samples']['stockPrices'] = await db
    .select({
      id: stockPrices.id,
      organizationId: stockPrices.organizationId,
      price: stockPrices.price,
      changePercent: stockPrices.changePercent,
      volume: stockPrices.volume,
      timestamp: stockPrices.timestamp,
    })
    .from(stockPrices)
    .where(gte(stockPrices.timestamp, since))
    .orderBy(desc(stockPrices.timestamp))
    .limit(200);

  const orgPosts = recentPosts.filter((post) =>
    organizationIds.has(post.authorId)
  );
  const actorPosts = recentPosts.filter((post) => actorIds.has(post.authorId));
  const articlePosts = recentPosts.filter(
    (post) =>
      post.type === 'article' ||
      post.articleTitle !== null ||
      post.category === 'article'
  );

  return {
    counts: {
      posts: recentPosts.length,
      orgPosts: orgPosts.length,
      actorPosts: actorPosts.length,
      articlePosts: articlePosts.length,
      events: recentEvents.length,
      questions: recentQuestions.length,
      activeTimeframedMarkets: activeTimeframedMarkets.length,
      rssHeadlines: recentHeadlines.length,
      parodyHeadlines: recentParodies.length,
      worldFacts: recentFacts.length,
      predictionPriceHistoryRows: recentPredictionHistory.length,
      stockPriceRows: recentStockPrices.length,
    },
    samples: {
      posts: recentPosts.slice(0, 20),
      events: recentEvents.slice(0, 20),
      questions: recentQuestions.slice(0, 20),
      headlines: recentHeadlines.slice(0, 20),
      parodies: recentParodies.slice(0, 20),
      worldFacts: recentFacts.slice(0, 20),
      predictionPriceHistory: recentPredictionHistory.slice(0, 20),
      stockPrices: recentStockPrices.slice(0, 20),
    },
    duplicateStats: {
      questionTexts: buildDuplicateStats(
        recentQuestions.map((question) => ({
          id: question.id,
          text: question.text,
        }))
      ),
      eventDescriptions: buildDuplicateStats(
        recentEvents.map((event) => ({
          id: event.id,
          text: event.description,
        }))
      ),
      postBodies: buildDuplicateStats(
        recentPosts.map((post) => ({
          id: post.id,
          text: post.content,
        }))
      ),
      articleTitles: buildDuplicateStats(
        articlePosts
          .filter((post) => post.articleTitle)
          .map((post) => ({
            id: post.id,
            text: post.articleTitle ?? '',
          }))
      ),
      activeMarketQuestions: buildDuplicateStats(
        activeTimeframedMarkets.map((market) => ({
          id: market.id,
          text: linkedQuestionById.get(market.questionId ?? '')?.text ?? '',
        }))
      ),
    },
    timeframeBreakdown: activeTimeframedMarkets.reduce<Record<string, number>>(
      (acc, market) => {
        const key = market.granularTimeframe ?? market.timeframe;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {}
    ),
  };
}

async function collectTrendingTagSnapshot() {
  const latestTrending: Array<{
    id: string;
    tagId: string;
    score: string;
    postCount: number;
    rank: number;
    calculatedAt: Date;
    tagDisplayName: string | null;
    tagName: string | null;
    category: string | null;
  }> = await db
    .select({
      id: trendingTags.id,
      tagId: trendingTags.tagId,
      score: trendingTags.score,
      postCount: trendingTags.postCount,
      rank: trendingTags.rank,
      calculatedAt: trendingTags.calculatedAt,
      tagDisplayName: tags.displayName,
      tagName: tags.name,
      category: tags.category,
    })
    .from(trendingTags)
    .leftJoin(tags, eq(trendingTags.tagId, tags.id))
    .orderBy(trendingTags.rank)
    .limit(20);

  return latestTrending;
}

async function collectTrajectoryAudit(since: Date): Promise<TrajectoryAudit> {
  const trajectoryRows: Array<{
    id: string;
    trajectoryId: string;
    agentId: string;
    createdAt: Date;
    finalStatus: string;
    episodeLength: number;
    totalReward: number;
    tradesExecuted: number | null;
    postsCreated: number | null;
    stepsJson: string;
  }> = await db
    .select({
      id: trajectories.id,
      trajectoryId: trajectories.trajectoryId,
      agentId: trajectories.agentId,
      createdAt: trajectories.createdAt,
      finalStatus: trajectories.finalStatus,
      episodeLength: trajectories.episodeLength,
      totalReward: trajectories.totalReward,
      tradesExecuted: trajectories.tradesExecuted,
      postsCreated: trajectories.postsCreated,
      stepsJson: trajectories.stepsJson,
    })
    .from(trajectories)
    .where(gte(trajectories.createdAt, since))
    .orderBy(desc(trajectories.createdAt))
    .limit(500);

  const llmLogRows: Array<{
    id: string;
    trajectoryId: string;
    stepId: string;
    callId: string;
    createdAt: Date;
    latencyMs: number | null;
    model: string;
    purpose: string;
    actionType: string | null;
    systemPrompt: string;
    userPrompt: string;
    response: string;
    promptTokens: number | null;
    completionTokens: number | null;
  }> = await db
    .select({
      id: llmCallLogs.id,
      trajectoryId: llmCallLogs.trajectoryId,
      stepId: llmCallLogs.stepId,
      callId: llmCallLogs.callId,
      createdAt: llmCallLogs.createdAt,
      latencyMs: llmCallLogs.latencyMs,
      model: llmCallLogs.model,
      purpose: llmCallLogs.purpose,
      actionType: llmCallLogs.actionType,
      systemPrompt: llmCallLogs.systemPrompt,
      userPrompt: llmCallLogs.userPrompt,
      response: llmCallLogs.response,
      promptTokens: llmCallLogs.promptTokens,
      completionTokens: llmCallLogs.completionTokens,
    })
    .from(llmCallLogs)
    .where(gte(llmCallLogs.createdAt, since))
    .orderBy(desc(llmCallLogs.createdAt))
    .limit(1000);

  const trajectoryById = new Map(
    trajectoryRows.map((row) => [row.trajectoryId, row])
  );

  const actionAttempts: ActionAttemptRecord[] = [];
  for (const row of trajectoryRows) {
    const steps = parseJsonArray(row.stepsJson);
    for (const rawStep of steps) {
      if (!isJsonRecord(rawStep)) continue;
      const action = isJsonRecord(rawStep.action) ? rawStep.action : null;
      if (!action || typeof action.actionType !== 'string') continue;

      actionAttempts.push({
        trajectoryId: row.trajectoryId,
        agentId: row.agentId,
        finalStatus: row.finalStatus,
        stepId: typeof rawStep.stepId === 'string' ? rawStep.stepId : '',
        stepNumber:
          typeof rawStep.stepNumber === 'number' ? rawStep.stepNumber : 0,
        timestamp:
          typeof rawStep.timestamp === 'number' ? rawStep.timestamp : 0,
        actionType: action.actionType,
        success: action.success === true,
        error: typeof action.error === 'string' ? action.error : undefined,
        reasoning:
          typeof action.reasoning === 'string' ? action.reasoning : undefined,
        result: isJsonRecord(action.result) ? action.result : undefined,
      });
    }
  }

  const byActionType = new Map<
    string,
    {
      attempts: number;
      successes: number;
      failures: number;
      uniqueAgents: Set<string>;
      exampleErrors: Set<string>;
    }
  >();

  for (const attempt of actionAttempts) {
    const existing = byActionType.get(attempt.actionType) ?? {
      attempts: 0,
      successes: 0,
      failures: 0,
      uniqueAgents: new Set<string>(),
      exampleErrors: new Set<string>(),
    };
    existing.attempts += 1;
    existing.uniqueAgents.add(attempt.agentId);
    if (attempt.success) existing.successes += 1;
    else existing.failures += 1;
    if (attempt.error) existing.exampleErrors.add(attempt.error);
    byActionType.set(attempt.actionType, existing);
  }

  const llmCalls: PromptCallArtifact[] = llmLogRows.map((row) => ({
    promptType: row.actionType ?? row.purpose,
    provider: 'trajectory',
    model: row.model,
    format: 'text',
    temperature: 0,
    maxTokens: row.completionTokens ?? 0,
    systemPrompt: row.systemPrompt,
    userPrompt: row.userPrompt,
    rawResponse: row.response,
    parsedResponse: safeJsonParse(row.response),
    inputTokens: row.promptTokens ?? 0,
    outputTokens: row.completionTokens ?? 0,
    totalTokens: (row.promptTokens ?? 0) + (row.completionTokens ?? 0),
    durationMs: row.latencyMs ?? 0,
    success: true,
    capturedAt: row.createdAt.toISOString(),
    source: 'npc',
    actionType: row.actionType ?? undefined,
    trajectoryId: row.trajectoryId,
    agentId: trajectoryById.get(row.trajectoryId)?.agentId,
  }));

  return {
    trajectories: trajectoryRows.map((row) => ({
      id: row.id,
      trajectoryId: row.trajectoryId,
      agentId: row.agentId,
      createdAt: row.createdAt.toISOString(),
      finalStatus: row.finalStatus,
      episodeLength: row.episodeLength,
      totalReward: row.totalReward,
      tradesExecuted: row.tradesExecuted,
      postsCreated: row.postsCreated,
    })),
    llmCalls,
    actionAttempts,
    actionSummary: {
      totalAttempts: actionAttempts.length,
      totalSuccesses: actionAttempts.filter((attempt) => attempt.success)
        .length,
      totalFailures: actionAttempts.filter((attempt) => !attempt.success)
        .length,
      byActionType: [...byActionType.entries()]
        .map(([actionType, value]) => ({
          actionType,
          attempts: value.attempts,
          successes: value.successes,
          failures: value.failures,
          uniqueAgents: value.uniqueAgents.size,
          exampleErrors: [...value.exampleErrors].slice(0, 5),
        }))
        .sort((left, right) => right.attempts - left.attempts),
      unusedCoreActions: CORE_NPC_ACTIONS.filter(
        (actionType) => !byActionType.has(actionType)
      ),
    },
  };
}

function collectDagTraceDirectories(since: Date): string[] {
  if (!statExists(DAG_TRACE_DIR)) return [];

  return readdirSync(DAG_TRACE_DIR)
    .filter((entry) => entry.startsWith('tick-'))
    .map((entry) => path.join(DAG_TRACE_DIR, entry))
    .filter((entryPath) => {
      try {
        return statSync(entryPath).mtimeMs >= since.getTime();
      } catch {
        return false;
      }
    })
    .sort();
}

function getEmptyTrajectoryAudit(): TrajectoryAudit {
  return {
    trajectories: [],
    llmCalls: [],
    actionAttempts: [],
    actionSummary: {
      totalAttempts: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      byActionType: [],
      unusedCoreActions: [...CORE_NPC_ACTIONS],
    },
  };
}

function buildQuestionReport(cycleSnapshots: CycleSnapshot[]) {
  const questionsById = new Map<
    string,
    CycleSnapshot['samples']['questions'][number]
  >();
  for (const snapshot of cycleSnapshots) {
    for (const question of snapshot.samples.questions) {
      questionsById.set(question.id, question);
    }
  }

  const allQuestions = [...questionsById.values()];
  return {
    totalCreated: allQuestions.length,
    duplicates: buildDuplicateStats(
      allQuestions.map((question) => ({
        id: question.id,
        text: question.text,
      }))
    ),
    topicBreakdown: allQuestions.reduce<Record<string, number>>(
      (acc, question) => {
        const key = question.topicLabel ?? question.topicKey ?? 'unlabeled';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {}
    ),
    samples: allQuestions.slice(0, 25),
  };
}

function buildPredictionMarketReport(cycleSnapshots: CycleSnapshot[]) {
  const latestSnapshot = cycleSnapshots.at(-1);
  const historyRows = cycleSnapshots.flatMap(
    (snapshot) => snapshot.samples.predictionPriceHistory
  );
  const historyByMarket = new Map<
    string,
    Array<{
      createdAt: string;
      yesPrice: string | null;
      noPrice: string | null;
    }>
  >();

  for (const row of historyRows) {
    const existing = historyByMarket.get(row.marketId) ?? [];
    existing.push({
      createdAt: row.createdAt.toISOString(),
      yesPrice: row.yesPrice,
      noPrice: row.noPrice,
    });
    historyByMarket.set(row.marketId, existing);
  }

  return {
    activeMarketCount: latestSnapshot?.counts.activeTimeframedMarkets ?? 0,
    timeframeBreakdown: latestSnapshot?.timeframeBreakdown ?? {},
    duplicateQuestions: latestSnapshot?.duplicateStats
      .activeMarketQuestions ?? {
      total: 0,
      exactDuplicateGroups: [],
      similarPairs: [],
    },
    historyRows: historyRows.length,
    marketsWithMovement: historyByMarket.size,
    recentPriceHistory: [...historyByMarket.entries()]
      .slice(0, 25)
      .map(([marketId, rows]) => ({
        marketId,
        points: rows.slice(0, 10),
      })),
  };
}

function buildNewsReport(cycleSnapshots: CycleSnapshot[]) {
  const latestSnapshot = cycleSnapshots.at(-1);
  const articlePosts = cycleSnapshots.flatMap((snapshot) =>
    snapshot.samples.posts.filter(
      (post) =>
        post.type === 'article' ||
        post.articleTitle !== null ||
        post.category === 'article'
    )
  );

  return {
    postsCreated: cycleSnapshots.reduce(
      (sum, snapshot) => sum + snapshot.counts.posts,
      0
    ),
    articlePostsCreated: cycleSnapshots.reduce(
      (sum, snapshot) => sum + snapshot.counts.articlePosts,
      0
    ),
    rssHeadlinesFetched: cycleSnapshots.reduce(
      (sum, snapshot) => sum + snapshot.counts.rssHeadlines,
      0
    ),
    parodyHeadlinesGenerated: cycleSnapshots.reduce(
      (sum, snapshot) => sum + snapshot.counts.parodyHeadlines,
      0
    ),
    eventDuplicates: latestSnapshot?.duplicateStats.eventDescriptions ?? {
      total: 0,
      exactDuplicateGroups: [],
      similarPairs: [],
    },
    articleTitleDuplicates: buildDuplicateStats(
      articlePosts
        .filter((post) => post.articleTitle)
        .map((post) => ({
          id: post.id,
          text: post.articleTitle ?? '',
        }))
    ),
  };
}

function buildFeedReport(
  storiesFeed: {
    stories: Array<{
      storyKey: string;
      title?: string;
      posts: Array<{ id: string; content: string }>;
    }>;
  },
  forYouFeed: {
    stories: Array<{
      storyKey: string;
      title?: string;
      posts: Array<{ id: string; content: string }>;
    }>;
  }
) {
  const toStoryTextItems = (
    stories: Array<{
      storyKey: string;
      title?: string;
      posts: Array<{ id: string; content: string }>;
    }>
  ) =>
    stories.map((story) => ({
      id: story.storyKey,
      text:
        story.posts[0]?.content ??
        (typeof story.title === 'string' ? story.title : story.storyKey),
    }));

  return {
    stories: {
      count: storiesFeed.stories.length,
      duplicates: buildDuplicateStats(toStoryTextItems(storiesFeed.stories)),
    },
    forYou: {
      count: forYouFeed.stories.length,
      duplicates: buildDuplicateStats(toStoryTextItems(forYouFeed.stories)),
    },
  };
}

function buildWarnings(
  jobArtifacts: JobArtifact[],
  promptAudit: ReturnType<typeof buildPromptAudit>,
  cycleSnapshots: CycleSnapshot[],
  trajectoryAudit: TrajectoryAudit
) {
  const warnings = [...promptAudit.warnings];

  for (const job of jobArtifacts) {
    if (!job.success) {
      warnings.push(
        `${job.name}: request failed${job.error ? ` (${job.error})` : ''}`
      );
      continue;
    }
    const body = job.body;
    if (
      body &&
      typeof body === 'object' &&
      body !== null &&
      'skipped' in body
    ) {
      const skipped = (body as JsonRecord).skipped;
      if (skipped === true) {
        warnings.push(`${job.name}: skipped`);
      }
    }
  }

  for (const snapshot of cycleSnapshots) {
    const counts = snapshot.counts;
    if ((counts.questions ?? 0) === 0)
      warnings.push('No questions were created in a cycle snapshot');
    if ((counts.events ?? 0) === 0)
      warnings.push('No world events were created in a cycle snapshot');
    if ((counts.posts ?? 0) === 0)
      warnings.push('No posts were created in a cycle snapshot');
  }

  for (const actionType of trajectoryAudit.actionSummary.unusedCoreActions) {
    warnings.push(`Core NPC action not exercised during run: ${actionType}`);
  }

  if (trajectoryAudit.actionSummary.totalAttempts === 0) {
    warnings.push('No NPC action attempts were recorded in trajectories');
  }

  return [...new Set(warnings)];
}

function buildMarkdownReport(report: {
  runId: string;
  cycles: number;
  rssMode: string;
  jobs: JobArtifact[];
  promptAudit: ReturnType<typeof buildPromptAudit>;
  cycleSnapshots: CycleSnapshot[];
  trajectoryAudit: TrajectoryAudit;
  questionReport: ReturnType<typeof buildQuestionReport>;
  predictionMarketReport: ReturnType<typeof buildPredictionMarketReport>;
  newsReport: ReturnType<typeof buildNewsReport>;
  stories: {
    count: number;
    duplicates: ReturnType<typeof buildDuplicateStats>;
  };
  forYou: { count: number; duplicates: ReturnType<typeof buildDuplicateStats> };
  trendingWidget: JobArtifact;
  breakingNewsWidget: JobArtifact;
  warnings: string[];
}) {
  const lines: string[] = [];
  lines.push(`# Core World Simulation Report`);
  lines.push('');
  lines.push(`- Run ID: ${report.runId}`);
  lines.push(`- Cycles: ${report.cycles}`);
  lines.push(`- RSS mode: ${report.rssMode}`);
  lines.push(`- NPC trade probability: ${npcTradeProbability}`);
  lines.push(`- Prompt calls captured: ${report.promptAudit.totalCalls}`);
  lines.push('');

  lines.push(`## Jobs`);
  lines.push('');
  for (const job of report.jobs) {
    lines.push(
      `- ${job.name} (cycle ${job.cycle}): ${job.success ? 'ok' : 'failed'} in ${job.durationMs}ms`
    );
  }
  lines.push('');

  lines.push(`## Cycle Snapshots`);
  lines.push('');
  report.cycleSnapshots.forEach((snapshot, index) => {
    lines.push(`### Cycle ${index + 1}`);
    lines.push('');
    lines.push(`- Posts: ${snapshot.counts.posts}`);
    lines.push(`- Org posts: ${snapshot.counts.orgPosts}`);
    lines.push(`- Actor posts: ${snapshot.counts.actorPosts}`);
    lines.push(`- Article posts: ${snapshot.counts.articlePosts}`);
    lines.push(`- Events: ${snapshot.counts.events}`);
    lines.push(`- Questions: ${snapshot.counts.questions}`);
    lines.push(
      `- Active timeframed markets: ${snapshot.counts.activeTimeframedMarkets}`
    );
    lines.push(`- RSS headlines: ${snapshot.counts.rssHeadlines}`);
    lines.push(`- Parody headlines: ${snapshot.counts.parodyHeadlines}`);
    lines.push(`- World facts: ${snapshot.counts.worldFacts}`);
    lines.push('');
  });

  lines.push(`## Feed`);
  lines.push('');
  lines.push(`- Stories feed stories: ${report.stories.count}`);
  lines.push(
    `- Stories feed exact duplicate groups: ${report.stories.duplicates.exactDuplicateGroups.length}`
  );
  lines.push(`- For You feed stories: ${report.forYou.count}`);
  lines.push(
    `- For You exact duplicate groups: ${report.forYou.duplicates.exactDuplicateGroups.length}`
  );
  lines.push('');

  lines.push(`## Questions`);
  lines.push('');
  lines.push(`- Created: ${report.questionReport.totalCreated}`);
  lines.push(
    `- Exact duplicate groups: ${report.questionReport.duplicates.exactDuplicateGroups.length}`
  );
  lines.push(
    `- Similar question pairs: ${report.questionReport.duplicates.similarPairs.length}`
  );
  lines.push('');

  lines.push(`## Prediction Markets`);
  lines.push('');
  lines.push(
    `- Active markets: ${report.predictionMarketReport.activeMarketCount}`
  );
  lines.push(
    `- Price history rows captured: ${report.predictionMarketReport.historyRows}`
  );
  lines.push(
    `- Markets with movement: ${report.predictionMarketReport.marketsWithMovement}`
  );
  lines.push('');

  lines.push(`## News`);
  lines.push('');
  lines.push(`- Posts created: ${report.newsReport.postsCreated}`);
  lines.push(
    `- Article posts created: ${report.newsReport.articlePostsCreated}`
  );
  lines.push(
    `- RSS headlines fetched: ${report.newsReport.rssHeadlinesFetched}`
  );
  lines.push(
    `- Parody headlines generated: ${report.newsReport.parodyHeadlinesGenerated}`
  );
  lines.push('');

  lines.push(`## Prompt Audit`);
  lines.push('');
  for (const promptType of report.promptAudit.promptTypes.slice(0, 20)) {
    lines.push(
      `- ${promptType.promptType}: ${promptType.calls} calls, ${promptType.uniqueInputs} unique inputs, ${promptType.uniqueOutputs} unique outputs, avg ${promptType.avgInputTokens}/${promptType.avgOutputTokens} tokens`
    );
  }
  lines.push('');

  lines.push(`## NPC Actions`);
  lines.push('');
  lines.push(
    `- Attempts: ${report.trajectoryAudit.actionSummary.totalAttempts}`
  );
  lines.push(
    `- Successes: ${report.trajectoryAudit.actionSummary.totalSuccesses}`
  );
  lines.push(
    `- Failures: ${report.trajectoryAudit.actionSummary.totalFailures}`
  );
  for (const action of report.trajectoryAudit.actionSummary.byActionType.slice(
    0,
    12
  )) {
    lines.push(
      `- ${action.actionType}: ${action.attempts} attempts, ${action.successes} success, ${action.failures} failure`
    );
  }
  if (report.trajectoryAudit.actionSummary.unusedCoreActions.length > 0) {
    lines.push('');
    lines.push(
      `- Unused core actions: ${report.trajectoryAudit.actionSummary.unusedCoreActions.join(', ')}`
    );
  }
  lines.push('');

  if (report.promptAudit.repeatedPromptBlocks.length > 0) {
    lines.push(`## Repeated Prompt Blocks`);
    lines.push('');
    for (const block of report.promptAudit.repeatedPromptBlocks.slice(0, 10)) {
      lines.push(
        `- ${block.count} uses across ${block.promptTypes.length} prompt types: ${block.sample}`
      );
    }
    lines.push('');
  }

  if (report.warnings.length > 0) {
    lines.push(`## Warnings`);
    lines.push('');
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }

  lines.push(`## Widgets`);
  lines.push('');
  lines.push(
    `- Trending widget: ${report.trendingWidget.success ? 'ok' : 'failed'}`
  );
  lines.push(
    `- Breaking news widget: ${report.breakingNewsWidget.success ? 'ok' : 'failed'}`
  );
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function main() {
  const runStartedAt = new Date();
  const llmCalls: PromptCallArtifact[] = [];
  const priorCallback = getLLMCallCallback();

  setLLMCallCallback((call) => {
    llmCalls.push({
      ...call,
      capturedAt: new Date().toISOString(),
      source: 'engine',
    });
    priorCallback?.(call);
  });

  const restoreFetch =
    rssMode === 'snapshot' ? await installRssFetchCache() : () => {};

  const jobArtifacts: JobArtifact[] = [];
  const cycleSnapshots: CycleSnapshot[] = [];

  logger.info(
    'Starting core world simulation',
    {
      cycles,
      rssMode,
      npcTradeProbability,
      outputDir,
    },
    'CoreWorldSim'
  );

  try {
    const bootstrapResult = await bootstrapGameIfNeeded();
    writeJson(path.join(outputDir, 'bootstrap.json'), bootstrapResult);

    for (let cycle = 1; cycle <= cycles; cycle++) {
      const cycleStartedAt = new Date();
      logger.info(
        `Running simulation cycle ${cycle}/${cycles}`,
        undefined,
        'CoreWorldSim'
      );

      const worldFactsJob = await invokeCronRoute(
        '../apps/web/src/app/api/cron/world-facts/route.ts',
        'world-facts',
        cycle,
        '/api/cron/world-facts'
      );
      jobArtifacts.push(worldFactsJob);
      writeJson(
        path.join(
          jobsDir,
          `${String(cycle).padStart(2, '0')}-world-facts.json`
        ),
        worldFactsJob
      );

      const gameTickStartedAt = new Date();
      let gameTickJob: JobArtifact;
      try {
        const gameTickResult = await executeGameTick();
        const gameTickCompletedAt = new Date();
        gameTickJob = {
          name: 'game-tick',
          cycle,
          startedAt: gameTickStartedAt.toISOString(),
          completedAt: gameTickCompletedAt.toISOString(),
          durationMs:
            gameTickCompletedAt.getTime() - gameTickStartedAt.getTime(),
          success: true,
          body: gameTickResult,
        };
      } catch (error) {
        const gameTickCompletedAt = new Date();
        gameTickJob = {
          name: 'game-tick',
          cycle,
          startedAt: gameTickStartedAt.toISOString(),
          completedAt: gameTickCompletedAt.toISOString(),
          durationMs:
            gameTickCompletedAt.getTime() - gameTickStartedAt.getTime(),
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      jobArtifacts.push(gameTickJob);
      writeJson(
        path.join(jobsDir, `${String(cycle).padStart(2, '0')}-game-tick.json`),
        gameTickJob
      );

      const marketsJob = await invokeCronRoute(
        '../apps/web/src/app/api/cron/markets-tick/route.ts',
        'markets-tick',
        cycle,
        '/api/cron/markets-tick'
      );
      jobArtifacts.push(marketsJob);
      writeJson(
        path.join(
          jobsDir,
          `${String(cycle).padStart(2, '0')}-markets-tick.json`
        ),
        marketsJob
      );

      const npcJob = await invokeCronRoute(
        '../apps/web/src/app/api/cron/npc-tick/route.ts',
        'npc-tick',
        cycle,
        '/api/cron/npc-tick'
      );
      jobArtifacts.push(npcJob);
      writeJson(
        path.join(jobsDir, `${String(cycle).padStart(2, '0')}-npc-tick.json`),
        npcJob
      );

      const organizationJob = await invokeCronRoute(
        '../apps/web/src/app/api/cron/organization-tick/route.ts',
        'organization-tick',
        cycle,
        '/api/cron/organization-tick'
      );
      jobArtifacts.push(organizationJob);
      writeJson(
        path.join(
          jobsDir,
          `${String(cycle).padStart(2, '0')}-organization-tick.json`
        ),
        organizationJob
      );

      const articleJob = await invokeCronRoute(
        '../apps/web/src/app/api/cron/article-tick/route.ts',
        'article-tick',
        cycle,
        '/api/cron/article-tick'
      );
      jobArtifacts.push(articleJob);
      writeJson(
        path.join(
          jobsDir,
          `${String(cycle).padStart(2, '0')}-article-tick.json`
        ),
        articleJob
      );

      const cycleSnapshot = await collectCycleSnapshot(cycleStartedAt);
      cycleSnapshots.push(cycleSnapshot);
      writeJson(path.join(cycleDir, `cycle-${cycle}.json`), cycleSnapshot);
    }

    const { buildStoriesFeed } = (await import(
      '../apps/web/src/app/api/feed/stories/pipeline.ts'
    )) as {
      buildStoriesFeed: () => Promise<{
        stories: Array<{
          storyKey: string;
          title?: string;
          posts: Array<{ id: string; content: string }>;
        }>;
      }>;
    };
    const { buildForYouFeed } = (await import(
      '../apps/web/src/app/api/feed/for-you/pipeline.ts'
    )) as {
      buildForYouFeed: (userId?: string | null) => Promise<{
        stories: Array<{
          storyKey: string;
          title?: string;
          posts: Array<{ id: string; content: string }>;
        }>;
      }>;
    };

    const storiesFeed = await buildStoriesFeed();
    const forYouFeed = await buildForYouFeed(null);
    writeJson(path.join(feedsDir, 'stories.json'), storiesFeed);
    writeJson(path.join(feedsDir, 'for-you.json'), forYouFeed);

    const trendingWidget = await invokeGetRoute(
      '../apps/web/src/app/api/feed/widgets/trending/route.ts',
      'trending-widget',
      '/api/feed/widgets/trending'
    );
    writeJson(path.join(widgetsDir, 'trending.json'), trendingWidget);

    const breakingNewsWidget = await invokeGetRoute(
      '../apps/web/src/app/api/feed/widgets/breaking-news/route.ts',
      'breaking-news-widget',
      '/api/feed/widgets/breaking-news?limit=10'
    );
    writeJson(path.join(widgetsDir, 'breaking-news.json'), breakingNewsWidget);

    const trendingSnapshot = await collectTrendingTagSnapshot();
    writeJson(path.join(widgetsDir, 'trending-tags-db.json'), trendingSnapshot);

    const trajectoryAudit = await collectTrajectoryAudit(runStartedAt);
    const allPromptCalls = [...llmCalls, ...trajectoryAudit.llmCalls];
    const promptAudit = buildPromptAudit(allPromptCalls);
    writeJson(path.join(promptsDir, 'engine-llm-calls.json'), llmCalls);
    writeJson(
      path.join(promptsDir, 'trajectory-llm-calls.json'),
      trajectoryAudit.llmCalls
    );
    writeJson(path.join(promptsDir, 'llm-calls.json'), allPromptCalls);
    writeJson(path.join(promptsDir, 'audit.json'), promptAudit);
    writeJson(
      path.join(outputDir, 'actions.json'),
      trajectoryAudit.actionSummary
    );
    writeJson(path.join(outputDir, 'trajectories.json'), trajectoryAudit);

    const copiedPromptLogs: string[] = [];
    const debugPromptDir = path.resolve(process.cwd(), 'debug', 'prompts');
    if (statExists(debugPromptDir)) {
      for (const entry of readdirSync(debugPromptDir)) {
        const fullPath = path.join(debugPromptDir, entry);
        const stats = statSync(fullPath);
        if (stats.mtimeMs < runStartedAt.getTime()) continue;
        const targetPath = path.join(promptsDir, 'markdown', entry);
        writeText(targetPath, readFileSync(fullPath, 'utf8'));
        copiedPromptLogs.push(targetPath);
      }
    }

    const feedReport = buildFeedReport(storiesFeed, forYouFeed);
    const questionReport = buildQuestionReport(cycleSnapshots);
    const predictionMarketReport = buildPredictionMarketReport(cycleSnapshots);
    const newsReport = buildNewsReport(cycleSnapshots);
    const dagTraceDirs = collectDagTraceDirectories(runStartedAt);
    const warnings = buildWarnings(
      jobArtifacts,
      promptAudit,
      cycleSnapshots,
      trajectoryAudit
    );

    writeJson(path.join(outputDir, 'question-stats.json'), questionReport);
    writeJson(
      path.join(outputDir, 'prediction-market-stats.json'),
      predictionMarketReport
    );
    writeJson(path.join(outputDir, 'news-stats.json'), newsReport);
    writeJson(path.join(outputDir, 'feed-stats.json'), feedReport);
    writeJson(path.join(outputDir, 'dag-traces.json'), dagTraceDirs);

    const summary = {
      runId,
      startedAt: runStartedAt.toISOString(),
      completedAt: new Date().toISOString(),
      cycles,
      rssMode,
      outputDir,
      dagTraceDirs,
      copiedPromptLogs,
      jobs: jobArtifacts,
      cycleSnapshots,
      trajectories: trajectoryAudit.trajectories,
      actionSummary: trajectoryAudit.actionSummary,
      feeds: {
        ...feedReport,
      },
      widgets: {
        trending: trendingWidget,
        breakingNews: breakingNewsWidget,
        trendingTagsDb: trendingSnapshot,
      },
      questionReport,
      predictionMarketReport,
      newsReport,
      promptAudit,
      warnings,
    };

    writeJson(path.join(outputDir, 'summary.json'), summary);
    writeText(
      path.join(outputDir, 'report.md'),
      buildMarkdownReport({
        runId,
        cycles,
        rssMode,
        jobs: jobArtifacts,
        promptAudit,
        cycleSnapshots,
        trajectoryAudit,
        questionReport,
        predictionMarketReport,
        newsReport,
        stories: {
          count: feedReport.stories.count,
          duplicates: feedReport.stories.duplicates,
        },
        forYou: {
          count: feedReport.forYou.count,
          duplicates: feedReport.forYou.duplicates,
        },
        trendingWidget,
        breakingNewsWidget,
        warnings,
      })
    );

    logger.info(
      'Core world simulation completed',
      {
        outputDir,
        cycles,
        promptCalls: llmCalls.length,
      },
      'CoreWorldSim'
    );
  } catch (error) {
    const trajectoryAudit = await collectTrajectoryAudit(runStartedAt).catch(
      () => getEmptyTrajectoryAudit()
    );
    const allPromptCalls = [...llmCalls, ...trajectoryAudit.llmCalls];
    const promptAudit = buildPromptAudit(allPromptCalls);
    const dagTraceDirs = collectDagTraceDirectories(runStartedAt);
    const warnings = buildWarnings(
      jobArtifacts,
      promptAudit,
      cycleSnapshots,
      trajectoryAudit
    );
    const failure = error instanceof Error ? error : new Error(String(error));

    writeJson(path.join(promptsDir, 'engine-llm-calls.json'), llmCalls);
    writeJson(
      path.join(promptsDir, 'trajectory-llm-calls.json'),
      trajectoryAudit.llmCalls
    );
    writeJson(path.join(promptsDir, 'llm-calls.json'), allPromptCalls);
    writeJson(path.join(promptsDir, 'audit.json'), promptAudit);
    writeJson(
      path.join(outputDir, 'actions.json'),
      trajectoryAudit.actionSummary
    );
    writeJson(path.join(outputDir, 'trajectories.json'), trajectoryAudit);
    writeJson(path.join(outputDir, 'dag-traces.json'), dagTraceDirs);
    writeJson(path.join(outputDir, 'failure.json'), {
      runId,
      cycles,
      rssMode,
      npcTradeProbability,
      outputDir,
      error: {
        name: failure.name,
        message: failure.message,
        stack: failure.stack,
      },
      jobs: jobArtifacts,
      cycleSnapshots,
      warnings,
    });

    throw failure;
  } finally {
    restoreFetch();
    setLLMCallCallback(priorCallback);
    await closeDatabase();
  }
}

main().catch((error) => {
  logger.error(
    'Core world simulation failed',
    error instanceof Error ? error : new Error(String(error)),
    'CoreWorldSim'
  );
  process.exit(1);
});
