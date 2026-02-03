-- Migration: Add AgentInstruction table
-- Description: Owner-provided instructions for agents, injected into decision prompts
-- Author: Coffee
-- Date: 2026-02-03

-- Create the AgentInstruction table
CREATE TABLE IF NOT EXISTS "AgentInstruction" (
    "id" text PRIMARY KEY NOT NULL,
    "agentUserId" text NOT NULL,
    "ownerId" text NOT NULL,
    "content" text NOT NULL,
    "parsedRule" text,
    "category" text NOT NULL,
    "directiveType" text NOT NULL,
    "priority" integer NOT NULL DEFAULT 5,
    "status" text NOT NULL DEFAULT 'active',
    "validFrom" timestamp NOT NULL DEFAULT now(),
    "validUntil" timestamp,
    "conditions" jsonb,
    "sourceMessageId" text,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL,
    "completedAt" timestamp,
    "revokedAt" timestamp
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "AgentInstruction_agentUserId_status_idx" 
    ON "AgentInstruction" ("agentUserId", "status");

CREATE INDEX IF NOT EXISTS "AgentInstruction_ownerId_idx" 
    ON "AgentInstruction" ("ownerId");

CREATE INDEX IF NOT EXISTS "AgentInstruction_validUntil_idx" 
    ON "AgentInstruction" ("validUntil");

-- Add check constraints for valid values
ALTER TABLE "AgentInstruction" 
    ADD CONSTRAINT "AgentInstruction_category_check" 
    CHECK ("category" IN ('trading', 'social', 'behavior', 'general'));

ALTER TABLE "AgentInstruction" 
    ADD CONSTRAINT "AgentInstruction_directiveType_check" 
    CHECK ("directiveType" IN ('always', 'never', 'prefer', 'avoid', 'until'));

ALTER TABLE "AgentInstruction" 
    ADD CONSTRAINT "AgentInstruction_status_check" 
    CHECK ("status" IN ('active', 'expired', 'revoked', 'completed'));

ALTER TABLE "AgentInstruction" 
    ADD CONSTRAINT "AgentInstruction_priority_check" 
    CHECK ("priority" >= 1 AND "priority" <= 10);

