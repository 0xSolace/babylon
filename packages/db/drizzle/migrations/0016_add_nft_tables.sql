-- Create NFT collection & mint eligibility tables

CREATE TABLE IF NOT EXISTS "NftCollection" (
	"id" text PRIMARY KEY NOT NULL,
	"tokenId" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"imageUrl" text NOT NULL,
	"thumbnailUrl" text,
	"imageCid" text,
	"storyTitle" text,
	"storyContent" text,
	"metadataUri" text,
	"attributes" json,
	"contractAddress" text NOT NULL,
	"chainId" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "NftCollection_tokenId_unique" UNIQUE("tokenId")
);

CREATE INDEX IF NOT EXISTS "NftCollection_tokenId_idx" ON "NftCollection" USING btree ("tokenId");
CREATE INDEX IF NOT EXISTS "NftCollection_contractAddress_idx" ON "NftCollection" USING btree ("contractAddress");

CREATE TABLE IF NOT EXISTS "NftOwnership" (
	"id" text PRIMARY KEY NOT NULL,
	"tokenId" integer NOT NULL,
	"ownerAddress" text NOT NULL,
	"userId" text,
	"acquiredAt" timestamp NOT NULL,
	"txHash" text,
	"blockNumber" bigint,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "NftOwnership_tokenId_key" UNIQUE("tokenId")
);

CREATE INDEX IF NOT EXISTS "NftOwnership_ownerAddress_idx" ON "NftOwnership" USING btree ("ownerAddress");
CREATE INDEX IF NOT EXISTS "NftOwnership_userId_idx" ON "NftOwnership" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "NftOwnership_updatedAt_idx" ON "NftOwnership" USING btree ("updatedAt");

CREATE TABLE IF NOT EXISTS "NftClaim" (
	"id" text PRIMARY KEY NOT NULL,
	"tokenId" integer NOT NULL,
	"claimerUserId" text,
	"claimerAddress" text NOT NULL,
	"claimedAt" timestamp NOT NULL,
	"txHash" text NOT NULL,
	"snapshotRank" integer,
	"snapshotPoints" integer,
	CONSTRAINT "NftClaim_tokenId_key" UNIQUE("tokenId")
);

CREATE INDEX IF NOT EXISTS "NftClaim_claimerUserId_idx" ON "NftClaim" USING btree ("claimerUserId");
CREATE INDEX IF NOT EXISTS "NftClaim_claimerAddress_idx" ON "NftClaim" USING btree ("claimerAddress");

CREATE TABLE IF NOT EXISTS "NftSnapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"walletAddress" text,
	"rank" integer NOT NULL,
	"points" integer NOT NULL,
	"snapshotTakenAt" timestamp NOT NULL,
	"hasMinted" boolean DEFAULT false NOT NULL,
	"mintedTokenId" integer,
	"mintedAt" timestamp,
	"mintTxHash" text,
	CONSTRAINT "NftSnapshot_userId_key" UNIQUE("userId")
);

CREATE INDEX IF NOT EXISTS "NftSnapshot_walletAddress_idx" ON "NftSnapshot" USING btree ("walletAddress");
CREATE INDEX IF NOT EXISTS "NftSnapshot_hasMinted_idx" ON "NftSnapshot" USING btree ("hasMinted");
CREATE INDEX IF NOT EXISTS "NftSnapshot_rank_idx" ON "NftSnapshot" USING btree ("rank");
