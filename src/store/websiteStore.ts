import { create } from 'zustand'
import type {
  ComponentLayout,
  ComponentNode,
  ComponentProps,
  WebsiteDocument,
} from '../schema/types'
import { websiteSamples } from '../samples'
import { findNode, updateTree } from './tree'

type ComponentNodeUpdate = Omit<
  Partial<ComponentNode>,
  'id' | 'layout' | 'props'
> & {
  layout?: Partial<ComponentLayout>
  props?: Partial<ComponentProps>
}

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
      if (!findNode(state.website.root, id)) {
        throw new Error(`Cannot update component "${id}": node not found.`)
      }

      const root = updateTree(state.website.root, id, (node) => ({
        ...node,
        ...updates,
        id: node.id,
        props: updates.props ? { ...node.props, ...updates.props } : node.props,
        layout: updates.layout
          ? { ...node.layout, ...updates.layout }
          : node.layout,
      }))

      return { website: { ...state.website, root } }
    }),
}))
