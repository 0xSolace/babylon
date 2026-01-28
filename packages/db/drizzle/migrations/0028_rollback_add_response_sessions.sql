-- Rollback: Remove Response Sessions
-- 
-- This removes the response_sessions table and related changes.
-- Run this to undo migration 0028_add_response_sessions.sql

-- Step 1: Drop index from Message table
DROP INDEX IF EXISTS "Message_responseSessionId_idx";

-- Step 2: Drop foreign key from Message table
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_responseSessionId_fkey";

-- Step 3: Drop responseSessionId column from Message table
ALTER TABLE "Message" DROP COLUMN IF EXISTS "responseSessionId";

-- Step 4: Drop indexes from ResponseSession table
DROP INDEX IF EXISTS "ResponseSession_status_idx";
DROP INDEX IF EXISTS "ResponseSession_chatId_createdAt_idx";
DROP INDEX IF EXISTS "ResponseSession_userMessageId_idx";
DROP INDEX IF EXISTS "ResponseSession_chatId_idx";

-- Step 5: Drop foreign keys from ResponseSession table
ALTER TABLE "ResponseSession" DROP CONSTRAINT IF EXISTS "ResponseSession_userMessageId_fkey";
ALTER TABLE "ResponseSession" DROP CONSTRAINT IF EXISTS "ResponseSession_chatId_fkey";

-- Step 6: Drop ResponseSession table
DROP TABLE IF EXISTS "ResponseSession";

-- Step 7: Drop the enum type
DROP TYPE IF EXISTS "response_session_status";

