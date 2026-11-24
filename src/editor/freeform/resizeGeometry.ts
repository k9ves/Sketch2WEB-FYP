// Pure resize math for the canvas. No React, no DOM.

import { rectsCollide } from './geometry'
import type { Bounds, Point, Rect, Size } from './geometry'

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** Free components resize from every side. */
export const FREE_HANDLES: readonly ResizeHandle[] = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
]

/** A flow component's top-left is set by the flow, so it grows right/down. */
export const FLOW_HANDLES: readonly ResizeHandle[] = ['e', 's', 'se']

export const MIN_SIZE: Size = { width: 16, height: 16 }

export interface ResizeInput {
  /** Rectangle at the start of the gesture, relative to the container. */
  start: Rect
  handle: ResizeHandle
  /** Pointer movement since the start. */
  delta: Point
  /** Keep the start width/height ratio (Shift, or always for images). */
  keepRatio: boolean
  /** Container content area; `height: null` means it can grow downward. */
  bounds: Bounds
  /** Siblings to stop at (free components only), or empty. */
  obstacles: readonly Rect[]
  minSize?: Size
}

const hasEast = (h: ResizeHandle) => h.includes('e')
const hasWest = (h: ResizeHandle) => h.includes('w')
const hasSouth = (h: ResizeHandle) => h.includes('s')
const hasNorth = (h: ResizeHandle) => h.includes('n')

/** Rect for the raw pointer movement, before any limit. */
function rawRect(start: Rect, handle: ResizeHandle, delta: Point): Rect {
  const rect = { ...start }
  if (hasEast(handle)) rect.width = start.width + delta.x
  if (hasWest(handle)) {
    rect.x = start.x + delta.x
    rect.width = start.width - delta.x
  }
  if (hasSouth(handle)) rect.height = start.height + delta.y
  if (hasNorth(handle)) {
    rect.y = start.y + delta.y
    rect.height = start.height - delta.y
  }
  return rect
}

/** Sets width/height, keeping the edges opposite the handle in place. */
function withSize(
  start: Rect,
  handle: ResizeHandle,
  width: number,
  height: number,
): Rect {
  return {
    x: hasWest(handle) ? start.x + start.width - width : start.x,
    y: hasNorth(handle) ? start.y + start.height - height : start.y,
    width,
    height,
  }
}

function applyRatio(start: Rect, handle: ResizeHandle, raw: Rect): Rect {
  const ratio = start.width / start.height
  const horizontal = hasEast(handle) || hasWest(handle)
  const vertical = hasNorth(handle) || hasSouth(handle)
  let scale: number
  if (horizontal && vertical) {
    // Corner: follow the axis the pointer moved most along.
    const sx = raw.width / start.width
    const sy = raw.height / start.height
    scale = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy
  } else if (horizontal) {
    scale = raw.width / start.width
  } else {
    scale = raw.height / start.height
  }
  const width = start.width * scale
  return withSize(start, handle, width, width / ratio)
}

/** Largest scale (0..1) of the change from `from` to `to` that stays free. */
function lastFreeStep(from: Rect, to: Rect, obstacles: readonly Rect[]): Rect {
  const at = (t: number): Rect => ({
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  })
  const free = (rect: Rect) => !obstacles.some((o) => rectsCollide(rect, o))
  if (free(to)) return to
  let low = 0
  let high = 1
  for (let i = 0; i < 20; i += 1) {
    const mid = (low + high) / 2
    if (free(at(mid))) low = mid
    else high = mid
  }
  return at(low)
}

/**
 * New rectangle for a resize gesture: follows the pointer, keeps the ratio
 * when asked, never gets smaller than `minSize`, stays inside the container,
 * and stops at the first sibling it would touch.
 */
export function resizeRect(input: ResizeInput): Rect {
  const { start, handle, delta, keepRatio, bounds } = input
  const min = input.minSize ?? MIN_SIZE

  let rect = rawRect(start, handle, delta)
  if (keepRatio) rect = applyRatio(start, handle, rect)

  // Minimum size (the ratio keeps the larger of the two minimums).
  let width = Math.max(rect.width, min.width)
  let height = Math.max(rect.height, min.height)
  if (keepRatio) {
    const ratio = start.width / start.height
    if (width / ratio < min.height) width = min.height * ratio
    height = width / ratio
  }

  // Container edges: the moving edges stop at the container.
  const maxWidth = hasWest(handle)
    ? start.x + start.width
    : bounds.width - start.x
  const maxHeight = hasNorth(handle)
    ? start.y + start.height
    : bounds.height === null
      ? Number.POSITIVE_INFINITY
      : bounds.height - start.y
  if (keepRatio) {
    const ratio = start.width / start.height
    const limit = Math.min(maxWidth, maxHeight * ratio)
    if (width > limit) {
      width = Math.max(limit, min.width)
      height = width / ratio
    }
  } else {
    width = Math.min(width, Math.max(maxWidth, min.width))
    height = Math.min(height, Math.max(maxHeight, min.height))
  }
  rect = withSize(start, handle, width, height)

  // Siblings: ignore any the start rect already touches (e.g. pinned
  // neighbours that sit flush), then stop before the first one hit. Without
  // a ratio, each axis stops on its own, so a blocked side does not freeze
  // the other.
  const obstacles = input.obstacles.filter((o) => !rectsCollide(start, o))
  if (obstacles.length === 0) return rect
  if (keepRatio) return lastFreeStep(start, rect, obstacles)

  const horizontal = lastFreeStep(
    start,
    { ...start, x: rect.x, width: rect.width },
    obstacles,
  )
  return lastFreeStep(
    horizontal,
    { ...horizontal, y: rect.y, height: rect.height },
    obstacles,
  )
}
