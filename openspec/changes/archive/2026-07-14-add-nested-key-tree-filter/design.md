## Context

LangHub currently manages translation keys as flat key strings, while many projects organize keys with dot notation such as `auth.login.title` or `settings.profile.name`. Users need a way to understand and filter by this hierarchy without changing how keys are stored.

The requested view should behave like a folder tree: the root `{}` is the top-level folder, intermediate key segments are parent folders, and complete translation keys are selectable leaf items. Each item in the tree has a checkbox that drives filtering of the visible translation keys/editor rows.

## Goals / Non-Goals

**Goals:**

- Build a tree representation from existing flat translation key names.
- Show `{}` as the root folder containing the full hierarchy.
- Show parent key segments as folder-like nodes and complete keys as leaf nodes.
- Provide a checkbox before every root, folder, and key item.
- Filter visible translation keys by selected tree items, where folder selections include all descendant keys.
- Keep this as a client-side browsing/filtering feature with no database schema changes.

**Non-Goals:**

- Changing the stored key format or enforcing dot notation.
- Adding key move/rename by dragging folders.
- Changing import/export serialization behavior.
- Adding server-side filtering or new API endpoints unless performance requires it later.

## Decisions

1. **Build the tree from flat keys on the client.**
   - Rationale: key hierarchy is derived from existing key names, so no persisted tree model is needed.
   - Alternative considered: store parent/child relationships in the database. Rejected because it adds migration and consistency costs for a view-only filter.

2. **Treat dot-separated key segments as hierarchy boundaries.**
   - Rationale: dot notation is already the common convention for nested localization keys.
   - Alternative considered: support custom separators immediately. Rejected for initial scope; this can be added later if import/export formats require it.

3. **Represent folders and leaves separately even when a parent path is also a complete key.**
   - Rationale: a key like `auth` can coexist with descendants like `auth.login.title`; the UI must allow filtering the exact key and the descendant folder scope distinctly.
   - Alternative considered: merge folder and leaf into one node. Rejected because it makes exact-key filtering ambiguous.

4. **Use checkbox selection as an additive filter.**
   - Rationale: users can select multiple folders/keys to focus the table on several parts of the namespace.
   - Behavior: when no tree item is checked, all keys remain visible; when one or more items are checked, visible keys are the union of every selected item's descendant leaf keys.
   - Alternative considered: single-select folder navigation. Rejected because the user explicitly requested checkboxes and filtering.

5. **Keep tree filter independent from existing search/status filters and compose them.**
   - Rationale: the tree narrows the key set structurally; search/status filters should continue to work within that selected set.
   - Alternative considered: make tree selection replace existing filters. Rejected because it would remove useful existing workflows.

## Risks / Trade-offs

- [Risk] Large projects could make the tree expensive to rebuild on every render. → Mitigation: derive the tree with memoization based on the key list and store checked node IDs separately.
- [Risk] Parent paths that are also real keys can confuse users. → Mitigation: display folder nodes and exact-key leaf nodes with distinct icons/labels when both exist.
- [Risk] Checkbox cascade behavior can be ambiguous. → Mitigation: define folder selection as filtering all descendants; implementation can show indeterminate states for clarity but filtering must remain union-based.
- [Risk] Empty or malformed key names may not map cleanly to a tree. → Mitigation: place keys without meaningful segments under the `{}` root as leaf items and avoid crashing on empty segments.
