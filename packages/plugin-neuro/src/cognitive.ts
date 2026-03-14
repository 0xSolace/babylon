/**
 * Cognitive Memory Engine
 *
 * WHY THIS ENGINE EXISTS:
 * ======================
 * Every cognitive evaluator does the same dance:
 * 1. Load existing memories → 2. Format for LLM → 3. Prompt LLM →
 * 4. Parse response → 5. Save memory
 *
 * This was ~250 lines per evaluator. The engine extracts this pattern,
 * reducing each cognitive type to a ~30-line schema definition.
 *
 * HOW IT WORKS:
 * ============
 * createCognitiveMemory(schema) returns:
 * - evaluator: Runs on each message, calls LLM, creates/updates memories
 * - provider: Injects memory summary into agent's context
 * - typeGuard: Type-safe memory filtering
 *
 * The engine handles two execution paths:
 * 1. ROUTING (existing memories exist): "Which memory does this relate to?"
 * 2. INITIALIZATION (no memories yet): "What memories should I create?"
 *
 * WHY XML FOR LLM COMMUNICATION:
 * =============================
 * We tested JSON, YAML, and plain text. XML won because:
 * - Clear field boundaries (no escape character hell like JSON)
 * - LLMs trained on tons of XML (HTML, RSS, configs)
 * - Easy regex fallback parsing when DOMParser isn't available
 * - Nested structures are intuitive
 */

import {
  type ActionResult,
  asUUID,
  type Evaluator,
  formatMessages,
  getEntityDetails,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type Provider,
  type State,
  type UUID,
} from '@elizaos/core';
import { v4 } from 'uuid';
import {
  DEFAULT_SALIENCE_CONFIG,
  filterBySalience,
  type SalienceConfig,
  type SalienceContext,
} from './dynamics/salience.ts';
import {
  mergeMessageIds,
  mergeStringLists,
  toCsvArray,
  toNumber,
  toStringSafe,
} from './metadata.ts';
import {
  buildRelationshipMap,
  formatRelationshipMap,
  type RelationQueryOptions,
} from './relations.ts';
import type {
  CognitiveMemory,
  CognitiveMemorySchema,
  FieldDef,
  InferMetadata,
} from './schema.ts';
import { getDirectiveKey, getMetadataType, isMemoryOfType } from './schema.ts';
import {
  asRecord,
  extractNodes,
  getDirective,
  type ParsedNode,
  parseDirectiveList,
  parseXml,
} from './utils.ts';

// =============================================================================
// XML Schema Generation
// =============================================================================
// WHY GENERATE XML SCHEMAS:
// The LLM needs to know what fields to fill. By generating the schema from
// field definitions, we ensure consistency between what we ask for and what
// we can parse. Change the schema once, both sides update.
// =============================================================================

/**
 * Generate XML schema fragment for a single field.
 *
 * WHY INCLUDE HINTS:
 * - Enums show options: (formal|casual|technical) guides the LLM
 * - Numbers show ranges: (0-100) prevents out-of-range values
 * - Arrays note format: (comma-separated) clarifies structure
 * Without hints, LLMs often produce unusable output.
 */
function fieldToXml(name: string, def: FieldDef): string {
  let hint = def.description;

  // WHY: Show enum options so LLM knows valid values
  if (def.type === 'enum' && def.options) {
    hint += ` (${def.options.join('|')})`;
  } else if (def.type === 'array') {
    // WHY: Comma-separated is parseable; newlines/bullets aren't
    hint += ' (comma-separated)';
  } else if (def.type === 'number') {
    if (def.min !== undefined && def.max !== undefined) {
      hint += ` (${def.min}-${def.max})`;
    }
  }

  return `  <${name}>${hint}</${name}>`;
}

/**
 * Generate full XML schema from field definitions.
 *
 * WHY includeDirective PARAMETER:
 * - Routing prompts need directive field (which memory to update?)
 * - Init prompts don't (creating fresh, no routing needed)
 */
