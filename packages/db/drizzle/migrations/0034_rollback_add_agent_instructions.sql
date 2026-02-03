-- Rollback: Remove AgentInstruction table
-- Description: Rollback migration for 0033_add_agent_instructions.sql

-- Drop check constraints first
ALTER TABLE "AgentInstruction" DROP CONSTRAINT IF EXISTS "AgentInstruction_priority_check";
ALTER TABLE "AgentInstruction" DROP CONSTRAINT IF EXISTS "AgentInstruction_status_check";
ALTER TABLE "AgentInstruction" DROP CONSTRAINT IF EXISTS "AgentInstruction_directiveType_check";
ALTER TABLE "AgentInstruction" DROP CONSTRAINT IF EXISTS "AgentInstruction_category_check";

-- Drop indexes
DROP INDEX IF EXISTS "AgentInstruction_validUntil_idx";
DROP INDEX IF EXISTS "AgentInstruction_ownerId_idx";
DROP INDEX IF EXISTS "AgentInstruction_agentUserId_status_idx";

-- Drop table
DROP TABLE IF EXISTS "AgentInstruction";

