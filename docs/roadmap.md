# Babylon roadmap (potential)

Potential work items for agent/LLM visibility, docs, and standards. Each item includes **why** we might do it.

---

## Agent / LLM standards on our domain

### Already in place

- **A2A** (Agent-to-Agent): `GET/POST /api/a2a`, per-agent `GET/POST /api/agents/{id}/a2a`. **Why**: Standard agent discovery and messaging; agents can find our card and talk to Babylon.
- **MCP** (Model Context Protocol): `GET/POST /api/mcp`. **Why**: Tool-calling agents (Cursor, etc.) can use our 75+ tools without implementing A2A.
- **Agent cards**: Platform card at `/.well-known/agent-card.json` → `/api/game/card`; per-agent at `/api/agents/{id}/.well-known/agent-card`. **Why**: A2A and other protocols expect a well-known URL for discovery.
- **OpenAPI**: `/api/docs` (generated from route `@openapi` tags). **Why**: Machine-readable API spec for docs and tooling.
- **Skills**: Generated `docs/skills.md` and `skills/babylon/` (SKILL.md, claw.json, README) from A2A/MCP sources. **Why**: Single source of truth; AgentSkills-compatible packages for Cursor/ClawHub/etc. without hand-editing.

### Potential additions

| Item | What | Why |
|------|------|-----|
| **llms.txt** | Plain-text file at `/llms.txt` (or `/.well-known/llms.txt`) listing product summary, docs, API, A2A/MCP URLs, skills. | **Why**: Emerging standard for LLM/agent discovery (like robots.txt for AIs). Gives agents one place to learn what we are and where to find docs and endpoints. Spec: [llms.txt](https://www.ai-visibility.org.uk/specifications/llms-txt/), [AnswerDotAI/llms-txt](https://github.com/AnswerDotAI/llms-txt). |
| **llms-full.txt** | Optional full doc (single file, &lt;50KB). | **Why**: Some specs support a “full” variant for context-heavy ingestion; only add if we want one-file docs for agents. |
| **security.txt** | `/.well-known/security.txt` (RFC 9116): security contact, policy URL, expiry. | **Why**: Standard place for security researchers; low effort, good practice for any public domain. |
| **Stable platform agent card URL** | Document or alias so “Babylon platform” card is clearly distinct from game card. | **Why**: Today `/.well-known/agent-card.json` points at game card; if we want a single “Babylon API” card for agents, we could expose it at a dedicated well-known path and reference it in llms.txt. |
| **ACP** (Agent Communication Protocol) | Optional REST + multipart MIME API (IBM/BeeAI). | **Why**: Alternative to A2A for lighter, REST-native agent integrations; only if we see demand. |

### Other agent protocols (reference only)

We do **not** plan to implement these unless requirements change:

- **ANP** (Agent Network Protocol): Decentralized P2P, W3C DIDs. **Why not now**: Different layer (identity/networking), not a “serve on our domain” endpoint.
- **AGORA**: Natural-language meta-protocol. **Why not now**: Research/early; not a transport we’d host.

---

## Doc and skill generation

- **docs:generate** runs vendor doc pulls (e.g. Drizzle, Elysia, Privy, Bun) **and** the skills generator (docs/skills.md + skills/babylon/). **Why**: One command keeps all LLM-facing docs (vendor + our A2A/MCP surface) in sync so we don’t forget to refresh skills when APIs change.
- **skills:generate** writes only `docs/skills.md`. **Why**: Quick refresh of the in-repo reference without touching the packaged skill.
- **skills:package** writes the full `skills/babylon/` package (SKILL.md, claw.json, README). **Why**: Produces the AgentSkills-compatible directory for publishing or dropping into an agent’s skills folder.

---

## Changelog / versioning

See [CHANGELOG.md](../CHANGELOG.md) for released and unreleased changes. Roadmap items above are **potential**; they are not committed until they appear in the changelog as done.