function generateXmlSchema(
  schema: CognitiveMemorySchema,
  includeDirective: boolean
): string {
  const lines: string[] = ['<response>'];

  // WHY: Directive tells us what to do with the response
  // Options: existing ID (update), "new" (create), "NONE" (skip)
  if (includeDirective) {
    const directiveKey = getDirectiveKey(schema);
    if (directiveKey !== 'NONE') {
      lines.push(
        `  <${directiveKey}>ID of existing ${schema.name} to update, OR "new" to create, OR "NONE" to skip</${directiveKey}>`
      );
    }
  }

  // WHY: <reasoning> captures LLM's thought process for debugging
  // Also acts as "chain of thought" which improves output quality
  lines.push('  <reasoning>Your analysis</reasoning>');

  for (const [name, def] of Object.entries(schema.fields)) {
    lines.push(fieldToXml(name, def));
  }

  lines.push('</response>');
  return lines.join('\n');
}

/**
 * Generate XML schema for initialization (multiple items).
 *
 * WHY DIFFERENT FROM ROUTING SCHEMA:
 * During initialization, there are no existing memories to route to.
 * Instead, the LLM analyzes recent messages and may create multiple
 * new memories at once (e.g., "I see 3 conversation threads here").
 */
function generateInitXmlSchema(schema: CognitiveMemorySchema): string {
  const singular = schema.name;
  const plural = `${schema.name}s`;

  const fieldLines = Object.entries(schema.fields)
    .map(([name, def]) => `      ${fieldToXml(name, def).trim()}`)
    .join('\n');

  // WHY NESTED STRUCTURE: <conversations><conversation>...</conversation></conversations>
  // Allows LLM to return 0, 1, or many items. The comment reminds it that
  // returning none is valid ("or leave empty if none").
  return `<response>
  <${plural}>
    <${singular}>
      <reasoning>Your analysis</reasoning>
${fieldLines}
    </${singular}>
    <!-- Add more ${plural} as needed, or leave empty if none -->
  </${plural}>
</response>`;
}

// =============================================================================
// CSV Formatting
// =============================================================================
// WHY CSV FOR CONTEXT:
// When existing memories exist, the LLM needs to see them to decide:
// "Does this message relate to an existing memory, or is it new?"
//
// CSV is compact (fits more context in token limit), parseable by LLMs,
// and includes IDs for routing (LLM can say "update abc-123").
// =============================================================================

/**
 * Generate CSV from memories using field definitions.
 *
 * WHY NOT JSON:
 * JSON uses more tokens (quotes, brackets, escaping).
 * CSV is ~40% smaller for the same data, and LLMs parse it fine.
 */
function generateCsv<T extends CognitiveMemorySchema>(
  memories: Array<CognitiveMemory<InferMetadata<T>>>,
  schema: T
): string {
  if (memories.length === 0) return '';

  const fieldNames = Object.keys(schema.fields);
  // WHY ID FIRST: LLM needs IDs to route ("update this one").
  // Having ID as first column makes it visually prominent.
  const headers = ['id', ...fieldNames];

  const rows = memories.map((memory) => {
    const metadata = memory.metadata;
    const values = [memory.id ?? ''];

    for (const fieldName of fieldNames) {
      const value = (metadata as Record<string, unknown>)[fieldName];
      const def = schema.fields[fieldName];

      // WHY SEMICOLONS FOR ARRAYS: Commas are CSV delimiters.
      // Using semicolons inside arrays prevents parsing ambiguity.
      if (def.type === 'array' && Array.isArray(value)) {
        values.push(value.join('; '));
      } else if (value === undefined || value === null) {
        values.push('');
      } else {
        values.push(String(value));
      }
    }

    return values.join(',');
  });

  return `${headers.join(',')}\n${rows.join('\n')}\n`;
}

// =============================================================================
// Metadata Extraction
// =============================================================================
// WHY SEPARATE EXTRACTION:
// LLM outputs are messy. They might:
// - Omit fields (use defaults)
// - Return wrong types ("fifty" instead of 50)
// - Include extra fields (ignore them)
// - Return out-of-range values (clamp them)
//
// This function normalizes LLM output into clean metadata.
// =============================================================================

/**
 * Extract metadata from parsed XML node using schema field definitions.
 *
 * WHY existing PARAMETER:
 * When updating a memory, we want to merge, not replace.
 * - Arrays: merge new items with existing
 * - Strings: prefer new value, fall back to existing
 * - Numbers: prefer new value, fall back to existing
 * This preserves accumulated data while allowing updates.
 */
