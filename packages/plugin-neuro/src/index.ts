/**
 * Plugin Neuro - Cognitive Memory System for elizaOS
 *
 * WHY THIS PLUGIN EXISTS:
 * ======================
 * Traditional chatbots are stateless—every message is processed in isolation.
 * Real intelligence requires persistent cognitive structures:
 *
 * - MEMORY: What have I learned? (with natural decay over time)
 * - PATTERN RECOGNITION: What behaviors do I observe? (with trust scoring)
 * - HYPOTHESIS FORMATION: What do I predict? (with testing and lifecycle)
 * - SELF-EVALUATION: How good is my reasoning? (metacognition)
 *
 * This plugin provides these capabilities through a schema-driven architecture.
 *
 * ARCHITECTURE OVERVIEW:
 * =====================
 * 1. SCHEMAS define cognitive memory types (what to track)
 * 2. ENGINE generates evaluators + providers from schemas
 * 3. EVALUATORS run on each message, calling LLMs to analyze and create memories
 * 4. PROVIDERS inject memory summaries into agent context
 * 5. DYNAMICS handle temporal behavior (decay, confidence)
 * 6. EVENTS notify other systems of cognitive insights
 *
 * WHY SCHEMA-DRIVEN:
 * =================
 * Before: 250+ lines per cognitive type (boilerplate)
 * After: 30-50 lines per schema (configuration)
 *
 * This makes it easy to add new cognitive capabilities without writing
 * repetitive evaluator/provider code.
 */

import { type Plugin } from '@elizaos/core';

// Cognitive Memory Engine - transforms schemas into evaluators/providers
import { createCognitiveMemory } from './cognitive.ts';
// Legacy evaluator - reviewEvaluator grades agent responses,
// feeding into metacognition for self-evaluation
import { reviewEvaluator } from './evaluators/evl_review.ts';
// Schema Definitions - each defines a cognitive memory type
import {
  conversationSchema,
  cultureSchema,
  hypothesisSchema,
  metacognitionSchema,
  narrativeSchema,
  patternSchema,
  taskSchema,
  understandingSchema,
  verificationSchema,
} from './schemas/index.ts';

// =============================================================================
// Create Cognitive Memories from Schemas
// =============================================================================
// WHY AT MODULE LOAD:
// createCognitiveMemory() is pure (no side effects). Running at load time
// means evaluators/providers are ready when plugin initializes.
// This is faster than creating them on-demand.
// =============================================================================

// ----- Wave 1: Foundation -----
// These are the core cognitive types that most agents need.

/**
 * CONVERSATIONS: Track conversation threads per room.
 * WHY: Enables "what were we talking about?" context.
 */
const conversation = createCognitiveMemory(conversationSchema);

/**
 * CULTURE: Detect room terminology, tone, norms.
 * WHY: Enables adapting communication style to fit the community.
 */
const culture = createCognitiveMemory(cultureSchema);

// ----- Wave 2: Entity Intelligence -----
// These track per-entity (user) cognitive data.

/**
 * PATTERNS: Trust scoring and behavioral observation.
 * WHY: "Should I trust this person?" is fundamental to social intelligence.
 */
const pattern = createCognitiveMemory(patternSchema);

/**
 * UNDERSTANDING: Track user's knowledge level (ELI5).
 * WHY: Explaining blockchain to a novice vs expert requires different language.
 */
const understanding = createCognitiveMemory(understandingSchema);

/**
 * TASKS: Track requests, action chains, blockers.
 * WHY: Multi-step tasks need state. "What was I doing? What's blocking?"
 */
const task = createCognitiveMemory(taskSchema);

/**
 * VERIFICATION: Hallucination detection, response checking.
 * WHY: Self-correction requires knowing when you're wrong.
 */
const verification = createCognitiveMemory(verificationSchema);

// ----- Wave 3: Temporal Intelligence -----
// These add time-aware cognitive capabilities.

