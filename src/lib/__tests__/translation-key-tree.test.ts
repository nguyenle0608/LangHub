import { describe, expect, it } from 'vitest'
import {
  KEY_TREE_ROOT_ID,
  buildTranslationKeyTree,
  leafNodeId,
  resolveCheckedTranslationKeyIds,
} from '../translation-key-tree'

describe('translation key tree utilities', () => {
  const items = [
    { id: '1', key: 'auth' },
    { id: '2', key: 'auth.login.title' },
    { id: '3', key: 'auth.logout' },
    { id: '4', key: 'settings.profile.name' },
    { id: '5', key: 'appName' },
  ]

  it('builds a root tree with folders and flat leaf keys', () => {
    const tree = buildTranslationKeyTree(items)
    expect(tree.id).toBe(KEY_TREE_ROOT_ID)
    expect(tree.label).toBe('{}')
    expect(tree.descendantKeyIds.sort()).toEqual(['1', '2', '3', '4', '5'])

    const authFolder = tree.children.find((child) => child.kind === 'folder' && child.label === 'auth')
    const authLeaf = tree.children.find((child) => child.kind === 'leaf' && child.keyName === 'auth')
    const appLeaf = tree.children.find((child) => child.kind === 'leaf' && child.keyName === 'appName')

    expect(authFolder?.descendantKeyIds.sort()).toEqual(['2', '3'])
    expect(authLeaf?.descendantKeyIds).toEqual(['1'])
    expect(appLeaf?.descendantKeyIds).toEqual(['5'])
  })

  it('keeps parent path leaf selection separate from folder descendants', () => {
    const tree = buildTranslationKeyTree(items)
    const authFolder = tree.children.find((child) => child.kind === 'folder' && child.label === 'auth')
    expect(authFolder).toBeDefined()

    const folderSelection = resolveCheckedTranslationKeyIds(tree, new Set([authFolder!.id]))
    const leafSelection = resolveCheckedTranslationKeyIds(tree, new Set([leafNodeId('1')]))

    expect(Array.from(folderSelection ?? []).sort()).toEqual(['2', '3'])
    expect(Array.from(leafSelection ?? [])).toEqual(['1'])
  })

  it('returns null when nothing is checked and unions multiple checked nodes', () => {
    const tree = buildTranslationKeyTree(items)
    expect(resolveCheckedTranslationKeyIds(tree, new Set())).toBeNull()

    const settingsFolder = tree.children.find((child) => child.kind === 'folder' && child.label === 'settings')
    const selection = resolveCheckedTranslationKeyIds(tree, new Set([leafNodeId('5'), settingsFolder!.id]))

    expect(Array.from(selection ?? []).sort()).toEqual(['4', '5'])
  })
})
