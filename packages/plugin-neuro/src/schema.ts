/**
 * Cognitive Memory Schema Types
 *
 * WHY THIS EXISTS:
 * ================
 * We observed that all cognitive evaluators follow the same pattern:
 * 1. Query existing memories of this type
 * 2. Format them for the LLM (usually as CSV)
 * 3. Build a prompt asking the LLM to analyze new messages
 * 4. Parse the LLM's XML response
 * 5. Extract metadata and create/update memory
 *
 * This was ~200-300 lines of boilerplate per evaluator. By extracting
 * the pattern into a schema-driven engine, we reduce each cognitive
 * type to ~30-50 lines of declarative configuration.
 *
 * WHY SCHEMAS INSTEAD OF CLASSES:
 * ==============================
 * We considered class inheritance (BaseEvaluator, etc.) but:
 * - Classes are verbose for simple customizations
 * - Inheritance hierarchies get tangled quickly
 * - TypeScript generics + inheritance = pain
 *
 * Schemas are:
 * - Declarative (what, not how)
 * - Easy to read and modify
 * - Composable via hooks
 * - Generate TypeScript types automatically
 *
 * WHY HOOKS FOR CUSTOMIZATION:
 * ===========================
 * Some behaviors are hard to express as pure config:
 * - Complex validation logic ("only run if 10+ messages exist")
 * - Custom formatting ("show trust score with priming text")
 * - Side effects ("emit event when confidence drops")
 *
 * Hooks let us start simple and extract patterns into config later.
 * This follows: "optimize for specific first, then generalize."
 */

