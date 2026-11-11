import type { ComponentNode, ComponentType } from '../schema/types'

const containerTypes: ReadonlySet<ComponentType> = new Set([
  'website',
  'hero',
  'section',
  'columns',
  'card',
  'footer',
])

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

export function addNode(
  tree: ComponentNode,
  parentId: string,
  node: ComponentNode,
  index?: number,
): ComponentNode {
  const parent = findNode(tree, parentId)
  if (!parent) {
    throw new Error(`Cannot add component: parent "${parentId}" not found.`)
  }
  if (!containerTypes.has(parent.type)) {
    throw new Error(`Cannot add children to "${parent.type}" components.`)
  }

  return addNodeAtParent(tree, parentId, node, index)
}

function addNodeAtParent(
  tree: ComponentNode,
  parentId: string,
  node: ComponentNode,
  index?: number,
): ComponentNode {
  if (tree.id === parentId) {
    const insertionIndex = index ?? tree.children.length
    if (
      !Number.isInteger(insertionIndex) ||
      insertionIndex < 0 ||
      insertionIndex > tree.children.length
    ) {
      throw new RangeError('Child insertion index is out of range.')
    }

    return {
      ...tree,
      children: [
        ...tree.children.slice(0, insertionIndex),
        node,
        ...tree.children.slice(insertionIndex),
      ],
    }
  }

  let changed = false
  const children = tree.children.map((child) => {
    if (changed) return child
    const updatedChild = addNodeAtParent(child, parentId, node, index)
    if (updatedChild !== child) changed = true
    return updatedChild
  })

  return changed ? { ...tree, children } : tree
}

export function removeNode(tree: ComponentNode, id: string): ComponentNode {
  if (tree.id === id) {
    throw new Error('Cannot remove the website root.')
  }
  if (!findNode(tree, id)) {
    throw new Error(`Cannot remove component "${id}": node not found.`)
  }

  return removeNodeFromChildren(tree, id)
}

export function moveNode(
  tree: ComponentNode,
  id: string,
  newParentId: string,
  index: number,
): ComponentNode {
  if (tree.id === id) {
    throw new Error('Cannot move the website root.')
  }

  const node = findNode(tree, id)
  if (!node) {
    throw new Error(`Cannot move component "${id}": node not found.`)
  }

  const newParent = findNode(tree, newParentId)
  if (!newParent) {
    throw new Error(`Cannot move component: parent "${newParentId}" not found.`)
  }
  if (!containerTypes.has(newParent.type)) {
    throw new Error(`Cannot add children to "${newParent.type}" components.`)
  }
  if (findNode(node, newParentId)) {
    throw new Error('Cannot move a component into itself or its descendants.')
  }

  const treeWithoutNode = removeNode(tree, id)
  return addNode(treeWithoutNode, newParentId, node, index)
}

function removeNodeFromChildren(
  tree: ComponentNode,
  id: string,
): ComponentNode {
  const childIndex = tree.children.findIndex((child) => child.id === id)
  if (childIndex !== -1) {
    return {
      ...tree,
      children: tree.children.filter((_, index) => index !== childIndex),
    }
  }

  let changed = false
  const children = tree.children.map((child) => {
    if (changed) return child
    const updatedChild = removeNodeFromChildren(child, id)
    if (updatedChild !== child) changed = true
    return updatedChild
  })

  return changed ? { ...tree, children } : tree
}
