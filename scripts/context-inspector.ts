#!/usr/bin/env bun

/**
 * Context Inspector — Dev tool for NPC prompt debugging
 *
 * Shows exactly what context an NPC/agent receives for trading and posting
 * decisions. Renders the full prompt and reports on token usage, truncation,
 * ghost variables, and position visibility.
 *
 * Usage:
 *   bun run inspect:context -- --npc ailon-musk --type trading
 *   bun run inspect:context -- --npc all --type both --summary
 *   bun run inspect:context -- --npc ailon-musk --type posting --raw
 */

import { parseArgs } from 'node:util';
import {
  generateWorldContext,
  getShuffledExamplesText,
  MarketContextService,
  type NPCMarketContext,
  npcMarketDecisions,
  renderPrompt,
  StaticDataRegistry,
} from '@babylon/engine';

// ---------------------------------------------------------------------------
// Inlined trading strategy logic (from engine/src/npc/trading-strategies.ts)
// These are private internals not exported from @babylon/engine.
// ---------------------------------------------------------------------------
const TRADING_STRATEGIES = {
  momentum: {
    label: 'Momentum',
    followTrend: 0.7,
    contrarian: 0.2,
    random: 0.1,
  },
  contrarian: {
    label: 'Contrarian',
    followTrend: 0.2,
    contrarian: 0.7,
    random: 0.1,
  },
  value: { label: 'Value', followTrend: 0.3, contrarian: 0.4, random: 0.3 },
  random: {
    label: 'Random',
    followTrend: 0.33,
    contrarian: 0.33,
    random: 0.34,
  },
} as const;

type StrategyKey = keyof typeof TRADING_STRATEGIES;

