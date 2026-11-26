import { isComponentType, type ComponentNode } from '../schema/types'
import { describeElement, generateNodeJsx, openTag } from './generateNode'

const INDENT = '  '

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  )
}

/**
 * Checks one node's own fields, not its children (those are checked when
 * they are generated), so one broken grandchild does not drop a section.
 */
function isGeneratableNode(value: unknown): value is ComponentNode {
  if (typeof value !== 'object' || value === null) return false
  const node = value as Record<string, unknown>
  return (
    typeof node.id === 'string' &&
    isComponentType(node.type) &&
    isStringRecord(node.content) &&
    isStringRecord(node.layout) &&
    isStringRecord(node.style) &&
    Array.isArray(node.children)
  )
}

/**
 * Children that can be turned into code. Broken nodes (unknown type,
 * missing fields) are skipped, like the canvas shows a warning instead.
 */
export function generatableChildren(node: ComponentNode): ComponentNode[] {
  return (node.children as unknown[]).filter(isGeneratableNode)
}

function treeLines(node: ComponentNode, depth: number): string[] {
  const pad = INDENT.repeat(depth)
  const element = describeElement(node)
  const children = generatableChildren(node)

  // Leaves (and containers without children) fit on one line.
  if (element.text !== null || children.length === 0) {
    return [pad + generateNodeJsx(node)]
  }

  return [
    pad + openTag(element),
    ...children.flatMap((child) => treeLines(child, depth + 1)),
    `${pad}</${element.tag}>`,
  ]
}

/** Generates indented JSX for a node and all of its children. */
export function generateTreeJsx(node: ComponentNode, depth = 0): string {
  return treeLines(node, depth).join('\n')
}
