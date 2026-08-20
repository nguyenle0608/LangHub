import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { TagInput } from '../TagInput'

afterEach(() => { cleanup() })

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const chip = (tag: string) => screen.queryByText(tag)
const spinner = () => document.querySelector('svg.animate-spin')
const type = (text: string) => {
  const input = screen.getByPlaceholderText('Add tag…')
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

/** Mirrors KeyDetailPanel: the parent commits to `value` only on success. */
function Harness({ onCommit, initial = [] }: { onCommit: (next: string[]) => Promise<boolean>; initial?: string[] }) {
  const [tags, setTags] = useState<string[]>(initial)
  return (
    <TagInput
      value={tags}
      onChange={async (next) => {
        const ok = await onCommit(next)
        if (ok) setTags(next)
        return ok
      }}
    />
  )
}

describe('TagInput pending state', () => {
  it('shows the tag with a spinner while the add is in flight, then settles', async () => {
    const d = deferred<boolean>()
    render(<Harness onCommit={() => d.promise} />)

    await act(async () => { type('mobile') })
    // Optimistic: visible immediately, with a spinner instead of the remove button.
    expect(chip('mobile')).not.toBeNull()
    expect(spinner()).not.toBeNull()
    expect(screen.queryByLabelText('Remove tag mobile')).toBeNull()

    await act(async () => { d.resolve(true); await d.promise })
    await waitFor(() => expect(spinner()).toBeNull())
    expect(chip('mobile')).not.toBeNull()
    expect(screen.getByLabelText('Remove tag mobile')).toBeTruthy()
  })

  it('drops the tag again when the add fails', async () => {
    const d = deferred<boolean>()
    render(<Harness onCommit={() => d.promise} />)

    await act(async () => { type('broken') })
    expect(chip('broken')).not.toBeNull()

    await act(async () => { d.resolve(false); await d.promise })
    await waitFor(() => expect(chip('broken')).toBeNull())
  })

  it('drops the tag when the add rejects outright', async () => {
    const d = deferred<boolean>()
    render(<Harness onCommit={() => d.promise} />)

    await act(async () => { type('boom') })
    await act(async () => {
      d.reject(new Error('network'))
      await d.promise.catch(() => {})
    })
    await waitFor(() => expect(chip('boom')).toBeNull())
  })

  it('keeps the tag with a spinner while the remove is in flight, then removes it', async () => {
    const d = deferred<boolean>()
    render(<Harness onCommit={() => d.promise} initial={['legacy']} />)

    await act(async () => { screen.getByLabelText('Remove tag legacy').click() })
    expect(chip('legacy')).not.toBeNull()
    expect(spinner()).not.toBeNull()

    await act(async () => { d.resolve(true); await d.promise })
    await waitFor(() => expect(chip('legacy')).toBeNull())
  })

  it('keeps the tag when the remove fails', async () => {
    const d = deferred<boolean>()
    render(<Harness onCommit={() => d.promise} initial={['stays']} />)

    await act(async () => { screen.getByLabelText('Remove tag stays').click() })
    await act(async () => { d.resolve(false); await d.promise })

    await waitFor(() => expect(spinner()).toBeNull())
    expect(chip('stays')).not.toBeNull()
    expect(screen.getByLabelText('Remove tag stays')).toBeTruthy()
  })

  it('ignores a second remove click while the first is pending', async () => {
    const d = deferred<boolean>()
    const onCommit = vi.fn(() => d.promise)
    render(<Harness onCommit={onCommit} initial={['once']} />)

    await act(async () => { screen.getByLabelText('Remove tag once').click() })
    // The button is replaced by the spinner, so a second click cannot even land.
    expect(screen.queryByLabelText('Remove tag once')).toBeNull()
    expect(onCommit).toHaveBeenCalledTimes(1)

    await act(async () => { d.resolve(true); await d.promise })
  })

  it('stays instant for a synchronous parent, with no spinner', async () => {
    function SyncHarness() {
      const [tags, setTags] = useState<string[]>([])
      return <TagInput value={tags} onChange={setTags} />
    }
    render(<SyncHarness />)

    await act(async () => { type('local') })
    expect(chip('local')).not.toBeNull()
    expect(spinner()).toBeNull()
  })

  it('will not add a duplicate of a tag already shown', async () => {
    const onCommit = vi.fn(async () => true)
    render(<Harness onCommit={onCommit} initial={['dup']} />)

    await act(async () => { type('DUP') })
    expect(onCommit).not.toHaveBeenCalled()
  })
})
