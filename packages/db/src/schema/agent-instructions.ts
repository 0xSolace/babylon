/**
 * AgentInstruction Schema
 *
 * Owner-provided instructions for agents.
 * Created when owner sends strategic commands via team chat.
 * Injected into agent decision prompts during autonomous ticks.
 */

import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// =============================================================================
// Types
// =============================================================================

/**
 * Condition types for JSONB column.
 * Evaluated each tick to determine if instruction applies.
 */
export interface InstructionCondition {
  /** Price must be above this value for instruction to apply */
  priceAbove?: { ticker: string; value: number };
  /** Price must be below this value for instruction to apply */
  priceBelow?: { ticker: string; value: number };
  /** Instruction only applies after this date (ISO string) */
  afterDate?: string;
  /** Instruction only applies before this date (ISO string) */
  beforeDate?: string;
}

export type InstructionCategory = 'trading' | 'social' | 'behavior' | 'general';
export type InstructionDirectiveType =
  | 'always'
  | 'never'
  | 'prefer'
  | 'avoid'
  | 'until';
export type InstructionStatus = 'active' | 'expired' | 'revoked' | 'completed';

// =============================================================================
// Table Definition
// =============================================================================

export const agentInstructions = pgTable(
  'AgentInstruction',
  {
    id: text('id').primaryKey(),
    agentUserId: text('agentUserId').notNull(),
    ownerId: text('ownerId').notNull(),

    // Instruction content
    content: text('content').notNull(),
    parsedRule: text('parsedRule'),
    category: text('category').$type<InstructionCategory>().notNull(),

    // Directive type
    directiveType: text('directiveType')
      .$type<InstructionDirectiveType>()
      .notNull(),

    // Priority & Status
    priority: integer('priority').notNull().default(5),
    status: text('status')
      .$type<InstructionStatus>()
      .notNull()
      .default('active'),

    // Time bounds
    validFrom: timestamp('validFrom', { mode: 'date' }).notNull().defaultNow(),
    validUntil: timestamp('validUntil', { mode: 'date' }),

    // Conditions (JSON) - evaluated each tick
    conditions: jsonb('conditions').$type<InstructionCondition>(),

    // Metadata
    sourceMessageId: text('sourceMessageId'),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
    completedAt: timestamp('completedAt', { mode: 'date' }),
    revokedAt: timestamp('revokedAt', { mode: 'date' }),
  },
  (table) => [
    index('AgentInstruction_agentUserId_status_idx').on(
      table.agentUserId,
      table.status
    ),
    index('AgentInstruction_ownerId_idx').on(table.ownerId),
    index('AgentInstruction_validUntil_idx').on(table.validUntil),
  ]
);

// =============================================================================
// Relations
// =============================================================================

export const agentInstructionsRelations = relations(
  agentInstructions,
  ({ one }) => ({
    agent: one(users, {
      fields: [agentInstructions.agentUserId],
      references: [users.id],
      relationName: 'agentInstructions',
    }),
    owner: one(users, {
      fields: [agentInstructions.ownerId],
      references: [users.id],
      relationName: 'ownedInstructions',
    }),
  })
);

// =============================================================================
// Type Exports
// =============================================================================

export type AgentInstruction = typeof agentInstructions.$inferSelect;
export type NewAgentInstruction = typeof agentInstructions.$inferInsert;
