CREATE TYPE "public"."SentryWebhookInboxStatus" AS ENUM('pending', 'processing', 'processed', 'failed', 'dead');--> statement-breakpoint
CREATE TABLE "AchievementDefinition" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"tier" text NOT NULL,
	"iconKey" text NOT NULL,
	"pointsReward" integer NOT NULL,
	"threshold" integer NOT NULL,
	"trackingType" text NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ChallengeDefinition" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"pool" text NOT NULL,
	"category" text NOT NULL,
	"iconKey" text NOT NULL,
	"pointsReward" integer NOT NULL,
	"threshold" integer NOT NULL,
	"trackingType" text NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserAchievement" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"achievementId" text NOT NULL,
	"unlockedAt" timestamp DEFAULT now() NOT NULL,
	"pointsAwarded" integer NOT NULL,
	CONSTRAINT "UserAchievement_userId_achievementId_idx" UNIQUE("userId","achievementId")
);
--> statement-breakpoint
CREATE TABLE "UserChallengeProgress" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"challengeId" text NOT NULL,
	"periodKey" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed" integer DEFAULT 0 NOT NULL,
	"completedAt" timestamp,
	"pointsAwarded" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UserChallengeProgress_userId_challengeId_periodKey_idx" UNIQUE("userId","challengeId","periodKey")
);
--> statement-breakpoint
CREATE TABLE "MessageReaction" (
	"id" text PRIMARY KEY NOT NULL,
	"chatId" text NOT NULL,
	"messageId" text NOT NULL,
	"userId" text NOT NULL,
	"emoji" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "MessageReaction_messageId_userId_emoji_key" UNIQUE("messageId","userId","emoji")
);
--> statement-breakpoint
CREATE TABLE "SentryWebhookInbox" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'sentry' NOT NULL,
	"resource" text NOT NULL,
	"action" text,
	"organizationSlug" text,
	"projectSlug" text,
	"issueId" text,
	"issueShortId" text,
	"issueTitle" text,
	"issueUrl" text,
	"eventId" text,
	"level" text,
	"culprit" text,
	"dedupeKey" text NOT NULL,
	"routingKey" text,
	"webhookTimestamp" timestamp,
	"status" "SentryWebhookInboxStatus" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"maxAttempts" integer DEFAULT 8 NOT NULL,
	"nextAttemptAt" timestamp DEFAULT now() NOT NULL,
	"processingStartedAt" timestamp,
	"processedAt" timestamp,
	"failedAt" timestamp,
	"lastError" text,
	"payload" json NOT NULL,
	"metadata" json,
	"receivedAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "SentryWebhookInbox_dedupeKey_unique" UNIQUE("dedupeKey")
);
--> statement-breakpoint
CREATE TABLE "WalletTransferLimit" (
	"userId" text PRIMARY KEY NOT NULL,
	"dailyLimitUsd" numeric(18, 2) DEFAULT '1000.00' NOT NULL,
	"dailySpentUsd" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"lastResetAt" timestamp DEFAULT now() NOT NULL,
	"elevatedUntil" timestamp,
	"elevatedLimitUsd" numeric(18, 2)
);
--> statement-breakpoint
CREATE TABLE "WalletTransferLog" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"fromAddress" text NOT NULL,
	"toAddress" text NOT NULL,
	"tokenAddress" text,
	"tokenId" text,
	"amount" text NOT NULL,
	"txHash" text,
	"chainId" integer NOT NULL,
	"status" text NOT NULL,
	"type" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"confirmedAt" timestamp,
	"usdValueAtTime" numeric(18, 2),
	"ipAddress" text
);
--> statement-breakpoint
ALTER TABLE "UserAgentConfig" ADD COLUMN "priceAlerts" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "offlineWalletReady" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "offlineWalletReadyAt" timestamp;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "emailNotificationsEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "emailNotificationsRealtime" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "emailNotificationsDailySummary" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "emailNotificationsWeeklySummary" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "emailNotificationsMonthlySummary" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "emailNotificationsUnsubscribedAt" timestamp;--> statement-breakpoint
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "UserAchievement_unlockedAt_idx" ON "UserAchievement" USING btree ("unlockedAt");--> statement-breakpoint
CREATE INDEX "UserChallengeProgress_userId_periodKey_idx" ON "UserChallengeProgress" USING btree ("userId","periodKey");--> statement-breakpoint
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX "MessageReaction_chatId_idx" ON "MessageReaction" USING btree ("chatId");--> statement-breakpoint
CREATE INDEX "MessageReaction_userId_idx" ON "MessageReaction" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "MessageReaction_chatId_messageId_idx" ON "MessageReaction" USING btree ("chatId","messageId");--> statement-breakpoint
CREATE INDEX "SentryWebhookInbox_status_nextAttemptAt_idx" ON "SentryWebhookInbox" USING btree ("status","nextAttemptAt");--> statement-breakpoint
CREATE INDEX "SentryWebhookInbox_project_issue_status_idx" ON "SentryWebhookInbox" USING btree ("projectSlug","issueId","status");--> statement-breakpoint
CREATE INDEX "SentryWebhookInbox_eventId_idx" ON "SentryWebhookInbox" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "SentryWebhookInbox_routingKey_status_idx" ON "SentryWebhookInbox" USING btree ("routingKey","status");--> statement-breakpoint
CREATE INDEX "SentryWebhookInbox_receivedAt_idx" ON "SentryWebhookInbox" USING btree ("receivedAt");--> statement-breakpoint
CREATE INDEX "SentryWebhookInbox_resource_action_idx" ON "SentryWebhookInbox" USING btree ("resource","action");--> statement-breakpoint
CREATE INDEX "WalletTransferLog_userId_idx" ON "WalletTransferLog" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "WalletTransferLog_userId_createdAt_idx" ON "WalletTransferLog" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "WalletTransferLog_fromAddress_idx" ON "WalletTransferLog" USING btree ("fromAddress");--> statement-breakpoint
CREATE INDEX "WalletTransferLog_toAddress_idx" ON "WalletTransferLog" USING btree ("toAddress");--> statement-breakpoint
CREATE INDEX "WalletTransferLog_txHash_idx" ON "WalletTransferLog" USING btree ("txHash");--> statement-breakpoint
CREATE INDEX "WalletTransferLog_status_idx" ON "WalletTransferLog" USING btree ("status");--> statement-breakpoint
CREATE INDEX "User_emailNotificationsEnabled_idx" ON "User" USING btree ("emailNotificationsEnabled");