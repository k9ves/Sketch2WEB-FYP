import { create } from 'zustand'
import { isComponentNode, isWebsiteDocument } from '../schema/types'
import type { ComponentNode, WebsiteDocument } from '../schema/types'
import { websiteSamples } from '../samples'
import { liftContainerText } from './containerText'
import {
  addNode as addNodeToTree,
  findParent,
  isContainerType,
  findNode,
  moveNode as moveNodeInTree,
  removeNode as removeNodeFromTree,
  updateTree,
} from './tree'

type ComponentNodeUpdate = Partial<
  Pick<ComponentNode, 'content' | 'layout' | 'style'>
>

/** Layout keys to merge into nodes, by node id. */
export type LayoutPatch = Record<string, Record<string, string>>

/** Freeform position of a node inside its parent; null means flow layout. */
export interface FreeformPosition {
  x: number
  y: number
  width: number
}

// `pinned` marks a neighbour pinned automatically by an Alt move.
// `flowParent` / `flowIndex` remember where a freely placed node sat in flow.
// Any explicit placement or return to flow clears them.
const positionKeys = [
  'x',
  'y',
  'width',
  'pinned',
  'pinX',
  'pinY',
  'flowParent',
  'flowIndex',
] as const

interface HistoryEntry {
  website: WebsiteDocument
  selectedId: string | null
}

interface WebsiteState {
  website: WebsiteDocument
  selectedId: string | null
  past: HistoryEntry[]
  future: HistoryEntry[]
  setWebsite: (website: WebsiteDocument) => void
  selectNode: (id: string | null) => void
  updateNode: (id: string, updates: ComponentNodeUpdate) => void
  addNode: (parentId: string, node: ComponentNode, index?: number) => void
  duplicateNode: (id: string) => void
  removeNode: (id: string) => void
  moveNode: (id: string, newParentId: string, index: number) => void
  placeNode: (
    id: string,
    parentId: string,
    index: number,
    position: FreeformPosition | null,
    otherLayouts?: LayoutPatch,
  ) => void
  setLayouts: (
    layouts: LayoutPatch,
    options?: { recordHistory?: boolean },
  ) => void
  /** Puts a node, and neighbours pinned with it, back into flow. */
  returnToFlow: (id: string) => void
  /** Puts every child of a container back into flow layout (one undo step). */
  returnChildrenToFlow: (containerId: string) => void
  undo: () => void
  redo: () => void
}

const HISTORY_LIMIT = 50

function recordChange(
  state: WebsiteState,
  website: WebsiteDocument,
  selectedId: string | null = state.selectedId,
) {
  return {
    website,
    selectedId,
    past: [
      ...state.past.slice(-(HISTORY_LIMIT - 1)),
      { website: state.website, selectedId: state.selectedId },
    ],
    future: [],
  }
}

function containsWebsiteNode(node: ComponentNode): boolean {
  return node.type === 'website' || node.children.some(containsWebsiteNode)
}

function hasUniqueNewIds(
  node: ComponentNode,
  website: WebsiteDocument,
  seen = new Set<string>(),
): boolean {
  if (seen.has(node.id) || findNode(website, node.id)) return false
  seen.add(node.id)
  return node.children.every((child) => hasUniqueNewIds(child, website, seen))
}

function withPosition(
  layout: Record<string, string>,
  position: FreeformPosition | null,
): Record<string, string> {
  const next = { ...layout }
  positionKeys.forEach((key) => delete next[key])
  if (position === null) return next

  return {
    ...next,
    x: String(Math.round(position.x)),
    y: String(Math.round(position.y)),
    width: String(Math.round(position.width)),
  }
}

function applyLayoutPatch(
  tree: ComponentNode,
  layouts: LayoutPatch,
): ComponentNode {
  return Object.entries(layouts).reduce((current, [id, layout]) => {
    if (!findNode(current, id)) {
      throw new Error(`Cannot update layout of "${id}": node not found.`)
    }
    return updateTree(current, id, (node) => ({
      ...node,
      layout: { ...node.layout, ...layout },
    }))
  }, tree)
}

/**
 * Puts the matching children of a container back into flow. They keep their
 * place in `children`, which is still the original flow order. The
 * container's pinned height goes once no child is positioned.
 */
