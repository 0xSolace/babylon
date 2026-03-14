/**
 * Cross-Memory Relations
 *
 * WHY THIS EXISTS:
 * ================
 * Cognitive memories don't exist in isolation. A task might spawn from a
 * hypothesis, which came from observing patterns in conversations. These
 * relationships are captured via `ref` fields, but we need utilities to:
 *
 * 1. Follow a single reference (task → parentTask)
 * 2. Follow reverse references (hypothesis → all tasks that reference it)
 * 3. Build relationship graphs (conversation → patterns → hypotheses → narratives)
 * 4. Query by relationship (all memories related to entity X)
 *
 * WHY NOT USE A GRAPH DATABASE:
 * ============================
 * We're built on elizaOS's memory system (which uses relational DB). Adding
 * a graph DB would be:
 * - Another dependency to manage
 * - Another data sync to maintain
 * - Overkill for our current query patterns
 *
 * Instead, we build graph traversal on top of the existing memory queries.
 * This is O(depth) queries for graph traversal, which is fine for our
 * shallow relationship depths (typically 1-3 levels).
 *
 * WHY RELATIONSHIP MAPS:
 * =====================
 * Sometimes you need the full picture: "show me everything related to X".
 * RelationshipMap collects all connected memories into a traversable structure.
 * This enables:
 * - Debugging (why did the agent form this hypothesis?)
 * - Narrative building (what led to this conclusion?)
 * - Impact analysis (what would change if we remove this memory?)
 */

import type { IAgentRuntime, Memory, UUID } from '@elizaos/core';
import type { CognitiveMemorySchema, RefFieldDef } from './schema.ts';
import { getMetadataType, isMemoryOfType } from './schema.ts';

function getNeuroType(memory: Memory): string | undefined {
  const metadata = memory.metadata as Record<string, unknown> | undefined;
  const neuroType = metadata?.neuroType;
  return typeof neuroType === 'string' ? neuroType : undefined;
}

function getSchemaNameFromMemory(memory: Memory): string {
  const neuroType = getNeuroType(memory);
  return neuroType?.replace('neuro:', '') ?? '';
}

// =============================================================================
// Types
// =============================================================================

/**
 * A reference from one memory to another.
 * WHY: Explicit structure makes traversal predictable.
 */
export interface MemoryRef {
  /** The field name that contains the reference */
  field: string;
  /** The schema type being referenced */
  refType: string;
  /** The referenced memory ID(s) */
  targetIds: string[];
}

/**
 * Result of resolving a reference - the actual memory.
 * WHY: After following a ref, you want the memory, not just the ID.
 */
export interface ResolvedRef {
  field: string;
  refType: string;
  memories: Memory[];
}

/**
 * A node in the relationship graph.
 * WHY: Captures both the memory and its connections for traversal.
 */
export interface RelationNode {
  memory: Memory;
  /** Outgoing references (this memory → others) */
  outgoing: ResolvedRef[];
  /** Incoming references (others → this memory) */
  incoming: ResolvedRef[];
}

/**
 * Complete relationship map centered on a memory.
 * WHY: Enables full context queries like "what's related to this hypothesis?"
 */
export interface RelationshipMap {
  /** The central memory we're mapping from */
  center: Memory;
  /** All related memories by schema type */
  related: Map<string, Memory[]>;
  /** Full graph nodes for traversal */
  nodes: Map<string, RelationNode>;
  /** Traversal depth reached */
  depth: number;
}

/**
 * Options for relationship queries.
 */
export interface RelationQueryOptions {
  /** Maximum depth to traverse (default: 2) */
  maxDepth?: number;
  /** Schema types to include (default: all) */
  includeTypes?: string[];
  /** Schema types to exclude */
  excludeTypes?: string[];
  /** Whether to follow incoming references (default: true) */
  followIncoming?: boolean;
  /** Whether to follow outgoing references (default: true) */
  followOutgoing?: boolean;
}

// =============================================================================
// Schema Introspection
// =============================================================================

/**
 * Extract all ref fields from a schema.
 * WHY: Before we can follow references, we need to know which fields are refs.
 */
