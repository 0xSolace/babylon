#!/usr/bin/env bun
/**
 * Privy → Steward user migration script.
 *
 * Phase A: Export all users from Privy Admin API (paginated), cache to JSON
 * Phase B: Pre-seed email-having users in Steward via POST /platform/users
 *           with concurrency control (10 parallel)
 * Phase C: Write manifest of email-less users (linked by social at runtime)
 * Phase D: Write stewardId back to Babylon's "User" table for every
 *           successfully seeded user (matches via privyId)
 * Phase E: Print coverage report — how many Babylon users now have stewardId
 *
 * Usage:
 *   bun run steward:migrate                # full run
 *   bun run steward:migrate -- --dry-run   # report only, no writes
 *   bun run steward:migrate -- --use-cache # skip Phase A, reuse cached JSON
 *
 * Required env vars:
 *   NEXT_PUBLIC_PRIVY_APP_ID   — Privy app ID (from Privy dashboard)
 *   PRIVY_APP_SECRET           — Privy app secret (from Privy dashboard)
 *   STEWARD_API_URL            — Steward API URL (default: http://localhost:3200)
 *   STEWARD_PLATFORM_KEYS      — Steward platform key (comma-separated)
 *   DATABASE_URL               — Babylon Postgres connection string
 *
 * Outputs:
 *   migrations/privy-export.json          — cached Privy user dump (Phase A)
 *   migrations/privy-emailless-users.json — manifest of social-only users (Phase C)
 *
 * Notes:
 *   - Idempotent: re-running will not duplicate users in Steward (returns isNew=false)
 *   - Re-running is safe: stewardId updates are upserted by privyId
 *   - Email-less users are NOT pre-seeded; they link at login via social profile
 *     matching in auth-middleware.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

// ─── Load .env ────────────────────────────────────────────────────────────────

const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed
          .slice(eqIdx + 1)
          .trim()
          .replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? '';
const STEWARD_API_URL = process.env.STEWARD_API_URL ?? 'http://localhost:3200';
const PLATFORM_KEY = (process.env.STEWARD_PLATFORM_KEYS ?? '')
  .split(',')[0]
  .trim();
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const DRY_RUN = process.argv.includes('--dry-run');
const USE_CACHE = process.argv.includes('--use-cache');
const CONCURRENCY = 10; // parallel Steward requests

const migrationsDir = join(process.cwd(), 'migrations');
const EXPORT_CACHE_PATH = join(migrationsDir, 'privy-export.json');
const EMAILLESS_PATH = join(migrationsDir, 'privy-emailless-users.json');

// ─── Validate config ──────────────────────────────────────────────────────────

const errors: string[] = [];
if (!USE_CACHE && (!PRIVY_APP_ID || !PRIVY_APP_SECRET)) {
  errors.push(
    'NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET are required (or use --use-cache)'
  );
}
if (!PLATFORM_KEY) errors.push('STEWARD_PLATFORM_KEYS is required');
if (!DATABASE_URL) errors.push('DATABASE_URL is required');

if (errors.length) {
  for (const e of errors) console.error(`❌ ${e}`);
  process.exit(1);
}

if (DRY_RUN) {
  console.info('🔍 DRY RUN — no writes will be made to Steward or Babylon DB.');
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrivyLinkedAccount {
  type: string;
  address?: string;
  email?: string;
  fid?: number;
  username?: string;
  telegram_user_id?: string;
}

interface PrivyUser {
  id: string; // did:privy:xxx
  linked_accounts: PrivyLinkedAccount[];
  created_at: number;
}

interface EmaillessUser {
  privyId: string;
  farcasterFid: number | null;
  farcasterUsername: string | null;
  twitterUsername: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserEmail(user: PrivyUser): string | null {
  return user.linked_accounts.find((a) => a.type === 'email')?.email ?? null;
}
function getFarcasterFid(user: PrivyUser): number | null {
  const fc = user.linked_accounts.find((a) => a.type === 'farcaster');
  return fc ? Number(fc.fid ?? 0) || null : null;
}
function getFarcasterUsername(user: PrivyUser): string | null {
  const fc = user.linked_accounts.find((a) => a.type === 'farcaster');
  return fc ? String(fc.username ?? '') || null : null;
}
function getTwitterUsername(user: PrivyUser): string | null {
  const tw = user.linked_accounts.find((a) => a.type === 'twitter_oauth');
  return tw ? String(tw.username ?? '') || null : null;
}
function getTelegramId(user: PrivyUser): string | null {
  const tg = user.linked_accounts.find((a) => a.type === 'telegram');
  return tg ? String(tg.telegram_user_id ?? '') || null : null;
}
function getTelegramUsername(user: PrivyUser): string | null {
  const tg = user.linked_accounts.find((a) => a.type === 'telegram');
  return tg ? String(tg.username ?? '') || null : null;
}

/** Run up to `limit` promises concurrently. */
async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  async function next(): Promise<void> {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]!();
    }
  }
  await Promise.all(Array.from({ length: limit }, () => next()));
  return results;
}

