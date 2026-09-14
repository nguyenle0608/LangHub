# Roadmap

Work that is decided but not done. Each entry says what "done" means, so the
item can be picked up by someone who was not in the conversation that created
it. Anything already shipped belongs in the changelog, not here.

---

## The CLI's interface is now a contract

`langhub-cli` is published. That closes the "publish the CLI" item, and opens
this one in its place: what was a local tool is now something other
repositories commit a config file for and CI pins a version of.

Three things are load-bearing from here, and cannot be changed without a major
version and a migration note:

- **`langhub.json`'s field names.** A repository that has committed one breaks
  if a field is renamed. `locales`, `apiBase`, `projectId`, `branch`, `output`
  and `format` are fixed.
- **Exit codes.** `--check` exits 1 when out of date and 0 when not, which is
  what makes it usable as a CI gate. A run that refuses to write also exits 1.
- **`.env.langhub` and `LANGHUB_TOKEN`.** Both appear in people's CI
  configuration, not only in their repositories.

The report format and the prompt wording are *not* in that set, deliberately.

### Still open from before publishing

**A second consumer has not used it.** The web app is the one that will show
whether anything is accidentally shaped around Flutter. Publishing at `0.1.0`
was a deliberate bet that the shape is close enough; the version says so, and
leaves room to be wrong. If the web app needs something the current shape
cannot express, `0.2.0` is the place to fix it — while the only consumers are
still in this organization.

---

## Formats other than JSON

`format` accepts `json`. `arb`, `android`, `ios`, `yaml`, `csv` and `tsv`
report that they are coming.

Each has file-level structure a merge has to preserve, which is why they are
not a flag: ARB carries `@key` metadata describing placeholders, Android and
iOS have their own escaping, and a merge that writes the values correctly while
losing the structure around them produces a file that parses and ships wrong.

The order to do them in is the order someone asks. ARB is the likely first —
Flutter's other localization path — and it is also the one where the metadata
question has to be answered rather than avoided: LangHub does not store `@key`
entries, so the CLI has to leave whatever the repository already has, which
means reading the existing file rather than writing over it.
