# Translation assistance operations

## Release gate

Keep `TRANSLATION_ASSISTANCE_ENABLED=false` while migration 017 is deploying and Translation Memory is being backfilled. The capture trigger may safely collect newly approved pairs while the editor UI remains disabled.

## Backfill

Call `backfill_translation_memory(after_translation_id, batch_size)` with the service role only. Start with a null cursor and pass the returned `nextCursor` into the next call until `processed` is zero. Use batches of 500 by default and do not expose this RPC through a browser client.

After backfill, compare sampled TM rows with approved target translations and confirm that locale pairs and organization IDs match their source projects.

## Verification

- Confirm exact matches rank before fuzzy matches.
- Confirm strings shorter than four characters return exact results only.
- Approve a new target and verify one TM entry appears.
- Change an approved base source and verify a new pair is retained without deleting the old pair.
- Use two organizations to verify no TM or glossary result crosses the tenant boundary.
- Verify translators can read glossary guidance but cannot mutate terms.

## Rollback

Set `TRANSLATION_ASSISTANCE_ENABLED=false` first. This removes editor requests without affecting translation editing or saving. Migration 017 data can remain in place while investigating because capture and search do not alter translation values. Do not drop TM/glossary tables as a routine rollback; they contain accumulated organization data.

## Retention

Deleting a source project, branch, or key clears nullable TM provenance but preserves reusable source/target text. Deleting the organization removes all of its TM and glossary rows.
