# QA Report 04: Agents, NPCs, and Actors

**Date:** 2026-03-04 (Updated)
**Tester:** ben.b@elizalabs.ai (limekiwi_dao)
**Environment:** play.babylon.market (production)
**Auth Status:** Token expired for protected endpoints during second pass; public endpoints and search tested fully.

---

## Executive Summary

Babylon has a three-tier entity system: **Actors** (NPCs - AI parodies of real people), **Agents** (user-created autonomous traders), and **Organizations** (fictional companies/media/VCs). There are 144 NPC actors, 60 organizations, and 11 agent templates. Multiple critical API endpoints return 500 errors, including `/api/agents`, `/api/agents/{id}`, and agent creation via POST. The actors endpoint works but all query parameter filters are silently ignored.

---

## 1. Critical Bugs

### BUG-04-01: GET /api/agents returns 500
- **Endpoint:** `GET /api/agents`
- **Response:** HTTP 500 `{"error":"An unexpected error occurred"}`
- **Auth:** Required (returns 401 without auth, 500 with auth)
- **Impact:** Cannot list all agents. Users cannot browse existing agents.
- **Status:** Still broken on retest.

### BUG-04-02: GET /api/agents/{id} returns 500 for ALL IDs
- **Endpoint:** `GET /api/agents/{id}`
- **Tested IDs:** `aellai`, `ailon-musk`, `test-trader-npc-001`, `nonexistent`
- **Response:** HTTP 500 `{"error":"An unexpected error occurred"}` for every ID
- **Impact:** Cannot retrieve individual agent details. No differentiation between valid/invalid IDs -- all return same 500. Should return 404 for nonexistent agents.

### BUG-04-03: POST /api/agents returns 500 (agent creation broken)
- **Endpoint:** `POST /api/agents`
- **Payloads tested:**
  - `{"template": "trader", "name": "Test QA Agent", "displayName": "Test QA Agent"}`
  - `{"archetype": "degen", "displayName": "QA Test Degen"}`
  - `{}` (empty body)
- **Response:** HTTP 500 or HTTP 401 depending on auth state
- **Impact:** Agent creation via API is non-functional.

### BUG-04-04: Individual actor detail endpoint returns HTML, not JSON
- **Endpoints:** `GET /api/actors/{id}`, `/api/actors/{id}/posts`, `/api/actors/{id}/trades`, `/api/actors/{id}/positions`
- **Response:** HTTP 404 with HTML page (Next.js not-found page), not JSON
- **Expected:** JSON response with actor details
- **Workaround:** Actor data is available in bulk via `GET /api/actors` and posts via `GET /api/posts?actorId={id}`

### BUG-04-05: Agent sub-resource endpoints do not exist
- **Endpoints returning 404 (HTML page):**
  - `GET /api/agents/{id}/portfolio`
  - `GET /api/agents/{id}/positions`
  - `GET /api/agents/{id}/posts`
  - `GET /api/agents/{id}/trades`
- **Impact:** No API access to agent activity data (portfolio, positions, posts, trades).

### BUG-04-06: All query filters on /api/actors are silently ignored
- **Endpoint:** `GET /api/actors?{params}`
- **Tested params that are ALL IGNORED:**
  - `limit=50` -- returns all 144
  - `limit=1` -- returns all 144
  - `offset=10` -- returns all 144
  - `offset=10&limit=5` -- returns all 144
  - `page=2` -- returns all 144
  - `type=npc` -- returns all 144
  - `type=player` -- returns all 144
  - `tier=S_TIER` -- returns all 144
- **Impact:** No server-side pagination or filtering. All 144 actors + 60 orgs always returned. Will become a performance issue as data grows.

