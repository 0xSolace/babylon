#!/usr/bin/env bun

/**
 * Context Inspector — Dev tool for NPC and autonomous agent prompt debugging
 *
 * Shows exactly what context an NPC or autonomous agent receives for trading
 * and posting decisions. Renders the full prompt and reports on token usage,
 * truncation, ghost variables, and position visibility.
 *
 * Usage (NPCs):
 *   bun run inspect:context -- --npc ailon-musk --type trading
 *   bun run inspect:context -- --npc all --type both --summary
 *   bun run inspect:context -- --npc ailon-musk --type posting --raw
 *
 * Usage (Autonomous Agents):
 *   bun run inspect:context -- --agent <userId> --raw
 *   bun run inspect:context -- --agent <userId>
 */

import { parseArgs } from 'node:util';
import {
  generateWorldContext,
  MarketContextService,
  MarketDecisionEngine,
  type NPCMarketContext,
  npcMarketDecisions,
  renderPrompt,
  StaticDataRegistry,
} from '@babylon/engine';

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
    agent: { type: 'string', default: '' },
    type: { type: 'string', default: 'trading' },
    diff: { type: 'boolean', default: false },
    summary: { type: 'boolean', default: false },
    raw: { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: false,
});

const npcArg = args.npc || '';
const agentArg = args.agent || '';
const inspectType = args.type as 'trading' | 'posting' | 'both';
const showDiff = args.diff ?? false;
const showSummary = args.summary ?? false;
const showRaw = args.raw ?? false;

