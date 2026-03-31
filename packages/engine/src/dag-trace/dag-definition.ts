/**
 * Static DAG definition for the game tick.
 * Maps directly to the execution flow in game-tick.ts.
 */

import type { DagDefinition } from './types';

export const GAME_TICK_DAG: DagDefinition = {
  nodes: [
    {
      id: 'init',
      name: 'Initialize',
      phase: 'Bootstrap',
      phaseNumber: 100,
      description: 'Token stats, LLM client setup, game state fetch',
    },
    {
      id: 'bootstrap',
      name: 'Bootstrap Game',
      phase: 'Bootstrap',
      phaseNumber: 100,
      description: 'Create actors, organizations, pools if needed',
    },
    {
      id: 'bootstrap-content',
      name: 'Bootstrap Content',
      phase: 'Bootstrap',
      phaseNumber: 100,
      description: 'Initial relationships, trending tags if fresh setup',
    },
    {
      id: 'questions-load',
      name: 'Load Questions',
      phase: 'Questions',
      phaseNumber: 200,
      description: 'Fetch active questions from database',
    },
    {
      id: 'questions-init',
      name: 'Generate Initial Questions',
      phase: 'Questions',
      phaseNumber: 200,
      description: 'LLM: Generate prediction questions if first tick',
    },
    {
      id: 'oracle-commitments',
      name: 'Oracle Commitments',
      phase: 'Questions',
      phaseNumber: 200,
      description: 'Publish question commitments to blockchain',
    },
    {
      id: 'events',
      name: 'Generate Events',
      phase: 'Events',
      phaseNumber: 300,
      description: 'World events and arc pulse events',
    },
    {
      id: 'market-baseline',
      name: 'Baseline Investments',
      phase: 'Markets',
      phaseNumber: 400,
      description: 'NPC baseline position allocation',
    },
    {
      id: 'market-decisions',
      name: 'Market Decisions',
      phase: 'Markets',
      phaseNumber: 400,
      description: 'LLM: Batch NPC trading decisions (main LLM call)',
    },
    {
      id: 'trade-execution',
      name: 'Trade Execution',
      phase: 'Markets',
      phaseNumber: 400,
      description: 'Execute NPC trading decisions',
    },
    {
      id: 'price-updates',
      name: 'Price Updates',
      phase: 'Markets',
      phaseNumber: 400,
      description: 'Recalculate market prices from trades',
    },
    {
      id: 'rebalancing',
      name: 'Portfolio Rebalancing',
      phase: 'Rebalancing',
      phaseNumber: 500,
      description: 'Monitor and rebalance NPC portfolios',
    },
    {
      id: 'question-topup',
      name: 'Question Top-up',
      phase: 'Questions',
      phaseNumber: 200,
      description: 'LLM: Generate more questions if < 10 active',
    },
    {
      id: 'narrative-arcs',
      name: 'Narrative Arcs',
      phase: 'Events',
      phaseNumber: 300,
      description: 'Process arc phase transitions',
    },
    {
      id: 'timeframed-markets',
      name: 'Timeframed Markets',
      phase: 'Events',
      phaseNumber: 300,
      description: 'Process multi-timeframe market arcs',
    },
    {
      id: 'game-state-update',
      name: 'Update Game State',
      phase: 'ContentMaintenance',
      phaseNumber: 600,
      description: 'DB: lastTickAt, currentDay',
    },
    {
      id: 'widget-caches',
      name: 'Widget Caches',
      phase: 'ContentMaintenance',
      phaseNumber: 600,
      description: 'Top gainers, questions, pools',
    },
    {
      id: 'trending-tags',
      name: 'Trending Tags',
      phase: 'ContentMaintenance',
      phaseNumber: 600,
      description: 'Recalculate trending topics',
    },
    {
      id: 'reputation-sync',
      name: 'Reputation Sync',
      phase: 'ContentMaintenance',
      phaseNumber: 600,
      description: 'Sync on-chain reputation scores',
    },
    {
      id: 'relationships',
      name: 'Relationship Evolution',
      phase: 'Social',
      phaseNumber: 700,
      description: 'LLM: Analyze NPC interactions, update relationships',
    },
    {
      id: 'group-dynamics',
      name: 'Group Dynamics',
      phase: 'Social',
      phaseNumber: 700,
      description: 'LLM: Group formation, messages, joins/kicks',
    },
    {
      id: 'alpha-invites',
      name: 'Alpha Invites',
      phase: 'Social',
      phaseNumber: 700,
      description: 'Invite engaged users to alpha groups',
    },
    {
      id: 'market-volatility',
      name: 'Market Volatility',
      phase: 'Markets',
      phaseNumber: 400,
      description: 'Simulate random price walks',
    },
    {
      id: 'token-stats-finalize',
      name: 'Finalize Token Stats',
      phase: 'Finalize',
      phaseNumber: 800,
      description: 'Aggregate LLM usage and costs',
    },
  ],
  edges: [
    // Bootstrap chain
    { source: 'init', target: 'bootstrap', label: 'config' },
    { source: 'bootstrap', target: 'bootstrap-content', label: 'actors' },
    { source: 'init', target: 'questions-load', label: 'dbConnection' },

    // Questions flow
    {
      source: 'questions-load',
      target: 'questions-init',
      label: 'activeQuestions',
    },
    {
      source: 'questions-init',
      target: 'oracle-commitments',
      label: 'newQuestions',
    },
    { source: 'questions-load', target: 'events', label: 'activeQuestions[]' },
    {
      source: 'questions-load',
      target: 'market-decisions',
      label: 'activeQuestions[]',
    },
    {
      source: 'questions-load',
      target: 'narrative-arcs',
      label: 'activeQuestions[]',
    },
    {
      source: 'questions-load',
      target: 'question-topup',
      label: 'activeCount',
    },

    // Events to markets context
    { source: 'events', target: 'market-decisions', label: 'worldContext' },

    // Markets chain
    {
      source: 'market-baseline',
      target: 'price-updates',
      label: 'baselineTrades',
    },
    {
      source: 'market-decisions',
      target: 'trade-execution',
      label: 'decisions[]',
    },
    {
      source: 'trade-execution',
      target: 'price-updates',
      label: 'executedTrades',
    },
    { source: 'price-updates', target: 'rebalancing', label: 'updatedPrices' },

    // Narrative flow
    {
      source: 'narrative-arcs',
      target: 'timeframed-markets',
      label: 'arcEvents',
    },
    {
      source: 'narrative-arcs',
      target: 'market-volatility',
      label: 'eventsGenerated',
    },

    // Content maintenance chain
    {
      source: 'game-state-update',
      target: 'widget-caches',
      label: 'currentDay',
    },
    {
      source: 'widget-caches',
      target: 'trending-tags',
      label: 'updatedCaches',
    },

    // Finalize collects from all
    {
      source: 'token-stats-finalize',
      target: 'token-stats-finalize',
      label: '',
    }, // terminal node placeholder
  ],
};

/** Phase color mapping for the visualizer */
export const PHASE_COLORS: Record<string, string> = {
  Bootstrap: '#3b82f6', // blue
  Questions: '#06b6d4', // cyan
  Events: '#f97316', // orange
  Markets: '#22c55e', // green
  Rebalancing: '#eab308', // yellow
  ContentMaintenance: '#6b7280', // gray
  Social: '#a855f7', // purple
  Finalize: '#ef4444', // red
};
