# Roadmap: database layer consistency

This is a **working roadmap**, not a commitment schedule. It tracks **why** we want each item and **what** “done” looks like.

---

## Completed (baseline)

- **`@babylon/db` no longer re-exports** Drizzle SQL builders (`eq`, `and`, `sql`, …). **Why:** Avoid a fake “second Drizzle API,” reduce upgrade churn, and make import paths honest (`drizzle-orm` vs domain queries).
- **Named query modules** for daily topics and NPC group-chat onboarding live under `packages/db` with **`asSystem`** where RLS requires a system principal. **Why:** Engine and cron should orchestrate, not own SQL shape.
- **`engine-read-queries.ts`** — shared engine reads (questions, markets, games, world events, arc state, actors, posts) plus game-service helpers (`fetchLatestContinuousGameDayRow`, `fetchActiveMarketSummaries`). **Why:** Replaces the orphan `packages/engine/src/db/queries.ts` copy; SQL is reviewed in one package.
- **`perp-price-impact-queries.ts`** — snapshot / org state / open positions for user-trade price impact and base price. **Why:** Keeps perp impact SQL out of `packages/engine` services.
- **`portfolio-pnl-queries.ts`** — `fetchPortfolioPnLSnapshot`. **Why:** One join-heavy path for P&L; `PortfolioPnLSnapshot` type is canonical in `@babylon/db` (engine `client.ts` re-exports the type).
- **Biome / a2a** updated so `drizzle-orm` is allowed where re-exports were previously assumed. **Why:** Align lint with the new import rules.

---

## In progress / next

### 1. Move remaining Drizzle from `packages/engine` into `packages/db`

**Why:** Same reasons as daily-topic / NPC onboarding: one place for `where` clauses, easier RLS review, shared tests.

**Candidates (non-exhaustive):** `group-chat-service.ts`, `sub-market-service.ts`, `ActorSocialActions.ts`, `game-tick.ts`, wallet/trade paths that still build large `asSystem` callbacks inline.

**Done when:** New features add **no** new multi-line Drizzle blocks in engine; engine calls `@babylon/db` helpers or thin ports.

### 2. Standardize RLS wrapper per query family

**Why:** Some paths use `asSystem` inside query modules; others may still use raw `db` on connections that assume privilege. Auditing “who sets `app.current_user_id`” should be mechanical.

**Done when:** Each exported query documents in a one-line JSDoc whether it expects **user**, **system**, or **public** context, and tests cover the critical paths.

### 3. Optional: `readAfterWrite` helper (replica lag)

**Why:** `CLAUDE.md` notes replica reads can be stale immediately after writes. A small helper would document the pattern and reduce foot-guns.

**Done when:** Documented API + used in at least one high-traffic read-after-write flow (or explicitly deferred with issue link).

### 4. Harden large-table migrations (`CONCURRENTLY`)

**Why:** Blocking indexes on huge tables risk production outages. Called out in `CLAUDE.md` for specific migrations.

**Done when:** Tracked issue + migration playbook for tables past agreed row thresholds.

---

## How to use this doc

- **Contributors:** Pick an item, open a PR scoped to one service or query family, link this file in the PR description under “Context.”
- **Reviewers:** If a PR adds `where` in `apps/web` or large inline Drizzle in engine, ask for a **named query in `@babylon/db`** unless there is an explicit, documented exception.
