## Summary
- Replace uppercase currency symbol Ƀ (U+0243) with lowercase ƀ (U+0255) throughout the UI
- Update all currency formatting functions to use the new symbol consistently
- Replace hardcoded $ signs with ƀ where appropriate (preserving actual USD references)
- Add comprehensive test coverage for currency formatting edge cases

## Type
- [x] Refactor / cleanup (no behavior change)

## Context / Links
- Video demo: https://share.descript.com/view/mR65lK3keuX

## Scope (keep it focused)
- [x] This PR is focused on a single change/theme (not a catch‑all)
- [x] Drive‑by refactors are excluded or split into a separate PR
- [x] Non‑goals / follow‑ups are listed below (with links)

**Areas touched**
- [x] Web UI (`apps/web`)
- [x] Web API routes / SSE / A2A (`apps/web`)
- [x] Agents / runtime / A2A / MCP (`packages/agents`)
- [x] Shared types/utils (`packages/shared`)
- [x] Tests (`packages/testing`)

## Changes
- Updated `BABYLON_POINTS_SYMBOL` constant from 'Ƀ' to 'ƀ' in `packages/shared/src/constants/currency.ts`
- Replaced all hardcoded $ signs with ƀ in UI components (except actual USD references like BuyPointsModal)
- Updated `formatCurrency`, `formatPrice`, `formatVolume` functions to use lowercase symbol
- Replaced `Intl.NumberFormat` USD usage with custom ƀ formatting in PnL share cards
- Updated validation schema error messages
- Updated API route messages for agent wallet/trading balance operations
- Added comprehensive test suite (40+ new tests) covering edge cases, boundary conditions, and integration points

**Key files:**
- `packages/shared/src/constants/currency.ts` - Core constant update
- `packages/shared/src/utils/format.ts` - Currency formatting function
- `apps/web/src/app/markets/_lib/formatters.ts` - Market formatters
- `apps/web/src/components/**/*.tsx` - UI components (trade cards, admin panels, profile widgets, etc.)
- `packages/testing/unit/shared/format-currency.test.ts` - Comprehensive currency tests
- `packages/testing/unit/markets/formatters.test.ts` - Market formatter integration tests

## Review guide

**Start here**
- `packages/shared/src/constants/currency.ts` - Single source of truth for symbol
- `packages/shared/src/utils/format.ts` - Core formatting function
- `packages/testing/unit/shared/format-currency.test.ts` - Test coverage

**Risk**
- [x] Low - Symbol-only change, no functional impact

**Notes for reviewers**
- All currency displays now use lowercase ƀ instead of uppercase Ƀ or $
- USD references in BuyPointsModal and AdminSendMoneyModal intentionally preserved (actual USD purchases)
- Cashtags ($AAPL, $BTC) intentionally preserved (ticker symbols, not currency)
- Template literals and regex patterns intentionally preserved
- All tests pass (1157 tests), type checking passes, linting passes

## Test plan

**Commands run**
- [x] `bun run check` (Biome format)
- [x] `bun run typecheck`
- [x] `bun run lint`
- [x] `bun run build`
- [x] `bun run test:unit` (1157 tests passing)

**Manual verification**
1. Check currency displays across UI pages (markets, profile, leaderboard, admin panels)
2. Verify symbol appears correctly (lowercase ƀ, not uppercase Ƀ or $)
3. Verify USD references still show $ where appropriate (buy points modal)

## Ops / Migration / Deployment

- [x] No deploy impact
- [ ] Requires env var updates (listed below + `.env.example` updated)
- [ ] Requires DB migration (`bun run db:migrate`) / backfill / seed
- [ ] Changes cron schedule or endpoints (`vercel.json`, `CRON_SECRET`, etc.)
- [ ] Rollout behind a flag / gradual rollout

**Env vars (added/changed/removed)**
- None

**DB / data migration**
- None

**Rollout / rollback plan**
- Rollout: Standard deployment - no special steps needed
- Rollback: Revert PR if needed - no data migration required

## Breaking changes

- [x] None

## Security / privacy

- [x] No security impact

## Screenshots / recordings (UI)

### Option A: Visual demo

**Video demonstration:** https://share.descript.com/view/mR65lK3keuX

*Demo script (for recording):*
1. Navigate through markets page - verify currency symbols show ƀ
2. Check profile page - verify balance and PnL show ƀ
3. View leaderboard - verify points show ƀ
4. Check admin panels - verify all currency displays use ƀ
5. Verify BuyPointsModal still shows $ for actual USD purchases

## Checklist (author)
- [x] Self-review done (diff + critical paths)
- [x] Base branch is correct (`staging` by default)
- [x] Handlers remain thin and portable (validate → service → map errors)
- [x] Domain logic stays in packages (no Next/React/Elysia coupling in core)
- [x] `.env.example` updated (if env changed) and variables documented above
- [x] Docs updated (and `bun run docs:generate` if needed)
- [x] Tests added/updated for behavior changes (or rationale provided)
- [x] Dependency changes are intentional (`bun.lock` updated)
- [x] Code owners requested (auto via CODEOWNERS or manual)
- [x] **Screenshots/recordings section filled** (visual demo OR explanation why N/A)
