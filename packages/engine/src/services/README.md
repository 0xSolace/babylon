# Engine services — user identifier query optimizations

Domain services under `@babylon/engine` that touch Postgres should avoid `OR` across `User.id` and `User.privyId` when a single identifier string can be classified first.

## Why this folder documents it

- **Hot paths**: Points and portfolio code run often; bad plans on `User` show up as DB time and lock pressure.
- **One rule everywhere**: Classification lives in `@babylon/shared` (`resolveUserIdentifierKind`) so API lookups and engine queries never disagree.

## Documents (read these first)

| Doc | Scope |
|-----|--------|
| [`TOTAL_POINTS_OPTIMIZATION.md`](./TOTAL_POINTS_OPTIMIZATION.md) | `markDirty`, `recomputeTotalPoints` — OR removal, indexes, username `lower()` |
| [`PORTFOLIO_BREAKDOWN_OPTIMIZATION.md`](./PORTFOLIO_BREAKDOWN_OPTIMIZATION.md) | `calculatePortfolioBreakdown` — same pattern |
| [`../../../shared/src/utils/USER_IDENTIFIER.md`](../../../shared/src/utils/USER_IDENTIFIER.md) | Classifier behavior, edge cases, index map |

## Rules of thumb (WHYs)

1. **Classify, then one `WHERE` branch** — **WHY**: Postgres optimizes single-index predicates far more reliably than `OR` on different columns.
2. **Username branch = `lower(username) = lower(input)`** — **WHY**: Uses `idx_users_username_lower` and matches `findUserByIdentifier` (case-insensitive).
3. **Never fork the classifier** — **WHY**: Two copies → production bugs when UUID/snowflake/privy rules change in one place only.

## Roadmap (high level)

- **Done**: Shared helper, engine OR removal, docs, unit tests for classifier.
- **Next**: `EXPLAIN (ANALYZE)` in staging/prod on the three query shapes; consider write-back / batching for `markDirty` only if metrics still show pressure after this change.
