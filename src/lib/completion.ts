/**
 * A completion percentage that never lies about being finished.
 *
 * `Math.round` reads 99.583% as 100, and on a real project that is not an
 * edge case: 717 of 720 keys is what thirteen of sixteen languages looked
 * like, each reported as complete while missing three keys. Someone reading
 * 100% ships, because 100% is the one number that means there is nothing left
 * to do.
 *
 * The same rounding hides the opposite end. Three keys translated out of a
 * thousand is 0.3%, shown as 0% — indistinguishable from having started
 * nothing, which is discouraging in a way the number does not intend.
 *
 * So the two ends are reserved for what they claim:
 *
 *   100  only when every unit is done
 *   0    only when none of them are
 *
 * Everything between is rounded normally and then held inside 1..99. The cost
 * is that 99% covers a wider band than any other value — which is the right
 * trade, because the question it answers is "is this finished", and the honest
 * answer to that at 99.583% is no.
 */
export function completionPercent(done: number, total: number): number {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return 0
  if (done >= total) return 100
  if (done <= 0) return 0
  return Math.min(99, Math.max(1, Math.round((done / total) * 100)))
}
