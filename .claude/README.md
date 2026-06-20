# Claude Code Setup — LangHub

> **Repository-level configuration for Claude Code AI assistant**
> This directory contains Claude-specific setup. Shared project rules live in `.agents/`.

---

## File Structure

| File / Dir | Purpose |
|---|---|
| `../CLAUDE.md` | Claude entrypoint — tech stack, commands, critical rules |
| `../.agents/rules/project-rules.md` | Shared architecture rules (layers, Supabase, API, TypeScript) |
| `../.agents/rules/git-rules.md` | Shared Git workflow rules |
| `settings.json` | Codegraph hooks (PostToolUse / SessionStart) |
| `settings.local.json` | Local permissions (gitignored) |
| `skills/` | Task-specific skill files (debug, explore, refactor, review, openspec) |
| `commands/opsx/` | OpenSpec workflow slash commands |

---

## Separation of Concerns

| Directory | Audience | Content |
|---|---|---|
| `.agents/` | All AI agents | Shared instructions, rules, standards all agents must follow |
| `.claude/` | Claude Code AI | Claude-specific setup, settings, skills, and commands |
| `docs/` | Developers | Feature documentation, architecture notes |

**Key principle**: `.agents/` is shared AI guidance. `.claude/` is Claude-specific.

---

## How Claude Code Uses These Files

### Session Start
1. Reads `CLAUDE.md` automatically → tech stack overview, commands, critical constraints
2. Reads `.agents/rules/project-rules.md` → detailed architecture rules for any code work
3. Reads `.agents/rules/git-rules.md` → git workflow when working with branches/PRs

### During Work
- **DB queries** → `lib/supabase/queries/` — never inline
- **Auth validation** → API routes must check session before DB
- **Admin client** → use for all server-side mutations
- **Snapshot first** → before any destructive operation
- **AI features** → "Coming Soon" toast only, no real API calls

---

## Available Skills

| Skill | Trigger |
|---|---|
| `debug-issue` | Systematically trace and debug issues using codegraph |
| `explore-codebase` | Navigate codebase structure using knowledge graph |
| `refactor-safely` | Plan and execute safe refactoring with dependency analysis |
| `review-changes` | Structured code review with risk scoring |
| `openspec-propose` | Propose a new change with all artifacts |
| `openspec-apply-change` | Implement tasks from a change |
| `openspec-verify-change` | Verify implementation matches change artifacts |
| `openspec-archive-change` | Archive a completed change |
| `openspec-sync-specs` | Sync delta specs from a change to main specs |
| `openspec-explore` | Explore mode — think through ideas, not implement |

## Available Commands

| Command | Action |
|---|---|
| `/opsx:propose` | Propose + generate all change artifacts |
| `/opsx:apply` | Implement tasks from a change |
| `/opsx:verify` | Verify implementation before archive |
| `/opsx:archive` | Archive a completed change |
| `/opsx:sync` | Sync delta specs to main specs |
| `/opsx:explore` | Enter explore mode |
