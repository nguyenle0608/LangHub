# Shared Agent Guidance — LangHub

This directory is the **shared source of truth** for all AI agents in this repository.
Keep agent-neutral rules here so Claude, Codex, and future agents can update one
place instead of maintaining divergent copies.

## Read Order

1. `.agents/rules/source-of-truth.md` — routing map
2. `.agents/rules/project-rules.md` — architecture, layer boundaries, naming, DB, API, and verification rules
3. `.agents/rules/git-rules.md` — branch, commit, PR, merge rules
4. `CLAUDE.md` — project overview and key commands
5. `docs/` — feature docs, schema references, architecture notes

## Important

- Agent-specific folders (`.claude/`, `.codex/`) contain only runtime setup,
  skills, hooks, and integration notes for that specific agent.
- Shared project rules belong in `.agents/` or `docs/`.
- If generic advice conflicts with this directory, follow this directory.
