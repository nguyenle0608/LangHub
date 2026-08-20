// PostgREST caps a select at 1000 rows by default, so any query over a table
// that grows with the project (translation_keys, version_snapshots) has to page
// through explicitly. Silently truncating those reads corrupts snapshots and
// restores instead of failing loudly, so every such read must go through here.
export type PaginatedQueryError = { message: string }
type PageResult<T> = { data: T[] | null; error: PaginatedQueryError | null }

export const DEFAULT_PAGE_SIZE = 500

export class PageLoadError extends Error {
  constructor(resource: string, message: string) {
    super(`Failed to load ${resource}: ${message}`)
    this.name = 'PageLoadError'
  }
}

export async function loadAllPages<T>(
  resource: string,
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options: { pageSize?: number; wrapError?: (resource: string, message: string) => Error } = {}
): Promise<T[]> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const wrapError = options.wrapError ?? ((r, m) => new PageLoadError(r, m))
  const rows: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await loadPage(from, from + pageSize - 1)
    if (error) throw wrapError(resource, error.message)

    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }

  return rows
}
