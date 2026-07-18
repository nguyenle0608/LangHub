import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TranslationsPane } from '../KeyDetailPanel'
import type { KeyWithTranslations } from '@/lib/supabase/queries/translations'
import type { LocaleWithStats } from '@/types'

const baseLocale: LocaleWithStats = { id: 'locale-en', code: 'en', name: 'English', is_base: true, total: 1, approved: 1, percent: 100 }
const targetLocale: LocaleWithStats = { id: 'locale-vi', code: 'vi', name: 'Vietnamese', is_base: false, total: 1, approved: 0, percent: 0 }
const keyItem = {
  id: 'key-a', project_id: 'project-a', branch_id: 'branch-a', key: 'auth.sign_in',
  description: null, tags: [], platforms: [], char_limit: null, is_plural: false,
  plural_forms: null, reference_key_id: null, created_by: null, created_at: null,
  translations: [
    { id: 'source-a', key_id: 'key-a', locale_id: 'locale-en', value: 'Sign in', status: 'approved' },
    { id: 'target-a', key_id: 'key-a', locale_id: 'locale-vi', value: '', status: 'empty' },
  ],
} as KeyWithTranslations

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('editor translation assistance', () => {
  it('loads on target focus, caches while typing, and applies without auto-saving', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        sourceText: 'Sign in', sourceLocale: 'en', targetLocale: 'vi',
        suggestions: [{ id: 'tm-a', sourceText: 'Sign in', targetText: 'Đăng nhập', score: 1, matchKind: 'exact', projectId: null, usageCount: 0, lastUsedAt: null }],
        glossary: [],
      } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { recorded: true } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<TranslationsPane keyItem={keyItem} locales={[baseLocale, targetLocale]} branchId="branch-a" onUpdated={vi.fn()} canEdit />)
    const target = screen.getByPlaceholderText('Translation…')
    fireEvent.focus(target)
    const suggestion = await screen.findByText('Đăng nhập')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.change(target, { target: { value: 'Đang gõ' } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(suggestion)
    expect((target as HTMLTextAreaElement).value).toBe('Đăng nhập')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/translations')).toBe(false)
  })

  it('keeps editing available and exposes retry after lookup failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<TranslationsPane keyItem={keyItem} locales={[baseLocale, targetLocale]} branchId="branch-a" onUpdated={vi.fn()} canEdit />)
    const target = screen.getByPlaceholderText('Translation…')
    fireEvent.focus(target)
    expect(await screen.findByText('Translation assistance unavailable — retry')).toBeTruthy()
    fireEvent.change(target, { target: { value: 'Bản dịch thủ công' } })
    expect((target as HTMLTextAreaElement).value).toBe('Bản dịch thủ công')
  })

  it('cancels a stale lookup when the selected key changes', () => {
    let requestSignal: AbortSignal | undefined
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      requestSignal = init?.signal as AbortSignal | undefined
      return new Promise<Response>(() => undefined)
    })
    vi.stubGlobal('fetch', fetchMock)
    const view = render(<TranslationsPane keyItem={keyItem} locales={[baseLocale, targetLocale]} branchId="branch-a" onUpdated={vi.fn()} canEdit />)
    fireEvent.focus(screen.getByPlaceholderText('Translation…'))
    expect(requestSignal?.aborted).toBe(false)
    view.rerender(<TranslationsPane keyItem={{ ...keyItem, id: 'key-b' }} locales={[baseLocale, targetLocale]} branchId="branch-a" onUpdated={vi.fn()} canEdit />)
    expect(requestSignal?.aborted).toBe(true)
  })

  it('shows a non-blocking glossary warning in the target cell', async () => {
    const glossaryKey = {
      ...keyItem,
      translations: keyItem.translations.map((translation) => (
        translation.locale_id === targetLocale.id
          ? { ...translation, value: 'Vui lòng tiếp tục', status: 'pending' }
          : translation
      )),
    } as KeyWithTranslations
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      sourceText: 'Sign in', sourceLocale: 'en', targetLocale: 'vi', suggestions: [],
      glossary: [{ id: 'term-a', sourceTerm: 'Sign in', targetTerm: 'Đăng nhập', caseSensitive: false, wholeWord: true, description: null }],
    } }), { status: 200 })))
    render(<TranslationsPane keyItem={glossaryKey} locales={[baseLocale, targetLocale]} branchId="branch-a" onUpdated={vi.fn()} canEdit />)
    fireEvent.focus(screen.getByPlaceholderText('Translation…'))
    expect(await screen.findByText('Use glossary term “Đăng nhập” for “Sign in”')).toBeTruthy()
    expect((screen.getByPlaceholderText('Translation…') as HTMLTextAreaElement).value).toBe('Vui lòng tiếp tục')
  })
})
