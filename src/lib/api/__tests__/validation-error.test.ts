import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { firstIssueMessage } from '../validation-error'
import { chunkBulkItems, partialWriteMessage, MAX_BULK_TRANSLATION_ITEMS } from '../bulk-translations'

const BulkSchema = z.object({
  items: z.array(z.object({ keyId: z.string().uuid() })).min(1).max(MAX_BULK_TRANSLATION_ITEMS),
})

describe('firstIssueMessage', () => {
  it('describes an oversized bulk request as a sentence, not an object', () => {
    const parsed = BulkSchema.safeParse({
      items: Array.from({ length: MAX_BULK_TRANSLATION_ITEMS + 1 }, () => ({ keyId: crypto.randomUUID() })),
    })
    expect(parsed.success).toBe(false)
    const message = firstIssueMessage(parsed.error!)
    expect(typeof message).toBe('string')
    expect(message).toContain('items')
  })

  it('names the offending field', () => {
    const parsed = BulkSchema.safeParse({ items: [{ keyId: 'not-a-uuid' }] })
    expect(firstIssueMessage(parsed.error!)).toBe('items.0.keyId: Invalid uuid')
  })
})

describe('chunkBulkItems', () => {
  it('keeps every batch within what the route accepts', () => {
    const items = Array.from({ length: 11_024 }, (_, i) => i)
    const batches = chunkBulkItems(items)

    expect(batches.every((b) => b.length <= MAX_BULK_TRANSLATION_ITEMS)).toBe(true)
    expect(batches.flat()).toEqual(items)
  })

  it('sends a request that already fits as a single batch', () => {
    expect(chunkBulkItems([1, 2, 3])).toEqual([[1, 2, 3]])
  })

  it('sends nothing when there is nothing to send', () => {
    expect(chunkBulkItems([])).toEqual([])
  })
})

describe('chunkBulkItems batch alignment', () => {
  it('splits two parallel arrays the same way, so batch i matches batch i', () => {
    const items = Array.from({ length: 11_024 }, (_, i) => `item-${i}`)
    const changes = items.map((item) => `change-for-${item}`)

    const itemBatches = chunkBulkItems(items)
    const changeBatches = chunkBulkItems(changes)

    expect(changeBatches).toHaveLength(itemBatches.length)
    itemBatches.forEach((batch, i) => {
      expect(changeBatches[i]).toEqual(batch.map((item) => `change-for-${item}`))
    })
  })
})

describe('partialWriteMessage', () => {
  it('says how much landed when a later batch failed', () => {
    expect(partialWriteMessage(5000, 11_024, 'Approve failed'))
      .toBe('Approve failed — 5,000 of 11,024 saved before it stopped')
  })

  it('does not imply a partial save when nothing was written', () => {
    expect(partialWriteMessage(0, 11_024, 'Approve failed')).toBe('Approve failed')
  })
})