if (!npcArg && !agentArg) {
  console.log(`Usage:
  bun run inspect:context -- --npc <id|all> [options]     # Inspect NPC context
  bun run inspect:context -- --agent <userId> [options]    # Inspect autonomous agent context

Options:
  --npc <id>           NPC ID (e.g. ailon-musk) or "all" for summary
  --agent <userId>     Autonomous agent user ID (from DB)
  --type <type>        trading | posting | both (default: trading)
  --diff               Side-by-side comparison (only with --type both)
  --summary            Aggregate stats instead of full prompt
  --raw                Output raw rendered prompt text`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// No inlined engine formatting — we use the real MarketDecisionEngine
// and renderPrompt to produce the actual prompt NPCs receive.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Template variable extraction
// ---------------------------------------------------------------------------
function extractTemplateVars(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

// ---------------------------------------------------------------------------
// Trading context inspection — uses the real MarketDecisionEngine pipeline
// ---------------------------------------------------------------------------

const { getShuffledExamplesText } = await import(
  '../packages/engine/src/prompts'
);

async function inspectTradingContext(npcId: string): Promise<{
  sections: Array<{
    name: string;
    tokens: number;
    populated: boolean;
  }>;
  ghostVars: string[];
  totalTokens: number;
  positionVisibility: { total: number; shown: number };
  rawPrompt?: string;
}> {
  const svc = new MarketContextService();
  const ctx = await svc.buildContextForNPC(npcId);

  // Create engine with a stub LLM — we only need formatting, not generation
  const stubLlm = { getProvider: () => 'groq' } as never;
  const engine = new MarketDecisionEngine(stubLlm, svc);

  // Call the same methods the engine calls in generateDecisionsForContexts
  // Since formatNPCsList and formatMarketTable are private, we access them
  // through the prototype (acceptable for a dev tool)
  const formatNPCsList = (engine as never as Record<string, Function>)[
    'formatNPCsList'
  ].bind(engine);
  const formatMarketTable = (engine as never as Record<string, Function>)[
    'formatMarketTable'
  ].bind(engine);

  const npcsList = formatNPCsList([ctx]) as string;
  const marketTable = formatMarketTable([ctx]) as string;

  const worldContext = await generateWorldContext();
  const examples = getShuffledExamplesText();

  const validNpcIds = ctx.npcId;
  const allTickers = new Set<string>();
  ctx.perpMarkets.forEach((m: { ticker: string }) => allTickers.add(m.ticker));
  const validTickers =
    allTickers.size > 0 ? Array.from(allTickers).join(', ') : 'N/A';

  // Assemble the exact same variables the engine passes to renderPrompt
  const vars: Record<string, string> = {
    examples,
    marketTable,
    npcCount: '1',
    npcsList,
    validNpcIds,
    validTickers,
    realityGrounding: worldContext.realityGrounding,
    activeQuestions: '',
    recentEvents: '',
    richGameContext: worldContext.richGameContext || '',
    eventMarketSignals: 'No event-market signals available',
  };

  const rendered = renderPrompt(npcMarketDecisions, vars, {
    allowEmpty: true,
  });

  // Find ghost vars (in template but not supplied)
  const templateVars = extractTemplateVars(npcMarketDecisions.template);
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

  const sections = Object.entries(vars).map(([name, value]) => ({
    name,
    tokens: estimateTokens(value),
    populated: value.trim().length > 0,
  }));

  // Position count — the engine now shows all positions (not capped at 3)
  const totalPositions = ctx.currentPositions.length;
  // Count how many actually appear in the rendered dashboard
  const shownPositions = (npcsList.match(/\[ID:/g) || []).length;

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
// NOTE: FeedGenerator.buildRichCharacterContext is private and deeply stateful
// (requires LLM, event history, relationship engine, etc.). This inspection
// shows the data that WOULD be available to the posting pipeline, but does
// not render the exact posting prompt. Use --type trading for exact prompts.
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

  console.log(
    `${YELLOW}NOTE: Posting context is an approximation. FeedGenerator.buildRichCharacterContext ` +
      `is private and stateful. Use --type trading for exact engine prompts.${RESET}`
  );

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
    ? `${YELLOW}[APPROXIMATION — not the exact FeedGenerator prompt]${RESET}\n` +
      [
        characterInfo,
        eventsText,
        postsText,
        worldContext.realityGrounding,
      ].join('\n---\n')
    : undefined;

  return { sections, totalTokens, rawPrompt };
}

// ---------------------------------------------------------------------------
// Autonomous agent context inspection
// ---------------------------------------------------------------------------
async function inspectAgentContext(agentUserId: string): Promise<{
  sections: Array<{
    name: string;
    tokens: number;
    populated: boolean;
    count?: number;
  }>;
  totalTokens: number;
  rawPrompt?: string;
}> {
  // Dynamic imports from @babylon/agents (not in @babylon/engine)
  const {
    getPredictionMarkets,
    getPerpMarkets,
    getAgentPositions,
    getRecentPosts,
    getAgentGroupChats,
    getAgentOwnPosts,
  } = await import('../packages/agents/src/autonomous/utils/context-gatherers');
  const { gatherPendingCommentReplies, gatherPendingChatMessages } =
    await import(
      '../packages/agents/src/autonomous/utils/interaction-gatherers'
    );
  const { buildMultiStepDecisionPrompt } = await import(
    '../packages/agents/src/autonomous/templates/multi-step-decision'
  );
  const { getAgentContext } = await import(
    '../packages/agents/src/autonomous/agent-context'
  );
  const { db, eq, users } = await import('@babylon/db');

  // Verify agent exists
  const [user] = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, agentUserId))
    .limit(1);

  if (!user) {
    error(`Agent user not found: ${agentUserId}`);
    process.exit(1);
  }

  const agentCtx = await getAgentContext(agentUserId);
  const agentName = agentCtx.displayName || user.displayName || agentUserId;

  // Gather all context (same as MultiStepExecutor.gatherContext)
  const [
    predictionMarkets,
    perpMarkets,
    agentPositions,
    recentPosts,
    pendingCommentReplies,
    pendingChatMessages,
    agentGroupChats,
    agentOwnPosts,
  ] = await Promise.all([
    getPredictionMarkets(),
    getPerpMarkets(),
    getAgentPositions(agentUserId),
    getRecentPosts(agentUserId),
    gatherPendingCommentReplies(agentUserId).catch(() => []),
    gatherPendingChatMessages(agentUserId).catch(() => []),
    getAgentGroupChats(agentUserId),
    getAgentOwnPosts(agentUserId),
  ]);

  const { WalletService } = await import('@babylon/engine');
  let balance = 0;
  let pnl = 0;
  try {
    const walletBalance = await WalletService.getBalance(agentUserId);
    balance = walletBalance.balance;
    pnl = walletBalance.lifetimePnL;
  } catch {
    // NPC or missing wallet — use 0
  }

  const sections: Array<{
    name: string;
    tokens: number;
    populated: boolean;
    count?: number;
  }> = [];

  // Build the actual prompt to measure it
  const context = {
    balance,
    pnl,
    openPositions:
      agentPositions.predictions.length + agentPositions.perps.length,
    pendingCommentReplies: pendingCommentReplies.slice(0, 3),
    pendingChatMessages: pendingChatMessages.slice(0, 3),
    enabledFeatures: ['TRADING', 'POSTING', 'COMMENTING', 'DMS', 'GROUP_CHATS'],
    predictionMarkets,
    perpMarkets,
    recentPosts,
    agentPositions,
    groupChats: agentGroupChats,
    agentOwnPosts,
  };

  let renderedPrompt: string;
  try {
    renderedPrompt = buildMultiStepDecisionPrompt({
      agentName,
      iterationCount: 1,
      maxIterations: 5,
      traceActionResults: [],
      context: context as never,
      isNpc: agentCtx.isNpc,
    });
  } catch {
    renderedPrompt =
      '[Failed to render prompt — missing template dependencies]';
  }

  // Section breakdown
  sections.push({
    name: 'identity',
    tokens: estimateTokens(agentName),
    populated: true,
  });
  sections.push({
    name: 'balance & PnL',
    tokens: estimateTokens(`$${balance} / PnL: $${pnl}`),
    populated: balance > 0 || pnl !== 0,
  });

  const predMktsText = predictionMarkets
    .map((m: { question: string }) => m.question)
    .join('\n');
  sections.push({
    name: 'predictionMarkets',
    tokens: estimateTokens(predMktsText),
    populated: predictionMarkets.length > 0,
    count: predictionMarkets.length,
  });

  const perpMktsText = perpMarkets
    .map((m: { name: string }) => m.name)
    .join('\n');
  sections.push({
    name: 'perpMarkets',
    tokens: estimateTokens(perpMktsText),
    populated: perpMarkets.length > 0,
    count: perpMarkets.length,
  });

  const predPositions = agentPositions.predictions || [];
  const perpPositions = agentPositions.perps || [];
  sections.push({
    name: 'positions (prediction)',
    tokens: estimateTokens(JSON.stringify(predPositions)),
    populated: predPositions.length > 0,
    count: predPositions.length,
  });
  sections.push({
    name: 'positions (perp)',
    tokens: estimateTokens(JSON.stringify(perpPositions)),
    populated: perpPositions.length > 0,
    count: perpPositions.length,
  });

  const postsText = recentPosts
    .map((p: { content: string }) => p.content)
    .join('\n');
  sections.push({
    name: 'recentPosts',
    tokens: estimateTokens(postsText),
    populated: recentPosts.length > 0,
    count: recentPosts.length,
  });

  const ownPostsText = agentOwnPosts
    .map((p: { content: string }) => p.content)
    .join('\n');
  sections.push({
    name: 'agentOwnPosts',
    tokens: estimateTokens(ownPostsText),
    populated: agentOwnPosts.length > 0,
    count: agentOwnPosts.length,
  });

  sections.push({
    name: 'pendingCommentReplies',
    tokens: estimateTokens(JSON.stringify(pendingCommentReplies.slice(0, 3))),
    populated: pendingCommentReplies.length > 0,
    count: pendingCommentReplies.length,
  });

  sections.push({
    name: 'pendingChatMessages',
    tokens: estimateTokens(JSON.stringify(pendingChatMessages.slice(0, 3))),
    populated: pendingChatMessages.length > 0,
    count: pendingChatMessages.length,
  });

  sections.push({
    name: 'groupChats',
    tokens: estimateTokens(JSON.stringify(agentGroupChats)),
    populated: agentGroupChats.length > 0,
    count: agentGroupChats.length,
  });

  const totalTokens = estimateTokens(renderedPrompt);

  return {
    sections,
    totalTokens,
    rawPrompt: showRaw ? renderedPrompt : undefined,
  };
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

  // Handle agent mode
  if (agentArg) {
    heading(`Autonomous Agent Context: ${agentArg}`);
    try {
      const result = await inspectAgentContext(agentArg);

      if (showRaw && result.rawPrompt) {
        console.log(result.rawPrompt);
      } else {
        subheading('Section Breakdown');
        const maxName = Math.max(
          ...result.sections.map((s) => s.name.length),
          8
        );
        console.log(`${'Section'.padEnd(maxName)}  Tokens    Count   Status`);
        console.log('-'.repeat(maxName + 40));
        for (const s of result.sections) {
          const status = s.populated
            ? `${GREEN}populated${RESET}`
            : `${DIM}empty${RESET}`;
          const count =
            s.count !== undefined ? String(s.count).padStart(5) : '    -';
          console.log(
            `${s.name.padEnd(maxName)}  ${String(s.tokens).padStart(6)}    ${count}   ${status}`
          );
        }

        subheading('Token Budget');
        console.log(`  Total rendered prompt tokens: ${result.totalTokens}`);
        console.log(
          `  Budget: 30,000 tokens | Utilization: ${((result.totalTokens / 30000) * 100).toFixed(1)}%`
        );

        subheading('Data Limits');
        console.log('  Prediction markets: max 8 (24h window)');
        console.log('  Perp markets: max 8 (top by price)');
        console.log('  Positions: max 10 each type');
        console.log('  Recent posts: max 8 (24h window)');
        console.log('  Pending replies: max 3');
        console.log('  Pending chats: max 3');
        console.log('  Group chats: max 5');
        console.log('  Own posts: max 5');
      }
    } catch (e) {
      error(
        `Failed to build agent context: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    process.exit(0);
  }

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
      subheading(`Posting Context — approximation (${allActors.length} NPCs)`);
      let totalPostingTokens = 0;
      let totalPopulated = 0;
      let totalSections = 0;

      for (const actor of allActors) {
        const result = await inspectPostingContext(actor.id);
        totalPostingTokens += result.totalTokens;
        totalPopulated += result.sections.filter((s) => s.populated).length;
        totalSections += result.sections.length;

        if (!showSummary) {
          console.log(
            `  ${actor.id.padEnd(24)} ${String(result.totalTokens).padStart(5)} tokens  ${result.sections.filter((s) => s.populated).length}/${result.sections.length} sections`
          );
        }
      }

      console.log(
        `\nTotal posting tokens: ${totalPostingTokens} | Avg per NPC: ${Math.round(totalPostingTokens / allActors.length)} | Populated: ${totalPopulated}/${totalSections} sections`
      );
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
