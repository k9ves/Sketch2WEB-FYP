// Freeform (Alt) placement, container growth and collision fixes for
// absolutely positioned components. Reads the DOM, never writes the store.

import type { ComponentNode } from '../../schema/types'
import type { FreeformPosition, LayoutPatch } from '../../store/websiteStore'
import { isContainerType } from '../../store/tree'
import { readLength, readNodeBox } from './canvasLayout'
import {
  containerContentElement,
  nodeElement,
  readContainerFrame,
} from './canvasDom'
import type { ContainerFrame } from './canvasDom'
import { findNearestFreePosition, rectsCollide } from './geometry'
import type { Rect } from './geometry'

export interface FreePlan {
  /** Null when the component does not fit anywhere in the container. */
  position: FreeformPosition | null
  /** Viewport rectangle to preview (resolved spot, or the wanted spot). */
  preview: Rect
}

/**
 * Every container grows downward to fit its positioned children (see
 * containPositionedChildren); if that makes it touch a positioned sibling,
 * the collision pass moves the sibling.
 */
const GROWS_DOWNWARD = true

/**
 * Like readContainerFrame, but obstacles are what the user can see. A leaf's
 * wrapper can be stretched far beyond its content (e.g. by a flex row), and
 * that invisible area must stay free for placement.
 */
export function readVisibleFrame(
  containerId: string,
  excludeNodeId: string | null,
):
  | (ContainerFrame & { flowObstacles: Rect[]; earlierObstacles: Rect[] })
  | null {
  const frame = readContainerFrame(containerId, excludeNodeId, GROWS_DOWNWARD)
  const content = containerContentElement(containerId)
  if (!frame) return null
  if (!content) return { ...frame, flowObstacles: [], earlierObstacles: [] }

  const obstacles: Rect[] = []
  // Children still in flow; they always take the top of the container.
  const flowObstacles: Rect[] = []
  // Siblings that come before the excluded node in flow order.
  const earlierObstacles: Rect[] = []
  let beforeExcluded = true
  for (const child of Array.from(content.children)) {
    if (!(child instanceof HTMLElement)) continue
    if (excludeNodeId !== null && child.dataset.swNode === excludeNodeId) {
      beforeExcluded = false
      continue
    }

    const visible =
      child.classList.contains('is-leaf') &&
      child.firstElementChild instanceof HTMLElement
        ? child.firstElementChild
        : child
    const rect = visible.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    const obstacle = {
      x: rect.left - frame.origin.x,
      y: rect.top - frame.origin.y,
      width: rect.width,
      height: rect.height,
    }
    obstacles.push(obstacle)
    if (child.dataset.swPositioned !== 'true') flowObstacles.push(obstacle)
    if (excludeNodeId !== null && beforeExcluded)
      earlierObstacles.push(obstacle)
  }

  return { ...frame, obstacles, flowObstacles, earlierObstacles }
}

/**
 * Layout that pins the container's flow children (except `excludeNodeId`)
 * exactly where they are drawn now. Used when a component leaves the flow,
 * so its old neighbours do not shift into the gap.
 */
export function freezeFlowSiblings(
  containerId: string,
  excludeNodeId: string,
): LayoutPatch {
  const frame = readContainerFrame(containerId, null, GROWS_DOWNWARD)
  const content = containerContentElement(containerId)
  if (!frame || !content) return {}

  const patch: LayoutPatch = {}
  for (const child of Array.from(content.children)) {
    if (!(child instanceof HTMLElement)) continue
    const id = child.dataset.swNode
    if (id === undefined || id === excludeNodeId) continue
    if (child.dataset.swPositioned === 'true') continue

    // Exact (sub-pixel) values, so nothing shifts even by a pixel.
    const rect = child.getBoundingClientRect()
    const x = px(rect.left - frame.origin.x)
    const y = px(rect.top - frame.origin.y)
    patch[id] = {
      x,
      y,
      width: String(Math.ceil(rect.width)),
      // Where it was pinned. Pushes are always worked out from here, so the
      // result depends only on the current layout, never on history.
      pinX: x,
      pinY: y,
      // Marks a neighbour pinned automatically (not placed by the user), so
      // "Return to flow" can bring it back together with the moved node.
      pinned: 'true',
    }
  }

  // Keep the container's current height too, so what follows it stays put.
  patch[containerId] = { height: px(content.getBoundingClientRect().height) }
  return patch
}

