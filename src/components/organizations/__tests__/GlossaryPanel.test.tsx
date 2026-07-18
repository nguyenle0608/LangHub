import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlossaryPanel } from '../GlossaryPanel'

const emptyList = () => Promise.resolve(new Response(JSON.stringify({ data: [], pagination: { nextOffset: null } }), { status: 200 }))

afterEach(() => { vi.restoreAllMocks() })

describe('GlossaryPanel', () => {
  it('lets read-only members view terms without management controls', async () => {
    vi.stubGlobal('fetch', vi.fn(emptyList))
    render(<GlossaryPanel orgId="org-a" canManage={false} />)
    expect(await screen.findByText('No glossary terms yet.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add term' })).toBeNull()
  })

  it('creates a term through the organization-scoped endpoint', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(emptyList)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        id: 'term-a', org_id: 'org-a', source_locale: 'en', target_locale: 'vi',
        source_term: 'Sign in', source_normalized: 'sign in', target_term: 'Đăng nhập',
        case_sensitive: false, whole_word: true, description: null,
        created_by: 'user-a', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      } }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<GlossaryPanel orgId="org-a" canManage />)
    await screen.findByText('No glossary terms yet.')
    fireEvent.change(screen.getByLabelText('Source term'), { target: { value: 'Sign in' } })
    fireEvent.change(screen.getByLabelText('Required translation'), { target: { value: 'Đăng nhập' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add term' }))
    await screen.findByText('Sign in')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/organizations/org-a/glossary', expect.objectContaining({ method: 'POST' }))
  })

  it('requires a second destructive click before deletion', async () => {
    const row = {
      id: 'term-a', org_id: 'org-a', source_locale: 'en', target_locale: 'vi',
      source_term: 'Sign in', source_normalized: 'sign in', target_term: 'Đăng nhập',
      case_sensitive: false, whole_word: true, description: null,
      created_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [row], pagination: { nextOffset: null } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { deleted: true } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<GlossaryPanel orgId="org-a" canManage />)
    const deleteButton = await screen.findByRole('button', { name: 'Delete Sign in' })
    fireEvent.click(deleteButton)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock).toHaveBeenLastCalledWith('/api/organizations/org-a/glossary/term-a', { method: 'DELETE' })
  })
})
