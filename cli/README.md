# langhub-cli

Move translations between [LangHub](https://github.com/nguyenle0608/LangHub) and a repository.

The CLI carries the strings and guarantees which keys are present. What a value *means* — placeholder syntax, plural rules, whether an empty one falls back — belongs to the i18n library reading the file, so the CLI has no framework-specific rules and needs none. It writes JSON; other formats report that they are coming.

## Two ways to run it

**Without installing** — nothing to add to the project, which is what makes it
usable from a Flutter repository or a CI job:

```bash
npx langhub-cli init      # langhub.json and a gitignored .env.langhub
npx langhub-cli locales   # what the project has, and what langhub.json asks for that it does not
npx langhub-cli pull      # LangHub -> this repo
npx langhub-cli push      # this repo -> LangHub  (needs a write-scoped token)
```

**Installed globally**, if you run it often enough that `npx` gets tiresome:

```bash
npm i -g langhub-cli
langhub pull
```

The installed command is `langhub`, not `langhub-cli` — the package name is
only how npm finds it. Until you install it globally, that shorter command does
not exist, so every example below is written as `npx langhub-cli`.

## Commands

```bash
npx langhub-cli pull --check            # report only, write nothing, exit 1 when out of date
npx langhub-cli pull --locale vi-VN     # just this locale; repeat the flag for several
npx langhub-cli pull --verbose          # list every key, not the first ten of each kind
npx langhub-cli pull --yes              # accept every replacement without asking
```

To read one locale closely — every replacement with both values, every added
key, every key it is keeping — narrow it and ask for everything:

```bash
npx langhub-cli pull --check --locale vi-VN --verbose
```

`--locale` narrows the request too, not just the output: only that locale is
fetched. All four flags work the same on `push`.

## Configuration

`langhub.json` is committed. It holds no secret.

```json
{
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
}
```

`locales` maps a LangHub locale code to the file this repository reads it from, and the two sides are allowed to differ — `hi-IN → en-IN` above is a real case, where an app serves Hindi under the tag its backend already uses. Check this field twice: getting it wrong ships one language's text under another language's name, and nothing downstream notices.

`apiBase` is where your LangHub runs — the example above is the hosted one. It has no default and must be set. The CLI sends a bearer token, so the host receiving it is always a choice someone made rather than a guess. https is required except on localhost.

## Credentials

`LANGHUB_TOKEN` comes from the environment or from `.env.langhub`, never from `langhub.json`. `init` creates that file empty and makes sure git ignores it. A variable already set in the environment wins over the file, so a CI secret is never overridden by a copy left behind locally.

Create the token in LangHub under Organization Settings → API tokens. `read` is enough to pull; pushing needs `write`.

## What it does with a conflict

Both directions fetch and merge everything before writing anything, then print a plan. New keys are written without asking — nothing is lost. Only a value that would replace a different one needs a decision, and both values are shown, because a count cannot be judged: "20 overwritten" is either a routine sync or a morning of someone's work.

```
  [3/15] Reading vi-VN

Plan:
  vi-VN -> vi-VN.json    14 added, 1 overwritten, 1 kept
  fr-FR -> fr-FR.json    1 overwritten

vi-VN -> vi-VN.json
  1 value would be replaced:
    buttons.save
      here:    Lưu lại
      LangHub: Lưu
  14 keys would be added:
    checkout.title
    ... and 4 more (--verbose to list them)
  1 key here but not in LangHub — kept, upload them:
    quests.newQuest

Replace 2 local values with LangHub's? [y]es all / [N]o / [r]eview each: r

[1/2] vi-VN -> vi-VN.json  buttons.save
  here:    Lưu lại
  LangHub: Lưu
  [y]take / [N]keep / [a]take rest / [k]keep rest / [q]uit:
```

Every locale is listed separately, and every category names its keys rather than
counting them: twelve added keys are either a feature someone just finished
translating or a merge that went the wrong way, and those look identical until
the keys are on screen. Long lists stop at ten; `--verbose` lifts that.

Progress goes to stderr while locales are read, so piping the plan to a file or
a diff gets the plan alone.

Keeping one value leaves the rest of that file to be written normally. Quitting writes nothing at all. `--yes` accepts every replacement; without a terminal to ask, the run refuses rather than assuming, so `--yes` is how an unattended run says in writing that it accepts them.

`--check` reports and changes nothing, exiting 1 when out of date — which is what makes it usable as a CI gate.

## What it will not do

- **It never deletes a key.** One that exists on one side and not the other is reported and kept. "Not uploaded yet" and "deliberately removed" are indistinguishable from here.
- **It does not read inside a value.** Placeholders, plural forms and markup are carried through exactly as they are.
- **It does not write empty values.** A key with no approved translation is left out, so the reading library falls back instead of rendering nothing.

## Round trip

An import lands as `pending`, and `pull` takes only approved values. A value pushed up has to be reviewed in LangHub before it comes back down — until then a pull looks exactly like the push having failed. `push` compares against everything LangHub holds, not only approved values, so someone else's draft appears in the plan instead of being silently replaced.

## If every request returns 404

The v1 API is disabled unless the deployment sets `PUBLIC_API_ENABLED=true`, and a disabled deployment answers 404 rather than disclosing that the endpoints exist. That is the first thing to check when a correct token and project id still get nothing.

A 404 on *some* locales but not others is a different thing: the project and branch are fine and those codes do not exist. `langhub locales` says which.
