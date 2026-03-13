CREATE TYPE "public"."game_master_action_status" AS ENUM(
  'queued',
  'awaiting_approval',
  'approved',
  'rejected',
  'executing',
  'executed',
  'failed'
);--> statement-breakpoint
CREATE TYPE "public"."game_master_authority" AS ENUM(
  'suggest',
  'steer',
  'override'
);--> statement-breakpoint
CREATE TYPE "public"."game_master_directive_type" AS ENUM(
  'actor_instruction',
  'organization_instruction',
  'article_brief',
  'market_narrative'
);--> statement-breakpoint
CREATE TYPE "public"."game_master_risk" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."game_master_run_status" AS ENUM(
  'running',
  'completed',
  'failed'
);--> statement-breakpoint
CREATE TYPE "public"."game_master_run_type" AS ENUM(
  'daily',
  'pulse',
  'reactive'
);--> statement-breakpoint
CREATE TYPE "public"."game_master_target_type" AS ENUM(
  'actor',
  'organization',
  'question',
  'relationship',
  'world',
  'system'
);--> statement-breakpoint

CREATE TABLE "GameMasterRun" (
  "id" text PRIMARY KEY NOT NULL,
  "gameDay" integer NOT NULL,
  "runType" "game_master_run_type" NOT NULL,
  "triggerType" text,
  "triggerData" jsonb,
  "status" "game_master_run_status" DEFAULT 'running' NOT NULL,
  "dailyObjective" text,
  "worldSummary" text,
  "observationSummary" text,
  "planSummary" text,
  "model" text,
  "startedAt" timestamp DEFAULT now() NOT NULL,
  "completedAt" timestamp,
  "failedAt" timestamp,
  "error" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp NOT NULL
);--> statement-breakpoint

CREATE TABLE "GameMasterAction" (
  "id" text PRIMARY KEY NOT NULL,
  "runId" text NOT NULL,
  "actionType" text NOT NULL,
  "authorityLevel" "game_master_authority" NOT NULL,
  "riskLevel" "game_master_risk" NOT NULL,
  "targetType" "game_master_target_type" NOT NULL,
  "targetIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "instructionText" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "game_master_action_status" DEFAULT 'queued' NOT NULL,
  "requiresApproval" boolean DEFAULT false NOT NULL,
  "approvalReason" text,
  "approvedBy" text,
  "approvedAt" timestamp,
  "rejectedBy" text,
  "rejectedAt" timestamp,
  "executedAt" timestamp,
  "executionResult" jsonb,
  "failedAt" timestamp,
  "error" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp NOT NULL
);--> statement-breakpoint

CREATE TABLE "GameMasterDirective" (
  "id" text PRIMARY KEY NOT NULL,
  "sourceActionId" text NOT NULL,
  "directiveType" "game_master_directive_type" NOT NULL,
  "targetType" "game_master_target_type" NOT NULL,
  "targetId" text NOT NULL,
  "authorityLevel" "game_master_authority" NOT NULL,
  "promptOverlay" text NOT NULL,
  "metadata" jsonb,
  "startsAt" timestamp DEFAULT now() NOT NULL,
  "expiresAt" timestamp,
  "isActive" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp NOT NULL
);--> statement-breakpoint

CREATE INDEX "GameMasterRun_gameDay_runType_idx" ON "GameMasterRun" USING btree ("gameDay","runType");--> statement-breakpoint
CREATE INDEX "GameMasterRun_status_startedAt_idx" ON "GameMasterRun" USING btree ("status","startedAt");--> statement-breakpoint
CREATE INDEX "GameMasterRun_createdAt_idx" ON "GameMasterRun" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "GameMasterAction_runId_idx" ON "GameMasterAction" USING btree ("runId");--> statement-breakpoint
CREATE INDEX "GameMasterAction_status_createdAt_idx" ON "GameMasterAction" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "GameMasterAction_requiresApproval_status_idx" ON "GameMasterAction" USING btree ("requiresApproval","status");--> statement-breakpoint
CREATE INDEX "GameMasterAction_actionType_idx" ON "GameMasterAction" USING btree ("actionType");--> statement-breakpoint
CREATE INDEX "GameMasterAction_targetType_idx" ON "GameMasterAction" USING btree ("targetType");--> statement-breakpoint
CREATE INDEX "GameMasterDirective_targetType_targetId_idx" ON "GameMasterDirective" USING btree ("targetType","targetId");--> statement-breakpoint
CREATE INDEX "GameMasterDirective_isActive_expiresAt_idx" ON "GameMasterDirective" USING btree ("isActive","expiresAt");--> statement-breakpoint
CREATE INDEX "GameMasterDirective_sourceActionId_idx" ON "GameMasterDirective" USING btree ("sourceActionId");--> statement-breakpoint