function extractMetadata<T extends CognitiveMemorySchema>(
  node: ParsedNode,
  schema: T,
  messageId: string | undefined,
  existing?: Partial<InferMetadata<T>>
): InferMetadata<T> {
  const metadataType = getMetadataType(schema);
  const result: Record<string, unknown> = {
    type: 'custom',
    neuroType: metadataType,
  };

  for (const [fieldName, def] of Object.entries(schema.fields)) {
    const rawValue = node[fieldName];
    const existingValue = existing
      ? (existing as Record<string, unknown>)[fieldName]
      : undefined;

    switch (def.type) {
      case 'string':
        // WHY FALLBACK CHAIN: raw → existing → default → empty
        // Ensures we always have a string, never undefined
        result[fieldName] = toStringSafe(
          rawValue,
          (existingValue as string) ?? def.default ?? ''
        );
        break;

      case 'number': {
        const num = toNumber(
          rawValue,
          (existingValue as number) ?? def.default
        );
        if (num !== undefined) {
          // WHY CLAMPING: LLMs sometimes return out-of-range values.
          // "trust score: 150" should be clamped to 100.
          if (def.min !== undefined) result[fieldName] = Math.max(def.min, num);
          else if (def.max !== undefined)
            result[fieldName] = Math.min(def.max, num);
          else result[fieldName] = num;
        }
        break;
      }

      case 'boolean':
        // WHY STRING CHECK: LLMs often return "true" as string, not boolean
        if (rawValue !== undefined) {
          result[fieldName] = rawValue === true || rawValue === 'true';
        } else {
          result[fieldName] = existingValue ?? def.default ?? false;
        }
        break;

      case 'array':
        // WHY MERGE: Arrays accumulate over time. Don't lose existing items.
        // New items are added, duplicates are deduplicated.
        result[fieldName] = mergeStringLists(
          existingValue as string[] | undefined,
          toCsvArray(rawValue)
        );
        break;

      case 'enum':
        const strValue = toStringSafe(rawValue);
        // WHY VALIDATE: Only accept values that are in the options list.
        // LLMs might return "kinda positive" when options are [positive|neutral|negative].
        if (strValue && def.options.includes(strValue)) {
          result[fieldName] = strValue;
        } else {
          result[fieldName] = existingValue ?? def.default ?? def.options[0];
        }
        break;

      case 'timestamp':
        // WHY DATE.NOW() DEFAULT: If no timestamp provided, use current time.
        // This is usually what we want for "when was this observed?"
        result[fieldName] = toNumber(rawValue) ?? existingValue ?? Date.now();
        break;

      case 'ref':
        // WHY REFS AS STRINGS: UUIDs are strings. For multiple refs,
        // store as array of strings. Enables graph queries later.
        if (def.multiple) {
          result[fieldName] = mergeStringLists(
            existingValue as string[] | undefined,
            toCsvArray(rawValue)
          );
        } else {
          result[fieldName] = toStringSafe(
            rawValue,
            (existingValue as string) ?? ''
          );
        }
        break;
    }
  }

  // Handle common fields
  if ('messageIds' in node || messageId) {
    result.messageIds = mergeMessageIds(
      existing?.messageIds as string[] | undefined,
      [...toCsvArray(node.messageIds), ...(messageId ? [messageId] : [])]
    );
  }

  return result as InferMetadata<T>;
}

// =============================================================================
// Provider Generation
// =============================================================================

/**
 * Generate provider line from memory using schema.
 */
function formatProviderLine<T extends CognitiveMemorySchema>(
  memory: CognitiveMemory<InferMetadata<T>>,
  schema: T
): string {
  const metadata = memory.metadata;
  const parts: string[] = [];

  // Build a summary line from fields
  for (const [fieldName, def] of Object.entries(schema.fields)) {
    const value = (metadata as Record<string, unknown>)[fieldName];
    if (value === undefined || value === null) continue;

    if (def.type === 'array' && Array.isArray(value) && value.length > 0) {
      parts.push(
        `${fieldName}: ${value.slice(0, 3).join(', ')}${value.length > 3 ? '...' : ''}`
      );
    } else if (
      def.type === 'number' ||
      def.type === 'enum' ||
      def.type === 'string'
    ) {
      const strValue = String(value);
      if (strValue && strValue.length < 50) {
        parts.push(`${fieldName}: ${strValue}`);
      }
    }
  }

  return parts.join(' | ');
}

