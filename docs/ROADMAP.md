# Roadmap

Work that is decided but not done. Each entry says what "done" means, so the
item can be picked up by someone who was not in the conversation that created
it. Anything already shipped belongs in the changelog, not here.

---

## Publish the CLI

**Status:** the CLI works, is installed locally with `npm link`, and is
documented at `/docs#cli`. What is left is publishing it.

`cli/` carries translations from LangHub into a repo over the public API. It
guarantees which keys are present and leaves what a value means to the project
reading the file — so it has no framework-specific rules and needs none. Today
it writes JSON; ARB, Android XML, iOS `.strings` and the rest answer
"coming soon", because each has file-level structure a merge has to preserve.

### Why it is not published yet

Deliberately held back. `npm link` is right while the CLI is still changing:
rebuild and the command updates, no reinstall, no version to bump for every
adjustment. Publishing freezes the interface — `langhub.json`'s shape, the
report format, the exit codes — into something other repositories depend on and
CI pins. That is worth doing once the shape has survived a second consumer.

### Before publishing

- **Settle the npm name.** `package.json` says `@langhub/cli`. A scoped name
  needs an npm organization called `langhub` that we can publish to; if that
  does not exist, either create it or drop the scope. Publishing cannot be
  undone after 72 hours, so the name is a one-way decision.
- **A second consumer has used it.** The web app is the one that will show
  whether anything in the CLI is accidentally shaped around Flutter. Publishing
  before that means guessing which parts generalise.
- **`langhub.json` is treated as a contract.** Once repositories commit one, its
  fields cannot be renamed without breaking them. Read it once more with that in
  mind before the first publish.

### The docs page

Done — `src/app/(marketing)/docs/page.tsx`, section `#cli`, above the REST API
section because the CLI is how most people will use that API.

Two things in it become wrong the moment the package is published, and have to
change in the same commit:

- **Install.** It currently says "not on npm yet" and gives the build-from-source
  command. That becomes `npx @langhub/cli`, which needs nothing installed —
  which is what makes it usable from a Flutter repository and from CI, so it
  should lead rather than follow a global install.
- **`apiBase` in the example** points at `https://lang-hub.netlify.app`. Check
  that is still the address being documented publicly.
