import { describe, expect, it } from 'vitest'
import {
  KEY_TREE_ROOT_ID,
  buildTranslationKeyTree,
  getKeyTreeNodeCheckStates,
  leafNodeId,
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
    const authLeaf = tree.children.find((child) => child.kind === 'leaf' && child.keyName === 'auth')
    expect(authFolder).toBeDefined()
    expect(authLeaf).toBeDefined()

    const folderStates = getKeyTreeNodeCheckStates(tree, new Set(['2', '3']))
    expect(folderStates.get(authFolder!.id)).toBe('checked')
    expect(folderStates.get(authLeaf!.id)).toBe('unchecked')

    const leafStates = getKeyTreeNodeCheckStates(tree, new Set(['1']))
    expect(leafStates.get(authLeaf!.id)).toBe('checked')
    expect(leafStates.get(authFolder!.id)).toBe('unchecked')
  })

  it('returns unchecked for every node when nothing is selected', () => {
    const tree = buildTranslationKeyTree(items)
    const states = getKeyTreeNodeCheckStates(tree, new Set())
    expect(states.get(tree.id)).toBe('unchecked')
    for (const child of tree.children) {
      expect(states.get(child.id)).toBe('unchecked')
    }
  })

  it('unions multiple selected leaves under their respective folders', () => {
    const tree = buildTranslationKeyTree(items)
    const settingsFolder = tree.children.find((child) => child.kind === 'folder' && child.label === 'settings')
    expect(settingsFolder).toBeDefined()

    const states = getKeyTreeNodeCheckStates(tree, new Set(['4', '5']))
    expect(states.get(settingsFolder!.id)).toBe('checked')
    expect(states.get(leafNodeId('5'))).toBe('checked')
    expect(states.get(tree.id)).toBe('indeterminate')
  })

  it('marks a folder indeterminate when only some descendants are selected', () => {
    const tree = buildTranslationKeyTree(items)
    const authFolder = tree.children.find((child) => child.kind === 'folder' && child.label === 'auth')
    expect(authFolder).toBeDefined()

    const states = getKeyTreeNodeCheckStates(tree, new Set(['2']))
    expect(states.get(authFolder!.id)).toBe('indeterminate')
  })

  it('marks a folder checked when all descendants are selected, and root indeterminate', () => {
    const tree = buildTranslationKeyTree(items)
    const authFolder = tree.children.find((child) => child.kind === 'folder' && child.label === 'auth')
    expect(authFolder).toBeDefined()

    const states = getKeyTreeNodeCheckStates(tree, new Set(['2', '3']))
    expect(states.get(authFolder!.id)).toBe('checked')
    expect(states.get(tree.id)).toBe('indeterminate')
  })

  it('marks every node checked when all keys are selected', () => {
    const tree = buildTranslationKeyTree(items)
    const states = getKeyTreeNodeCheckStates(tree, new Set(['1', '2', '3', '4', '5']))
    expect(states.get(tree.id)).toBe('checked')
    for (const child of tree.children) {
      expect(states.get(child.id)).toBe('checked')
    }
  })
})