function hashStringToUint32(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

function getNpcTradingStrategy(npcId: string): StrategyKey {
  const keys = Object.keys(TRADING_STRATEGIES) as StrategyKey[];
  const hash = hashStringToUint32(npcId);
  return keys[hash % keys.length] as StrategyKey;
}

function formatTradingStrategyBias(bias: {
  followTrend: number;
  contrarian: number;
  random: number;
}): string {
  const toPct = (v: number) => `${Math.round(v * 100)}%`;
  return `Follow trend: ${toPct(bias.followTrend)} | Contrarian: ${toPct(bias.contrarian)} | Random: ${toPct(bias.random)}`;
}

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function warn(msg: string) {
  console.log(`${YELLOW}WARNING: ${msg}${RESET}`);
}
function error(msg: string) {
  console.log(`${RED}ERROR: ${msg}${RESET}`);
}
function heading(msg: string) {
  console.log(`\n${BOLD}${CYAN}=== ${msg} ===${RESET}`);
}
function subheading(msg: string) {
  console.log(`\n${BOLD}${msg}${RESET}`);
}

// ---------------------------------------------------------------------------
// Token estimation (matches engine: Math.ceil(text.length / 4))
// ---------------------------------------------------------------------------
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const { values: args } = parseArgs({
  options: {
    npc: { type: 'string', default: '' },
    type: { type: 'string', default: 'trading' },
    diff: { type: 'boolean', default: false },
    summary: { type: 'boolean', default: false },
    raw: { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: false,
});

const npcArg = args.npc || '';
const inspectType = args.type as 'trading' | 'posting' | 'both';
const showDiff = args.diff ?? false;
const showSummary = args.summary ?? false;
const showRaw = args.raw ?? false;

if (!npcArg) {
  console.log(`Usage: bun run inspect:context -- --npc <id|all> [options]

Options:
  --npc <id>           NPC ID (e.g. ailon-musk) or "all" for summary
  --type <type>        trading | posting | both (default: trading)
  --diff               Side-by-side comparison (only with --type both)
  --summary            Aggregate stats instead of full prompt
  --raw                Output raw rendered prompt text`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Replicate MarketDecisionEngine formatting (private methods)
// ---------------------------------------------------------------------------

function mapPersonalityToArchetype(personality: string): string {
  const p = personality.toLowerCase();
  if (
    p.includes('risk') ||
    p.includes('aggressive') ||
    p.includes('degen') ||
    p.includes('speculator')
  )
    return 'DEGEN_TRADER';
  if (
    p.includes('cautious') ||
    p.includes('conservative') ||
    p.includes('manager')
  )
    return 'RISK_MANAGER';
  if (p.includes('analytical') || p.includes('quant') || p.includes('math'))
    return 'QUANT_TRADER';
  if (p.includes('insider') || p.includes('connected')) return 'INSIDER';
  return 'SYSTEMATIC_TRADER';
}

function formatMarketTable(ctx: NPCMarketContext): string {
  const perps = ctx.perpMarkets || [];
  const predictions = ctx.predictionMarkets || [];
  let table =
    '| Ticker/ID | Type | Price | 24h Change | Volume/Liq |\n|---|---|---|---|---|\n';
  for (const p of perps) {
    const sign = p.changePercent24h >= 0 ? '+' : '';
    table += `| ${p.ticker} | PERP | $${p.currentPrice.toFixed(2)} | ${sign}${p.changePercent24h.toFixed(2)}% | Vol: $${(p.volume24h / 1000).toFixed(1)}k |\n`;
  }
  for (const p of predictions) {
    table += `| ${p.id} | PRED | Yes: ${p.yesPrice.toFixed(0)}c | No: ${p.noPrice.toFixed(0)}c | Vol: $${(p.totalVolume / 1000).toFixed(1)}k |\n`;
  }
  return table;
}

function formatNPCDashboard(ctx: NPCMarketContext): string {
  const archetype = mapPersonalityToArchetype(ctx.personality);
  const strategyKey = getNpcTradingStrategy(ctx.npcId);
  const strategy = TRADING_STRATEGIES[strategyKey];

  const totalSize = ctx.currentPositions.reduce((s, p) => s + p.size, 0);
  const exposure =
    ctx.availableBalance > 0 ? (totalSize / ctx.availableBalance) * 100 : 0;
  const totalPnL = ctx.currentPositions.reduce(
    (s, p) => s + p.unrealizedPnL,
    0
  );
  const pnlSign = totalPnL >= 0 ? '+' : '';

  const topPositions = ctx.currentPositions
    .sort((a, b) => Math.abs(b.unrealizedPnL) - Math.abs(a.unrealizedPnL))
    .slice(0, 3)
    .map((p) => {
      const symbol = p.marketType === 'perp' ? p.ticker : `Q${p.marketId}`;
      const posSign = p.unrealizedPnL >= 0 ? '+' : '';
      return `${symbol} ${p.side} ($${p.size.toFixed(0)}, PnL: ${posSign}$${p.unrealizedPnL.toFixed(0)}) [ID:${p.id}]`;
    })
    .join(', ');

  const relationships =
    ctx.relationships && ctx.relationships.length > 0
      ? ctx.relationships
          .filter((r) => Math.abs(r.sentiment) > 0.4)
          .slice(0, 4)
          .map((r) => `${r.sentiment > 0 ? 'Ally' : 'Rival'}:${r.actorName}`)
          .join(', ')
      : 'None';

  const recentTopics = ctx.recentPosts
    .slice(0, 3)
    .map((p) => p.content.substring(0, 20) + '...')
    .join(' | ');

  const privateIntel =
    ctx.groupChatMessages.length > 0
      ? ctx.groupChatMessages
          .slice(0, 2)
          .map((m) => `"${m.fromName}: ${m.message}"`)
          .join(' | ')
      : 'None';

  return `TRADER DASHBOARD
ID: ${ctx.npcId} | Name: ${ctx.npcName}
Archetype: ${archetype} | Strategy: ${strategy.label} (${strategyKey})
Bias: ${formatTradingStrategyBias(strategy)} | Cash: $${ctx.availableBalance.toLocaleString()}
Total PnL: ${pnlSign}$${totalPnL.toFixed(0)} | Exposure: ${exposure.toFixed(1)}%
Network: ${relationships}
Positions: ${topPositions || 'None'}
Current Focus: ${recentTopics || 'Market General'}
PRIVATE INTEL: ${privateIntel}`;
}

// ---------------------------------------------------------------------------
// Template variable extraction
// ---------------------------------------------------------------------------
function extractTemplateVars(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

// ---------------------------------------------------------------------------
// Trading context inspection
// ---------------------------------------------------------------------------
async function inspectTradingContext(npcId: string): Promise<{
  sections: Array<{
    name: string;
    tokens: number;
    populated: boolean;
    truncated?: boolean;
  }>;
  ghostVars: string[];
  totalTokens: number;
  positionVisibility: { total: number; shown: number };
  rawPrompt?: string;
}> {
  const svc = new MarketContextService();
  const ctx = await svc.buildContextForNPC(npcId);

  const worldContext = await generateWorldContext();
  const examples = getShuffledExamplesText();
  const npcsList = formatNPCDashboard(ctx);
  const marketTable = formatMarketTable(ctx);

  const validNpcIds = ctx.npcId;
  const allTickers = new Set<string>();
  ctx.perpMarkets.forEach((m) => allTickers.add(m.ticker));
  const validTickers =
    allTickers.size > 0 ? Array.from(allTickers).join(', ') : 'N/A';

  // Assemble the variables passed to renderPrompt
  const vars: Record<string, string> = {
    examples,
    marketTable,
    npcCount: '1',
    npcsList,
    validNpcIds,
    validTickers,
    realityGrounding: worldContext.realityGrounding,
    activeQuestions: '', // optional in prompt
    recentEvents: '', // optional in prompt
    richGameContext: worldContext.richGameContext || '',
    eventMarketSignals: 'No event-market signals available',
  };

  // Render and measure
  const rendered = renderPrompt(npcMarketDecisions, vars, {
    allowEmpty: true,
  });

  // Find ghost vars (in template but not in vars)
  const templateVars = extractTemplateVars(npcMarketDecisions.template);
  // Auto-injected date vars from renderPrompt
  const autoVars = new Set([
    'currentDateTime',
    'currentDate',
    'currentTime',
    'currentYear',
    'currentMonth',
    'currentDay',
  ]);
  const suppliedVarKeys = new Set([...Object.keys(vars), ...autoVars]);
  const ghostVars = templateVars.filter((v) => !suppliedVarKeys.has(v));

  // Build section report
  const sections = Object.entries(vars).map(([name, value]) => ({
    name,
    tokens: estimateTokens(value),
    populated: value.trim().length > 0,
  }));

  // Position visibility
  const totalPositions = ctx.currentPositions.length;
  const shownPositions = Math.min(totalPositions, 3); // formatNPCDashboard shows max 3

  return {
    sections,
    ghostVars,
    totalTokens: estimateTokens(rendered),
    positionVisibility: { total: totalPositions, shown: shownPositions },
    rawPrompt: showRaw ? rendered : undefined,
  };
}

// ---------------------------------------------------------------------------
// Posting context inspection
// ---------------------------------------------------------------------------
async function inspectPostingContext(npcId: string): Promise<{
  sections: Array<{ name: string; tokens: number; populated: boolean }>;
  totalTokens: number;
  rawPrompt?: string;
}> {
  const actor = StaticDataRegistry.getActor(npcId);
  if (!actor) {
    error(`Actor not found: ${npcId}`);
    return { sections: [], totalTokens: 0 };
  }

  // Build character context sections manually since buildRichCharacterContext
  // is private on FeedGenerator
  const svc = new MarketContextService();
  const events = await svc.getEventsForNPC(npcId, actor.name);
  const recentPosts = await svc.getRecentPostsByNPC(npcId);
  const worldContext = await generateWorldContext();

  const sections: Array<{ name: string; tokens: number; populated: boolean }> =
    [];

  const characterInfo = [
    `Name: ${actor.name}`,
    actor.description ? `Description: ${actor.description}` : '',
    actor.personality ? `Personality: ${actor.personality}` : '',
    actor.voice ? `Voice: ${actor.voice}` : '',
    actor.postStyle ? `Post Style: ${actor.postStyle}` : '',
    actor.postExample.length > 0
      ? `Examples: ${actor.postExample.join(' | ')}`
      : '',
    actor.domain.length > 0 ? `Domains: ${actor.domain.join(', ')}` : '',
    actor.affiliations.length > 0
      ? `Affiliations: ${actor.affiliations.join(', ')}`
      : '',
    actor.tier ? `Tier: ${actor.tier}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  sections.push({
    name: 'characterInfo',
    tokens: estimateTokens(characterInfo),
    populated: characterInfo.length > 0,
  });

  const eventsText = events
    .map((e) => `[${e.type}] ${e.description}`)
    .join('\n');
  sections.push({
    name: 'personalEvents',
    tokens: estimateTokens(eventsText),
    populated: eventsText.length > 0,
  });

  const postsText = recentPosts.map((p) => p.content).join('\n');
  sections.push({
    name: 'previousPosts',
    tokens: estimateTokens(postsText),
    populated: postsText.length > 0,
  });

  sections.push({
    name: 'realityGrounding',
    tokens: estimateTokens(worldContext.realityGrounding),
    populated: worldContext.realityGrounding.length > 0,
  });

  sections.push({
    name: 'worldActors',
    tokens: estimateTokens(worldContext.worldActors),
    populated: worldContext.worldActors.length > 0,
  });

  const richCtx = worldContext.richGameContext || '';
  sections.push({
    name: 'richGameContext',
    tokens: estimateTokens(richCtx),
    populated: richCtx.length > 0,
  });

  const totalTokens = sections.reduce((s, sec) => s + sec.tokens, 0);

  const rawPrompt = showRaw
    ? [
        characterInfo,
        eventsText,
        postsText,
        worldContext.realityGrounding,
      ].join('\n---\n')
    : undefined;

  return { sections, totalTokens, rawPrompt };
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------
function printSectionReport(
  sections: Array<{
    name: string;
    tokens: number;
    populated: boolean;
    truncated?: boolean;
  }>
) {
  const maxName = Math.max(...sections.map((s) => s.name.length), 8);
  console.log(`${'Section'.padEnd(maxName)}  Tokens    Status`);
  console.log('-'.repeat(maxName + 30));

  for (const s of sections) {
    const status = s.populated
      ? `${GREEN}populated${RESET}`
      : `${DIM}empty${RESET}`;
    const truncNote = s.truncated ? ` ${YELLOW}(truncated)${RESET}` : '';
    console.log(
      `${s.name.padEnd(maxName)}  ${String(s.tokens).padStart(6)}    ${status}${truncNote}`
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  heading('Context Inspector');

  // Validate NPC
  if (npcArg !== 'all') {
    const actor = StaticDataRegistry.getActor(npcArg);
    if (!actor) {
      error(`NPC not found: ${npcArg}`);
      const allIds = StaticDataRegistry.getActorIds().slice(0, 10);
      console.log(`Available NPCs (first 10): ${allIds.join(', ')}`);
      process.exit(1);
    }
  }

  // Handle "all" summary mode
  if (npcArg === 'all') {
    heading('All NPCs Summary');
    const allActors = StaticDataRegistry.getAllActors().filter(
      (a) => !a.isTest && !a.name.includes('Group Test')
    );

    if (inspectType === 'trading' || inspectType === 'both') {
      subheading(`Trading Context (${allActors.length} NPCs)`);
      const svc = new MarketContextService();
      let contexts: Map<string, NPCMarketContext>;
      try {
        contexts = await svc.buildContextForAllNPCs();
      } catch (e) {
        warn(
          `Could not build contexts from DB: ${e instanceof Error ? e.message : String(e)}`
        );
        console.log('Ensure DATABASE_URL is set and the database has data.');
        process.exit(1);
      }

      let totalTokensAll = 0;
      let totalPositionsAll = 0;
      let npcsWithPositions = 0;

      for (const actor of allActors) {
        const ctx = contexts.get(actor.id);
        if (!ctx) continue;
        const dashboard = formatNPCDashboard(ctx);
        const tokens = estimateTokens(dashboard);
        totalTokensAll += tokens;
        const posCount = ctx.currentPositions.length;
        totalPositionsAll += posCount;
        if (posCount > 0) npcsWithPositions++;

        if (!showSummary) {
          console.log(
            `  ${actor.id.padEnd(24)} ${String(tokens).padStart(5)} tokens  ${posCount} positions  $${ctx.availableBalance.toLocaleString()} balance`
          );
        }
      }

      console.log(
        `\nTotal dashboard tokens: ${totalTokensAll} | NPCs with positions: ${npcsWithPositions}/${allActors.length} | Total positions: ${totalPositionsAll}`
      );
    }

    if (inspectType === 'posting' || inspectType === 'both') {
      subheading(`Posting Context (${allActors.length} NPCs)`);
      for (const actor of allActors.slice(0, 5)) {
        const result = await inspectPostingContext(actor.id);
        console.log(
          `  ${actor.id.padEnd(24)} ${String(result.totalTokens).padStart(5)} tokens  ${result.sections.filter((s) => s.populated).length}/${result.sections.length} sections populated`
        );
      }
      if (allActors.length > 5) {
        console.log(
          `  ${DIM}... and ${allActors.length - 5} more (use --npc <id> for full detail)${RESET}`
        );
      }
    }

    process.exit(0);
  }

  // Single NPC inspection
  if (inspectType === 'trading' || inspectType === 'both') {
    heading(`Trading Context: ${npcArg}`);
    try {
      const result = await inspectTradingContext(npcArg);

      if (showRaw && result.rawPrompt) {
        console.log(result.rawPrompt);
      } else {
        subheading('Section Breakdown');
        printSectionReport(result.sections);

        subheading('Position Visibility');
        console.log(
          `  Total positions: ${result.positionVisibility.total} | Shown in prompt: ${result.positionVisibility.shown}`
        );
        if (result.positionVisibility.total > result.positionVisibility.shown) {
          warn(
            `${result.positionVisibility.total - result.positionVisibility.shown} positions hidden from prompt (max 3 shown)`
          );
        }

        subheading('Token Budget');
        console.log(`  Total prompt tokens: ${result.totalTokens}`);

        if (result.ghostVars.length > 0) {
          subheading('Ghost Variables');
          for (const v of result.ghostVars) {
            console.log(
              `  ${RED}{{${v}}}${RESET} - in template but not supplied`
            );
          }
        } else {
          console.log(`\n${GREEN}No ghost variables detected.${RESET}`);
        }

        // Truncation report
        subheading('Truncation Report');
        const ctx = await new MarketContextService().buildContextForNPC(npcArg);
        const truncations = [];
        if (ctx.recentPosts.length >= 50)
          truncations.push(`  Posts: capped at 50 (may have more)`);
        if (ctx.recentEvents.length >= 30)
          truncations.push(`  Events: capped at 30 (may have more)`);
        if (ctx.predictionMarkets.length >= 15)
          truncations.push(
            `  Prediction markets: capped at 15 (may have more)`
          );
        if (ctx.groupChatMessages.length > 2)
          truncations.push(
            `  Group chat: ${ctx.groupChatMessages.length} messages, only 2 shown in prompt`
          );
        if (truncations.length > 0) {
          for (const t of truncations) {
            console.log(`${YELLOW}${t}${RESET}`);
          }
        } else {
          console.log(`  ${GREEN}No truncation detected.${RESET}`);
        }
      }
    } catch (e) {
      error(
        `Failed to build trading context: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  if (inspectType === 'posting' || inspectType === 'both') {
    heading(`Posting Context: ${npcArg}`);
    try {
      const result = await inspectPostingContext(npcArg);

      if (showRaw && result.rawPrompt) {
        console.log(result.rawPrompt);
      } else {
        subheading('Section Breakdown');
        printSectionReport(result.sections);

        subheading('Token Budget');
        console.log(`  Total context tokens: ${result.totalTokens}`);
      }
    } catch (e) {
      error(
        `Failed to build posting context: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // Diff mode
  if (showDiff && inspectType === 'both') {
    heading('Trading vs Posting Comparison');
    try {
      const trading = await inspectTradingContext(npcArg);
      const posting = await inspectPostingContext(npcArg);

      console.log(
        `${''.padEnd(20)}  ${'Trading'.padStart(10)}  ${'Posting'.padStart(10)}`
      );
      console.log('-'.repeat(45));
      console.log(
        `${'Total tokens'.padEnd(20)}  ${String(trading.totalTokens).padStart(10)}  ${String(posting.totalTokens).padStart(10)}`
      );
      console.log(
        `${'Sections'.padEnd(20)}  ${String(trading.sections.length).padStart(10)}  ${String(posting.sections.length).padStart(10)}`
      );
      console.log(
        `${'Populated'.padEnd(20)}  ${String(trading.sections.filter((s) => s.populated).length).padStart(10)}  ${String(posting.sections.filter((s) => s.populated).length).padStart(10)}`
      );
      console.log(
        `${'Ghost vars'.padEnd(20)}  ${String(trading.ghostVars.length).padStart(10)}  ${'N/A'.padStart(10)}`
      );
    } catch (e) {
      error(`Diff failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  process.exit(0);
}

main().catch((e) => {
  error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
