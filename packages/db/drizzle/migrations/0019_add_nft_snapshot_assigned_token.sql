-- Migration: Add assignedTokenId to NftSnapshot table
-- This column stores the pre-assigned NFT tokenId for each eligible user
-- Each NFT can only be assigned to one user (unique constraint)

-- Add assignedTokenId column
ALTER TABLE "NftSnapshot" ADD COLUMN "assignedTokenId" INTEGER;

-- Create unique constraint (each NFT can only be assigned to one user)
ALTER TABLE "NftSnapshot" ADD CONSTRAINT "NftSnapshot_assignedTokenId_key" UNIQUE ("assignedTokenId");

-- Create index for faster lookups
CREATE INDEX "NftSnapshot_assignedTokenId_idx" ON "NftSnapshot" ("assignedTokenId");