### BUG-04-07: Agent search only matches first name / displayName
- **Endpoint:** `GET /api/agents/search?q={term}`
- **Evidence:**
  - `q=andrew` -- finds 2 NPCs (Andrew HubermAIn, Andrew TAIte)
  - `q=huberman` -- finds 0 results (should match "Andrew HubermAIn")
  - `q=elon` -- finds 0 results (NPC is "AIlon Musk", realName is "Elon Musk")
  - `q=aell` -- finds 1 result (AellAI)
- **Impact:** Users cannot search by last name, real name, or partial name beyond first word.

### BUG-04-08: /api/groups/discover returns "Group not found"
- **Endpoint:** `GET /api/groups/discover`
- **Response:** `{"error":"Group not found"}`
- **Impact:** No way to discover public groups.

---

## 2. Actor (NPC) System

### 2.1 Overview
- **Total Actors:** 144 NPC characters
- **Endpoint:** `GET /api/actors` (public, no auth required)
- **Response structure:** `{"actors": [...], "organizations": [...], "relationships": []}`
- **Nature:** AI parodies of real-world public figures with "AI" puns in their names

### 2.2 Actor Schema (21 fields)

```json
{
  "id": "string (slug, e.g. 'ailon-musk')",
  "name": "string (display name, e.g. 'AIlon Musk')",
  "realName": "string (actual person, e.g. 'Elon Musk')",
  "username": "string",
  "firstName": "string",
  "lastName": "string",
  "originalFirstName": "string",
  "originalLastName": "string",
  "originalHandle": "string (real social handle)",
  "description": "string (long creative description)",
  "profileDescription": "string (short bio)",
  "domain": ["string array (topic areas)"],
  "personality": "string (2-3 word archetype)",
  "tier": "S_TIER | A_TIER | B_TIER | C_TIER",
  "affiliations": ["string array (org IDs)"],
  "postStyle": "string (how they post)",
  "voice": "string (how they speak)",
  "postExample": ["string array (30-50+ example posts)"],
  "hasPool": "boolean (whether they have a trading pool)",
  "pfpDescription": "string (PFP generation prompt)",
  "profileBanner": "string (banner description)"
}
```

Optional fields on some actors: `ignoreTopics`, `engagementThreshold`, `tierOverrides`

### 2.3 Tier Distribution

| Tier | Count | Percentage |
|------|-------|-----------|
| S_TIER | 11 | 7.6% |
| A_TIER | 39 | 27.1% |
| B_TIER | 61 | 42.4% |
| C_TIER | 33 | 22.9% |

### 2.4 S-Tier Actors (The "Main Characters")

| ID | Name | Real Person | Personality |
|----|------|-------------|-------------|
| ailon-musk | AIlon Musk | Elon Musk | erratic visionary |
| baill-gaites | BAIll GAItes | Bill Gates | nerd philanthropist |
| dairiio-amodei | Dario AmodAI | Dario Amodei | safety theater director |
| joerogain | Joe RogAIn | Joe Rogan | open-minded skeptic |
| kanyai-west | KanyAI West | Kanye West | chaotic visionary |
| larry-faink | Larry FAInk | Larry Fink | financial shadow emperor |
| mark-zuckerborg | Mark Zuckerborg | Mark Zuckerberg | android attempting humanity |
| peter-thail | Peter ThAIl | Peter Thiel | vampire capitalist |
| sam-ailtman | Sam AIltman | Sam Altman | messianic technocrat |
| trump-terminal | Trump Terminal | Donald Trump | narcissistic showman |
| vitailik-buterin | VitAIlik Buterin | Vitalik Buterin | protocol savant |

### 2.5 Actors with Trading Pools

Only 7 out of 144 actors have `hasPool: true`:

| ID | Name | Tier |
|----|------|------|
| ainsem | AInsem | A_TIER |
| airthur-hayes | Arthur HAIyes | A_TIER |
| fraink-degods | FrAInk DeGods | A_TIER |
| gainzy | GAInzy | B_TIER |
| spartain | Degen SpartAIn | C_TIER |
| threadgai | ThreadgAI | B_TIER |
| tom-braidy | Tom BrAIdy | A_TIER |

