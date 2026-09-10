#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fetchLocale, pushLocale } from './api.js'
import { ENV_FILE, loadEnvFile } from './env.js'
import { loadConfig, requireToken, type Config } from './config.js'
import { formatNotInLangHub, formatOverwrites, formatPlan, PULL_SIDES, PUSH_SIDES, type Sides } from './report.js'
import { askPlan, createPrompter } from './prompt.js'
import { reviewOverwrites, wasTaken, type PendingOverwrite } from './review.js'
import { diffForPush, emptyReport, hasChanges, merge, parseFile, serialize } from './sync.js'
import type { Flat } from './keys.js'
import type { Overwrite } from './sync.js'

/** One line of a value, short enough to sit next to another one. */
function preview(value: string, max = 90): string {
  const flat = value.replace(/\n/g, '\\n')
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

function readLocal(path: string): Flat {
  try {
    return parseFile(readFileSync(path, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw new Error(`${path}: ${(error as Error).message}`)
  }
}

async function pull(
  config: Config,
  options: { check: boolean; yes: boolean; only: string[] }
): Promise<number> {
  const token = requireToken()
  const unknown = options.only.filter((code) => !(code in config.locales))
  if (unknown.length) throw new Error(`Not in langhub.json locales: ${unknown.join(', ')}`)

  const wanted = options.only.length ? options.only : Object.keys(config.locales)

  // Everything is fetched and merged before anything is written. A run that
  // asks "overwrite 40 values?" after having already written eleven files is
  // not asking a question — it is announcing a decision it half made.
  const planned = []
  for (const code of wanted) {
    const path = resolve(config.output, `${config.locales[code]}.json`)
    const report = emptyReport()
    const merged = merge(await fetchLocale(config, code, token), readLocal(path), report)
    planned.push({ code, label: `${code} -> ${config.locales[code]}.json`, path, merged, report })
  }

  console.log('\nPlan:')
  for (const { label, report } of planned) console.log(formatPlan(label, report))

  const overwrites = planned.map(({ label, report }) => ({ label, overwrites: report.overwrites }))
  const total = overwrites.reduce((sum, entry) => sum + entry.overwrites.length, 0)
  if (total > 0) console.log(formatOverwrites(overwrites, PULL_SIDES))

  const missing = planned.map(({ label, report }) => ({ label, keys: report.notInLangHub }))
  if (missing.some((entry) => entry.keys.length > 0)) console.log(formatNotInLangHub(missing))

  const changed = planned.some(({ report }) => hasChanges(report))
  if (options.check) {
    console.log(`\n${changed ? 'Out of date — run `langhub pull`.' : 'Up to date.'}`)
    return changed ? 1 : 0
  }

  const decision = await approve(planned, total, options.yes, PULL_SIDES)
  if (decision === null) return 1

  // A value the reviewer kept goes back to what the file already had. The rest
  // of that file — new keys, accepted values — is written either way.
  let kept = 0
  if (decision !== 'all') {
    for (const { label, merged, report } of planned) {
      for (const overwrite of report.overwrites) {
        if (!wasTaken(decision, label, overwrite.key)) {
          merged[overwrite.key] = overwrite.from
          kept++
        }
      }
    }
  }

  for (const { path, merged } of planned) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, serialize(merged))
  }
  const summary = kept > 0 ? ` Kept ${kept} local value${kept === 1 ? '' : 's'}.` : ''
  console.log(`\nWrote ${planned.length} file${planned.length === 1 ? '' : 's'}.${summary} Read the diff before committing.`)
  return 0
}

/**
 * Whether git already ignores `path`. Anything unexpected — no git, not a
 * repository, an old git — answers "no", so the worst case is a redundant
 * .gitignore line rather than a credential file left tracked.
 */
function isIgnoredByGit(cwd: string, path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '--quiet', '--', path], { cwd, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Make sure the credential file cannot be committed.
 *
 * Only appends when git does not already ignore it: many repositories have a
 * `.env*` rule that covers this file, and adding a second one that changes
 * nothing is noise in a file everyone reads. Returns what happened so `init`
 * can say it plainly rather than leaving the reader to check.
 */
function ensureIgnored(cwd: string, path: string): 'already' | 'added' | 'no-git' {
  if (!existsSync(resolve(cwd, '.git'))) return 'no-git'
  if (isIgnoredByGit(cwd, path)) return 'already'
  const gitignore = resolve(cwd, '.gitignore')
  const existing = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : ''
  const prefix = existing && !existing.endsWith('\n') ? '\n' : ''
  appendFileSync(gitignore, `${prefix}\n# LangHub API token — never commit this\n${path}\n`)
  return 'added'
}


/**
 * Set up the three things a repository needs to pull translations, and say what
 * each one actually did.
 *
 * Each is decided on its own. Bailing out because one already exists is how a
 * repository ends up with a langhub.json and no gitignore rule — the run that
 * would have added it stopped at the first line. Nothing here overwrites; the
 * command can be run again safely, and on a half-configured repository it
 * finishes the setup instead of refusing.
 */
function init(cwd: string): number {
  const done: string[] = []

  // langhub.json is deliberately incomplete: projectId and the locale map are
  // decisions, not defaults, and a file that looks ready while pointing at the
  // wrong project is worse than one that refuses to run.
  const configPath = resolve(cwd, 'langhub.json')
  if (existsSync(configPath)) {
    done.push('langhub.json already exists — left alone')
  } else {
    writeFileSync(configPath, `${JSON.stringify({
      projectId: 'PUT THE PROJECT UUID HERE — the id in the LangHub editor URL',
      branch: 'main',
      format: 'json',
      output: 'assets/translations',
      locales: { 'en-US': 'en-US', 'vi-VN': 'vi-VN' },
      apiBase: 'https://your-langhub.example.com',
    }, null, 2)}\n`)
    done.push('Wrote langhub.json')
  }

  // Created empty rather than left to the reader: a token pasted into
  // langhub.json is the one mistake here that editing cannot undo, because by
  // then it is in the repository's history.
  const envPath = resolve(cwd, ENV_FILE)
  if (existsSync(envPath)) {
    done.push(`${ENV_FILE} already exists — left alone`)
  } else {
    writeFileSync(envPath, [
      '# Read by the langhub CLI. Never commit this file.',
      '# A variable already set in the environment wins over this file, so CI',
      '# secrets are not overridden by a copy left here.',
      '',
      '# Organization Settings -> API Tokens in LangHub. Scope: read. Shown once.',
      'LANGHUB_TOKEN=',
      '',
      '# Required: where your LangHub runs. There is no default — the CLI will',
      '# not guess a hostname to send your token to.',
      'LANGHUB_API_BASE=',
      '',
    ].join('\n'))
    done.push(`Wrote ${ENV_FILE}`)
  }

  done.push({
    added: `Added ${ENV_FILE} to .gitignore`,
    already: `${ENV_FILE} is already covered by .gitignore`,
    'no-git': `Not a git repository — make sure ${ENV_FILE} cannot be committed`,
  }[ensureIgnored(cwd, ENV_FILE)])

  console.log(done.map((line) => `  ${line}`).join('\n'))
  console.log(`
Next:
  1. Set projectId and apiBase, and map every locale you ship under
     "locales" (LangHub code -> the basename this repo reads it from; they
     differ when the app and LangHub disagree on a tag).
  2. Put your token in ${ENV_FILE} — read scope, from Organization Settings.
  3. \`langhub pull --check\` to see what would change without writing.

langhub.json holds no secret and belongs in git. The token never goes in it.`)
  return 0
}


/**
 * Ask what to do about overwrites, in whichever direction.
 *
 * Returns 'all' to take everything, a set of accepted keys after a review, or
 * null when the answer was no — which every caller reads as "write nothing".
 * One implementation for both commands so the two cannot drift into asking
 * differently about the same kind of loss.
 */
async function approve(
  planned: Array<{ label: string; report: { overwrites: Overwrite[] } }>,
  total: number,
  yes: boolean,
  sides: Sides
): Promise<Set<string> | 'all' | null> {
  if (total === 0 || yes) return 'all'

  const pending: PendingOverwrite[] = planned.flatMap(({ label, report }) =>
    report.overwrites.map((overwrite) => ({ ...overwrite, label }))
  )
  const prompter = createPrompter()
  let plan
  let outcome
  try {
    plan = await askPlan(`\nReplace ${total} value${total === 1 ? '' : 's'}?`, prompter)
    if (plan === 'review') {
      outcome = await reviewOverwrites(pending, (item, index, count) => {
        console.log(`\n[${index + 1}/${count}] ${item.label}  ${item.key}`)
        console.log(`  ${sides.from} ${preview(item.from)}`)
        console.log(`  ${sides.to} ${preview(item.to)}`)
      }, prompter)
    }
  } finally {
    prompter.close()
  }

  if (plan === 'none') {
    console.log(process.stdin.isTTY
      ? 'Nothing written.'
      : 'Nothing written — no terminal to ask. Re-run with --yes to accept these overwrites.')
    return null
  }
  if (outcome?.aborted) {
    console.log('\nStopped. Nothing written.')
    return null
  }
  return outcome ? outcome.taken : 'all'
}

/**
 * Send this repo's values to LangHub.
 *
 * The mirror of pull, and the more dangerous of the two: pull damages one
 * checkout, push changes what everyone sees. So the comparison is against
 * everything LangHub holds, not only approved values — a pending translation
 * filtered out of the comparison would look like an empty slot, and be
 * overwritten without ever appearing in the plan.
 *
 * Keys LangHub has and this repo does not are never touched. An import only
 * writes the keys it names, and reading absence as deletion would let one stale
 * checkout remove work nobody in this push knew about.
 */
async function push(
  config: Config,
  options: { check: boolean; yes: boolean; only: string[] }
): Promise<number> {
  const token = requireToken()
  const unknown = options.only.filter((code) => !(code in config.locales))
  if (unknown.length) throw new Error(`Not in langhub.json locales: ${unknown.join(', ')}`)

  const wanted = options.only.length ? options.only : Object.keys(config.locales)
  const planned = []
  for (const code of wanted) {
    const path = resolve(config.output, `${config.locales[code]}.json`)
    const local = readLocal(path)
    if (Object.keys(local).length === 0) continue
    const report = emptyReport()
    const outgoing = diffForPush(local, await fetchLocale(config, code, token, 'all'), report)
    planned.push({ code, label: `${config.locales[code]}.json -> ${code}`, outgoing, report })
  }

  if (planned.length === 0) throw new Error('No locale files found to push')

  console.log('\nPlan:')
  for (const { label, report } of planned) console.log(formatPlan(label, report))

  const total = planned.reduce((sum, { report }) => sum + report.overwrites.length, 0)
  if (total > 0) {
    console.log(formatOverwrites(
      planned.map(({ label, report }) => ({ label, overwrites: report.overwrites })),
      PUSH_SIDES
    ))
  }

  const changed = planned.some(({ report }) => hasChanges(report))
  if (options.check) {
    console.log(`\n${changed ? 'LangHub is behind this repo — run `langhub push`.' : 'LangHub matches this repo.'}`)
    return changed ? 1 : 0
  }
  if (!changed) {
    console.log('\nNothing to send.')
    return 0
  }

  const decision = await approve(planned, total, options.yes, PUSH_SIDES)
  if (decision === null) return 1

  let sent = 0
  for (const { code, label, outgoing, report } of planned) {
    const entries = { ...outgoing }
    if (decision !== 'all') {
      for (const overwrite of report.overwrites) {
        if (!wasTaken(decision, label, overwrite.key)) delete entries[overwrite.key]
      }
    }
    if (Object.keys(entries).length === 0) continue
    const result = await pushLocale(config, code, token, entries)
    sent++
    console.log(`  ${label}  ${result.created} created, ${result.updated} updated`)
  }

  if (sent === 0) {
    console.log('\nNothing sent — every change was declined.')
    return 0
  }
  console.log(`\nSent ${sent} locale${sent === 1 ? '' : 's'}. LangHub snapshotted before each import.`)
  // Not a detail to leave for someone to discover: an import lands as pending,
  // and pull only takes approved values. Until these are reviewed in LangHub,
  // a pull will not bring them back — which looks exactly like the push having
  // silently failed.
  console.log('They arrive as pending. `langhub pull` takes only approved values,')
  console.log('so approve them in LangHub before expecting them back.')
  return 0
}

const USAGE = `langhub — move translations between LangHub and this repo

  langhub init                                          write a starter langhub.json
  langhub pull [--check] [--yes] [--locale <code>]...   LangHub -> this repo
  langhub push [--check] [--yes] [--locale <code>]...   this repo -> LangHub

    --check   report only, change nothing
    --yes     accept every overwrite without asking

  Both show a plan first and, when a value would be replaced, offer to review
  the replacements one at a time. push needs a write-scoped token.

Configuration lives in langhub.json. The CLI writes JSON; it carries the strings
and guarantees the keys, and leaves what a value means to the project reading it.
The token comes from LANGHUB_TOKEN, so the config file can be committed and the
credential cannot.`

async function main(argv: string[]): Promise<number> {
  loadEnvFile(process.cwd())
  const [command, ...rest] = argv
  if (!command || command === 'help' || command === '--help') {
    console.log(USAGE)
    return 0
  }
  if (command === 'init') return init(process.cwd())
  if (command !== 'pull' && command !== 'push') {
    console.error(`Unknown command "${command}".\n\n${USAGE}`)
    return 2
  }

  const only: string[] = []
  let check = false
  let yes = false
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--check') check = true
    else if (rest[i] === '--yes' || rest[i] === '-y') yes = true
    else if (rest[i] === '--locale') {
      const value = rest[++i]
      if (!value) throw new Error('--locale needs a locale code')
      only.push(value)
    } else throw new Error(`Unknown option "${rest[i]}"`)
  }
  const config = loadConfig(process.cwd())
  return command === 'push'
    ? push(config, { check, yes, only })
    : pull(config, { check, yes, only })
}

main(process.argv.slice(2))
  .then((code) => { process.exitCode = code })
  .catch((error: Error) => {
    console.error(`\n${error.message}`)
    process.exitCode = 1
  })
