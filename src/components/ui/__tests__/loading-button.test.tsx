import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoadingButton } from '../loading-button'

afterEach(() => { cleanup() })

function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const button = () => screen.getByRole('button') as HTMLButtonElement
const spinner = () => document.querySelector('svg.animate-spin')

describe('LoadingButton', () => {
  it('disables and spins while a promise-returning onClick is in flight', async () => {
    const d = deferred()
    render(<LoadingButton onClick={() => d.promise}>Preview</LoadingButton>)

    expect(button().disabled).toBe(false)
    expect(spinner()).toBeNull()

    await act(async () => { button().click() })
    expect(button().disabled).toBe(true)
    expect(spinner()).not.toBeNull()

    await act(async () => { d.resolve(); await d.promise })
    await waitFor(() => expect(button().disabled).toBe(false))
    expect(spinner()).toBeNull()
  })

  it('ignores repeat clicks while in flight', async () => {
    const d = deferred()
    const onClick = vi.fn(() => d.promise)
    render(<LoadingButton onClick={onClick}>Save</LoadingButton>)

    await act(async () => { button().click(); button().click(); button().click() })
    expect(onClick).toHaveBeenCalledTimes(1)

    await act(async () => { d.resolve(); await d.promise })
  })

  it('clears the pending state and logs when the action rejects', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deferred()
    render(<LoadingButton onClick={() => d.promise}>Save</LoadingButton>)

    await act(async () => { button().click() })
    expect(button().disabled).toBe(true)

    await act(async () => {
      d.reject(new Error('boom'))
      await d.promise.catch(() => {})
    })
    await waitFor(() => expect(button().disabled).toBe(false))
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })

  it('leaves a synchronous onClick untouched', async () => {
    const onClick = vi.fn()
    render(<LoadingButton onClick={onClick}>Go</LoadingButton>)

    await act(async () => { button().click() })
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(button().disabled).toBe(false)
    expect(spinner()).toBeNull()
  })

  it('keeps children by default and swaps them for loadingText', () => {
    const { rerender } = render(<LoadingButton loading>Delete</LoadingButton>)
    expect(button().textContent).toContain('Delete')

    rerender(<LoadingButton loading loadingText="Deleting…">Delete</LoadingButton>)
    expect(button().textContent).toContain('Deleting…')
    expect(button().textContent).not.toContain('Delete')
  })

  it('renders the spinner alone for icon buttons', () => {
    render(<LoadingButton loading loadingText={null}><span>icon</span></LoadingButton>)
    expect(screen.queryByText('icon')).toBeNull()
    expect(spinner()).not.toBeNull()
  })

  // StrictMode mounts, cleans up, then mounts again. A mounted-ref that is only
  // armed by its initialiser reads false on the second mount, which left the
  // spinner stuck on forever after the first click.
  it('clears the pending state under StrictMode double-mounting', async () => {
    const d = deferred()
    render(
      <StrictMode>
        <LoadingButton onClick={() => d.promise}>Delete</LoadingButton>
      </StrictMode>
    )

    await act(async () => { button().click() })
    expect(button().disabled).toBe(true)

    await act(async () => { d.resolve(); await d.promise })
    await waitFor(() => expect(button().disabled).toBe(false))
    expect(spinner()).toBeNull()
    expect(button().textContent).toContain('Delete')
  })

  it('honours parent-driven loading, as a form submit needs', () => {
    render(<LoadingButton type="submit" loading>Sign in</LoadingButton>)
    expect(button().disabled).toBe(true)
    expect(spinner()).not.toBeNull()
  })
})
