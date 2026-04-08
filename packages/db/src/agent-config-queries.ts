/**
 * UserAgentConfig CRUD helpers for agents package wiring.
 */

import { eq, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { NewUserAgentConfig, UserAgentConfig } from './model-types';
import { userAgentConfigs } from './tables/user-agent-configs';

type AgentConfigDb = DrizzleClient | Transaction;

export async function selectUserAgentConfigByUserId(
  db: AgentConfigDb,
  userId: string
): Promise<UserAgentConfig | undefined> {
  const [row] = await db
    .select()
    .from(userAgentConfigs)
    .where(eq(userAgentConfigs.userId, userId))
    .limit(1);
  return row;
}

export async function insertUserAgentConfigOnConflictDoNothing(
  db: AgentConfigDb,
  row: NewUserAgentConfig
): Promise<UserAgentConfig | undefined> {
  const [created] = await db
    .insert(userAgentConfigs)
    .values(row)
    .onConflictDoNothing({ target: userAgentConfigs.userId })
    .returning();
  return created;
}

export async function updateUserAgentConfigByUserId(
  db: AgentConfigDb,
  userId: string,
  patch: Partial<Omit<UserAgentConfig, 'id' | 'userId' | 'createdAt'>>,
  updatedAt: Date
): Promise<UserAgentConfig | undefined> {
  const [updated] = await db
    .update(userAgentConfigs)
    .set({ ...patch, updatedAt })
    .where(eq(userAgentConfigs.userId, userId))
    .returning();
  return updated;
}

export async function insertUserAgentConfigReturningFull(
  db: AgentConfigDb,
  row: NewUserAgentConfig
): Promise<UserAgentConfig | undefined> {
  const [created] = await db.insert(userAgentConfigs).values(row).returning();
  return created;
}

/**
 * Atomically set `lastTriggeredAt` on one entry in the JSON `priceAlerts` array (read path stays in app).
 */
export async function updateUserAgentConfigPriceAlertLastTriggeredAt(
  db: AgentConfigDb,
  userId: string,
  alertId: string,
  triggeredAtIso: string
): Promise<void> {
  await db
    .update(userAgentConfigs)
    .set({
      priceAlerts: sql`(
          SELECT COALESCE(
            jsonb_agg(
              CASE
                WHEN elem->>'id' = ${alertId}
                THEN elem || jsonb_build_object('lastTriggeredAt', ${triggeredAtIso}::text)
                ELSE elem
              END
            ),
            '[]'::jsonb
          )::json
          FROM jsonb_array_elements(
            COALESCE(${userAgentConfigs.priceAlerts}::jsonb, '[]'::jsonb)
          ) AS elem
        )`,
      updatedAt: new Date(),
    })
    .where(eq(userAgentConfigs.userId, userId));
}
