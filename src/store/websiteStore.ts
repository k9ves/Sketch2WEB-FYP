import { create } from 'zustand'
import { isComponentNode, isWebsiteDocument } from '../schema/types'
import type { ComponentNode, WebsiteDocument } from '../schema/types'
import { websiteSamples } from '../samples'
import {
  addNode as addNodeToTree,
  findParent,
  findNode,
  moveNode as moveNodeInTree,
  removeNode as removeNodeFromTree,
  updateTree,
} from './tree'

type ComponentNodeUpdate = Partial<
  Pick<ComponentNode, 'content' | 'layout' | 'style'>
>

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
  website: websiteSamples.landing,
  selectedId: null,
  past: [],
  future: [],
  setWebsite: (website) =>
    set({ website, selectedId: null, past: [], future: [] }),
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