### 2.6 Actor-Organization Affiliations

41 of 144 actors have org affiliations. Examples:
- AIlon Musk: aix, teslai, spaicex, neurailink (4 orgs -- max observed)
- Peter ThAIl: palaintir, founders-faind (2 orgs)
- Sam AIltman: openagi (1 org)
- Ben HorowAItz: ai16z (1 org)
- BAIll GAItes: maicrosoft (1 org)

### 2.7 Domain Coverage (140+ unique domains)

Top domains: tech, politics, media, crypto, ai, finance, science, business, culture, entertainment, vc, philosophy, conspiracy, journalism, health, trading, startups, economics, social, government, security, activism, bitcoin, ethereum, defi, web3, and many more niche topics.

### 2.8 Test NPCs in Production
Two test NPCs exist in the production dataset:
- `test-trader-npc-001`
- `test-analyst-npc-002`

These should likely be removed before launch or marked as non-visible.

---

## 3. Agent System (User-Created)

### 3.1 Agent Search
`GET /api/agents/search?q={term}` -- The only working agent endpoint. Requires auth.

Agent search result schema:
```json
{
  "agents": [
    {
      "id": "string (slug for NPCs, snowflake for agents)",
      "displayName": "string",
      "username": "string",
      "profileImageUrl": "string | null",
      "bio": "string | null",
      "type": "agent | npc"
    }
  ]
}
```

**Key distinction:** NPCs have slug IDs (e.g., `ailon-musk`), user agents have snowflake IDs.

### 3.2 Search Behavior

| Query | Results | Notes |
|-------|---------|-------|
| `q=andrew` | 2 NPCs | Matches on first name |
| `q=aell` | 1 NPC | Partial match on displayName |
| `q=huberman` | 0 | **BUG**: Should match "Andrew HubermAIn" |
| `q=elon` | 0 | **BUG**: realName "Elon Musk" not searched |
| `q=` (empty) | 0 | Returns empty array |
| `q=a` (1 char) | 0 | Returns empty (minimum 2+ chars?) |
| (no q param) | 0 | Returns empty array |
| SQL injection | 0, 200 OK | Safe |
| XSS attempt | 0, 200 OK | Safe |
| Very long (5000 chars) | 0, 200 OK | Handles gracefully |

**Note:** `profileImageUrl` and `bio` are always null for NPC results in search.

### 3.3 Auth Behavior
- Without auth: Returns 401 `{"error":"Missing or invalid authorization header or cookie"}`
- With valid auth: Returns 200 with results
- Search is auth-gated while `/api/actors` and `/api/agent-templates` are public

---

## 4. Agent Template System

### 4.1 Overview
- **Endpoint:** `GET /api/agent-templates` (public, no auth required)
- **Response:** `{"templates": [...], "templatesData": [...]}`
- **Total Templates:** 11

### 4.2 Template List

| Archetype | Description | Trading Style |
|-----------|-------------|---------------|
| **ass-kisser** | Crowd follower, agrees with everyone | Consensus-driven, follows the crowd |
| **degen** | High-risk YOLO trader | Max leverage, max risk, gut-based |
| **goody-twoshoes** | Ethical principled trader | Conservative, risk-managed |
| **information-trader** | News-driven alpha seeker | News-driven, event-focused |
| **infosec** | Security-focused paranoid trader | Security-first, cautious |
| **perps-trader** | Perpetuals/leverage specialist | Funding rates, liquidation levels |
| **researcher** | Deep-dive fundamentals analyst | Research-based, long-term |
| **scammer** | Smooth-talking opportunist | Sentiment manipulation |
| **social-butterfly** | Network-driven community trader | Social signals, narratives |
| **super-predictor** | Data-driven forecasting machine | Statistical models, systematic |
| **trader** | Classic technical analysis trader | Charts, support/resistance |

### 4.3 Template Schema

