-- Rollback: Remove assignedTokenId from NftSnapshot table

DROP INDEX IF EXISTS "NftSnapshot_assignedTokenId_idx";
ALTER TABLE "NftSnapshot" DROP CONSTRAINT IF EXISTS "NftSnapshot_assignedTokenId_key";
ALTER TABLE "NftSnapshot" DROP COLUMN IF EXISTS "assignedTokenId";
