import type { CSSProperties } from 'react'
import {
  readLength,
  readNodeBox,
  readNodeSize,
} from '../editor/freeform/canvasLayout'
import type { ComponentNode } from '../schema/types'
import { isContainerType } from '../store/tree'

// Freeform placement in the export (T53b): components placed freely (Alt)
// or resized on the canvas. The canvas puts these styles on its `.sw-node`
// wrappers (CanvasNodeFrame.tsx); the export has no wrappers, so they go on
// the element itself. Containers grow to fit positioned children at run
// time (src/freeform.ts in the export), like containPositionedChildren on
// the canvas.

function px(value: number): string {
  return `${Math.round(value)}px`
}

function hasPositionedChild(node: ComponentNode): boolean {
  return node.children.some((child) => readNodeBox(child) !== null)
}

/** Right edge the positioned children are meant to reach. */
function positionedRight(node: ComponentNode): number {
  return Math.max(
    0,
    ...node.children.map((child) => {
      const box = readNodeBox(child)
      if (!box) return 0
      return box.x + (readNodeSize(child).width ?? box.width)
    }),
  )
}

/** Minimum height the canvas keeps for a container (stored or resized). */
function storedMinHeight(node: ComponentNode): number {
  return Math.max(
    readLength(node.layout.height) ?? 0,
    readNodeSize(node).height ?? 0,
  )
}

/** Inline styles for a node's free position and resized size. */
export function placementStyle(node: ComponentNode): CSSProperties {
  const box = readNodeBox(node)
  const size = readNodeSize(node)
  const container = node.type === 'website' || isContainerType(node.type)
  const style: CSSProperties = {}

  if (box) {
    style.position = 'absolute'
    style.left = px(box.x)
    style.top = px(box.y)
  } else if (container && hasPositionedChild(node)) {
    // Positioned children are placed relative to their container.
    style.position = 'relative'
  }

  // Same width rules as CanvasNodeFrame: a resized width wins; otherwise
  // positioned containers keep their width and leaves hug their content up
  // to their stored width. Nothing gets wider than its container.
  if (size.width !== null) {
    style.width = px(size.width)
    style.maxWidth = '100%'
  } else if (box && container) {
    style.width = px(box.width)
    style.maxWidth = '100%'
  } else if (box) {
    style.maxWidth = `min(${px(box.width)}, 100%)`
  }

  // A container that sizes to its content would collapse around absolute
  // children; keep it as wide as they reach (canvas: min-width on wrapper).
  if (container && node.type !== 'website' && hasPositionedChild(node)) {
    style.minWidth = `min(${px(positionedRight(node))}, 100%)`
  }

  if (!container && size.height !== null) {
    if (node.type === 'image') style.height = px(size.height)
    else style.minHeight = px(size.height)
  }
  if (node.type === 'image' && (size.width !== null || size.height !== null)) {
    // An image fills its resized box; its ratio was kept while resizing.
    style.objectFit = 'cover'
  }
  return style
}

/** Data attributes the export's freeform runtime reads. */
export function placementAttributes(
  node: ComponentNode,
): { name: string; value: string }[] {
  const attributes: { name: string; value: string }[] = []
  if (readNodeBox(node)) {
    attributes.push({ name: 'data-sw-positioned', value: 'true' })
  }
  const container = node.type === 'website' || isContainerType(node.type)
  const minHeight = storedMinHeight(node)
  if (container && (hasPositionedChild(node) || minHeight > 0)) {
    attributes.push({ name: 'data-sw-contains', value: 'true' })
    if (minHeight > 0) {
      attributes.push({ name: 'data-sw-min-height', value: String(minHeight) })
    }
  }
  return attributes
}

/** True when the export needs the freeform runtime. */
export function usesFreeform(node: ComponentNode): boolean {
  return (
    placementAttributes(node).length > 0 || node.children.some(usesFreeform)
  )
}