export function getRefFields(schema: CognitiveMemorySchema): Array<{
  name: string;
  refType: string;
  multiple: boolean;
}> {
  const refs: Array<{ name: string; refType: string; multiple: boolean }> = [];

  for (const [name, field] of Object.entries(schema.fields)) {
    if (field.type === 'ref') {
      const refField = field as RefFieldDef;
      refs.push({
        name,
        refType: refField.refType,
        multiple: refField.multiple ?? false,
      });
    }
  }

  return refs;
}

/**
 * Extract references from a memory's metadata.
 * WHY: Given a memory, find what it references.
 */
export function extractRefs(
  memory: Memory,
  schema: CognitiveMemorySchema
): MemoryRef[] {
  const refs: MemoryRef[] = [];
  const metadata = memory.metadata as Record<string, unknown>;

  if (!metadata) return refs;

  const refFields = getRefFields(schema);

  for (const { name, refType, multiple } of refFields) {
    const value = metadata[name];
    if (!value) continue;

    const targetIds: string[] = multiple
      ? (Array.isArray(value) ? value : []).filter(Boolean).map(String)
      : [String(value)];

    if (targetIds.length > 0) {
      refs.push({ field: name, refType, targetIds });
    }
  }

  return refs;
}

// =============================================================================
// Single Reference Resolution
// =============================================================================

/**
 * Resolve a single reference to its target memory.
 * WHY: The atomic operation for following refs. Used by higher-level functions.
 *
 * @example
 * const parentTask = await resolveRef(runtime, task, taskSchema, 'parentTaskId');
 */
export async function resolveRef(
  runtime: IAgentRuntime,
  memory: Memory,
  schema: CognitiveMemorySchema,
  fieldName: string
): Promise<Memory | null> {
  const metadata = memory.metadata as Record<string, unknown>;
  const targetId = metadata?.[fieldName];

  if (!targetId || typeof targetId !== 'string') {
    return null;
  }

  // Find the ref field to get the target type
  const refField = schema.fields[fieldName];
  if (!refField || refField.type !== 'ref') {
    return null;
  }

  // Query for the target memory
  const memories = await runtime.getMemories({
    tableName: (refField as RefFieldDef).refType,
    count: 1,
  });

  return memories.find((m) => m.id === targetId) ?? null;
}

/**
 * Resolve multiple references from a single field.
 * WHY: For ref fields with multiple: true.
 *
 * @example
 * const conversations = await resolveRefs(runtime, narrative, narrativeSchema, 'conversationIds');
 */
export async function resolveRefs(
  runtime: IAgentRuntime,
  memory: Memory,
  schema: CognitiveMemorySchema,
  fieldName: string
): Promise<Memory[]> {
  const metadata = memory.metadata as Record<string, unknown>;
  const targetIds = metadata?.[fieldName];

  if (!targetIds || !Array.isArray(targetIds)) {
    return [];
  }

  const refField = schema.fields[fieldName];
  if (!refField || refField.type !== 'ref') {
    return [];
  }

  const memories = await runtime.getMemories({
    tableName: (refField as RefFieldDef).refType,
    count: 100, // Reasonable upper bound
  });

  const idSet = new Set(targetIds.map(String));
  return memories.filter((m) => typeof m.id === 'string' && idSet.has(m.id));
}

/**
 * Resolve all outgoing references from a memory.
 * WHY: Get everything this memory points to.
 *
 * @example
 * const related = await resolveAllRefs(runtime, hypothesis, hypothesisSchema);
 * // { conversations: [...], patterns: [...] }
 */
export async function resolveAllRefs(
  runtime: IAgentRuntime,
  memory: Memory,
  schema: CognitiveMemorySchema
): Promise<ResolvedRef[]> {
  const refs = extractRefs(memory, schema);
  const resolved: ResolvedRef[] = [];

  for (const ref of refs) {
    const memories = await runtime.getMemories({
      tableName: ref.refType,
      count: 100,
    });

    const idSet = new Set(ref.targetIds);
    const matched = memories.filter(
      (m) => typeof m.id === 'string' && idSet.has(m.id)
    );

    resolved.push({
      field: ref.field,
      refType: ref.refType,
      memories: matched,
    });
  }

  return resolved;
}

