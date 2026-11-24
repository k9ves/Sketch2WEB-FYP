// DOM measurement for the freeform canvas.
// Every canvas node wrapper has `data-sw-node="<id>"`. For containers, the
// wrapper's first element child is the rendered container element; its
// padding box is the coordinate origin for the container's children.

import type { ComponentNode } from '../../schema/types'
import { isContainerType } from '../../store/tree'
import type { Bounds, Point, Rect } from './geometry'
import {
  ROOT_BOTTOM_SPACE,
  boxLayout,
  readLength,
  readNodeBox,
} from './canvasLayout'

export interface ContainerFrame {
  /** Viewport position of the container's coordinate origin. */
  origin: Point
  bounds: Bounds
  /** Siblings and static container content, in container coordinates. */
  obstacles: Rect[]
}

export function nodeElement(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-sw-node="${CSS.escape(id)}"]`,
  )
}

export function containerContentElement(id: string): HTMLElement | null {
  const content = nodeElement(id)?.firstElementChild
  return content instanceof HTMLElement ? content : null
}

function contentOrigin(content: HTMLElement): Point {
  const rect = content.getBoundingClientRect()
  return { x: rect.left + content.clientLeft, y: rect.top + content.clientTop }
}

export function readContainerFrame(
  containerId: string,
  excludeNodeId: string | null,
  growsDownward: boolean,
): ContainerFrame | null {
  const content = containerContentElement(containerId)
  if (!content) return null

  const origin = contentOrigin(content)
  const obstacles: Rect[] = []

  for (const child of Array.from(content.children)) {
    if (!(child instanceof HTMLElement)) continue
    if (excludeNodeId !== null && child.dataset.swNode === excludeNodeId) {
      continue
    }

    const rect = child.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    obstacles.push({
      x: rect.left - origin.x,
      y: rect.top - origin.y,
      width: rect.width,
      height: rect.height,
    })
  }

  return {
    origin,
    bounds: {
      width: content.clientWidth,
      height: growsDownward ? null : content.clientHeight,
    },
    obstacles,
  }
}

/**
 * Measures every node that has no stored position yet, using where the
 * browser currently draws it. Used once to turn flow-layout samples into
 * freeform positions.
 */
export function measureUnpositionedNodes(
  website: ComponentNode,
): Record<string, Record<string, string>> {
  const layouts: Record<string, Record<string, string>> = {}

  const visit = (node: ComponentNode, parent: ComponentNode) => {
    if (readNodeBox(node) === null) {
      const element = nodeElement(node.id)
      const parentContent = containerContentElement(parent.id)
      if (element && parentContent) {
        const origin = contentOrigin(parentContent)
        const rect = element.getBoundingClientRect()
        layouts[node.id] = boxLayout({
          x: rect.left - origin.x,
          y: rect.top - origin.y,
          width: Math.ceil(rect.width),
          height: isContainerType(node.type) ? Math.ceil(rect.height) : null,
        })
      }
    }
    node.children.forEach((child) => visit(child, node))
  }
  website.children.forEach((child) => visit(child, website))

  if (readLength(website.layout.height) === null) {
    const rootContent = containerContentElement(website.id)
    if (rootContent) {
      layouts[website.id] = {
        height: String(Math.ceil(rootContent.scrollHeight) + ROOT_BOTTOM_SPACE),
      }
    }
  }

  return layouts
}

/** Resolves once fonts and canvas images are loaded, so sizes are final. */
export async function waitForCanvasAssets(rootId: string): Promise<void> {
  const root = nodeElement(rootId)
  const images = root ? Array.from(root.querySelectorAll('img')) : []

  await Promise.all([
    document.fonts.ready,
    ...images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve()
            return
          }
          image.addEventListener('load', () => resolve(), { once: true })
          image.addEventListener('error', () => resolve(), { once: true })
        }),
    ),
  ])
}
