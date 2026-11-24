// Flow (normal) drop: where a dragged component lands among the container's
// flow children. The flow-index math is pure; DOM reading lives at the bottom.

import type { Point, Rect } from './geometry'
import { containerContentElement } from './canvasDom'

export interface FlowSibling {
  id: string
  /** Viewport rectangle. */
  rect: Rect
}

export interface FlowPlan {
  /** Insert before this sibling id, or append when null. */
  beforeId: string | null
  /** Viewport rectangle of the insertion line. */
  indicator: Rect
}

const INDICATOR_SIZE = 3

function sharesRow(a: Rect, b: Rect): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height
}

/**
 * A sibling with no other sibling beside it is a vertical-stack item (drop
 * above/below it); siblings side by side form a row (drop left/right).
 * Widths are not used, because components shrink to their content.
 */
function isStacked(
  sibling: FlowSibling,
  siblings: readonly FlowSibling[],
): boolean {
  return !siblings.some(
    (other) => other !== sibling && sharesRow(other.rect, sibling.rect),
  )
}

function comesBeforePointer(
  sibling: FlowSibling,
  pointer: Point,
  siblings: readonly FlowSibling[],
): boolean {
  const { x, y, width, height } = sibling.rect
  if (pointer.y > y + height) return true
  if (pointer.y < y) return false
  return isStacked(sibling, siblings)
    ? pointer.y > y + height / 2
    : pointer.x > x + width / 2
}

/** Index of the first flow sibling that should come after the pointer. */
export function flowInsertIndex(
  siblings: readonly FlowSibling[],
  pointer: Point,
): number {
  const index = siblings.findIndex(
    (sibling) => !comesBeforePointer(sibling, pointer, siblings),
  )
  return index === -1 ? siblings.length : index
}

export function flowIndicator(
  siblings: readonly FlowSibling[],
  index: number,
  content: Rect,
): Rect {
  const reference = siblings[index] ?? siblings[siblings.length - 1]
  if (!reference) {
    return {
      x: content.x + 4,
      y: content.y + 4,
      width: Math.max(0, content.width - 8),
      height: INDICATOR_SIZE,
    }
  }

  const after = index >= siblings.length
  const { x, y, width, height } = reference.rect
  if (isStacked(reference, siblings)) {
    // Span the container so the line is visible even for short text.
    return {
      x: content.x,
      y: after ? y + height + 2 : y - INDICATOR_SIZE - 2,
      width: content.width,
      height: INDICATOR_SIZE,
    }
  }
  return {
    x: after ? x + width + 2 : x - INDICATOR_SIZE - 2,
    y,
    width: INDICATOR_SIZE,
    height,
  }
}

function toRect(rect: DOMRect): Rect {
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

/** Reads the container's flow children from the DOM and plans the drop. */
export function planFlowDrop(
  containerId: string,
  pointer: Point,
  excludeNodeId: string | null,
): FlowPlan | null {
  const content = containerContentElement(containerId)
  if (!content) return null

  const siblings: FlowSibling[] = []
  for (const child of Array.from(content.children)) {
    if (!(child instanceof HTMLElement)) continue
    const id = child.dataset.swNode
    if (id === undefined || id === excludeNodeId) continue
    if (child.dataset.swPositioned === 'true') continue
    siblings.push({ id, rect: toRect(child.getBoundingClientRect()) })
  }

  const contentRect = toRect(content.getBoundingClientRect())
  const index = flowInsertIndex(siblings, pointer)
  return {
    beforeId: siblings[index]?.id ?? null,
    indicator: flowIndicator(siblings, index, contentRect),
  }
}
