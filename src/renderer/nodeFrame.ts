import { createContext, useContext } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { ComponentNode } from '../schema/types'

export interface NodeFrameProps {
  node: ComponentNode
  children: ReactNode
}

export type NodeFrame = ComponentType<NodeFrameProps>

const PassthroughFrame: NodeFrame = ({ children }) => children

/**
 * Lets the editor wrap every rendered child node (e.g. for positioning and
 * dragging) without the renderer knowing about the editor.
 */
export const NodeFrameContext = createContext<NodeFrame>(PassthroughFrame)

export function useNodeFrame(): NodeFrame {
  return useContext(NodeFrameContext)
}
