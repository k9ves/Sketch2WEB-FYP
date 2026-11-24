// Reads and writes freeform positions stored in `node.layout`.
// Keys: x, y, width (px) for every positioned node, height (px) for containers
// and the website root. Values are strings, as the schema requires.

import type { ComponentNode } from '../../schema/types'
import { isContainerType } from '../../store/tree'

export interface NodeBox {
  x: number
  y: number
  width: number
  height: number | null
}

/** Extra empty space kept below the lowest component on the root canvas. */
export const ROOT_BOTTOM_SPACE = 80

export function readLength(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const length = Number(value)
  return Number.isFinite(length) ? length : null
}

export function readNodeBox(node: ComponentNode): NodeBox | null {
  const x = readLength(node.layout.x)
  const y = readLength(node.layout.y)
  const width = readLength(node.layout.width)
  if (x === null || y === null || width === null) return null

  return { x, y, width, height: readLength(node.layout.height) }
}

/**
 * Size set by resizing (`boxWidth` / `boxHeight`, px), or null per axis when
 * the component sizes itself. Height is a minimum, so content never clips.
 */
export function readNodeSize(node: ComponentNode): {
  width: number | null
  height: number | null
} {
  return {
    width: readLength(node.layout.boxWidth),
    height: readLength(node.layout.boxHeight),
  }
}

export function boxLayout(
  box: Partial<NodeBox> & Pick<NodeBox, 'x' | 'y'>,
): Record<string, string> {
  const layout: Record<string, string> = {
    x: String(Math.round(box.x)),
    y: String(Math.round(box.y)),
  }
  if (box.width !== undefined) layout.width = String(Math.round(box.width))
  if (box.height !== undefined && box.height !== null) {
    layout.height = String(Math.round(box.height))
  }
  return layout
}

/** True when some node still has no stored position (e.g. a fresh sample). */
export function needsMeasuring(website: ComponentNode): boolean {
  if (readLength(website.layout.height) === null) return true

  const visit = (node: ComponentNode): boolean =>
    node.children.some((child) => readNodeBox(child) === null || visit(child))
  return visit(website)
}

/** Root height patch needed so a box ending at `bottom` stays on the canvas. */
export function rootGrowthPatch(
  website: ComponentNode,
  bottom: number,
): Record<string, Record<string, string>> {
  const current = readLength(website.layout.height) ?? 0
  const needed = Math.ceil(bottom + ROOT_BOTTOM_SPACE)
  return needed > current ? { [website.id]: { height: String(needed) } } : {}
}

export function storesHeight(node: ComponentNode): boolean {
  return isContainerType(node.type)
}