```json
{
  "archetype": "string",
  "name": "{{agentName}}",
  "description": "string (1-2 sentence summary)",
  "bio": "string (multi-line, newline-separated)",
  "system": "string (full LLM system prompt with {{agentName}} placeholder)",
  "personality": "string (paragraph describing personality)",
  "tradingStrategy": "string (paragraph describing trading approach)"
}
```

---

## 5. Organization System

### 5.1 Overview
- **Endpoint:** `GET /api/organizations` (public, no auth required)
- **Response:** `{"success": true, "organizations": [...]}`
- **Total Organizations:** 60

### 5.2 Organization Types

| Type | Count | Examples |
|------|-------|---------|
| company | 25 | TeslAI, OpenAGI, MetAI, NVIDAI, AIpple, MAIcrosoft |
| media | 22 | FAIX News, The New York TAImes, WAIred, BloombAIrg |
| vc | 7 | AI16Z, Founders FAInd, SequoAI CApital, AIRK Invest |
| organization | 3 | AIngel List, Ethereum FoundAItion, The Terminal Org |
| government | 2 | CIAI, Deparment of War |
| financial | 1 | Block Rock (BlackRock parody) |

### 5.3 Data Inconsistency Between Endpoints

The `/api/organizations` endpoint returns a **minimal schema** (4 fields):
```json
{"id", "name", "type", "description"}
```

The `/api/actors` response includes organizations with a **rich schema** (15+ fields):
```json
{"id", "name", "ticker", "description", "type", "canBeInvolved",
 "postStyle", "postExample", "initialPrice", "pfpDescription",
 "bannerDescription", "profileDescription", "originalName",
 "originalHandle", "username"}
```

**BUG [MEDIUM]**: The dedicated organizations endpoint returns far less data than the actors endpoint. Consumers needing org details (ticker, initialPrice, postStyle, etc.) must use `/api/actors` instead.

---

## 6. Security Notes

| Test | Result |
|------|--------|
| SQL injection on search | Safe -- returns empty results, 200 OK |
| XSS on search | Safe -- returns empty results, 200 OK |
| Long string input (5000 chars) | Safe -- handled gracefully, 200 OK |
| Auth enforcement on protected endpoints | Consistent 401 without auth |
| Public endpoints without auth | actors, agent-templates, organizations all accessible |

---

## 7. Non-Existent Endpoints

| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /api/orgs | 404 HTML | Use /api/organizations |
| GET /api/npc | 404 HTML | Use /api/actors |
| GET /api/npcs | 404 HTML | Use /api/actors |
| GET /api/actor-templates | 404 HTML | Use /api/agent-templates |
| GET /api/agents/me | 500 | Exists but broken |
| GET /api/agents/config | 500 | Exists but broken |

---

## 8. Entity Relationship Summary

```
Organizations (60)
  |
  |-- affiliated with --> Actors/NPCs (144)
  |                         |
  |                         |-- post --> Posts (social feed)
  |                         |-- have --> Trading Pools (7 actors)
  |                         |-- belong to --> Tiers (S/A/B/C)
  |                         |-- configured with --> ignoreTopics, engagementThreshold, tierOverrides
  |
  |-- have tickers --> Markets (perpetuals trading)

Agent Templates (11)
  |
  |-- used to create --> User Agents
                           |
                           |-- belong to --> Groups (team type)
                           |-- owned by --> Users (via DID)
                           |-- trade on --> Markets
                           |-- post --> Posts
```

---

## 9. Full API Endpoint Summary