function returnToFlowIn(
  website: WebsiteDocument,
  containerId: string,
  matches: (child: ComponentNode) => boolean,
): WebsiteDocument {
  const container = findNode(website, containerId)
  if (!container) throw new Error(`Cannot find container "${containerId}".`)

  const children = container.children.map((child) =>
    matches(child)
      ? { ...child, layout: withPosition(child.layout, null) }
      : child,
  )
  const layout = { ...container.layout }
  if (children.every((child) => child.layout.x === undefined)) {
    delete layout.height
  }

  const next = updateTree(website, containerId, (node) => ({
    ...node,
    layout,
    children,
  }))
  if (!isWebsiteDocument(next)) {
    throw new Error(
      'Returning components to flow produced an invalid website document.',
    )
  }
  return next
}

/**
 * Returns a node to flow at the container and index it had before it was
 * placed freely (`flowParent` / `flowIndex`), when that container is still
 * valid; otherwise in its current container. Neighbours pinned by the same
 * Alt move come back too, so the flow looks as it did before. Nodes the user
 * placed stay where they are.
 */
function sendHome(website: WebsiteDocument, id: string): WebsiteDocument {
  const node = findNode(website, id)
  const parent = findParent(website, id)
  if (!node || !parent) {
    throw new Error(`Cannot return "${id}" to flow: node not found.`)
  }

  const home =
    node.layout.flowParent !== undefined
      ? findNode(website, node.layout.flowParent)
      : undefined
  let tree: ComponentNode = website
  let containerId = parent.id
  if (
    home !== undefined &&
    isContainerType(home.type) &&
    findNode(node, home.id) === undefined
  ) {
    const others = home.children.filter((child) => child.id !== id)
    const wanted = Number(node.layout.flowIndex)
    const index = Number.isInteger(wanted)
      ? Math.min(Math.max(0, wanted), others.length)
      : others.length
    tree = moveNodeInTree(tree, id, home.id, index)
    containerId = home.id
  }
  if (!isWebsiteDocument(tree)) {
    throw new Error('Returning to flow produced an invalid website document.')
  }

  return returnToFlowIn(
    tree,
    containerId,
    (child) => child.id === id || child.layout.pinned === 'true',
  )
}

function cloneNodeWithNewIds(node: ComponentNode): ComponentNode {
  return {
    ...node,
    id: crypto.randomUUID(),
    content: { ...node.content },
    layout: { ...node.layout },
    style: { ...node.style },
    children: node.children.map(cloneNodeWithNewIds),
  }
}

