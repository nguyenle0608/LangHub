import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpen, Download, GitBranch, History, KeyRound, Languages, TerminalSquare, Terminal } from 'lucide-react'
import { CurlCodeBlock } from '@/components/marketing/CurlCodeBlock'

export const metadata: Metadata = {
  title: 'Docs · LangHub',
  description: 'Learn how to set up projects, manage translations, and ship localized apps with LangHub.',
}

const quickstart = [
  { step: 'Create a workspace', text: 'Sign up and set up your first organization workspace.' },
  { step: 'Add a project', text: 'Create a project and pick your base locale.' },
  { step: 'Import or add keys', text: 'Bring existing JSON or add translation keys in dot.notation.' },
  { step: 'Translate & export', text: 'Fill in each locale, review status, then export clean files.' },
]

const guides = [
  { icon: KeyRound, title: 'Translation keys', text: 'Keys are stored in dot.notation and rebuilt into nested files on export.' },
  { icon: Languages, title: 'Locales & status', text: 'Track review status per cell so you always know what is ready to ship.' },
  { icon: GitBranch, title: 'Branches & merge', text: 'Stage risky localization changes on a branch and merge when ready.' },
  { icon: History, title: 'Version history', text: 'Every destructive action snapshots first, so you can restore anytime.' },
  { icon: Download, title: 'Import & export', text: 'Round-trip common localization formats without leaving the browser.' },
  { icon: BookOpen, title: 'Concepts', text: 'Understand how projects, organizations, and roles fit together.' },
]

