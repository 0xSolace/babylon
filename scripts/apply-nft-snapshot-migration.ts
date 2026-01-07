/**
 * Apply NftSnapshot assignedTokenId migration
 *
 * This script adds the assignedTokenId column to NftSnapshot table.
 * Run with: bun run scripts/apply-nft-snapshot-migration.ts
 */

import { db, sql } from '@babylon/db';
import { logger } from '@babylon/shared';

async function applyMigration() {
  logger.info(
    'Checking if assignedTokenId column exists...',
    undefined,
    'Migration'
  );

  // Check if column already exists
  const [result] = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'NftSnapshot' AND column_name = 'assignedTokenId'
    ) as exists
  `);

  if (result?.exists) {
    logger.info(
      'Column assignedTokenId already exists, skipping',
      undefined,
      'Migration'
    );
    return;
  }

  logger.info('Adding assignedTokenId column...', undefined, 'Migration');

  // Add column
  await db.execute(sql`
    ALTER TABLE "NftSnapshot" ADD COLUMN "assignedTokenId" INTEGER
  `);

  // Add unique constraint
  await db.execute(sql`
    ALTER TABLE "NftSnapshot" ADD CONSTRAINT "NftSnapshot_assignedTokenId_key" UNIQUE ("assignedTokenId")
  `);

  // Add index
  await db.execute(sql`
    CREATE INDEX "NftSnapshot_assignedTokenId_idx" ON "NftSnapshot" ("assignedTokenId")
  `);

  logger.info(
    'Migration complete: assignedTokenId column added',
    undefined,
    'Migration'
  );
}

applyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Migration failed', { error: String(error) }, 'Migration');
    process.exit(1);
  });