// =============================================================================
// Reverse Reference Resolution
// =============================================================================

/**
 * Find all memories that reference a given memory.
 * WHY: Reverse lookups answer "what depends on this?" or "what came from this?"
 *
 * @example
 * const dependentTasks = await findReferencingMemories(runtime, hypothesis, [taskSchema]);
 */
export async function findReferencingMemories(
  runtime: IAgentRuntime,
  targetMemory: Memory,
  schemas: CognitiveMemorySchema[]
): Promise<Map<string, Memory[]>> {
  const result = new Map<string, Memory[]>();
  const targetId = targetMemory.id;

  for (const schema of schemas) {
    // Only check schemas that have ref fields pointing to target's type
    const refFields = getRefFields(schema);
    const targetSchemaName = getSchemaNameFromMemory(targetMemory);

    const relevantRefs = refFields.filter(
      (r) => r.refType === targetSchemaName
    );
    if (relevantRefs.length === 0) continue;

    // Query all memories of this schema type
    const memories = await runtime.getMemories({
      tableName: schema.table,
      count: 100,
    });

    // Filter to those referencing our target
    const matching = memories.filter((m) => {
      const metadata = m.metadata as Record<string, unknown>;
      if (!metadata) return false;

      for (const { name, multiple } of relevantRefs) {
        const value = metadata[name];
        if (multiple && Array.isArray(value) && value.includes(targetId)) {
          return true;
        }
        if (!multiple && value === targetId) {
          return true;
        }
      }
      return false;
    });

    if (matching.length > 0) {
      result.set(schema.name, matching);
    }
  }

  return result;
}

// =============================================================================
// Graph Traversal
// =============================================================================

/**
 * Build a relationship map centered on a memory.
 * WHY: Full context for understanding how memories connect.
 *
 * @example
 * const map = await buildRelationshipMap(runtime, hypothesis, schemas, { maxDepth: 2 });
 * console.log(map.related.get('task')); // All tasks related to this hypothesis
 */
export async function buildRelationshipMap(
  runtime: IAgentRuntime,
  centerMemory: Memory,
  schemas: CognitiveMemorySchema[],
  options: RelationQueryOptions = {}
): Promise<RelationshipMap> {
  const {
    maxDepth = 2,
    includeTypes,
    excludeTypes = [],
    followIncoming = true,
    followOutgoing = true,
  } = options;

  // Filter schemas based on options
  const activeSchemas = schemas.filter((s) => {
    if (excludeTypes.includes(s.name)) return false;
    if (includeTypes && !includeTypes.includes(s.name)) return false;
    return true;
  });

  // Track visited to avoid cycles
  const visited = new Set<string>();
  const nodes = new Map<string, RelationNode>();
  const related = new Map<string, Memory[]>();

  // BFS traversal
  const queue: Array<{
    memory: Memory;
    depth: number;
    schema?: CognitiveMemorySchema;
  }> = [{ memory: centerMemory, depth: 0 }];

  // Find schema for center memory
  const centerSchemaName = getSchemaNameFromMemory(centerMemory);
  const centerSchema = activeSchemas.find((s) => s.name === centerSchemaName);

  while (queue.length > 0) {
    const { memory, depth, schema } = queue.shift()!;

    if (!memory.id) continue;
    if (visited.has(memory.id)) continue;
    visited.add(memory.id);

    // Initialize node
    const node: RelationNode = {
      memory,
      outgoing: [],
      incoming: [],
    };
    nodes.set(memory.id, node);

    // Track by type
    const memSchemaName = getSchemaNameFromMemory(memory) || 'unknown';

    if (!related.has(memSchemaName)) {
      related.set(memSchemaName, []);
    }
    if (memory.id !== centerMemory.id) {
      related.get(memSchemaName)!.push(memory);
    }

    // Stop traversal at max depth
    if (depth >= maxDepth) continue;

    // Find schema for this memory
    const memSchema =
      schema ?? activeSchemas.find((s) => s.name === memSchemaName);

    // Follow outgoing references
    if (followOutgoing && memSchema) {
      const outRefs = await resolveAllRefs(runtime, memory, memSchema);
      node.outgoing = outRefs;

      for (const ref of outRefs) {
        const refSchema = activeSchemas.find((s) => s.name === ref.refType);
        for (const refMem of ref.memories) {
          if (refMem.id && !visited.has(refMem.id)) {
            queue.push({ memory: refMem, depth: depth + 1, schema: refSchema });
          }
        }
      }
    }

    // Follow incoming references
    if (followIncoming) {
      const incoming = await findReferencingMemories(
        runtime,
        memory,
        activeSchemas
      );

      for (const [schemaName, memories] of incoming) {
        const inSchema = activeSchemas.find((s) => s.name === schemaName);

        node.incoming.push({
          field: '', // We don't track which field for incoming
          refType: schemaName,
          memories,
        });

        for (const inMem of memories) {
          if (inMem.id && !visited.has(inMem.id)) {
            queue.push({ memory: inMem, depth: depth + 1, schema: inSchema });
          }
        }
      }
    }
  }

  return {
    center: centerMemory,
    related,
    nodes,
    depth: maxDepth,
  };
}

