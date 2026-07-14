export type TranslationKeyTreeNodeKind = 'root' | 'folder' | 'leaf'

export type TranslationKeyTreeItem = {
  id: string
  key: string
}

export type TranslationKeyTreeNode = {
  id: string
  kind: TranslationKeyTreeNodeKind
  label: string
  path: string
  keyId?: string
  keyName?: string
  children: TranslationKeyTreeNode[]
  descendantKeyIds: string[]
}

type MutableTreeNode = Omit<TranslationKeyTreeNode, 'children' | 'descendantKeyIds'> & {
  children: MutableTreeNode[]
  descendantKeyIds: Set<string>
  folderChildrenByPath?: Map<string, MutableTreeNode>
}

export const KEY_TREE_ROOT_ID = 'root:{}'

function folderNodeId(path: string): string {
  return `folder:${path}`
}

export function leafNodeId(keyId: string): string {
  return `leaf:${keyId}`
}

function splitKeyPath(key: string): string[] {
  return key
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)
}

function createFolderNode(label: string, path: string): MutableTreeNode {
  return {
    id: folderNodeId(path),
    kind: 'folder',
    label,
    path,
    children: [],
    descendantKeyIds: new Set<string>(),
    folderChildrenByPath: new Map<string, MutableTreeNode>(),
  }
}

function createLeafNode(item: TranslationKeyTreeItem, label: string): MutableTreeNode {
  return {
    id: leafNodeId(item.id),
    kind: 'leaf',
    label,
    path: item.key,
    keyId: item.id,
    keyName: item.key,
    children: [],
    descendantKeyIds: new Set<string>([item.id]),
  }
}

function finalizeNode(node: MutableTreeNode): TranslationKeyTreeNode {
  const children = node.children
    .sort((a, b) => {
      if (a.kind !== b.kind) {
        if (a.kind === 'folder') return -1
        if (b.kind === 'folder') return 1
      }
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    })
    .map(finalizeNode)

  return {
    id: node.id,
    kind: node.kind,
    label: node.label,
    path: node.path,
    keyId: node.keyId,
    keyName: node.keyName,
    children,
    descendantKeyIds: Array.from(node.descendantKeyIds),
  }
}

export function buildTranslationKeyTree(items: TranslationKeyTreeItem[]): TranslationKeyTreeNode {
  const root: MutableTreeNode = {
    id: KEY_TREE_ROOT_ID,
    kind: 'root',
    label: '{}',
    path: '',
    children: [],
    descendantKeyIds: new Set<string>(),
    folderChildrenByPath: new Map<string, MutableTreeNode>(),
  }

  for (const item of items) {
    root.descendantKeyIds.add(item.id)

    const parts = splitKeyPath(item.key)
    if (parts.length <= 1) {
      root.children.push(createLeafNode(item, item.key || '(empty key)'))
      continue
    }

    let parent = root
    for (let index = 0; index < parts.length - 1; index++) {
      const label = parts[index]!
      const path = parts.slice(0, index + 1).join('.')
      parent.descendantKeyIds.add(item.id)
      const folderChildren = parent.folderChildrenByPath ?? new Map<string, MutableTreeNode>()
      parent.folderChildrenByPath = folderChildren
      let folder = folderChildren.get(path)
      if (!folder) {
        folder = createFolderNode(label, path)
        folderChildren.set(path, folder)
        parent.children.push(folder)
      }
      parent = folder
    }

    parent.descendantKeyIds.add(item.id)
    parent.children.push(createLeafNode(item, parts[parts.length - 1] ?? item.key))
  }

  return finalizeNode(root)
}

export function resolveCheckedTranslationKeyIds(
  root: TranslationKeyTreeNode,
  checkedNodeIds: ReadonlySet<string>,
): Set<string> | null {
  if (checkedNodeIds.size === 0) return null

  const result = new Set<string>()
  const visit = (node: TranslationKeyTreeNode) => {
    if (checkedNodeIds.has(node.id)) {
      for (const keyId of node.descendantKeyIds) result.add(keyId)
    }
    for (const child of node.children) visit(child)
  }
  visit(root)
  return result
}
