# Agent Skill Packaging (AgentSkills)

We package the Babylon skill to the **[AgentSkills](https://agentskills.io)** spec. That format is the open standard supported by Cursor, Claude Code, VS Code, and others. We do not rely on or recommend third-party marketplaces; follow agentskills.io only.

## Why generate from source?

- **Single source of truth**: A2A skills and operations live in `packages/a2a`; MCP tools in `packages/mcp`. If we hand-wrote SKILL.md, it would drift when we add/rename operations or tools.
- **Correctness**: The generator parses the same files that the runtime uses, so the published skill always matches what the API actually supports.
- **Consistency**: One script produces both the in-repo reference (`docs/skills.md`) and the publishable package (`skills/babylon/`), so we don’t maintain two formats by hand.

## Package layout (AgentSkills spec)

A skill is a **directory** whose name matches the skill `name`, containing **SKILL.md** with YAML frontmatter and Markdown body:

```
babylon/
├── SKILL.md      # Required: frontmatter (name, description) + instructions
└── README.md     # Optional: human-readable docs
```

Generate from this repo:

```bash
bun run scripts/generate-skills-md.ts --package
# Writes skills/babylon/SKILL.md, claw.json, README.md
```

## Required metadata (SKILL.md)

From the [AgentSkills specification](https://agentskills.io/specification):

| Field           | Required | Rules |
|----------------|----------|--------|
| **name**       | Yes      | 1–64 chars, lowercase letters, numbers, hyphens only. Must match parent directory name (e.g. `babylon`). No leading/trailing hyphen, no consecutive hyphens. |
| **description**| Yes      | 1–1024 chars. What the skill does and when to use it; include keywords so agents can discover it. |

## Optional metadata (AgentSkills)

| Field             | Use |
|-------------------|-----|
| **license**       | SPDX id or reference to a license file. |
| **compatibility** | Max 500 chars. Environment requirements (e.g. “Requires network”). |
| **metadata**      | Arbitrary key-value (e.g. author, version). Clients may interpret; we don’t depend on any specific client. |
| **allowed-tools** | Experimental; space-delimited list of pre-approved tools. |

We keep frontmatter within the AgentSkills spec. The generator also emits `claw.json` for broader compatibility but it is not required by the spec.

## Security

- **No hardcoded credentials.** Use env vars (e.g. `BABYLON_API_KEY`); document in the skill body that callers must set `X-Babylon-Api-Key` or equivalent.
- Keep **SKILL.md** under ~500 lines; put long reference material in `references/` or linked docs if needed.

## References

- [AgentSkills specification](https://agentskills.io/specification) — source of truth
- [What are skills?](https://agentskills.io/what-are-skills)
- [SKILL.md spec (mdskills.ai)](https://www.mdskills.ai/specs/skill-md)