/**
 * HYPOTHESIS: Agent predictions with lifecycle (active → testing → resolved).
 * WHY: Making and testing predictions is how intelligence improves.
 */
const hypothesis = createCognitiveMemory(hypothesisSchema);

// ----- Wave 4: Synthesis & Self-Awareness -----
// These build higher-level understanding from other cognitive types.

/**
 * NARRATIVE: Synthesized stories from patterns/hypotheses.
 * WHY: Humans think in narratives. "What's the story here?"
 */
const narrative = createCognitiveMemory(narrativeSchema);

/**
 * METACOGNITION: Self-evaluation of evaluator quality.
 * WHY: Knowing "my trust judgments are often wrong" enables improvement.
 */
const metacognition = createCognitiveMemory(metacognitionSchema);

// =============================================================================
// Plugin Export
// =============================================================================
// WHY THIS STRUCTURE:
// elizaOS plugins provide actions, providers, evaluators, and services.
// - PROVIDERS run before response generation (inject context)
// - EVALUATORS run after message receipt (analyze and store)
// - ACTIONS are user-triggerable (not used here - cognitive processing is automatic)
// - SERVICES are long-running (not used here - no persistent connections needed)
// =============================================================================

export const neuroPlugin: Plugin = {
  name: 'neuro',
  description: 'Advanced cognitive reasoning and memory system',

  // WHY NO ACTIONS: Cognitive processing happens automatically.
  // Users don't say "analyze my trust level"—it just happens.
  actions: [],

  // WHY THESE PROVIDERS:
  // Each injects relevant cognitive context into the agent's prompt.
  // Order matters slightly—more important context should come first.
  providers: [
    // Foundation (always relevant)
    conversation.provider,
    culture.provider,

    // Entity intelligence (relevant when interacting with known entities)
    pattern.provider,
    understanding.provider,
    task.provider,
    verification.provider,

    // Predictions (relevant for planning/reasoning)
    hypothesis.provider,

    // Synthesis (optional, only when high-confidence narratives exist)
    narrative.provider,
    metacognition.provider,
  ],

  // WHY THESE EVALUATORS:
  // Each analyzes incoming messages and creates/updates memories.
  // All run on every message (validation hooks can skip irrelevant ones).
  evaluators: [
    // Foundation
    conversation.evaluator,
    culture.evaluator,

    // Entity intelligence
    pattern.evaluator,
    understanding.evaluator,
    task.evaluator,
    verification.evaluator,

    // Predictions
    hypothesis.evaluator,

    // Synthesis
    narrative.evaluator,
    metacognition.evaluator,

    // WHY LEGACY EVALUATOR:
    // reviewEvaluator grades agent responses. Its output feeds into
    // metacognition for self-evaluation. Not yet migrated to schema
    // because it has special integration needs.
    reviewEvaluator,
  ],

  // WHY NO SERVICES:
  // Cognitive processing is stateless—run evaluators, save memories.
  // No persistent connections or background tasks needed.
  services: [],
};

// =============================================================================
// Re-exports
// =============================================================================
// WHY RE-EXPORT:
// Users who want to create custom cognitive types need access to:
// - Schema types (to define their schema)
// - createCognitiveMemory (to generate evaluator/provider)
// - Dynamics (to customize decay/confidence behavior)
// - Events (to react to cognitive insights)
// =============================================================================

// Cognitive engine - the main API for custom types
export { createCognitiveMemory } from './cognitive.ts';
// Temporal dynamics (confidence, decay)
export * from './dynamics/index.ts';
// Event system for integration
export * from './events.ts';
// Legacy types (for backwards compatibility with existing code)
export * from './metadata.ts';
// Cross-memory relations and graph queries
export * from './relations.ts';
// Schema types and utilities
export * from './schema.ts';
export * from './schemas/index.ts';

// XML parsing utilities (useful for custom extraction hooks)
export { asRecord, extractNodes, getDirective, parseXml } from './utils.ts';

export default neuroPlugin;
