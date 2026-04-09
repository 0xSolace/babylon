# PR Summaries — Phase 3 & 4

---

## PR 1 — Steward Auth Migration

**Title:**
```
feat: replace Privy with Steward auth + remove crypto/blockchain stack
```

**Summary:**

This PR completes two major tasks: strips all crypto/blockchain dependencies from Babylon and replaces Privy with Steward, a self-hostable open-source auth provider.

**What was removed:**
- All Solana, EVM, Anchor, Agent0, and `@privy-io/*` packages and code (~37k lines deleted)
- Wallet-based login flows, NFT gating hooks, on-chain registration (`8004`)
- `@babylon/contracts` package and all related `tsconfig`/`next.config` references

**What was added:**
- Steward service in `docker-compose.yml` with health check, DB provisioning script, and `steward:init` npm script
- `stewardId` column on the `User` table (migration `0067_add_steward_id.sql`) alongside `privyId` for migration continuity
- Backend auth middleware rewritten to verify Steward JWTs (`jose`)
- New API routes: `/api/auth/session` (cookie bridge), `/api/auth/farcaster`, `/api/auth/farcaster-miniapp`, `/api/auth/telegram-miniapp`
- Frontend `StewardAuthProvider`, rewritten `useAuth` hook, and `LoginModal` with Google, Discord, X, email/passkey via Steward SDK (`@stwd/sdk`)
- `.env.example` updated with all Steward variables (`STEWARD_API_URL`, `STEWARD_JWT_SECRET`, `STEWARD_TENANT_ID`, `STEWARD_TENANT_API_KEY`, `STEWARD_APP_URL`)

**Test plan:**
- [ ] `bun run steward:init` provisions tenant and prints `STEWARD_TENANT_API_KEY`
- [ ] `docker compose up steward` becomes healthy
- [ ] Login modal renders with OAuth buttons (Google/Discord/X) enabled immediately
- [ ] Email magic-link flow delivers email and redirects back to `/auth/callback`
- [ ] Farcaster and Telegram miniapp auth routes return 200 with valid JWT
- [ ] Existing users with `privyId` are not broken (column still present)

---

## PR 2 — ElizaCloud Inference Migration

**Title:**
```
feat: route all inference through ElizaCloud when ELIZACLOUD_API_KEY is set
```

**Summary:**

When `ELIZACLOUD_API_KEY` is set, all LLM and embedding inference in Babylon routes through ElizaCloud's OpenAI-compatible proxy instead of calling Groq, OpenAI, or Anthropic directly. Individual provider keys remain as fallbacks so nothing breaks without an ElizaCloud key.

**Files changed (6):**

| File | Change |
|---|---|
| `packages/engine/src/llm/openai-client.ts` | ElizaCloud added as Priority #1 in `BabylonLLMClient`; new `resolveElizaCloudConfig()` helper; `'elizacloud'` provider type |
| `packages/engine/src/llm/embedding-client.ts` | Prefers `ELIZACLOUD_API_KEY` → `ELIZACLOUD_API_URL/openai/v1`; falls back to `OPENAI_API_KEY` |
| `packages/agents/src/llm/direct-groq.ts` | `resolveGroqBaseURL()` returns ElizaCloud URL when configured; `callGroqDirect()` accepts `ELIZACLOUD_API_KEY` as fallback |
| `packages/agents/src/runtime/AgentRuntimeManager.ts` | `getModelSettings()` + `character.settings` include ElizaCloud vars; `groqPlugin`/`openaiPlugin` activate on `ELIZACLOUD_API_KEY` |
| `packages/api/src/services/claude-service.ts` | Routes Anthropic SDK to `ELIZACLOUD_API_URL/anthropic/v1` when ElizaCloud key is set |
| `.env.example` | New "ElizaCloud Inference" section; individual provider keys marked as optional fallbacks |

**Test plan:**
- [ ] Set `ELIZACLOUD_API_KEY=<key>` and `ELIZACLOUD_API_URL=<url>` in `.env`, unset all other provider keys
- [ ] Run `bun run dev` — confirm no "No API key configured" warnings
- [ ] Trigger a game tick — confirm `BabylonLLMClient` logs `Using ElizaCloud (unified inference)`
- [ ] Confirm `callGroqDirect` resolves to ElizaCloud base URL in agent logs
- [ ] Without `ELIZACLOUD_API_KEY`, confirm fallback to `GROQ_API_KEY` / `ANTHROPIC_API_KEY` still works
