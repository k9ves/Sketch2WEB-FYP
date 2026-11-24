// Pure geometry for the freeform canvas. No React, no DOM.

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Rect extends Point, Size {}

/** Drop area of a container. `height: null` means it can grow downward. */
export interface Bounds {
  width: number
  height: number | null
}

/** Minimum empty space between two sibling components. */
export const COMPONENT_GAP = 8

/** True when the rectangles overlap or are closer than `gap`. */
export function rectsCollide(a: Rect, b: Rect, gap = COMPONENT_GAP): boolean {
  return (
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  )
}

/**
 * Finds the free top-left position closest to `desired` where a box of `size`
 * fits inside `bounds` without colliding with any obstacle.
 *
 * The closest free point always lies on the desired coordinate or on an edge
 * of an obstacle or the bounds, so only those candidates are checked.
 * Returns null when no valid position exists.
 */
export function findNearestFreePosition(
  size: Size,
  desired: Point,
  obstacles: readonly Rect[],
  bounds: Bounds,
  gap = COMPONENT_GAP,
): Point | null {
  if (size.width > bounds.width) return null
  if (bounds.height !== null && size.height > bounds.height) return null

  const maxX = Math.floor(bounds.width - size.width)
  const maxY =
    bounds.height === null
      ? Number.POSITIVE_INFINITY
      : Math.floor(bounds.height - size.height)
  const target = {
    x: Math.min(maxX, Math.max(0, Math.round(desired.x))),
    y: Math.min(maxY, Math.max(0, Math.round(desired.y))),
  }

  const xs = new Set<number>([target.x, 0, maxX])
  const ys = new Set<number>([target.y, 0])
  if (Number.isFinite(maxY)) ys.add(maxY)

  for (const obstacle of obstacles) {
    xs.add(Math.ceil(obstacle.x + obstacle.width + gap))
    xs.add(Math.floor(obstacle.x - gap - size.width))
    ys.add(Math.ceil(obstacle.y + obstacle.height + gap))
    ys.add(Math.floor(obstacle.y - gap - size.height))
  }

  let best: Point | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const x of xs) {
    if (x < 0 || x > maxX) continue
    for (const y of ys) {
      if (y < 0 || y > maxY) continue

      const distance = (x - target.x) ** 2 + (y - target.y) ** 2
      if (distance >= bestDistance) continue

      const candidate = { x, y, ...size }
      if (obstacles.some((obstacle) => rectsCollide(candidate, obstacle, gap)))
        continue

      best = { x, y }
      bestDistance = distance
    }
  }

  return best
}
