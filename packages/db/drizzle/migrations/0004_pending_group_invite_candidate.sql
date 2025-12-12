-- Migration: Add PendingGroupInviteCandidate table for event-driven group invites
-- This table queues users for potential group chat invites based on their interactions with NPCs

CREATE TABLE IF NOT EXISTS "PendingGroupInviteCandidate" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "npcId" TEXT NOT NULL,
  "groupChatId" TEXT,
  "engagementScore" DOUBLE PRECISION NOT NULL,
  "triggerType" TEXT NOT NULL,
  "triggerId" TEXT,
  "queuedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "processed" BOOLEAN DEFAULT FALSE NOT NULL,
  "outcome" TEXT,
  "processedAt" TIMESTAMP,
  "priorityMultiplier" DOUBLE PRECISION DEFAULT 1.0 NOT NULL
);

-- Unique constraint: one pending invite per user-npc pair
CREATE UNIQUE INDEX IF NOT EXISTS "PendingGroupInviteCandidate_userId_npcId_unprocessed" 
  ON "PendingGroupInviteCandidate" ("userId", "npcId", "processed");

-- Index for finding unprocessed candidates ordered by time
CREATE INDEX IF NOT EXISTS "PendingGroupInviteCandidate_processed_queuedAt_idx" 
  ON "PendingGroupInviteCandidate" ("processed", "queuedAt");

-- Index for finding candidates by NPC
CREATE INDEX IF NOT EXISTS "PendingGroupInviteCandidate_npcId_processed_idx" 
  ON "PendingGroupInviteCandidate" ("npcId", "processed");

-- Index for finding candidates by user
CREATE INDEX IF NOT EXISTS "PendingGroupInviteCandidate_userId_processed_idx" 
  ON "PendingGroupInviteCandidate" ("userId", "processed");

