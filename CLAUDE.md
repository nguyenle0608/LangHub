# LangHub — Localization Management Tool

## Agent Setup

Shared source of truth for all AI agents lives in `.agents/`:
- `.agents/rules/project-rules.md` — architecture, Supabase, API, TypeScript rules
- `.agents/rules/git-rules.md` — branch, commit, PR rules
- `.agents/rules/source-of-truth.md` — routing map for agents

Claude Code setup: `.claude/README.md` for skills, commands, and settings.

## Project Overview
Web-based localization tool for managing multi-language translations.
Similar to Lokalise / Gridly. Target: Mobile App & Web App developers.
AI Translation is a FUTURE feature — do NOT implement AI calls in MVP.

## Tech Stack
- Framework: Next.js 14 (App Router, TypeScript strict)
- Database: Supabase (PostgreSQL + Realtime + Auth)
- Styling: Tailwind CSS + shadcn/ui (dark theme, zinc base)
- Deploy: Vercel
- Package manager: pnpm

## Key Commands
- pnpm dev           → start dev server (localhost:3000)
- pnpm build         → production build
- pnpm lint          → eslint check
- pnpm typecheck     → tsc --noEmit
- pnpm test          → vitest
- pnpm db:push       → supabase db push (apply migrations)
- pnpm db:types      → generate TypeScript types from Supabase

## Coding Conventions
- TypeScript strict mode, no `any`
- Functional components only, no class components
- Named exports (no default exports except page.tsx/layout.tsx)
- Tailwind for all styling, no inline styles
- Server Components by default, "use client" only when needed
- Zod for all form validation and API input validation
- Error boundaries on all major page sections

## Critical Rules
- NEVER commit .env files
- All DB queries go through lib/supabase/queries/ — NOT direct calls in components
- All API routes must validate auth before any DB operation
- Parser/Exporter logic in lib/parsers/ and lib/exporters/ (pure functions, no side effects)
- Translation keys stored as dot.notation in DB, rebuilt to nested on export
- AI_PLACEHOLDER: Any AI translate button shows "Coming Soon" toast — do not wire up
- Version system: EVERY destructive operation (import, bulk delete, restore)
  must auto-create a snapshot BEFORE proceeding

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
