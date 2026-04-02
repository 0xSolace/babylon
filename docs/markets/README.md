# Markets documentation

Design notes, rationale (**WHY**), and pointers for the markets product surface (screener + trading terminal).

| Doc | Purpose |
|-----|---------|
| [trending-screener.md](./trending-screener.md) | `/markets/trending` browse-first screener: flows, deep links, **display formatting (compact tiers, guards, org avatars)**, code map, roadmap, rate limits |
| [markets-api-caching.md](./markets-api-caching.md) | Redis cache-aside for markets list APIs, SSE patching, invalidation topology, pagination, known caveats |
| Root [CHANGELOG.md](../../CHANGELOG.md) | What shipped, with **WHY** bullets where it helps reviewers |

**Why a `docs/markets/` folder:** Keeps product/architecture notes next to the domain without scattering READMEs across every route. App Router code stays in `apps/web`; long-form rationale lives here so agents and humans find one index.

**See also (code-adjacent READMEs):**

- [`apps/web/src/app/markets/_lib/README.md`](../../apps/web/src/app/markets/_lib/README.md) — why `formatters.ts` lives next to routes vs only `@babylon/shared`.
- [`apps/web/src/app/markets/trending/README.md`](../../apps/web/src/app/markets/trending/README.md) — quick dev map for the screener route.