/**
 * Create provider from schema.
 *
 * WHY SALIENCE IN PROVIDERS:
 * Not all memories are equally relevant. Without salience:
 * - "User likes coffee" shows up when debugging code
 * - Context is polluted with irrelevant information
 * - Token budget is wasted
 *
 * With salience:
 * - Only contextually relevant memories are shown
 * - Most relevant first
 * - Configurable threshold and limits
 *
 * WHY RELATIONS IN PROVIDERS:
 * Cognitive memories often connect: a task stems from a hypothesis,
 * which arose from observed patterns. Including related memories gives
 * the agent fuller context for decision-making.
 */
function createProvider<T extends CognitiveMemorySchema>(
  schema: T,
  allSchemas?: CognitiveMemorySchema[]
): Provider {
  const providerName = schema.provider?.name ?? schema.name.toUpperCase();
  const description =
    schema.provider?.description ??
    `Provides ${schema.name} cognitive memories`;
  const headerText =
    schema.provider?.headerText ??
    `# ${schema.name.charAt(0).toUpperCase() + schema.name.slice(1)} memories`;
  const emptyText =
    schema.provider?.emptyText ?? `No ${schema.name} memories tracked.\n`;

  // Salience configuration
  const salienceEnabled = schema.provider?.salience?.enabled ?? true;
  const salienceThreshold = schema.provider?.salience?.threshold ?? 0.2;
  const salienceMaxResults = schema.provider?.salience?.maxResults ?? 10;

  // Relations configuration
  const relationsEnabled = schema.provider?.relations?.enabled ?? false;
  const relationsMaxDepth = schema.provider?.relations?.maxDepth ?? 1;
  const relationsIncludeTypes = schema.provider?.relations?.includeTypes;
  const relationsMaxPerType = schema.provider?.relations?.maxPerType ?? 3;

  return {
    name: providerName,
    description,
    dynamic: schema.provider?.dynamic ?? true,
    get: async (runtime: IAgentRuntime, message: Memory, _state: State) => {
      const logger = runtime.logger.child({
        namespace: `neuro:provider:${schema.name}`,
      });

      // Build query based on scope
      const query: {
        tableName: string;
        roomId?: UUID;
        entityId?: UUID;
        unique: boolean;
      } = {
        tableName: schema.table,
        unique: false,
      };

      if (schema.scope === 'room') {
        query.roomId = message.roomId;
      } else if (schema.scope === 'entity') {
        query.entityId = message.entityId;
      }
      // 'global' scope has no filter

      let memories = (await runtime.getMemories(query)).filter(
        (m): m is CognitiveMemory<InferMetadata<T>> => isMemoryOfType(m, schema)
      );

      if (memories.length === 0) {
        return {
          data: { [`${schema.name}Count`]: 0 },
          values: {},
          text: emptyText,
        };
      }

      // Apply salience filtering if enabled
      let filteredCount = memories.length;
      if (salienceEnabled && memories.length > 1) {
        const context: SalienceContext = {
          message,
          entityId: message.entityId,
          roomId: message.roomId,
        };

        const salienceConfig: SalienceConfig = {
          ...DEFAULT_SALIENCE_CONFIG,
          threshold: salienceThreshold,
          maxResults: salienceMaxResults,
        };

        memories = filterBySalience(memories, context, salienceConfig);
        filteredCount = memories.length;

        logger.debug(
          {
            original: filteredCount,
            filtered: memories.length,
            threshold: salienceThreshold,
          },
          `Applied salience filtering to ${schema.name}`
        );
      }

      if (memories.length === 0) {
        return {
          data: { [`${schema.name}Count`]: 0 },
          values: {},
          text: emptyText,
        };
      }

      // Build relations text if enabled
      let relationsText = '';
      if (
        relationsEnabled &&
        allSchemas &&
        allSchemas.length > 0 &&
        memories.length > 0
      ) {
        // Build relationship map for the most relevant memory
        const topMemory = memories[0];

        const relationOptions: RelationQueryOptions = {
          maxDepth: relationsMaxDepth,
          includeTypes: relationsIncludeTypes,
          followOutgoing: true,
          followIncoming: true,
        };

        try {
          const relationMap = await buildRelationshipMap(
            runtime,
            topMemory,
            allSchemas,
            relationOptions
          );

          // Format with limits
          if (relationMap.related.size > 0) {
            relationsText = formatRelationshipMap(relationMap, {
              maxPerType: relationsMaxPerType,
              showIds: false,
            });
          }
        } catch (err) {
          logger.warn({ err }, 'Failed to build relationship map');
        }
      }

      // Use custom formatter if provided
      let text: string;
      if (schema.hooks?.formatProvider) {
        text = schema.hooks.formatProvider(memories, message, runtime);
      } else {
        const lines = memories.map((m) => `- ${formatProviderLine(m, schema)}`);
        text = `${headerText}\n${lines.join('\n')}\n`;
      }

      // Append relations if available
      if (relationsText) {
        text += `\n${relationsText}`;
      }

      logger.debug(
        { count: memories.length },
        `Provided ${schema.name} summary`
      );

      return {
        data: { [`${schema.name}Count`]: memories.length },
        values: {},
        text,
      };
    },
  };
}

