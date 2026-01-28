/**
 * Response Session types for Command Center grouped agent responses.
 *
 * A ResponseSession tracks a group of agent responses to a single user message.
 * It stores which agents are expected to respond, their completion status,
 * and an optional AI-generated summary of all responses.
 *
 * Note: This type must stay in sync with the database schema defined in
 * `packages/db/drizzle/migrations/schema.ts` (`responseSession` table).
 */

export const ResponseSessionStatusEnum = {
  PROCESSING: 'processing',
  COMPLETE: 'complete',
  TIMEOUT: 'timeout',
} as const;

export type ResponseSessionStatus =
  (typeof ResponseSessionStatusEnum)[keyof typeof ResponseSessionStatusEnum];

/**
 * Maximum number of agents that can respond to a single message in Command Center.
 */
export const MAX_RESPONDING_AGENTS = 4;

/**
 * Response session data structure matching the database schema.
 */
export interface ResponseSession {
  id: string;
  chatId: string;
  userMessageId: string;
  expectedAgentIds: string[];
  status: ResponseSessionStatus;
  summary: string | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * Response session with related agent response messages.
 * Used when fetching sessions with their associated responses.
 */
export interface ResponseSessionWithResponses extends ResponseSession {
  responses: {
    agentId: string;
    messageId: string;
    content: string;
    createdAt: string;
  }[];
  /** Agent IDs that failed to respond (client-side tracking only) */
  failedAgentIds?: string[];
}
