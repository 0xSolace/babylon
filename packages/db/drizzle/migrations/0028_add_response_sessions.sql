-- Migration: Add Response Sessions for Command Center
-- 
-- This creates a response_sessions table to track grouped agent responses in team chat.
-- When a user sends a message in Command Center, a session is created to track:
-- - Which agents are expected to respond (max 4)
-- - Status of the overall response (processing/complete/timeout)
-- - AI-generated summary of all agent responses (for future implementation)
--
-- Also adds response_session_id to Message table to link agent responses to their session.

-- Step 1: Create response_session_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'response_session_status') THEN
        CREATE TYPE "response_session_status" AS ENUM ('processing', 'complete', 'timeout');
        RAISE NOTICE 'Created response_session_status enum';
    ELSE
        RAISE NOTICE 'response_session_status enum already exists';
    END IF;
END $$;

-- Step 2: Create ResponseSession table
CREATE TABLE IF NOT EXISTS "ResponseSession" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "chatId" TEXT NOT NULL,
    "userMessageId" TEXT NOT NULL,
    "expectedAgentIds" TEXT[] NOT NULL,
    "status" "response_session_status" NOT NULL DEFAULT 'processing',
    "summary" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    "completedAt" TIMESTAMP WITH TIME ZONE
);

-- Step 3: Add foreign key constraints
DO $$
BEGIN
    -- Add FK to Chat if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ResponseSession_chatId_fkey'
    ) THEN
        ALTER TABLE "ResponseSession" 
        ADD CONSTRAINT "ResponseSession_chatId_fkey" 
        FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;
        RAISE NOTICE 'Added chatId foreign key to ResponseSession';
    END IF;

    -- Add FK to Message if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ResponseSession_userMessageId_fkey'
    ) THEN
        ALTER TABLE "ResponseSession" 
        ADD CONSTRAINT "ResponseSession_userMessageId_fkey" 
        FOREIGN KEY ("userMessageId") REFERENCES "Message"("id") ON DELETE CASCADE;
        RAISE NOTICE 'Added userMessageId foreign key to ResponseSession';
    END IF;
END $$;

-- Step 4: Create indexes for ResponseSession
CREATE INDEX IF NOT EXISTS "ResponseSession_chatId_idx" 
    ON "ResponseSession" ("chatId");
CREATE INDEX IF NOT EXISTS "ResponseSession_userMessageId_idx" 
    ON "ResponseSession" ("userMessageId");
CREATE INDEX IF NOT EXISTS "ResponseSession_chatId_createdAt_idx" 
    ON "ResponseSession" ("chatId", "createdAt");
CREATE INDEX IF NOT EXISTS "ResponseSession_status_idx" 
    ON "ResponseSession" ("status");

-- Step 5: Add responseSessionId column to Message table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Message' AND column_name = 'responseSessionId'
    ) THEN
        ALTER TABLE "Message" ADD COLUMN "responseSessionId" TEXT;
        RAISE NOTICE 'Added responseSessionId column to Message table';
    ELSE
        RAISE NOTICE 'responseSessionId column already exists on Message table';
    END IF;
END $$;

-- Step 6: Add foreign key for Message.responseSessionId
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Message_responseSessionId_fkey'
    ) THEN
        ALTER TABLE "Message" 
        ADD CONSTRAINT "Message_responseSessionId_fkey" 
        FOREIGN KEY ("responseSessionId") REFERENCES "ResponseSession"("id") ON DELETE SET NULL;
        RAISE NOTICE 'Added responseSessionId foreign key to Message';
    END IF;
END $$;

-- Step 7: Create index for Message.responseSessionId
CREATE INDEX IF NOT EXISTS "Message_responseSessionId_idx" 
    ON "Message" ("responseSessionId");

