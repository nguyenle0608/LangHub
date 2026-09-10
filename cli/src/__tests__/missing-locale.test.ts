import { describe, it, expect, vi } from 'vitest'
import { explainFailures, fetchAll } from '../index'
import type { Config } from '../config'

const config = {
  projectId: 'project-a',
  branch: 'main',
  format: 'json',
  output: 'assets/translations',
  apiBase: 'https://langhub.example.com',
  locales: { 'en-US': 'en-US', 'th-TH': 'th-TH', 'ko-KR': 'ko-KR' },
} as Config

const NOT_FOUND = 'returned 404 for th-TH: {"error":{"message":"Project resource not found"}}'

describe('fetchAll', () => {
  it('keeps going after a failure, so one run finds every bad locale', async () => {
    // Stopping at the first means a config with three typos takes three runs to
    // fix, each one revealing the next.
    const load = vi.fn(async (code: string) => {
      if (code === 'en-US') return { a: '1' }
      throw new Error(`${code} is not here`)
    })
    const { fetched, failed } = await fetchAll(['en-US', 'th-TH', 'ko-KR'], load)

    expect(load).toHaveBeenCalledTimes(3)
    expect(fetched.map((entry) => entry.code)).toEqual(['en-US'])
    expect(failed.map((entry) => entry.code)).toEqual(['th-TH', 'ko-KR'])
  })

  it('reports nothing failed when nothing did', async () => {
    const { fetched, failed } = await fetchAll(['en-US'], async () => ({ a: '1' }))
    expect(failed).toEqual([])
    expect(fetched).toHaveLength(1)
  })
})

describe('explainFailures', () => {
  const failed = [
    { code: 'th-TH', message: NOT_FOUND },
    { code: 'ko-KR', message: NOT_FOUND },
  ]

  it('names every failing locale and the file it maps to', () => {
    const text = explainFailures(failed, true, config)

    expect(text).toContain('2 locales could not be read')
    expect(text).toContain('th-TH -> th-TH.json')
    expect(text).toContain('ko-KR -> ko-KR.json')
  })

  it('blames the locale names when other locales worked', () => {
    // The API answers 404 identically for a missing project, branch or locale —
    // correctly, since saying which part of a guess was right is how a resource
    // gets enumerated. One locale succeeding is what rules the other two out.
    const text = explainFailures(failed, true, config)

    expect(text).toContain('the project and branch are right')
    expect(text).not.toContain('projectId')
  })

  it('blames the project or branch when nothing worked, and names the branch', () => {
    const text = explainFailures(failed, false, config)

    expect(text).toContain('more likely the project or the branch')
    expect(text).toContain('branch "main"')
  })

  it('keeps the underlying message, so a non-404 is not misread as a typo', () => {
    const text = explainFailures([{ code: 'th-TH', message: 'returned 500 for th-TH' }], true, config)
    expect(text).toContain('returned 500')
  })
})