function px(value: number): string {
  return String(Math.round(value * 100) / 100)
}

/** Plans an Alt-drop of a box currently drawn at `dragRect` (viewport). */
export function planFreeDrop(
  containerId: string,
  dragRect: Rect,
  excludeNodeId: string | null,
): FreePlan | null {
  const frame = readVisibleFrame(containerId, excludeNodeId)
  if (!frame) return null

  // Round width up so text does not wrap differently after the drop.
  const width = Math.min(
    Math.ceil(dragRect.width),
    Math.floor(frame.bounds.width),
  )
  const position = findNearestFreePosition(
    { width, height: dragRect.height },
    { x: dragRect.x - frame.origin.x, y: dragRect.y - frame.origin.y },
    frame.obstacles,
    frame.bounds,
  )

  if (!position) return { position: null, preview: dragRect }
  return {
    position: { ...position, width },
    preview: {
      x: frame.origin.x + position.x,
      y: frame.origin.y + position.y,
      width,
      height: dragRect.height,
    },
  }
}

/**
 * Absolutely positioned children take no space in the flow, so each
 * container (deepest first) gets a min-height that keeps them inside it.
 * A stored `layout.height` (data-sw-min-height) is kept as a minimum too.
 * Wrappers use `align-self: start`, so this extra height never stretches
 * flow siblings (which would feed back into collisions).
 */
export function containPositionedChildren(root: HTMLElement): void {
  const frames = Array.from(
    root.querySelectorAll<HTMLElement>(
      '.sw-node.is-container, .sw-canvas-root',
    ),
  )
  if (root.matches('.sw-node.is-container, .sw-canvas-root'))
    frames.unshift(root)

  for (const frame of frames.reverse()) {
    const content = frame.firstElementChild
    if (!(content instanceof HTMLElement)) continue

    content.style.minHeight = ''
    const isWrapper = frame.classList.contains('sw-node')
    if (isWrapper) frame.style.minWidth = ''
    const storedHeight = Number(frame.dataset.swMinHeight) || 0
    const positioned = Array.from(content.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.dataset.swPositioned === 'true',
    )
    if (positioned.length === 0 && storedHeight === 0) continue

    const style = getComputedStyle(content)
    // Positioned children add nothing to the container's own width, so a
    // container that sizes to its content (e.g. in a hero column) would
    // collapse. Keep it as wide as they reach, but never wider than its
    // parent.
    if (isWrapper && positioned.length > 0) {
      // Use the stored extent, not the drawn one: a child capped at 100% would
      // shrink with the container and the two would collapse together.
      const right =
        Math.max(
          ...positioned.map(
            (child) =>
              Number(child.dataset.swRight) ||
              child.offsetLeft + child.offsetWidth,
          ),
        ) +
        parseFloat(style.borderLeftWidth) +
        parseFloat(style.borderRightWidth)
      frame.style.minWidth = `min(${Math.ceil(right)}px, 100%)`
    }
    const bottom =
      positioned.length === 0
        ? 0
        : Math.max(
            ...positioned.map((child) => child.offsetTop + child.offsetHeight),
          ) +
          // Padding counts as free space: grow only past the visible edge.
          parseFloat(style.borderTopWidth) +
          parseFloat(style.borderBottomWidth)
    const required = Math.max(bottom, storedHeight)
    const cssMinHeight = parseFloat(style.minHeight) || 0
    if (required > cssMinHeight) {
      content.style.minHeight = `${required}px`
    }
  }
}

/**
 * Finds positioned components that overlap a sibling or left their
 * container (e.g. after text grew or a duplicate landed on its original) and
 * moves each to the nearest free spot. Returns the layout changes to store.
 */
