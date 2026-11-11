import type { ComponentNode } from '../schema/types'

export function findNode(
  tree: ComponentNode,
  id: string,
): ComponentNode | undefined {
  if (tree.id === id) return tree

  for (const child of tree.children ?? []) {
    const match = findNode(child, id)
    if (match) return match
  }

  return undefined
}

export function updateTree(
  tree: ComponentNode,
  id: string,
  update: (node: ComponentNode) => ComponentNode,
): ComponentNode {
  if (tree.id === id) return update(tree)

  let changed = false
  const children = tree.children?.map((child) => {
    const updatedChild = updateTree(child, id, update)
    if (updatedChild !== child) changed = true
    return updatedChild
  })

  return changed ? { ...tree, children } : tree
}