// =============================================================================
// Evaluator Generation
// =============================================================================

/**
 * Generate routing prompt (when existing memories exist).
 */
function generateRoutingPrompt<T extends CognitiveMemorySchema>(
  schema: T,
  existingCsv: string,
  formattedMessage: string
): string {
  const xmlSchema = generateXmlSchema(schema, true);

  return `<task>${schema.prompts.task}</task>

<existing${schema.name}s>
${existingCsv}
</existing${schema.name}s>

<message>
${formattedMessage}
</message>

${schema.prompts.additionalContext ?? ''}

<output>
Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the XML response format without any preamble or explanation.

Respond using XML format like this:
${xmlSchema}

IMPORTANT: Your response must ONLY contain the <response></response> XML block above. Do not include any text, thinking, or reasoning before or after this XML block. Start your response immediately with <response> and end with </response>.
</output>`;
}

/**
 * Generate initialization prompt (when no existing memories).
 */
function generateInitPrompt<T extends CognitiveMemorySchema>(
  schema: T,
  formattedMessages: string
): string {
  const xmlSchema = generateInitXmlSchema(schema);

  return `<task>${schema.prompts.task}</task>

<messages>
${formattedMessages}
</messages>

${schema.prompts.additionalContext ?? ''}

<output>
Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the XML response format without any preamble or explanation.

Respond using XML format like this:
${xmlSchema}

IMPORTANT: Your response must ONLY contain the <response></response> XML block above. Do not include any text, thinking, or reasoning before or after this XML block. Start your response immediately with <response> and end with </response>.
</output>`;
}

/**
 * Create evaluator from schema.
 */
