import { create } from 'zustand'
import { isWebsiteDocument } from '../schema/types'
import type { ComponentNode, WebsiteDocument } from '../schema/types'
import { websiteSamples } from '../samples'
import { findNode, updateTree } from './tree'

type ComponentNodeUpdate = Partial<
  Pick<ComponentNode, 'content' | 'layout' | 'style'>
>

interface WebsiteState {
  website: WebsiteDocument
  selectedId: string | null
  setWebsite: (website: WebsiteDocument) => void
  selectNode: (id: string | null) => void
  updateNode: (id: string, updates: ComponentNodeUpdate) => void
}

export const useWebsiteStore = create<WebsiteState>((set) => ({
  website: websiteSamples.landing,
  selectedId: null,
  setWebsite: (website) => set({ website, selectedId: null }),
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

      return { website }
    }),
}))
