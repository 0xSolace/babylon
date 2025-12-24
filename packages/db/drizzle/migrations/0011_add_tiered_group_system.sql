-- Migration: Add Tiered Group System
-- This enables NPCs to have multiple groups at different tiers (Inner Circle, Community, Followers)

-- Add tier columns to Chat table
ALTER TABLE "Chat" ADD COLUMN "tier" integer;
ALTER TABLE "Chat" ADD COLUMN "tierName" text;
ALTER TABLE "Chat" ADD COLUMN "maxMembers" integer;
ALTER TABLE "Chat" ADD COLUMN "parentGroupId" text;

-- Add tier columns to GroupChatMembership table
ALTER TABLE "GroupChatMembership" ADD COLUMN "tier" integer;
ALTER TABLE "GroupChatMembership" ADD COLUMN "promotedAt" timestamp;
ALTER TABLE "GroupChatMembership" ADD COLUMN "demotedAt" timestamp;
ALTER TABLE "GroupChatMembership" ADD COLUMN "previousTier" integer;

-- Add indexes for efficient tier queries
CREATE INDEX "Chat_tier_idx" ON "Chat" ("tier");
CREATE INDEX "Chat_npcAdminId_tier_idx" ON "Chat" ("npcAdminId", "tier");
CREATE INDEX "Chat_parentGroupId_idx" ON "Chat" ("parentGroupId");
CREATE INDEX "GroupChatMembership_tier_idx" ON "GroupChatMembership" ("tier");
CREATE INDEX "GroupChatMembership_userId_npcAdminId_tier_idx" ON "GroupChatMembership" ("userId", "npcAdminId", "tier");

-- Migrate existing NPC groups to Tier 1 (Inner Circle)
-- Only update groups that have an NPC admin and are group chats
UPDATE "Chat"
SET 
  "tier" = 1,
  "tierName" = 'Inner Circle',
  "maxMembers" = 12
WHERE "isGroup" = true 
  AND "npcAdminId" IS NOT NULL
  AND "tier" IS NULL;

-- Update existing memberships to Tier 1
UPDATE "GroupChatMembership"
SET "tier" = 1
WHERE "tier" IS NULL;

