-- Rollback: Remove Tiered Group System
-- Run this to revert the tiered group system changes

-- Drop indexes first
DROP INDEX IF EXISTS "GroupChatMembership_userId_npcAdminId_tier_idx";
DROP INDEX IF EXISTS "GroupChatMembership_tier_idx";
DROP INDEX IF EXISTS "Chat_parentGroupId_idx";
DROP INDEX IF EXISTS "Chat_npcAdminId_tier_idx";
DROP INDEX IF EXISTS "Chat_tier_idx";

-- Remove tier columns from GroupChatMembership
ALTER TABLE "GroupChatMembership" DROP COLUMN IF EXISTS "previousTier";
ALTER TABLE "GroupChatMembership" DROP COLUMN IF EXISTS "demotedAt";
ALTER TABLE "GroupChatMembership" DROP COLUMN IF EXISTS "promotedAt";
ALTER TABLE "GroupChatMembership" DROP COLUMN IF EXISTS "tier";

-- Remove tier columns from Chat
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "parentGroupId";
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "maxMembers";
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "tierName";
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "tier";

