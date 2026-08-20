# Git Rules — LangHub

> Reference standard. When in doubt, ask before acting.

---

## Branch Types

| Branch | Role |
|--------|------|
| `main` | Production — auto-deploy to Netlify |
| `develop` | Integration branch and GitHub default. Everything lands here first |
| `feature/*` | New features, refactors, tooling |
| `bugfix/*` | Bug fixes |
| `hotfix/*` | Emergency production fixes |

`feature/`, `bugfix/` and `hotfix/` are the only prefixes. `fix/`, `chore/` and
the like are not used — a chore or a refactor goes on a `feature/*` branch.

---

## Flow

```
feature/* | bugfix/*  ──►  develop  ──►  main (tag)  ──►  Netlify

hotfix/*:  main  ──►  hotfix/*  ──►  main (tag)  ──►  Netlify
                                  └─►  develop (so the fix is not lost)
```

> LangHub is a single-developer project. No staging or UAT branches unless explicitly requested.

---

## Branch Creation

| Branch | Create from | Rule |
|--------|------------|------|
| `feature/*` | `develop` | |
| `bugfix/*` | `develop` | |
| `hotfix/*` | `main` | Production bugs only; merge back into `develop` too |

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
- Work branches target `develop`. Only a release PR targets `main`.
- **Squash merge** work branches into `develop`.
- **Merge commit** for the release PR (`develop` → `main`). Squashing or
  rebasing there would put a commit on `main` that is not in `develop`'s
  history: the merge base would not advance, and the next release PR would
  list every commit already released.
- Delete the branch after merge — but note that because merges into `develop`
  are squashed, `git branch --merged` will not list it. Confirm with
  `git diff --stat develop <branch>` being empty first.
- Keep `develop`. It is the integration branch, not a per-release branch.

---

## Releases

- Version lives in `package.json`; bump it in the release PR.
- The marketing changelog (`src/app/(marketing)/changelog/page.tsx`) is grouped
  by month, not by version number. Add an entry in the release PR, written for
  the people reading the site rather than copied from commit subjects.
- Tag `main` after the release PR merges, using an annotated tag (`git tag -a`).
  Tags are named without a `v` prefix — `1.0.0`, matching the first release.
- If the release contains a new file in `supabase/migrations/`, say so in the
  PR: it has to be applied with `pnpm db:push` or the deploy ships code the
  database cannot serve.

---

## What Agents Must NOT Do Without Explicit Confirmation

- `git push --force` or `git push origin main`
- `git reset --hard` on `main`
- Delete branches that are not already merged
- Create releases or tags without confirmation
- Amend commits that have already been pushed