function createEvaluator<T extends CognitiveMemorySchema>(
  schema: T
): Evaluator {
  const evaluatorName = schema.evaluator?.name ?? schema.name.toUpperCase();
  const description =
    schema.evaluator?.description ??
    `Analyze and track ${schema.name} cognitive memories`;
  const directiveKey = getDirectiveKey(schema);

  return {
    name: evaluatorName,
    similes: [],
    description,
    examples: [],

    validate: async (
      runtime: IAgentRuntime,
      message: Memory,
      state?: State
    ): Promise<boolean> => {
      // Use custom validation if provided
      if (schema.hooks?.validate) {
        return schema.hooks.validate(runtime, message, state);
      }
      // Default: always run
      return true;
    },

    handler: async (
      runtime: IAgentRuntime,
      message: Memory,
      _state?: State
    ): Promise<ActionResult | undefined> => {
      const logger = runtime.logger.child({
        namespace: `neuro:${schema.name}`,
      });
      const { roomId } = message;

      // Build query based on scope
      const query: {
        tableName: string;
        roomId?: UUID;
        entityId?: UUID;
        unique: boolean;
      } = {
        tableName: schema.table,
        unique: false,
      };

      if (schema.scope === 'room') {
        query.roomId = roomId;
      } else if (schema.scope === 'entity') {
        query.entityId = message.entityId;
      }

      const existingMemories = (await runtime.getMemories(query)).filter(
        (m): m is CognitiveMemory<InferMetadata<T>> => isMemoryOfType(m, schema)
      );

      const entitiesData = await getEntityDetails({ runtime, roomId });
      logger.debug(
        { count: existingMemories.length },
        `Loaded existing ${schema.name} memories`
      );

      // Branch: routing (existing memories) vs initialization (no memories)
      if (existingMemories.length > 0) {
        // ROUTING BRANCH
        const csv = schema.hooks?.formatCsv
          ? schema.hooks.formatCsv(existingMemories)
          : generateCsv(existingMemories, schema);

        const formattedMessage = await formatMessages({
          messages: [message],
          entities: entitiesData,
        });

        const prompt = generateRoutingPrompt(schema, csv, formattedMessage);

        const response = await runtime.useModel(ModelType.TEXT_LARGE, {
          prompt,
        });
        logger.debug({ response }, `Model response for ${schema.name} routing`);

        const parsed = parseXml(response);
        const parsedRecord = asRecord(parsed);
        if (!parsedRecord) {
          logger.warn(`Unable to parse ${schema.name} routing response`);
          return;
        }

        // Handle NONE directive (schema says to always create)
        if (directiveKey === 'NONE') {
          // Always create new
          const metadata = (
            schema.hooks?.extractMetadata
              ? schema.hooks.extractMetadata(parsedRecord, message.id)
              : extractMetadata(parsedRecord, schema, message.id)
          ) as InferMetadata<T>;

          const newMemory: CognitiveMemory<InferMetadata<T>> = {
            id: asUUID(v4()),
            entityId: runtime.agentId,
            agentId: runtime.agentId,
            content: {},
            roomId,
            createdAt: Date.now(),
            metadata,
          };

          if (schema.hooks?.beforeSave) {
            await schema.hooks.beforeSave(runtime, newMemory, true);
          }

          await runtime.createMemory(newMemory, schema.table);
          logger.info(
            { memoryId: newMemory.id },
            `Created new ${schema.name} memory`
          );

          if (schema.hooks?.afterSave) {
            await schema.hooks.afterSave(runtime, newMemory, true);
          }
          return;
        }

        // Get directive from response
        const directive = getDirective(
          parsedRecord,
          directiveKey,
          `${schema.name}Id`
        );
        if (!directive) {
          logger.warn(`Model response missing ${schema.name} directive`);
          return;
        }

        const directiveLower = directive.toLowerCase();

        // Handle NONE (skip)
        if (directiveLower === 'none') {
          logger.info(`Model chose not to create/update any ${schema.name}`);
          return;
        }

        // Handle NEW
        if (directiveLower === 'new') {
          const metadata = (
            schema.hooks?.extractMetadata
              ? schema.hooks.extractMetadata(parsedRecord, message.id)
              : extractMetadata(parsedRecord, schema, message.id)
          ) as InferMetadata<T>;

          const newMemory: CognitiveMemory<InferMetadata<T>> = {
            id: asUUID(v4()),
            entityId: runtime.agentId,
            agentId: runtime.agentId,
            content: {},
            roomId,
            createdAt: Date.now(),
            metadata,
          };

          if (schema.hooks?.beforeSave) {
            await schema.hooks.beforeSave(runtime, newMemory, true);
          }

          await runtime.createMemory(newMemory, schema.table);
          logger.info(
            { memoryId: newMemory.id },
            `Created new ${schema.name} memory`
          );

          if (schema.hooks?.afterSave) {
            await schema.hooks.afterSave(runtime, newMemory, true);
          }
          return;
        }

        // Handle UPDATE (directive is an existing ID)
        const directiveList = parseDirectiveList(directive);
        const targetMemory = existingMemories.find(
          (m) => m.id === directiveList[0]
        );
        if (!targetMemory || !targetMemory.id) {
          logger.warn(
            { directive: directiveList[0] },
            `Unable to match ${schema.name} directive to existing memory`
          );
          return;
        }

        const updatedMetadata = (
          schema.hooks?.extractMetadata
            ? schema.hooks.extractMetadata(
                parsedRecord,
                message.id,
                targetMemory.metadata
              )
            : extractMetadata(
                parsedRecord,
                schema,
                message.id,
                targetMemory.metadata
              )
        ) as InferMetadata<T>;

        const updatedMemory: CognitiveMemory<InferMetadata<T>> = {
          ...targetMemory,
          metadata: updatedMetadata,
        };

        if (schema.hooks?.beforeSave) {
          await schema.hooks.beforeSave(runtime, updatedMemory, false);
        }

        await runtime.updateMemory({
          id: targetMemory.id,
          metadata: updatedMetadata,
        });
        logger.debug(
          { memoryId: targetMemory.id },
          `Updated ${schema.name} memory`
        );

        if (schema.hooks?.afterSave) {
          await schema.hooks.afterSave(runtime, updatedMemory, false);
        }
        return;
      }

      // INITIALIZATION BRANCH (no existing memories)
      const conversationLength = runtime.getConversationLength();
      const recentMessages = await runtime.getMemories({
        tableName: 'messages',
        roomId,
        count: conversationLength,
        unique: false,
      });

      const dialogueMessages = recentMessages.filter(
        (msg) => msg.content?.type !== 'action_result'
      );

      const formattedMessages = await formatMessages({
        messages: dialogueMessages,
        entities: entitiesData,
      });

      const prompt = generateInitPrompt(schema, formattedMessages);

      const response = await runtime.useModel(ModelType.TEXT_LARGE, { prompt });
      logger.debug(
        { response },
        `Model response for ${schema.name} initialization`
      );

      const parsed = parseXml(response);
      const nodes = extractNodes(
        asRecord(parsed),
        schema.name,
        `${schema.name}s`
      );

      if (nodes.length === 0) {
        logger.info(`Model did not return any ${schema.name}s to create`);
        return;
      }

      for (const node of nodes) {
        const metadata = (
          schema.hooks?.extractMetadata
            ? schema.hooks.extractMetadata(node, message.id)
            : extractMetadata(node, schema, message.id)
        ) as InferMetadata<T>;

        const newMemory: CognitiveMemory<InferMetadata<T>> = {
          id: asUUID(v4()),
          entityId: runtime.agentId,
          agentId: runtime.agentId,
          content: {},
          roomId,
          createdAt: Date.now(),
          metadata,
        };

        if (schema.hooks?.beforeSave) {
          await schema.hooks.beforeSave(runtime, newMemory, true);
        }

        await runtime.createMemory(newMemory, schema.table);
        logger.info(
          { memoryId: newMemory.id },
          `Created ${schema.name} memory during initialization`
        );

        if (schema.hooks?.afterSave) {
          await schema.hooks.afterSave(runtime, newMemory, true);
        }
      }
    },
  };
}