export function collectCollisionFixes(website: ComponentNode): LayoutPatch {
  return findCollisionFixes(website)
}

/** True when the rectangles really overlap (touching is fine). */
function overlaps(a: Rect, b: Rect): boolean {
  const e = 0.5
  return (
    a.x < b.x + b.width - e &&
    b.x < a.x + a.width - e &&
    a.y < b.y + b.height - e &&
    b.y < a.y + a.height - e
  )
}

/**
 * New top for `rect` below every obstacle it overlaps, or null when it
 * overlaps nothing. Repeats because moving down can reach another obstacle.
 */
function pushedDown(rect: Rect, obstacles: readonly Rect[]): number | null {
  let y = rect.y
  for (let i = 0; i <= obstacles.length; i += 1) {
    const hits = obstacles.filter((o) => overlaps({ ...rect, y }, o))
    if (hits.length === 0)
      return y === rect.y ? null : Math.round(y * 100) / 100
    y = Math.max(...hits.map((o) => o.y + o.height))
  }
  return Math.round(y * 100) / 100
}

function findCollisionFixes(website: ComponentNode): LayoutPatch {
  const patch: LayoutPatch = {}

  const visit = (container: ComponentNode) => {
    // Later siblings (e.g. a fresh duplicate) move; earlier ones stay put.
    for (const child of [...container.children].reverse()) {
      const box = readNodeBox(child)
      const element = nodeElement(child.id)
      if (!box || !element) continue

      const frame = readVisibleFrame(container.id, child.id)
      if (!frame) continue

      const rect = element.getBoundingClientRect()
      const current: Rect = {
        x: rect.left - frame.origin.x,
        y: rect.top - frame.origin.y,
        width: rect.width,
        height: rect.height,
      }

      // A pinned neighbour keeps its flow spot; flow had no gap rule, so it
      // only reacts to a real overlap (e.g. the component above it grew) and
      // then moves straight down, as flow layout would push it.
      if (child.layout.pinned === 'true') {
        // Start from where it was pinned (it goes back up when the space
        // above frees again, as in flow).
        const home = {
          ...current,
          x: readLength(child.layout.pinX) ?? box.x,
          y: readLength(child.layout.pinY) ?? box.y,
        }
        // A narrower container pulls it back inside, like flow would.
        const maxX = Math.max(0, frame.bounds.width - current.width)
        const x = Math.round(Math.min(Math.max(home.x, 0), maxX) * 100) / 100
        // Pushed only by what comes before it in flow: content still in
        // flow, earlier siblings, or anything starting above it. It never
        // jumps over a component that was below it.
        const pushers = frame.obstacles.filter(
          (o) =>
            o.y < home.y - 0.5 ||
            frame.flowObstacles.includes(o) ||
            frame.earlierObstacles.includes(o),
        )
        const y = pushedDown({ ...home, x }, pushers) ?? home.y
        if (Math.abs(x - current.x) < 0.5 && Math.abs(y - current.y) < 0.5) {
          continue
        }
        patch[child.id] = { x: String(x), y: String(y) }
        element.style.left = `${x}px`
        element.style.top = `${y}px`
        continue
      }
      const outside =
        current.x < -0.5 ||
        current.y < -0.5 ||
        current.x + current.width > frame.bounds.width + 0.5 ||
        (frame.bounds.height !== null &&
          current.y + current.height > frame.bounds.height + 0.5)
      const colliding = frame.obstacles.some((obstacle) =>
        rectsCollide(current, obstacle),
      )
      if (!outside && !colliding) continue

      const next = findNearestFreePosition(
        { width: current.width, height: current.height },
        current,
        frame.obstacles,
        frame.bounds,
      )
      if (!next || (next.x === box.x && next.y === box.y)) continue

      patch[child.id] = { x: String(next.x), y: String(next.y) }
      // Move it now so later siblings see the corrected spot.
      element.style.left = `${next.x}px`
      element.style.top = `${next.y}px`
    }

    container.children
      .filter((child) => isContainerType(child.type))
      .forEach(visit)
  }

  visit(website)
  return patch
}
