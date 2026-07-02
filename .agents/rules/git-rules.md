# Git Rules — LangHub

> Reference standard. When in doubt, ask before acting.

---

## Branch Types

| Branch | Role |
|--------|------|
| `main` | Production — auto-deploy to Vercel |
| `feature/*` | New features, refactors, tooling |
| `bugfix/*` | Bug fixes |
| `hotfix/*` | Emergency production fixes |

---

## Flow

```
feature/* ──► main ──► Vercel (auto-deploy)

hotfix/*: main ──► hotfix/* ──► main (tag) → Vercel
```

> LangHub is a single-developer project. No staging or UAT branches unless explicitly requested.

---

## Branch Creation

| Branch | Create from | Rule |
|--------|------------|------|
| `feature/*` | `main` | |
| `bugfix/*` | `main` | |
| `hotfix/*` | `main` | Production bugs only |

---

## Commit Message Format

```
<type>(<scope>): <short description>

[optional body]
```

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change, no feature/fix |
| `chore` | Tooling, config, deps |
| `docs` | Documentation only |
| `test` | Tests only |
| `perf` | Performance improvement |

Examples:
```
feat(editor): add inline translation status badge
fix(api): use admin client for server-side mutations
refactor(queries): extract translation queries to dedicated file
```

> **No co-author trailers.** Commit messages must NOT include a
> `Co-Authored-By:` line (or any AI-attribution trailer). Keep the message to
> the type/scope/description and body only.

---

## PR Rules

- PR title follows commit message format.
- PRs target `main`.
- Squash merge preferred for feature branches.
- Linear history on `main` — no merge commits from feature branches.
- Delete branch after merge.

---

## What Agents Must NOT Do Without Explicit Confirmation

- `git push --force` or `git push origin main`
- `git reset --hard` on `main`
- Delete branches that are not already merged
- Create releases or tags without confirmation
- Amend commits that have already been pushed
