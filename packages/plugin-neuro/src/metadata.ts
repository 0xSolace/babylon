import type { CustomMetadata, Memory } from '@elizaos/core';

type StringArray = string[];

interface BaseNeuroMetadata extends CustomMetadata {
  type: 'custom';
  neuroType: `neuro:${string}`;
  title?: string;
  summary?: string;
  keywords?: StringArray;
  topics?: StringArray;
  who?: StringArray;
  result?: string;
  messageIds?: StringArray;
}

export interface ConversationMetadata extends BaseNeuroMetadata {
  neuroType: 'neuro:conversation';
}

export interface HypothesisMetadata extends BaseNeuroMetadata {
  neuroType: 'neuro:hypothesis';
  detail?: string;
  tests?: StringArray;
  disprove?: StringArray;
  learn?: StringArray;
  priority?: number;
  daysAllocated?: number;
  context?: StringArray;
  narratives?: StringArray;
}

export interface NarrativeMetadata extends BaseNeuroMetadata {
  neuroType: 'neuro:narrative';
  details?: string;
  intent?: string;
  motivation?: string;
}

export type ConversationMemory = Memory & { metadata: ConversationMetadata };
export type HypothesisMemory = Memory & { metadata: HypothesisMetadata };
export type NarrativeMemory = Memory & { metadata: NarrativeMetadata };

export function isConversationMemory(
  memory: Memory
): memory is ConversationMemory {
  return (
    memory.metadata?.type === 'custom' &&
    (memory.metadata as Record<string, unknown>)?.neuroType ===
      'neuro:conversation'
  );
}

export function isHypothesisMemory(memory: Memory): memory is HypothesisMemory {
  return (
    memory.metadata?.type === 'custom' &&
    (memory.metadata as Record<string, unknown>)?.neuroType ===
      'neuro:hypothesis'
  );
}

export function isNarrativeMemory(memory: Memory): memory is NarrativeMemory {
  return (
    memory.metadata?.type === 'custom' &&
    (memory.metadata as Record<string, unknown>)?.neuroType ===
      'neuro:narrative'
  );
}

export function toStringSafe(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

export function toStringArray(value: unknown): StringArray {
  if (Array.isArray(value)) {
    return value.map((item) => toStringSafe(item)).filter(Boolean);
  }
  const single = toStringSafe(value);
  return single ? [single] : [];
}

export function mergeMessageIds(
  existing: StringArray | undefined,
  additional: StringArray
): StringArray {
  const merged = new Set<string>(existing ?? []);
  for (const id of additional) {
    if (id) {
      merged.add(id);
    }
  }
  return Array.from(merged);
}

export function toCsvArray(value: unknown): StringArray {
  if (Array.isArray(value)) {
    return value.flatMap((item) => toCsvArray(item));
  }

  const str = toStringSafe(value);
  if (!str) {
    return [];
  }

  return str
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function mergeStringLists(
  existing: StringArray | undefined,
  incoming: StringArray
): StringArray | undefined {
  const combined = [...(existing ?? [])];
  for (const entry of incoming) {
    if (entry && !combined.includes(entry)) {
      combined.push(entry);
    }
  }
  return combined.length > 0 ? combined : existing;
}

export function toNumber(
  value: unknown,
  fallback?: number
): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}
