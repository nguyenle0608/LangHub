import { describe, expect, it, vi } from 'vitest'
import { loadAllPages, PageLoadError } from '../paginate'

function pagedSource(total: number, pageSize: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }))
  return vi.fn(async (from: number, to: number) => ({
    data: rows.slice(from, Math.min(to + 1, from + pageSize)),
    error: null,
  }))
}

describe('loadAllPages', () => {
  it('reads past the 1000-row PostgREST cap', async () => {
    const loadPage = pagedSource(2350, 500)
    const rows = await loadAllPages<{ id: number }>('rows', loadPage)
    expect(rows).toHaveLength(2350)
    expect(rows[2349]).toEqual({ id: 2349 })
    expect(loadPage).toHaveBeenCalledTimes(5)
  })

  it('stops on a short page without an extra request', async () => {
    const loadPage = pagedSource(120, 500)
    expect(await loadAllPages('rows', loadPage)).toHaveLength(120)
    expect(loadPage).toHaveBeenCalledTimes(1)
  })

  it('requests one more page when the last page is exactly full', async () => {
    const loadPage = pagedSource(1000, 500)
    expect(await loadAllPages('rows', loadPage)).toHaveLength(1000)
    expect(loadPage).toHaveBeenCalledTimes(3)
  })

  it('throws instead of silently truncating on error', async () => {
    await expect(loadAllPages('snapshot rows', async () => ({ data: null, error: { message: 'boom' } })))
      .rejects.toThrow(PageLoadError)
    await expect(loadAllPages('snapshot rows', async () => ({ data: null, error: { message: 'boom' } })))
      .rejects.toThrow('Failed to load snapshot rows: boom')
  })

  it('wraps errors with the caller-supplied error type', async () => {
    class Custom extends Error {}
    await expect(loadAllPages('rows', async () => ({ data: null, error: { message: 'boom' } }), {
      wrapError: (_r, m) => new Custom(m),
    })).rejects.toThrow(Custom)
  })
})
