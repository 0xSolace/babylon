-- Add CHECK constraint to prevent negative trading balance for NPCs
-- This is a safety net in addition to application-level atomic checks

ALTER TABLE "ActorState" ADD CONSTRAINT "positive_trading_balance" CHECK ("tradingBalance" >= 0);