const githubActionsExample = `- name: Pull LangHub translations
  env:
    LANGHUB_TOKEN: __DOLLAR__{{ secrets.LANGHUB_TOKEN }}
    PROJECT_ID: __DOLLAR__{{ vars.LANGHUB_PROJECT_ID }}
  run: |
    curl --fail-with-body \\
      -H "Authorization: Bearer __DOLLAR__LANGHUB_TOKEN" \\
      -o app/locales/en.json \\
      "https://lang-hub.netlify.app/api/v1/projects/__DOLLAR__PROJECT_ID/export?locale=en&format=json"`.replaceAll('__DOLLAR__', String.fromCharCode(36))

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <header className="max-w-2xl">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm text-blue-700 dark:text-blue-300">
          <BookOpen className="h-3.5 w-3.5" />
          Documentation
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight">Get started with LangHub.</h1>
        <p className="mt-3 text-lg leading-8 text-muted-foreground">
          Everything you need to set up projects, manage translations, and ship localized apps with confidence.
        </p>
      </header>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">Quickstart</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickstart.map((item, index) => (
            <li key={item.step} className="rounded-xl border border-border bg-card p-5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <p className="mt-3 font-semibold">{item.step}</p>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight">Guides</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <div key={guide.title} className="group rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-950/10">
              <div className="inline-flex rounded-lg bg-blue-500/10 p-2.5 ring-1 ring-inset ring-blue-500/20 transition-colors group-hover:bg-blue-500/20">
                <guide.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="mt-4 font-semibold">{guide.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{guide.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="cli" className="mt-14 scroll-mt-20">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg bg-blue-500/10 p-2.5 ring-1 ring-inset ring-blue-500/20">
            <TerminalSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Command line</h2>
            <p className="text-sm text-muted-foreground">Move translations between LangHub and a repository, one command each way.</p>
          </div>
        </div>

        <div className="mt-6 space-y-8 rounded-xl border border-border bg-card p-6">
          <div>
            <p className="text-sm leading-6 text-muted-foreground">
              The CLI carries the strings and guarantees which keys are present. What a value <em>means</em> — placeholder syntax, plural rules, whether an empty one falls back — belongs to the i18n library reading the file, so the CLI has no framework-specific rules and needs none. It writes JSON today; other formats report that they are coming.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">Install</h3>
            <p className="mt-2 text-sm text-muted-foreground">Not on npm yet. Build it from the LangHub repository:</p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-5"><code>{`cd cli && npx tsc -p tsconfig.json && npm link`}</code></pre>
          </div>

          <div>
            <h3 className="font-semibold">Set up a repository</h3>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-5"><code>{`langhub init`}</code></pre>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Writes <code className="rounded bg-muted px-1">langhub.json</code> and an empty <code className="rounded bg-muted px-1">.env.langhub</code>, and adds the latter to <code className="rounded bg-muted px-1">.gitignore</code> unless git already ignores it. Nothing is ever overwritten, so it is safe to re-run on a repository that is half configured. The config file holds no secret and belongs in git; the token never goes in it.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">langhub.json</h3>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-5"><code>{`{
  "projectId": "4eb25308-4455-4fdc-881a-a9823bb6586b",
  "branch": "main",
  "format": "json",
  "output": "assets/translations",
  "apiBase": "https://lang-hub.netlify.app",
  "locales": {
    "en-US": "en-US",
    "vi-VN": "vi-VN",
    "hi-IN": "en-IN"
  }
}`}</code></pre>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              <code className="rounded bg-muted px-1">locales</code> maps a LangHub locale code to the file this repository reads it from, and the two sides are allowed to differ — the <code className="rounded bg-muted px-1">hi-IN → en-IN</code> line above is a real case, where an app serves Hindi under the tag its backend already uses. This is the field worth checking twice: getting it wrong ships one language&apos;s text under another language&apos;s name, and nothing downstream will notice.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              <code className="rounded bg-muted px-1">apiBase</code> has no default and must be set. The CLI sends a bearer token, so the host receiving it is always a choice someone made rather than a guess. https is required except on localhost.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">Credentials</h3>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-5"><code>{`# .env.langhub — gitignored
LANGHUB_TOKEN=lh_...`}</code></pre>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              A <code className="rounded bg-muted px-1">read</code> token is enough to pull; pushing needs <code className="rounded bg-muted px-1">write</code>. A variable already set in the environment wins over the file, so a CI secret is never overridden by a copy someone left behind locally.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">Pull, and push back</h3>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-5"><code>{`langhub pull --check    # what would change here; writes nothing, exits 1 when out of date
langhub pull            # LangHub -> this repo
langhub push            # this repo -> LangHub`}</code></pre>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Both fetch and merge everything before writing anything, then print a plan. A run that asks &ldquo;overwrite 40 values?&rdquo; after having already written eleven files is not asking a question.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">Reviewing what gets replaced</h3>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-5"><code>{`Plan:
  vi-VN -> vi-VN.json    1 added, 2 overwritten, 1 kept

vi-VN -> vi-VN.json — 2 values would be replaced:
  buttons.save
    here:    Lưu lại
    LangHub: Lưu

Replace 2 local values with LangHub's? [y]es all / [N]o / [r]eview each: r

[1/2] vi-VN -> vi-VN.json  buttons.save
  here:    Lưu lại
  LangHub: Lưu
  [y]take / [N]keep / [a]take rest / [k]keep rest / [q]uit:`}</code></pre>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              New keys are written without asking — nothing is lost. Only a differing value needs a decision, and both values are shown because a count cannot be judged: &ldquo;20 overwritten&rdquo; is either a routine sync or a morning of someone&apos;s work. Keeping one value leaves the rest of that file to be written normally. Quitting writes nothing at all.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              <code className="rounded bg-muted px-1">--yes</code> accepts every replacement without asking. Without a terminal to ask — CI, a cron job — the run refuses rather than assuming, so <code className="rounded bg-muted px-1">--yes</code> is how an unattended run says in writing that it accepts them.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">What the CLI will not do</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
              <li><strong>It never deletes a key.</strong> One that exists on one side and not the other is reported and kept. &ldquo;Not uploaded yet&rdquo; and &ldquo;deliberately removed&rdquo; are indistinguishable from here, and only someone who can tell them apart should act on it.</li>
              <li><strong>It does not read inside a value.</strong> Placeholders, plural forms and markup are carried through exactly as they are.</li>
              <li><strong>It does not write empty values.</strong> A key with no approved translation is left out, so the reading library falls back instead of rendering nothing.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold">Round trip</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              An import lands as <code className="rounded bg-muted px-1">pending</code>, and <code className="rounded bg-muted px-1">pull</code> takes only approved values. So a value pushed up has to be reviewed in LangHub before it comes back down — until then a pull looks exactly like the push having failed. <code className="rounded bg-muted px-1">push</code> compares against everything LangHub holds, not only approved values, so someone else&apos;s draft appears in the plan instead of being silently replaced.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">If every request returns 404</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The v1 API is disabled unless the deployment sets <code className="rounded bg-muted px-1">PUBLIC_API_ENABLED=true</code>, and a disabled deployment answers 404 rather than disclosing that the endpoints exist. That is by design, and it is the first thing to check when a correct token and project id still get nothing.
            </p>
          </div>
        </div>
      </section>

      <section id="api" className="mt-14 scroll-mt-20">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg bg-blue-500/10 p-2.5 ring-1 ring-inset ring-blue-500/20">
            <Terminal className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Public REST API</h2>
            <p className="text-sm text-muted-foreground">Automate translation pull and push from CI/CD or scripts.</p>
          </div>
        </div>

        <div className="mt-6 space-y-8 rounded-xl border border-border bg-card p-6">
          <div>
            <h3 className="font-semibold">Create and protect a token</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
              <li>Open Workspace Settings → API tokens. Only owners and admins can manage credentials.</li>
              <li>Prefer a read token and finite expiration. Use write only for import automation.</li>
              <li>Copy the <code className="rounded bg-muted px-1">lh_…</code> secret once into a secret manager. LangHub stores only its SHA-256 hash.</li>
              <li>Send it only as <code className="rounded bg-muted px-1">Authorization: Bearer …</code>. Revoke it immediately if exposed.</li>
            </ol>
            <p className="mt-2 text-sm text-muted-foreground">Write scope includes read access. Read scope cannot import.</p>
          </div>

          <div>
            <h3 className="font-semibold">v1 endpoints</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="text-muted-foreground"><tr className="border-b"><th className="py-2 pr-4">Method</th><th className="py-2 pr-4">Path</th><th className="py-2 pr-4">Scope</th><th className="py-2">Purpose</th></tr></thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="py-2 pr-4 font-mono">GET</td><td className="py-2 pr-4 font-mono">/api/v1/projects</td><td className="py-2 pr-4">read</td><td className="py-2">Cursor-paginated projects for the token workspace.</td></tr>
                  <tr><td className="py-2 pr-4 font-mono">GET</td><td className="py-2 pr-4 font-mono">/api/v1/projects/:id/translations</td><td className="py-2 pr-4">read</td><td className="py-2">Deterministic key/value JSON for one locale.</td></tr>
                  <tr><td className="py-2 pr-4 font-mono">GET</td><td className="py-2 pr-4 font-mono">/api/v1/projects/:id/export</td><td className="py-2 pr-4">read</td><td className="py-2">JSON, ARB, CSV, YAML, Android XML, or iOS strings.</td></tr>
                  <tr><td className="py-2 pr-4 font-mono">POST</td><td className="py-2 pr-4 font-mono">/api/v1/projects/:id/import</td><td className="py-2 pr-4">write</td><td className="py-2">Snapshot-first, transactional multipart import.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold">Pull translations</h3>
            <CurlCodeBlock>{`curl --fail-with-body \\
  -H "Authorization: Bearer $LANGHUB_TOKEN" \\
  "https://lang-hub.netlify.app/api/v1/projects/$PROJECT_ID/translations?locale=en&branch=main"`}</CurlCodeBlock>
            <p className="mt-2 text-sm text-muted-foreground">Copy produces a one-line command using the production API URL. Replace <code className="rounded bg-muted px-1">YOUR_LANGHUB_TOKEN</code> and <code className="rounded bg-muted px-1">YOUR_PROJECT_ID</code>; in Postman, paste it into Import → Raw text.</p>
            <p className="mt-2 text-sm text-muted-foreground">List projects accepts <code className="rounded bg-muted px-1">limit=1..100</code> and the opaque <code className="rounded bg-muted px-1">cursor</code> returned in <code className="rounded bg-muted px-1">pagination.nextCursor</code>.</p>
          </div>

          <div>
            <h3 className="font-semibold">Export a localization file</h3>
            <CurlCodeBlock>{`curl --fail-with-body \\
  -H "Authorization: Bearer $LANGHUB_TOKEN" \\
  -o en.json \\
  "https://lang-hub.netlify.app/api/v1/projects/$PROJECT_ID/export?locale=en&format=json&filter=approved"`}</CurlCodeBlock>
            <p className="mt-2 text-sm text-muted-foreground">Repeat <code className="rounded bg-muted px-1">locale</code> for multi-locale export. Formats: <code className="rounded bg-muted px-1">json</code>, <code className="rounded bg-muted px-1">arb</code>, <code className="rounded bg-muted px-1">csv</code>, <code className="rounded bg-muted px-1">yaml</code>, <code className="rounded bg-muted px-1">android</code>, and <code className="rounded bg-muted px-1">ios</code>.</p>
          </div>

          <div>
            <h3 className="font-semibold">Import with retry safety</h3>
            <CurlCodeBlock>{`curl --fail-with-body -X POST \\
  -H "Authorization: Bearer $LANGHUB_WRITE_TOKEN" \\
  -H "Idempotency-Key: deploy-$GITHUB_RUN_ID" \\
  -F "file=@locales/en.json" \\
  -F "locale=en" \\
  -F "branch=main" \\
  -F "format=json" \\
  "https://lang-hub.netlify.app/api/v1/projects/$PROJECT_ID/import"`}</CurlCodeBlock>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">The key is bound to the token and normalized request. An identical completed retry replays the stored response; changed content returns 409. Requests are limited to 5 MiB, 5,000 keys, 200 characters per key, and 100,000 characters per value.</p>
          </div>

          <div>
            <h3 className="font-semibold">GitHub Actions</h3>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-5"><code>{githubActionsExample}</code></pre>
          </div>

          <div>
            <h3 className="font-semibold">Errors and limits</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">JSON errors contain <code className="rounded bg-muted px-1">error.code</code>, <code className="rounded bg-muted px-1">error.message</code>, and <code className="rounded bg-muted px-1">error.requestId</code>. Expect 401 for any invalid credential, 403 for scope denial, 404 for out-of-workspace resources, 409 for idempotency conflict, and 429 with <code className="rounded bg-muted px-1">Retry-After</code>. Initial quotas are 120 reads and 10 writes per token per minute.</p>
          </div>
        </div>
      </section>

      <section className="mt-14 rounded-2xl border border-blue-500/30 bg-card bg-gradient-to-br from-blue-600/15 to-transparent p-8 text-center">
        <h2 className="text-balance text-2xl font-bold tracking-tight">Ready to try it?</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">Create your first project and see the workflow end to end.</p>
        <Link
          href="/signup"
          className="group mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Start free
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </section>
    </div>
  )
}