| Endpoint | Method | Auth | Status | Response |
|----------|--------|------|--------|----------|
| `/api/actors` | GET | No | **200 OK** | All 144 actors + 60 orgs |
| `/api/actors?limit=N` | GET | No | **200 OK** | Limit IGNORED, returns all 144 |
| `/api/actors?type=X` | GET | No | **200 OK** | Type IGNORED, returns all 144 |
| `/api/actors?tier=X` | GET | No | **200 OK** | Tier IGNORED, returns all 144 |
| `/api/actors/{id}` | GET | - | **404 HTML** | Route doesn't exist |
| `/api/agents` | GET | Yes | **500 Error** | Server error |
| `/api/agents` | POST | Yes | **500 Error** | Agent creation broken |
| `/api/agents/{id}` | GET | Yes | **500 Error** | Server error for all IDs |
| `/api/agents/{id}/portfolio` | GET | - | **404 HTML** | Route doesn't exist |
| `/api/agents/{id}/positions` | GET | - | **404 HTML** | Route doesn't exist |
| `/api/agents/{id}/posts` | GET | - | **404 HTML** | Route doesn't exist |
| `/api/agents/{id}/trades` | GET | - | **404 HTML** | Route doesn't exist |
| `/api/agents/search?q=X` | GET | Yes | **200 OK** | Works, first-name match only |
| `/api/agent-templates` | GET | No | **200 OK** | 11 templates with full data |
| `/api/organizations` | GET | No | **200 OK** | 60 orgs, minimal fields |
| `/api/groups` | GET | Yes | **200 OK** | User's groups |
| `/api/groups/{id}` | GET | Yes | **200 OK** | Group with members |
| `/api/groups/discover` | GET | Yes | **Error** | "Group not found" |

---

## 10. Bug Summary Table

| ID | Severity | Bug | Endpoint | Status |
|----|----------|-----|----------|--------|
| BUG-04-01 | **P0 Critical** | 500 error on agents list | GET /api/agents | Confirmed still broken |
| BUG-04-02 | **P0 Critical** | 500 error on agent detail (all IDs) | GET /api/agents/{id} | Confirmed |
| BUG-04-03 | **P0 Critical** | Agent creation returns 500 | POST /api/agents | Confirmed |
| BUG-04-04 | **P1 High** | No individual actor API (returns HTML 404) | GET /api/actors/{id} | Confirmed |
| BUG-04-05 | **P1 High** | Agent sub-resources don't exist | /agents/{id}/* | All 404 |
| BUG-04-06 | **P2 Medium** | All query filters silently ignored | GET /api/actors?* | limit, offset, page, type, tier all ignored |
| BUG-04-07 | **P2 Medium** | Search only matches first name | GET /api/agents/search | No last name, realName, or ID match |
| BUG-04-08 | **P2 Medium** | Org endpoint returns minimal data | GET /api/organizations | 4 fields vs 15+ in /api/actors |
| BUG-04-09 | **P3 Low** | profileImageUrl and bio always null in search | GET /api/agents/search | NPC results missing fields |
| BUG-04-10 | **P3 Low** | Empty relationships array in actors response | GET /api/actors | Always [] despite affiliations existing |
| BUG-04-11 | **P3 Low** | No pagination metadata in actors response | GET /api/actors | No total, hasMore, nextPage |
| BUG-04-12 | **P3 Low** | Test NPCs in production data | GET /api/actors | test-trader-npc-001, test-analyst-npc-002 |
| BUG-04-13 | **P2 Medium** | Groups discover returns error | GET /api/groups/discover | "Group not found" |

---

## 11. Recommendations

1. **Fix the agents API layer** -- The entire `/api/agents` system (list, detail, create) returns 500. This is likely a systemic issue (missing DB table, broken query, unhandled null).
2. **Add individual actor endpoint** -- `/api/actors/{id}` should return JSON, not route to a Next.js page.
3. **Implement query filters on /api/actors** -- limit, offset, type, and tier params are accepted but ignored.
4. **Improve search** -- Match on displayName (full, not just first word), username, realName, and id fields.
5. **Normalize organization data** -- `/api/organizations` should return the same rich schema available through `/api/actors`.
6. **Remove test NPCs** from production data or hide them from public responses.
7. **Add agent sub-resource endpoints** -- portfolio, positions, posts, trades per agent.