// =============================================================================
// Main Export
// =============================================================================

export interface CognitiveMemoryResult<T extends CognitiveMemorySchema> {
  evaluator: Evaluator;
  provider: Provider;
  typeGuard: (memory: Memory) => memory is CognitiveMemory<InferMetadata<T>>;
  metadataType: `neuro:${T['name']}`;
  schema: T;
}

export interface CognitiveMemoryOptions {
  /**
   * All schemas for relation traversal.
   * WHY: To follow references, we need to know about other memory types.
   * Pass all your schemas here to enable cross-memory queries.
   */
  allSchemas?: CognitiveMemorySchema[];
}

/**
 * Create a complete cognitive memory system from a schema definition.
 *
 * @param schema - The schema defining the cognitive memory type
 * @param options - Optional configuration including schemas for relations
 * @returns Evaluator, provider, type guard, and metadata type
 *
 * @example
 * ```typescript
 * // Basic usage
 * const culture = createCognitiveMemory(cultureSchema);
 *
 * // With relations enabled (for cross-memory queries in provider)
 * const hypothesis = createCognitiveMemory(hypothesisSchema, {
 *   allSchemas: [conversationSchema, patternSchema, hypothesisSchema],
 * });
 *
 * // Use in plugin
 * export const neuroPlugin: Plugin = {
 *   evaluators: [culture.evaluator],
 *   providers: [culture.provider],
 * };
 *
 * // Use type guard
 * if (culture.typeGuard(memory)) {
 *   // memory.metadata is typed as CultureMetadata
 * }
 * ```
 */
export function createCognitiveMemory<T extends CognitiveMemorySchema>(
  schema: T,
  options?: CognitiveMemoryOptions
): CognitiveMemoryResult<T> {
  return {
    evaluator: createEvaluator(schema),
    provider: createProvider(schema, options?.allSchemas),
    typeGuard: (memory: Memory): memory is CognitiveMemory<InferMetadata<T>> =>
      isMemoryOfType(memory, schema),
    metadataType: getMetadataType(schema),
    schema,
  };
}