// ─── Phase A: Export Privy users ─────────────────────────────────────────────

let allPrivyUsers: PrivyUser[] = [];

if (USE_CACHE && existsSync(EXPORT_CACHE_PATH)) {
  console.info('\n📦 Phase A: Loading Privy users from cache...');
  allPrivyUsers = JSON.parse(readFileSync(EXPORT_CACHE_PATH, 'utf-8'));
  console.info(`✅ Loaded ${allPrivyUsers.length} users from cache`);
} else {
  console.info('\n📥 Phase A: Exporting users from Privy Admin API...');

  const basicAuth = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString(
    'base64'
  );

  let cursor: string | undefined;
  do {
    const url = new URL('https://auth.privy.io/api/v1/users');
    url.searchParams.set('limit', '500');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'privy-app-id': PRIVY_APP_ID,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ Privy API error: ${res.status} ${text}`);
      process.exit(1);
    }

    const body = (await res.json()) as {
      data: PrivyUser[];
      next_cursor?: string;
    };

    allPrivyUsers.push(...body.data);
    cursor = body.next_cursor;
    process.stdout.write(`\r   Fetched ${allPrivyUsers.length} users...`);
  } while (cursor);

  console.info(`\n✅ Exported ${allPrivyUsers.length} Privy users`);

  // Cache to disk for re-runs
  if (!existsSync(migrationsDir)) mkdirSync(migrationsDir, { recursive: true });
  if (!DRY_RUN) {
    writeFileSync(EXPORT_CACHE_PATH, JSON.stringify(allPrivyUsers, null, 2));
    console.info(`   Cached to migrations/privy-export.json`);
  }
}

// ─── Partition by email ───────────────────────────────────────────────────────

const withEmail = allPrivyUsers.filter((u) => getUserEmail(u) !== null);
const withoutEmail = allPrivyUsers.filter((u) => getUserEmail(u) === null);

console.info(`\n   With email:    ${withEmail.length}`);
console.info(
  `   Without email: ${withoutEmail.length} (social-only, linked at login)`
);

// ─── Phase B: Pre-seed email users in Steward ─────────────────────────────────

console.info('\n📤 Phase B: Pre-seeding email users in Steward...');

if (!DRY_RUN) {
  const healthOk = await fetch(`${STEWARD_API_URL}/health`)
    .then((r) => r.ok)
    .catch(() => false);
  if (!healthOk) {
    console.error(`❌ Steward is not reachable at ${STEWARD_API_URL}`);
    process.exit(1);
  }
}

// Result bucket for Phase D
const stewardLinks: { privyId: string; stewardId: string }[] = [];

let seeded = 0;
let existed = 0;
let failed = 0;

if (DRY_RUN) {
  seeded = withEmail.length;
  console.info(`✅ Dry run: would seed ${seeded} users`);
} else {
  const tasks = withEmail.map((user) => async () => {
    const email = getUserEmail(user)!;
    const res = await fetch(`${STEWARD_API_URL}/platform/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Steward-Platform-Key': PLATFORM_KEY,
      },
      body: JSON.stringify({ email, emailVerified: true }),
    });

    const data = (await res.json()) as {
      ok: boolean;
      data?: { userId: string; isNew: boolean };
      error?: string;
    };

    if (!data.ok || !data.data) {
      failed++;
      console.warn(`\n   ⚠️  Failed ${email}: ${data.error ?? 'unknown'}`);
      return;
    }

    stewardLinks.push({ privyId: user.id, stewardId: data.data.userId });

    if (data.data.isNew) {
      seeded++;
    } else {
      existed++;
    }

    const done = seeded + existed + failed;
    if (done % 50 === 0) {
      process.stdout.write(
        `\r   ${done}/${withEmail.length} — created: ${seeded} existed: ${existed} failed: ${failed}`
      );
    }
  });

  await runConcurrent(tasks, CONCURRENCY);

  console.info(
    `\n✅ Steward seeding complete — created: ${seeded}  existed: ${existed}  failed: ${failed}`
  );
}

// ─── Phase C: Write email-less user manifest ──────────────────────────────────

console.info('\n📄 Phase C: Writing email-less user manifest...');