import type {
  CustomMetadata,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core';
import type { ParsedNode } from './utils.ts';

// =============================================================================
// Field Definition Types
// =============================================================================
// WHY TYPED FIELD DEFINITIONS:
// These aren't just for documentation—they drive:
// 1. XML schema generation (what the LLM sees)
// 2. Type inference (TypeScript knows the metadata shape)
// 3. Metadata extraction (how to parse LLM responses)
// 4. CSV formatting (how to show existing memories to LLM)
// =============================================================================

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'enum'
  | 'timestamp'
  | 'ref';

export interface BaseFieldDef {
  /**
   * Human-readable description shown to the LLM in XML schema.
   * WHY: LLMs need context to produce useful output. "score" alone is ambiguous;
   * "Trust level from 0-100 based on observed behavior" gives direction.
   */
  description: string;

  /**
   * Whether this field is optional.
   * WHY: Some fields only make sense in certain contexts. A "parentTaskId"
   * is only relevant for subtasks, not top-level tasks.
   */
  optional?: boolean;
}

export interface StringFieldDef extends BaseFieldDef {
  type: 'string';
  /**
   * Default value if not provided by LLM.
   * WHY: Ensures we always have a valid value, even if LLM omits field.
   */
  default?: string;
}

export interface NumberFieldDef extends BaseFieldDef {
  type: 'number';
  default?: number;
  /**
   * Minimum value - will be enforced during extraction.
   * WHY: LLMs sometimes produce out-of-range values. Clamping ensures
   * we don't get trust scores of -50 or 500.
   */
  min?: number;
  /** Maximum value - will be enforced during extraction. */
  max?: number;
}

export interface BooleanFieldDef extends BaseFieldDef {
  type: 'boolean';
  default?: boolean;
}

export interface ArrayFieldDef extends BaseFieldDef {
  type: 'array';
  /**
   * Type of items in the array.
   * WHY: Currently only string/number. Complex nested types would require
   * recursive schema definitions—YAGNI until we need it.
   */
  items?: 'string' | 'number';
}

export interface EnumFieldDef extends BaseFieldDef {
  type: 'enum';
  /**
   * Allowed values shown to LLM as (option1|option2|option3).
   * WHY: Constrains LLM output to valid values. Without this, LLMs might
   * return "kind of positive" instead of "positive".
   */
  options: string[];
  default?: string;
}

export interface TimestampFieldDef extends BaseFieldDef {
  type: 'timestamp';
  // WHY NO DEFAULT: Timestamps should be explicit (when was this observed?)
  // or auto-generated (now). A static default would be wrong.
}

export interface RefFieldDef extends BaseFieldDef {
  type: 'ref';
  /**
   * The schema name this references (e.g., 'hypothesis', 'conversation').
   * WHY: Enables cross-memory references. A narrative might reference
   * multiple conversations and hypotheses that contributed to it.
   */
  refType: string;
  /**
   * Whether this is a single ref or array of refs.
   * WHY: Some relationships are 1:1 (task → parentTask), others are 1:N
   * (narrative → many conversations).
   */
  multiple?: boolean;
}

export type FieldDef =
  | StringFieldDef
  | NumberFieldDef
  | BooleanFieldDef
  | ArrayFieldDef
  | EnumFieldDef
  | TimestampFieldDef
  | RefFieldDef;

// =============================================================================
// Hook Types
// =============================================================================
// WHY HOOKS:
// Hooks provide escape hatches for logic that doesn't fit the declarative model.
// Each hook is optional—only define what you need to customize.
//
// HOOK EXECUTION ORDER:
// 1. validate() - Should evaluator run at all?
// 2. [LLM call happens]
// 3. extractMetadata() - Custom parsing if default doesn't work
// 4. beforeSave() - Last chance to modify or reject
// 5. [DB write happens]
// 6. afterSave() - Side effects (events, logging)
// =============================================================================

/**
 * Memory with typed metadata for hooks.
 * WHY: Hooks need access to the memory being processed. The generic
 * parameter allows type-safe access to schema-specific fields.
 */
export interface CognitiveMemory<T = Record<string, unknown>> extends Memory {
  metadata: CustomMetadata &
    Record<string, unknown> &
    T & {
      type: 'custom';
      neuroType: `neuro:${string}`;
    };
}

/**
 * Validation hook - determines if evaluator should run.
 * WHY: Not every message needs every evaluator. Examples:
 * - Narrative: Only run if 10+ messages exist (need material to synthesize)
 * - Pattern: Only run if message is from a known entity
 * - Verification: Only run on agent responses, not user messages
 */
export type ValidateHook = (
  runtime: IAgentRuntime,
  message: Memory,
  state?: State
) => Promise<boolean>;

/**
 * Pre-save hook - called before memory is created/updated.
 * WHY: Last chance to:
 * - Validate data quality (throw to abort save)
 * - Enrich metadata (add computed fields)
 * - Transform data (normalize formats)
 */
export type BeforeSaveHook<T = Record<string, unknown>> = (
  runtime: IAgentRuntime,
  memory: CognitiveMemory<T>,
  isNew: boolean
) => Promise<void>;

/**
 * Post-save hook - called after memory is created/updated.
 * WHY: Side effects that depend on successful persistence:
 * - Emit events (for homeostasis integration)
 * - Update related memories
 * - Trigger downstream processing
 */
export type AfterSaveHook<T = Record<string, unknown>> = (
  runtime: IAgentRuntime,
  memory: CognitiveMemory<T>,
  isNew: boolean
) => Promise<void>;

/**
 * Custom provider formatting hook.
 * WHY: Default formatting (field: value lines) isn't always ideal.
 * Pattern provider needs to show trust + priming text.
 * Understanding provider groups by topic.
 */
export type FormatProviderHook<T = Record<string, unknown>> = (
  memories: Array<CognitiveMemory<T>>,
  message: Memory,
  runtime: IAgentRuntime
) => string;

/**
 * Custom CSV formatting hook for existing memories in prompts.
 * WHY: CSV is shown to LLM to provide context. Default includes all fields,
 * but sometimes you want to:
 * - Hide internal fields (messageIds)
 * - Reorder columns for readability
 * - Add computed columns
 */
export type FormatCsvHook<T = Record<string, unknown>> = (
  memories: Array<CognitiveMemory<T>>
) => string;

/**
 * Custom metadata extraction hook.
 * WHY: If LLM returns non-standard structure or needs special handling.
 * Most schemas don't need this—the default extractor handles standard fields.
 */
export type ExtractMetadataHook<T = Record<string, unknown>> = (
  node: ParsedNode,
  messageId: string | undefined,
  existing?: T
) => T;

export interface SchemaHooks<T = Record<string, unknown>> {
  validate?: ValidateHook;
  beforeSave?: BeforeSaveHook<T>;
  afterSave?: AfterSaveHook<T>;
  formatProvider?: FormatProviderHook<T>;
  formatCsv?: FormatCsvHook<T>;
  extractMetadata?: ExtractMetadataHook<T>;
}

// =============================================================================
// Prompt Configuration
// =============================================================================
// WHY SEPARATE PROMPT CONFIG:
// Prompts are the interface to the LLM. They need to be:
// - Easy to tune without touching logic
// - Consistent across similar schemas
// - Clear about what the LLM should do
// =============================================================================

export interface SchemaPrompts {
  /**
   * The task description for the LLM.
   * WHY: This is the most important part of the prompt. It tells the LLM
   * what cognitive work to do. Should be specific enough to guide behavior,
   * general enough to handle varied inputs.
   *
   * GOOD: "Analyze entity behavior patterns. Track trust signals, red flags,
   *        and overall trust score. Be skeptical by default."
   * BAD:  "Look at the messages."
   */
  task: string;

  /**
   * The directive field name in routing prompts.
   *
   * WHY: When existing memories exist, the LLM must decide:
   * - Update an existing memory? (return its ID)
   * - Create a new one? (return "new")
   * - Skip? (return "NONE")
   *
   * Defaults to `${name}IdOrNew` (e.g., "conversationIdOrNew").
   * Set to 'NONE' for schemas that always create new (e.g., verification).
   */
  routingDirective?: string;

  /**
   * Additional context to include in prompts.
   * WHY: Some evaluators need extra data. {{providers}} injects output
   * from other providers, enabling cross-evaluator context.
   */
  additionalContext?: string;
}

// =============================================================================
// Main Schema Definition
// =============================================================================
// WHY THIS STRUCTURE:
// A schema completely describes a cognitive memory type:
// - Identity (name, table)
// - Storage behavior (scope)
// - Data shape (fields)
// - LLM interaction (prompts)
// - Customization (hooks)
// - Runtime integration (provider, evaluator config)
// =============================================================================

/**
 * Memory scope determines how memories are filtered.
 * WHY THREE SCOPES:
 * - 'room': Per-channel context (conversations happen in rooms)
 * - 'entity': Per-user context (trust is per-person)
 * - 'global': Agent-wide context (hypotheses aren't tied to location)
 */
export type MemoryScope = 'room' | 'entity' | 'global';

export interface CognitiveMemorySchema<
  TName extends string = string,
  TFields extends Record<string, FieldDef> = Record<string, FieldDef>,
> {
  /**
   * Unique identifier for this cognitive memory type.
   * WHY: Used to generate metadata type key (`neuro:${name}`), table names
   * (if not specified), evaluator/provider names. Keep it short and descriptive.
   */
  name: TName;

  /**
   * Database table name for storing memories.
   * WHY SEPARATE FROM NAME: Allows migration. If we rename "convo" to
   * "conversation", we can keep table: 'convos' for backwards compatibility.
   */
  table: string;

  /**
   * Memory scope determines query filtering.
   * WHY: Different cognitive structures have different natural boundaries.
   * - Conversations are room-specific (what we talked about here)
   * - Trust is entity-specific (what I think of this person)
   * - Hypotheses are global (my predictions about the world)
   */
  scope: MemoryScope;

  /**
   * Field definitions for this memory type.
   * WHY EXPLICIT FIELDS: Enables automatic:
   * - TypeScript type generation (no manual interface definitions)
   * - XML schema for LLM prompts
   * - Metadata extraction from LLM responses
   * - CSV formatting for context
   */
  fields: TFields;

  /**
   * Prompt configuration for the LLM.
   */
  prompts: SchemaPrompts;

  /**
   * Optional hooks for customization.
   * WHY OPTIONAL: Most schemas work with defaults. Hooks are for edge cases.
   */
  hooks?: SchemaHooks;

  /**
   * Provider configuration.
   * WHY: Providers inject context into the agent's prompt. Configuration
   * controls how this memory type appears to other parts of the system.
   */
  provider?: {
    name?: string;
    description?: string;
    /**
     * Whether provider is dynamic (runs on every message).
     * WHY: Some providers are expensive or noisy. Set to false for
     * on-demand providers that only run when explicitly requested.
     */
    dynamic?: boolean;
    headerText?: string;
    emptyText?: string;
    /**
     * Salience configuration for filtering relevant memories.
     * WHY: Not all memories are relevant to the current context.
     * Salience scoring filters to the most relevant ones.
     */
    salience?: {
      /** Whether to use salience filtering (default: true) */
      enabled?: boolean;
      /** Minimum salience to include (0-1, default: 0.2) */
      threshold?: number;
      /** Max memories to return (default: 10) */
      maxResults?: number;
    };
    /**
     * Relations configuration for including related memories.
     * WHY: Cognitive memories don't exist in isolation. A task might
     * relate to a hypothesis, which came from patterns. Including
     * related memories gives the agent fuller context.
     */
    relations?: {
      /** Whether to include related memories (default: false) */
      enabled?: boolean;
      /** Max traversal depth (default: 1) */
      maxDepth?: number;
      /** Schema types to include (default: all) */
      includeTypes?: string[];
      /** Max related memories per type (default: 3) */
      maxPerType?: number;
    };
  };

  /**
   * Evaluator configuration.
   */
  evaluator?: {
    name?: string;
    description?: string;
  };
}

// =============================================================================
// Generated Types
// =============================================================================
// WHY TYPE INFERENCE:
// Instead of manually defining interfaces for each memory type's metadata,
// we infer them from the schema. This ensures:
// - Type safety without boilerplate
// - Single source of truth (schema defines structure)
// - Automatic updates when schema changes
// =============================================================================

/**
 * Infer metadata type from schema fields.
 *
 * WHY: TypeScript can derive the shape of metadata from field definitions.
 * This means schema authors get type safety without writing interfaces.
 *
 * EXAMPLE:
 * const schema = defineSchema({ fields: { score: { type: 'number' } } });
 * type Meta = InferMetadata<typeof schema>; // { type: string; score: number }
 */
export type InferMetadata<T extends CognitiveMemorySchema> = CustomMetadata &
  Record<string, unknown> & {
    type: 'custom';
    neuroType: `neuro:${T['name']}`;
  } & {
    [K in keyof T['fields']]: T['fields'][K] extends { type: 'string' }
      ? string
      : T['fields'][K] extends { type: 'number' }
        ? number
        : T['fields'][K] extends { type: 'boolean' }
          ? boolean
          : T['fields'][K] extends { type: 'array' }
            ? string[]
            : T['fields'][K] extends { type: 'enum'; options: infer O }
              ? O extends readonly string[]
                ? O[number]
                : string
              : T['fields'][K] extends { type: 'timestamp' }
                ? number
                : unknown;
  };

/**
 * Helper to create a typed schema with inference.
 *
 * WHY: Enables TypeScript to infer the full schema type from the definition.
 * Without this helper, you'd need explicit type annotations everywhere.
 */
export function defineSchema<
  TName extends string,
  TFields extends Record<string, FieldDef>,
>(
  schema: CognitiveMemorySchema<TName, TFields>
): CognitiveMemorySchema<TName, TFields> {
  return schema;
}

// =============================================================================
// Schema Utilities
// =============================================================================

/**
 * Generate metadata type key from schema name.
 * WHY: All neuro memories are prefixed with "neuro:" to distinguish from
 * other memory types in the system. This enables easy filtering.
 */
export function getMetadataType<T extends CognitiveMemorySchema>(
  schema: T
): `neuro:${T['name']}` {
  return `neuro:${schema.name}` as `neuro:${T['name']}`;
}

/**
 * Generate directive key for routing prompts.
 * WHY: Consistent naming convention makes prompts predictable.
 * conversationIdOrNew, hypothesisIdOrNew, etc.
 */
export function getDirectiveKey(schema: CognitiveMemorySchema): string {
  return schema.prompts.routingDirective ?? `${schema.name}IdOrNew`;
}

/**
 * Check if a memory matches a schema's type.
 * WHY: Type guards enable type-safe filtering. After this check,
 * TypeScript knows the memory's metadata shape.
 */
export function isMemoryOfType<T extends CognitiveMemorySchema>(
  memory: Memory,
  schema: T
): memory is CognitiveMemory<InferMetadata<T>> {
  return (
    memory.metadata?.type === 'custom' &&
    (memory.metadata as Record<string, unknown>)?.neuroType ===
      getMetadataType(schema)
  );
}
