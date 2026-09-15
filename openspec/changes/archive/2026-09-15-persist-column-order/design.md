## Context

`TranslationTable` already holds everything this change needs, in six pieces of component state: `localeOrder`, `hiddenCols`, `frozenCols`, `lockedCols`, `keyColWidth` and `localeColWidths`. Header drag-and-drop already writes `localeOrder` through `handleColDragStart` / `handleColDragOver` / `handleColDrop`, and `visibleLocales` already derives the rendered order from it, tolerating ids it does not recognise by sorting them last.

None of it survives a reload, and the Columns popover — which owns every other column setting — has no way to reorder.

The nearest precedent in the codebase is theme mode: a pure module in `src/lib/` holding the storage key and the parsing, with the component doing only the reading and writing. That shape is what makes the theme logic testable without a DOM, and it is the shape to follow here.

## Goals / Non-Goals

**Goals:**

- An arrangement that survives a reload, scoped per project.
- Reordering from inside the Columns popover, as a peer of hide / freeze / lock.
- Tolerating a stored arrangement that no longer matches the project — a removed locale, an added one, corrupt data — without an error and without discarding the parts that still apply.

**Non-Goals:**

- Sharing an arrangement between browsers, devices or teammates. This is a local preference like the theme; making it account-level means a table, an API and a sync story, for a setting whose whole value is that it is personal.
- Changing what a column does. Visibility, freezing, locking, widths and editing behaviour are untouched; only the arrangement is remembered, and only the ways to change it are extended.
- A drag-and-drop library. The header already does this with the native HTML drag events, and a second mechanism for the same gesture in the same component is worse than a slightly plainer one.

## Decisions

### Persist to `localStorage`, keyed by project

One key per project — `langhub-columns:<projectId>` — rather than one key holding every project.

*Why:* reading and writing one project's arrangement never touches another's, so a corrupt entry costs one project rather than all of them, and there is no merge step when two tabs have different projects open. A single key would have to be read-modify-written on every change, which is exactly where two tabs lose each other's edits.

*Alternative considered:* a `column_preferences` table keyed by user and project. Rejected for the same reason theme mode is not in the database: it is a per-browser preference, and putting it in Postgres buys cross-device sync at the cost of a migration, an API route, RLS policy, and a loading state on a table that currently renders immediately.

### One module, one shape, parsed at the boundary

`src/lib/editor/column-preferences.ts` exports the storage key, a `ColumnPreferences` type, and pure `parse` / `serialize` functions. The component calls them; the module never touches `window`.

*Why:* it makes every interesting case — a missing key, a truncated string, a number where an array belongs, a locale that has since been deleted — testable with no DOM and no component. The reconciliation against the project's actual locales is the part most likely to be wrong, and it should be the part easiest to test.

*Alternative considered:* a `useLocalStorage` hook doing parse and persist together. Rejected because it puts the validation behind a React boundary, where testing it means rendering something.

### Reconcile on read, not on write

What is stored is what the user arranged. The reconciliation — dropping locales the project no longer has, appending locales it has gained — happens when the stored value is read.

*Why:* the alternative rewrites storage whenever a project's locales change, which turns opening a project into a write, and loses a locale's remembered position permanently if it is removed and later added back. Reconciling on read keeps the stored arrangement as a statement of intent and lets the project's current locales decide what that means today.

`visibleLocales` already sorts unknown ids last, so the "locale added since" case needs no new logic — only the "locale removed" case needs filtering, and only so the stored list does not grow forever.

### Apply stored preferences in a layout effect, not a state initialiser

`TranslationTable` is a client component that Next still server-renders — the
editor page renders it directly, with no `ssr: false`. Reading `localStorage` in
a `useState` initialiser would therefore run twice with different answers: the
default on the server, the saved arrangement on the client. That is a hydration
mismatch, and React resolves those by keeping the server's markup, so the
arrangement would be applied to state but not reliably to the DOM.

The preferences are applied after mount instead, in a layout effect —
`useLayoutEffect` on the client, `useEffect` on the server, so React does not
warn about a layout effect in a server-rendered tree.

*Why a layout effect rather than a plain one:* both hydrate correctly, but
`useEffect` runs after the browser paints, so every load would show the columns
in default order for a frame and then rearrange. `useLayoutEffect` runs before
paint, so the rearrangement is never seen. The cost is synchronous work on the
main thread before the first paint, which for reordering a few dozen columns is
not worth trading correctness for.

*Alternative considered:* an inline script before hydration, the way
`themeInitScript()` avoids this for the theme. Rejected: the theme sets one
class on `<html>`, while column arrangement decides `grid-template-columns` and
the order of many nodes. *Also considered:* rendering the table with
`ssr: false`. Rejected for costing server rendering of the editor's first paint
to solve a problem a layout effect already solves.

### Write on change, debounced only for widths

Order, visibility, freezing and locking are discrete actions and write immediately. Column widths arrive continuously during a drag, so those writes are debounced.

*Why:* a resize fires on every mouse move, and serialising the whole preference object on each one is work nobody asked for. The other settings change once per click, where a debounce would only add a window in which a reload loses the change.

### Reuse the header's drag handlers in the popover

The popover list reuses `handleColDragStart` / `handleColDragOver` / `handleColDrop` rather than adding its own.

*Why:* they already do the move correctly, including the `localeOrder.length ? prev : locales.map(...)` fallback for the first reorder. Two implementations of one gesture drift, and the second one is always the one that forgets the fallback.

The popover list shows hidden languages too, since the spec requires a hidden column to keep a remembered position.

## Risks / Trade-offs

**A stored arrangement outlives the user's memory of setting it.** Someone who hid four columns months ago sees a table missing languages and no obvious cause. → "Reset all" already exists in the popover and already appears only when something is non-default; persisting makes that condition true across sessions, which is what surfaces the affordance when it matters.

**`localStorage` is unavailable or full.** Private browsing and storage-blocking extensions throw on access rather than returning null. → Every read and write is wrapped; a failure means the arrangement is not remembered, never that the editor fails to open.

**Two tabs on the same project write over each other.** The last write wins, and the other tab does not know. → Accepted. Per-project keys mean the loss is confined to one project's arrangement, and the cost of fixing it — a storage event listener reconciling live state — is more machinery than a preference of this weight is worth.

**Native drag-and-drop is not keyboard accessible.** The popover inherits that from the header. → Not made worse by this change, and not fixed by it either. Ordering remains reachable only by pointer, which is worth recording as a known limitation rather than quietly shipping as if it were complete.

## Migration Plan

No migration. Nothing is stored today, so every existing user starts at the default arrangement and the first one they set is remembered.

Rollback is removing the persistence calls; any stored data becomes inert and unread rather than harmful.

## Open Questions

- Should "Reset all" clear the stored entry or write an explicit default? Clearing is simpler and makes the storage absent rather than empty, which is easier to reason about — but it means a reset cannot be distinguished from never having set anything. The spec only requires that the arrangement does not come back, which clearing satisfies.