export const useWebsiteStore = create<WebsiteState>((set) => ({
  website: liftContainerText(websiteSamples.landing),
  selectedId: null,
  past: [],
  future: [],
  setWebsite: (website) =>
    set({
      website: liftContainerText(website),
      selectedId: null,
      past: [],
      future: [],
    }),
  selectNode: (selectedId) => set({ selectedId }),
  updateNode: (id, updates) =>
    set((state) => {
      if (!findNode(state.website, id)) {
        throw new Error(`Cannot update component "${id}": node not found.`)
      }

      const website = updateTree(state.website, id, (node) => ({
        ...node,
        ...updates,
        id: node.id,
        content: updates.content
          ? { ...node.content, ...updates.content }
          : node.content,
        layout: updates.layout
          ? { ...node.layout, ...updates.layout }
          : node.layout,
        style: updates.style ? { ...node.style, ...updates.style } : node.style,
      }))

      if (!isWebsiteDocument(website)) {
        throw new Error(
          'Updating a component produced an invalid website document.',
        )
      }

      return recordChange(state, website)
    }),
  addNode: (parentId, node, index) =>
    set((state) => {
      if (!isComponentNode(node)) {
        throw new Error('Cannot add an invalid component node.')
      }
      if (containsWebsiteNode(node)) {
        throw new Error('A website root cannot be added as a child node.')
      }
      if (!hasUniqueNewIds(node, state.website)) {
        throw new Error(`Cannot add component "${node.id}": duplicate node id.`)
      }

      const website = addNodeToTree(state.website, parentId, node, index)
      if (!isWebsiteDocument(website)) {
        throw new Error(
          'Adding a component produced an invalid website document.',
        )
      }

      return recordChange(state, website)
    }),
  duplicateNode: (id) =>
    set((state) => {
      const node = findNode(state.website, id)
      if (!node) {
        throw new Error(`Cannot duplicate component "${id}": node not found.`)
      }
      if (node.type === 'website') {
        throw new Error('Cannot duplicate the website root.')
      }

      const parent = findParent(state.website, id)
      if (!parent) {
        throw new Error(`Cannot duplicate component "${id}": parent not found.`)
      }

      const index = parent.children.findIndex((child) => child.id === id)
      if (index === -1) {
        throw new Error(
          `Cannot duplicate component "${id}": parent is invalid.`,
        )
      }

      const duplicate = cloneNodeWithNewIds(node)
      if (!isComponentNode(duplicate) || containsWebsiteNode(duplicate)) {
        throw new Error('Cannot duplicate an invalid component subtree.')
      }
      if (!hasUniqueNewIds(duplicate, state.website)) {
        throw new Error(
          `Cannot duplicate component "${id}": duplicate node id.`,
        )
      }

      const website = addNodeToTree(
        state.website,
        parent.id,
        duplicate,
        index + 1,
      )
      if (!isWebsiteDocument(website)) {
        throw new Error(
          'Duplicating a component produced an invalid website document.',
        )
      }

      return recordChange(state, website, duplicate.id)
    }),
  removeNode: (id) =>
    set((state) => {
      const target = findNode(state.website, id)
      if (!target) {
        throw new Error(`Cannot remove component "${id}": node not found.`)
      }
      if (id === state.website.id) {
        throw new Error('Cannot remove the website root.')
      }

      const website = removeNodeFromTree(state.website, id)
      if (!isWebsiteDocument(website)) {
        throw new Error(
          'Removing a component produced an invalid website document.',
        )
      }

      const clearSelection =
        state.selectedId !== null &&
        findNode(target, state.selectedId) !== undefined

      return recordChange(
        state,
        website,
        clearSelection ? null : state.selectedId,
      )
    }),
  moveNode: (id, newParentId, index) =>
    set((state) => {
      const website = moveNodeInTree(state.website, id, newParentId, index)
      if (!isWebsiteDocument(website)) {
        throw new Error(
          'Moving a component produced an invalid website document.',
        )
      }

      return recordChange(state, website)
    }),
  placeNode: (id, parentId, index, position, otherLayouts = {}) =>
    set((state) => {
      const moved = moveNodeInTree(state.website, id, parentId, index)
      const placed = updateTree(moved, id, (node) => ({
        ...node,
        layout: withPosition(node.layout, position),
      }))
      // Same undo step: e.g. old neighbours pinned in place.
      const website = applyLayoutPatch(placed, otherLayouts)
      if (!isWebsiteDocument(website)) {
        throw new Error(
          'Placing a component produced an invalid website document.',
        )
      }

      return recordChange(state, website, id)
    }),
  setLayouts: (layouts, options) =>
    set((state) => {
      const website = applyLayoutPatch(state.website, layouts)
      if (!isWebsiteDocument(website)) {
        throw new Error(
          'Updating layouts produced an invalid website document.',
        )
      }

      // Automatic corrections (e.g. collision fixes) replace the current state
      // without adding an undo step.
      return options?.recordHistory === false
        ? { website }
        : recordChange(state, website)
    }),
  returnToFlow: (id) =>
    set((state) => {
      return recordChange(state, sendHome(state.website, id), id)
    }),
  returnChildrenToFlow: (containerId) =>
    set((state) => {
      const container = findNode(state.website, containerId)
      if (!container) {
        throw new Error(`Cannot find container "${containerId}".`)
      }
      // Children that came from another container go back there first.
      const visitors = container.children.filter(
        (child) =>
          child.layout.flowParent !== undefined &&
          child.layout.flowParent !== containerId,
      )
      const tree = visitors.reduce<WebsiteDocument>(
        (current, child) => sendHome(current, child.id),
        state.website,
      )
      const website = returnToFlowIn(tree, containerId, () => true)
      return recordChange(state, website)
    }),
  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1]
      if (!previous) return state

      return {
        website: previous.website,
        selectedId: previous.selectedId,
        past: state.past.slice(0, -1),
        future: [
          ...state.future.slice(-(HISTORY_LIMIT - 1)),
          { website: state.website, selectedId: state.selectedId },
        ],
      }
    }),
  redo: () =>
    set((state) => {
      const next = state.future[state.future.length - 1]
      if (!next) return state

      return {
        website: next.website,
        selectedId: next.selectedId,
        past: [
          ...state.past.slice(-(HISTORY_LIMIT - 1)),
          { website: state.website, selectedId: state.selectedId },
        ],
        future: state.future.slice(0, -1),
      }
    }),
}))

// Development only: a hot update of this module would create a second store
// while some components keep the old one, so reload the page instead.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload())
}
