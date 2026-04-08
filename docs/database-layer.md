# Database layer: `@babylon/db`, `@babylon/db/engine-storage`, and `@babylon/db/runtime`

This document explains **how** we split database concerns and **why** each piece exists. It complements `CLAUDE.md` (rules) with rationale for contributors and code reviewers.

---

## The entry points (and why they are split)

| Entry | Purpose | Why separate |
|--------|---------|----------------|
| **`@babylon/db`** (barrel / `packages/db/src/index.ts`) | Schema **types**, named **query modules** (`fetchChatNameById`, `upsertDailyTopicRow`, …), shared helpers (`generateSnowflakeId`, moderation filters), re-exports of a few **client types** (`DrizzleClient`, `Transaction`) | Keeps a **stable, tree-shakeable API** for app and engine code without pulling the raw Postgres client into every import graph. |
| **`drizzle-orm`** | SQL **builders** used **inside** `packages/db` implementation (`*-queries.ts`, `tables/*`, `db.ts`) | App and domain packages should not import `drizzle-orm` for query building; they call named helpers from `@babylon/db`. **`@babylon/db` also re-exports** common builders/types (`eq`, `and`, `sql`, `InferSelectModel`, …) for the rare cases that still need them during migration—**prefer** keeping predicates inside `packages/db` query modules. |
| **`@babylon/db/engine-storage`** | Same as runtime: **`db`**, **table symbols**, **RLS helpers**, connection lifecycle | **Default import for other packages** (`packages/api`, `packages/agents`, …) and **root `scripts/` CLIs** (maintenance/seed scripts). Same module graph as runtime; use this path so boundary checks can keep `@babylon/db/runtime` internal. |
| **`@babylon/db/runtime`** | Identical exports (re-exported by `engine-storage`) | **Do not import from app or domain packages** — `bun run enforce:db-boundary` flags this path outside **exempt prefixes** (`apps/cli/`, `scripts/`, tests, …). Prefer `engine-storage` everywhere else. |

**Why not one package?** Historically, a single barrel re-exported both Drizzle helpers and domain queries. That made it unclear whether `apps/web` should build raw `where` clauses (it shouldn’t for maintainability) and tied lint rules to a re-export shim. Splitting **types + named queries** vs **runtime + RLS** vs **drizzle-orm** keeps boundaries enforceable in review.

---

## Where SQL and `where` clauses belong

**Rule:** Prefer **no ad-hoc Drizzle queries** in `apps/web` route handlers for non-trivial access patterns. Put **all** `select` / `insert` / `where` / `join` in `packages/db` as named functions (e.g. `*-queries.ts`, `nft-chat-gating-queries.ts`).

**Why:**

1. **Single place to audit** security (RLS, filters, PII).
2. **Easier to test** and reuse from API, engine, agents, cron.
3. **Clear ownership** when Postgres policies or indexes change.

**Engine (`packages/engine`)** is migrating toward the same rule: domain logic orchestrates; the DB package owns query shape. Until migration is complete, some engine files still inline Drizzle—treat those as **legacy** and move new work into `packages/db`.

---

## RLS: `asUser`, `asSystem`, `asPublic`

Postgres Row-Level Security uses a session variable (e.g. `app.current_user_id`) set per transaction.

| Helper | Sets `app.current_user_id` to | When to use |
|--------|--------------------------------|-------------|
| **`asUser`** | The authenticated user’s id | Request-scoped work that must **see only what that user may see**. |
| **`asSystem`** | `'system'` | **Background jobs**, cron, engine ticks, and internal maintenance that must **bypass RLS** in a controlled, logged way. |
| **`asPublic`** | Empty / public | Unauthenticated read paths that use RLS policies for anonymous access. |

**Why `asSystem` runs inside a transaction:** `set_config(..., true)` is **transaction-local**. Wrapping in `transaction()` guarantees the setting cannot leak to the next unrelated query on a pooled connection.

**Why not call `set_config` once at connect?** Poolers reuse connections across requests and jobs; a leaked “system” or stale user id would be a **security bug**. Per-operation transactions keep context correct.

**Naming:** `asSystem` is intentionally boring—it means “run this callback with the system RLS principal,” not “god mode everywhere.” Prefer **named query functions** that internally call `asSystem` so call sites stay readable (`upsertDailyTopicRow` vs raw `asSystem` in engine).

**Import path:** The `@babylon/db` barrel does **not** re-export `asUser` / `asSystem` / `asPublic`. Import them from **`@babylon/db/engine-storage`** in **`apps/web`**, `packages/api`, `packages/agents`, and similar. **`@babylon/db/runtime`** is the same module graph; `bun run enforce:db-boundary` allows it **only** under exempt prefixes (see `EXEMPT_PREFIXES` in `scripts/enforce-db-query-boundary.ts`). There is **no** runtime grandfather file — use `engine-storage` or move the file under an exempt prefix if you truly need the `runtime` specifier.

---

## Adding a new query

1. Add `packages/db/src/your-feature-queries.ts` (or extend an existing `*-queries.ts`).
2. Use `drizzle-orm` for `eq` / `and` / … **inside that file only** (or inside `engine-storage` consumers that are still being refactored).
3. Use **`asUser` / `asSystem` / `asPublic`** when RLS matters; use plain `db` from `./db` only when you have a deliberate reason (e.g. code paths that already run inside an RLS wrapper).
4. Export the function from `packages/db/src/index.ts`.
5. Import the function from `@babylon/db` in apps/engine/agents/api. **Do not** add `@babylon/db/runtime` outside exempt prefixes (use `@babylon/db/engine-storage` for the process-wide client + RLS helpers).

---

## Tooling and migrations

- **DB boundary:** `bun run enforce:db-boundary` — fails on (1) `@babylon/db/runtime` imports outside exempt path prefixes, and (2) direct `drizzle-orm` imports outside `packages/db/src/**`, `packages/db/drizzle/**`, and exempt prefixes (e.g. `scripts/`, `packages/testing/`). (`@babylon/db/engine-storage` is not flagged.) Only **git-tracked** files are scanned.
- **Codemod:** `scripts/split-drizzle-imports-from-db-barrel.ts` — splits legacy `import { eq } from '@babylon/db'` into `drizzle-orm` + `@babylon/db`. Uses **brace-balanced** parsing because naive regexes break on `}` inside nested objects above the import.
- **Biome:** `packages/a2a` may import `drizzle-orm` directly; it must not import `@babylon/db/tables` (use named helpers instead). See `biome.json` overrides.

---

Examples of query modules in-repo: `daily-topic-queries.ts`, `npc-group-chat-onboarding-queries.ts`, `engine-read-queries.ts`, `perp-price-impact-queries.ts`, `portfolio-pnl-queries.ts`, `chat-queries.ts`.

## Related docs

- `docs/roadmap-database-layer.md` — planned cleanup of remaining inline queries.
- `CLAUDE.md` — dependency direction and quality gates.
- `packages/api/src/rate-limiting/README.md` — public API rate limits (orthogonal but often touched alongside routes that call DB helpers).
