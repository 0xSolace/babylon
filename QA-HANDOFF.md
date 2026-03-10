# QA Bug Fix Handoff

**Date:** 2026-03-10
**Branch:** `save/qa-scripts` (this branch)
**Source:** `QA-FINDINGS.md` in this branch — 34 unique bugs from 76+ API endpoints tested

---

## Current State

### Staging has all hook fixes merged
PR #1214 fixed Claude Code hook misconfiguration (typecheck + test failures). Staging is clean and all hooks work correctly. **Any new agent must branch from staging.**

### Test timeout fix pending
`packages/testing/unit/web/api-routes-with-error-handling.test.ts` needs a 30s timeout (was 5s, times out scanning 200+ route files). Fix is on `fix/qa-garbage-jwt-500` branch stash — or just apply: change `it('wraps all...', async () => {` to `it('wraps all...', async () => {`, `30_000)` as 3rd arg.

---

## 5 Open PRs — All Green, Ready to Merge

All have staging merged in, CI passes, 0 review comments.

| PR | Branch | Bug | Description |
|----|--------|-----|-------------|
| #1215 | `fix/qa-npc-dm-guard-bypass` | C4 | NPC DM guard bypass via auto-create chat |
| #1216 | `fix/qa-npc-performance-zero-scores` | M5 | NPC performance leaderboard all zeros |
| #1217 | `fix/qa-get-post-wrong-url` | MCP1 | `get_post` double `/api` prefix |
| #1218 | `fix/qa-garbage-jwt-500` | C2 | Garbage JWT returns 500 instead of 401 |
| #1219 | `fix/qa-create-post-media-url` | MCP2 | `create_post` drops `mediaUrl` |

**Action:** Merge these 5 PRs first, then branch from updated staging for remaining work.

---

## Remaining Bugs — Split Into 5 Workstreams

### Agent 1: API 500 Errors
Each bug = separate PR, branched from staging.

| Bug | Endpoint | Issue |
|-----|----------|-------|
| C1 | `GET /api/agents` | Returns 500 (had PR #1188, was closed — needs fresh approach) |
| C3 | `GET /api/leaderboard?type=team&userId=X` | 500 on team+userId combo |
| C5 | `POST /api/markets/predictions` | 500 — schema mismatch, column doesn't exist |
| H5 | `GET /api/chats/[id]/participants` | 500 server error |

### Agent 2: Missing/Broken Endpoints
| Bug | Endpoint | Issue |
|-----|----------|-------|
| H1 | `POST /api/posts/:id` | Like returns 405 Method Not Allowed |
| H2 | `POST /api/posts/:id/reply` | Reply returns 400 "Invalid JSON" |
| H3 | `PATCH /api/users/me` | Profile update returns 405 |
| H9 | `GET /api/game/state` | Returns HTML instead of JSON |

### Agent 3: Chat & Social
| Bug | Endpoint | Issue |
|-----|----------|-------|
| H6 | `GET /api/chats/unread-count` | Always returns `pendingDMs: 0` |
| H8 | Follow/unfollow | No endpoints exist (all 404) |
| MCP3 | `babylon_search_agents` | Returns raw array instead of `{agents: [...]}` wrapper |

### Agent 4: Leaderboard & Performance
| Bug | Endpoint | Issue |
|-----|----------|-------|
| H4 | `GET /api/users/search?q=X` | 5.8s for some queries (missing index?) |
| H7 | `GET /api/leaderboard` | `currentUser` never populated from auth |
| MCP8 | `babylon_get_leaderboard` | Ignores `type` parameter |

### Agent 5: MCP Tool Parity
| Bug | MCP Tool | Issue |
|-----|----------|-------|
| MCP4 | `babylon_send_message` | Bypasses NPC DM guard (same root cause as C4) |
| MCP5 | `babylon_get_portfolio` | Returns empty with open positions |
| MCP6 | `babylon_resolve_market` | Allows non-admin resolution |
| MCP7 | `babylon_get_chat_messages` | Returns empty for active chats |

---

## Already Fixed (Merged to Staging)

| PR | Bugs Fixed |
|----|------------|
| #1203 | BAB-247 API QA fixes |
| #1208 | BAB-248 medium QA bugs |
| #1209 | BAB-249 MCP parity |
| #1210 | BAB-249 followup — notification clearing, resolution audit |
| #1211 | DB missing journal entry |
| #1214 | Claude Code hook misconfiguration (typecheck + test failures) |

---

## Instructions for Next Agent

```bash
# 1. Merge the 5 open PRs first
for pr in 1215 1216 1217 1218 1219; do
  gh pr merge $pr --squash --delete-branch
done

# 2. Pull updated staging
git checkout staging && git pull

# 3. For each bug, create a branch + PR
git checkout -b fix/qa-<short-name> staging
# ... fix the bug ...
# ... run tests: bun test packages/testing/unit/ --preload ./packages/testing/unit/preload.ts
# ... commit and push
gh pr create --base staging --title "fix: <description>" --body "Fixes QA bug <ID> from QA-FINDINGS.md"

# 4. Each bug = 1 small PR. Don't bundle.
```

### Key Files

| Area | Key Files |
|------|-----------|
| API routes | `apps/web/src/app/api/` |
| MCP tools | `packages/mcp/src/tools/` and `packages/mcp/src/tool-handlers.ts` |
| DB schema | `packages/db/src/schema/` |
| Shared types | `packages/shared/src/` |
| Tests | `packages/testing/unit/` |
| QA findings | `QA-FINDINGS.md` (this branch) |

### Hooks / Pre-push

Staging now has working pre-push hooks that run `turbo typecheck && turbo lint && turbo build`. This takes ~5 min. Don't skip with `--no-verify`. If typecheck fails, fix it before pushing.

### Parallel Agent Dispatch

To run 5 agents in parallel, use worktree isolation:
```
Agent tool with isolation: "worktree" for each workstream
```
Each agent gets its own git worktree so they don't conflict. After each finishes, their changes are on a separate branch ready for PR.
