/**
 * The bulk translation upsert takes a bounded number of items per request, so
 * one click cannot hand the database an unbounded write. "Approve all" over a
 * large project exceeds it easily — a 700-key, 16-locale sheet is over 11,000
 * items — so callers split the work rather than sending it all at once. The
 * limit lives here so the client splits on the same number the route enforces.
 */
export const MAX_BULK_TRANSLATION_ITEMS = 5000

export function chunkBulkItems<T>(items: T[], size = MAX_BULK_TRANSLATION_ITEMS): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/**
 * What to tell someone whose bulk write stopped part way. Batches that already
 * committed are not rolled back, so the count belongs in the message: "it
 * failed" would suggest nothing happened, and they would run it again.
 */
export function partialWriteMessage(committed: number, total: number, detail: string): string {
  if (committed === 0) return detail
  return `${detail} — ${committed.toLocaleString()} of ${total.toLocaleString()} saved before it stopped`
}