const emaillessManifest: EmaillessUser[] = withoutEmail.map((u) => ({
  privyId: u.id,
  farcasterFid: getFarcasterFid(u),
  farcasterUsername: getFarcasterUsername(u),
  twitterUsername: getTwitterUsername(u),
  telegramId: getTelegramId(u),
  telegramUsername: getTelegramUsername(u),
}));

if (!existsSync(migrationsDir)) mkdirSync(migrationsDir, { recursive: true });

if (!DRY_RUN) {
  writeFileSync(EMAILLESS_PATH, JSON.stringify(emaillessManifest, null, 2));
  console.info(
    `✅ Wrote ${emaillessManifest.length} email-less users to migrations/privy-emailless-users.json`
  );
} else {
  console.info(
    `✅ Dry run: would write ${emaillessManifest.length} entries to manifest`
  );
}

// ─── Phase D: Write stewardId back to Babylon DB ─────────────────────────────

console.info('\n🔗 Phase D: Linking stewardId in Babylon DB...');

if (DRY_RUN) {
  console.info(
    `✅ Dry run: would update stewardId for up to ${withEmail.length} users`
  );
} else if (stewardLinks.length === 0) {
  console.info('   No links to write (all users already existed or failed).');
} else {
  const sql = postgres(DATABASE_URL, { max: 5 });

  try {
    // Batch UPDATE in chunks of 500 to keep queries reasonable
    const CHUNK = 500;
    let updated = 0;

    for (let i = 0; i < stewardLinks.length; i += CHUNK) {
      const chunk = stewardLinks.slice(i, i + CHUNK);

      // Build a VALUES list for a single UPDATE … FROM (VALUES …) statement
      // UPDATE "User" SET "stewardId" = v."stewardId"
      //   FROM (VALUES ($1,$2), ($3,$4), …) AS v("privyId","stewardId")
      //  WHERE "User"."privyId" = v."privyId"
      //    AND "User"."stewardId" IS NULL
      const rows = chunk.flatMap((l) => [l.privyId, l.stewardId]);

      const placeholders = chunk
        .map((_, j) => `($${j * 2 + 1},$${j * 2 + 2})`)
        .join(',');

      const result = await sql.unsafe(
        `UPDATE "User" u
            SET "stewardId" = v."stewardId"
           FROM (VALUES ${placeholders}) AS v("privyId","stewardId")
          WHERE u."privyId" = v."privyId"
            AND u."stewardId" IS NULL`,
        rows
      );

      updated += result.count;
      process.stdout.write(`\r   Updated ${updated} rows...`);
    }

    console.info(`\n✅ Set stewardId on ${updated} Babylon users`);
  } finally {
    await sql.end();
  }
}

// ─── Phase E: Coverage report ─────────────────────────────────────────────────

console.info('\n📊 Phase E: Babylon DB coverage report...');

if (!DRY_RUN) {
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    const [row] = await sql<
      [{ total: string; has_steward: string; has_privy_no_steward: string }]
    >`
      SELECT
        COUNT(*)::text                                          AS total,
        COUNT(*) FILTER (WHERE "stewardId" IS NOT NULL)::text  AS has_steward,
        COUNT(*) FILTER (
          WHERE "privyId" IS NOT NULL AND "stewardId" IS NULL
        )::text                                                 AS has_privy_no_steward
      FROM "User"
      WHERE "isActor" = false
    `;
    console.info(`   Total real users:           ${row!.total}`);
    console.info(`   Users with stewardId:       ${row!.has_steward}`);
    console.info(
      `   Privy users missing link:   ${row!.has_privy_no_steward} (will be linked at first login)`
    );
  } finally {
    await sql.end();
  }
} else {
  console.info('   (Skipped in dry-run mode)');
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.info('\n' + '='.repeat(60));
console.info('Migration summary:');
console.info(`  Total Privy users:       ${allPrivyUsers.length}`);
console.info(`  With email (seeded):     ${withEmail.length}`);
console.info(`  Social-only (manifest):  ${withoutEmail.length}`);
if (!DRY_RUN) {
  console.info(`  Created in Steward:      ${seeded}`);
  console.info(`  Already existed:         ${existed}`);
  console.info(`  Failed:                  ${failed}`);
  console.info(`  DB links written:        ${stewardLinks.length}`);
}
console.info('');
console.info('Next steps:');
console.info(
  '  1. Social-only users auto-link at first login via FID/Twitter/Telegram'
);
console.info('     matching in auth-middleware.ts');
console.info(
  '  2. Add migrations/ directory to .gitignore (contains user PII)'
);
console.info('  3. Monitor auth errors after deployment for edge cases');
console.info('  4. Re-run with --use-cache to skip Privy export on retries');
console.info('='.repeat(60));
