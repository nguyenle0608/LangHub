# langhub-cli

Move translations between [LangHub](https://github.com/nguyenle0608/LangHub) and a repository.

The CLI carries the strings and guarantees which keys are present. What a value *means* — placeholder syntax, plural rules, whether an empty one falls back — belongs to the i18n library reading the file, so the CLI has no framework-specific rules and needs none. It writes JSON; other formats report that they are coming.

```bash
npx langhub-cli init      # langhub.json and a gitignored .env.langhub
npx langhub-cli locales   # what the project has, and what langhub.json asks for that it does not
npx langhub-cli pull      # LangHub -> this repo
npx langhub-cli push      # this repo -> LangHub  (needs a write-scoped token)
```

The command installed is `langhub`, not `langhub-cli` — the package name only
appears when fetching it. After `npm i -g langhub-cli` it is `langhub pull`.

## Configuration

`langhub.json` is committed. It holds no secret.

```json
{
  "projectId": "4eb25308-4455-4fdc-881a-a9823bb6586b",
  "branch": "main",
  "format": "json",
  "output": "assets/translations",
  "apiBase": "https://langhub.example.com",
  "locales": {
    "en-US": "en-US",
    "vi-VN": "vi-VN",
    "hi-IN": "en-IN"
  }
}
```

`locales` maps a LangHub locale code to the file this repository reads it from, and the two sides are allowed to differ — `hi-IN → en-IN` above is a real case, where an app serves Hindi under the tag its backend already uses. Check this field twice: getting it wrong ships one language's text under another language's name, and nothing downstream notices.

`apiBase` has no default and must be set. The CLI sends a bearer token, so the host receiving it is always a choice someone made rather than a guess. https is required except on localhost.

## Credentials

`LANGHUB_TOKEN` comes from the environment or from `.env.langhub`, never from `langhub.json`. `init` creates that file empty and makes sure git ignores it. A variable already set in the environment wins over the file, so a CI secret is never overridden by a copy left behind locally.

Create the token in LangHub under Organization Settings → API tokens. `read` is enough to pull; pushing needs `write`.

## What it does with a conflict

Both directions fetch and merge everything before writing anything, then print a plan. New keys are written without asking — nothing is lost. Only a value that would replace a different one needs a decision, and both values are shown, because a count cannot be judged: "20 overwritten" is either a routine sync or a morning of someone's work.

```
Replace 2 local values with LangHub's? [y]es all / [N]o / [r]eview each: r

[1/2] vi-VN -> vi-VN.json  buttons.save
  here:    Lưu lại
  LangHub: Lưu
  [y]take / [N]keep / [a]take rest / [k]keep rest / [q]uit:
```

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