// =============================================================================
// Convenience Queries
// =============================================================================

/**
 * Get all memories of a specific type related to a source memory.
 * WHY: Common query pattern - "get all tasks related to this hypothesis"
 *
 * @example
 * const tasks = await getRelatedByType(runtime, hypothesis, 'task', schemas);
 */
export async function getRelatedByType(
  runtime: IAgentRuntime,
  sourceMemory: Memory,
  targetType: string,
  schemas: CognitiveMemorySchema[],
  options: RelationQueryOptions = {}
): Promise<Memory[]> {
  const map = await buildRelationshipMap(runtime, sourceMemory, schemas, {
    ...options,
    includeTypes: [targetType, ...(options.includeTypes ?? [])],
  });

  return map.related.get(targetType) ?? [];
}

/**
 * Get the chain of memories from source to a specific target.
 * WHY: Trace lineage - "how did this narrative come from that conversation?"
 *
 * Returns null if no path exists.
 */
export async function findPath(
  runtime: IAgentRuntime,
  sourceId: string,
  targetId: string,
  schemas: CognitiveMemorySchema[],
  maxDepth: number = 5
): Promise<Memory[] | null> {
  // Get source memory
  const allMemories = await Promise.all(
    schemas.map((s) => runtime.getMemories({ tableName: s.table, count: 100 }))
  );
  const flatMemories = allMemories.flat();

  const sourceMemory = flatMemories.find((m) => m.id === sourceId);
  if (!sourceMemory) return null;

  // BFS to find path
  const visited = new Set<string>();
  const queue: Array<{ memory: Memory; path: Memory[] }> = [
    { memory: sourceMemory, path: [sourceMemory] },
  ];

  while (queue.length > 0) {
    const { memory, path } = queue.shift()!;

    if (path.length > maxDepth) continue;
    if (memory.id === targetId) return path;
    if (!memory.id) continue;
    if (visited.has(memory.id)) continue;
    visited.add(memory.id);

    // Find schema for this memory
    const memSchemaName = getSchemaNameFromMemory(memory);
    const memSchema = schemas.find((s) => s.name === memSchemaName);

    if (!memSchema) continue;

    // Follow outgoing refs
    const refs = extractRefs(memory, memSchema);
    for (const ref of refs) {
      for (const targetIdFromRef of ref.targetIds) {
        const targetMem = flatMemories.find((m) => m.id === targetIdFromRef);
        if (targetMem?.id && !visited.has(targetMem.id)) {
          queue.push({ memory: targetMem, path: [...path, targetMem] });
        }
      }
    }

    // Follow incoming refs
    for (const schema of schemas) {
      const refFields = getRefFields(schema);
      const relevantRefs = refFields.filter((r) => r.refType === memSchemaName);
      if (relevantRefs.length === 0) continue;

      const schemaMemories = flatMemories.filter(
        (m) => getNeuroType(m) === `neuro:${schema.name}`
      );

      for (const candidate of schemaMemories) {
        if (!candidate.id || visited.has(candidate.id)) continue;

        const candidateMeta = candidate.metadata as Record<string, unknown>;
        for (const { name, multiple } of relevantRefs) {
          const value = candidateMeta[name];
          const matches = multiple
            ? Array.isArray(value) && value.includes(memory.id)
            : value === memory.id;

          if (matches) {
            queue.push({ memory: candidate, path: [...path, candidate] });
            break;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Get all memories connected to an entity across all types.
 * WHY: Entity-centric view - "show me everything we know about this user"
 */
export async function getEntityRelations(
  runtime: IAgentRuntime,
  entityId: UUID,
  schemas: CognitiveMemorySchema[]
): Promise<Map<string, Memory[]>> {
  const result = new Map<string, Memory[]>();

  for (const schema of schemas) {
    const memories = await runtime.getMemories({
      tableName: schema.table,
      count: 100,
    });

    // Filter to entity-scoped or entity-matching memories
    const entityMemories = memories.filter((m) => {
      // Direct entity scope
      if (m.entityId === entityId) return true;

      // Check metadata for entity references
      const metadata = m.metadata as Record<string, unknown>;
      if (metadata?.entityId === entityId) return true;

      return false;
    });

    if (entityMemories.length > 0) {
      result.set(schema.name, entityMemories);
    }
  }

  return result;
}

/**
 * Count relationships by type.
 * WHY: Quick stats without loading full memories.
 */
export async function countRelations(
  runtime: IAgentRuntime,
  sourceMemory: Memory,
  schemas: CognitiveMemorySchema[]
): Promise<Map<string, { outgoing: number; incoming: number }>> {
  const result = new Map<string, { outgoing: number; incoming: number }>();

  // Find source schema
  const sourceSchemaName = getSchemaNameFromMemory(sourceMemory);
  const sourceSchema = schemas.find((s) => s.name === sourceSchemaName);

  // Count outgoing
  if (sourceSchema) {
    const refs = extractRefs(sourceMemory, sourceSchema);
    for (const ref of refs) {
      const current = result.get(ref.refType) ?? { outgoing: 0, incoming: 0 };
      current.outgoing += ref.targetIds.length;
      result.set(ref.refType, current);
    }
  }

  // Count incoming
  const incoming = await findReferencingMemories(
    runtime,
    sourceMemory,
    schemas
  );
  for (const [schemaName, memories] of incoming) {
    const current = result.get(schemaName) ?? { outgoing: 0, incoming: 0 };
    current.incoming += memories.length;
    result.set(schemaName, current);
  }

  return result;
}

// =============================================================================
// Provider Integration
// =============================================================================

/**
 * Format relationship map for provider output.
 * WHY: Providers need to show related memories in a readable format.
 */
export function formatRelationshipMap(
  map: RelationshipMap,
  options: { maxPerType?: number; showIds?: boolean } = {}
): string {
  const { maxPerType = 5, showIds = false } = options;
  const lines: string[] = [];

  const centerMeta = map.center.metadata as Record<string, unknown>;
  const centerType =
    typeof centerMeta?.neuroType === 'string'
      ? centerMeta.neuroType.replace('neuro:', '')
      : 'unknown';

  lines.push(`=== Relations for ${centerType} ===`);
  if (showIds) {
    lines.push(`ID: ${map.center.id}`);
  }
  lines.push('');

  for (const [type, memories] of map.related) {
    const count = memories.length;
    const shown = memories.slice(0, maxPerType);

    lines.push(`${type} (${count}):`);

    for (const mem of shown) {
      const meta = mem.metadata as Record<string, unknown>;
      const title =
        meta?.title ??
        meta?.topic ??
        meta?.summary ??
        (mem.id ? mem.id.slice(0, 8) : 'unknown');
      lines.push(`  - ${title}`);
    }

    if (count > maxPerType) {
      lines.push(`  ... and ${count - maxPerType} more`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
