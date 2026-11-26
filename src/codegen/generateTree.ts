import type { ComponentNode } from '../schema/types'
import { describeElement, generateNodeJsx, openTag } from './generateNode'

const INDENT = '  '

function treeLines(node: ComponentNode, depth: number): string[] {
  const pad = INDENT.repeat(depth)
  const element = describeElement(node)

  // Leaves (and containers without children) fit on one line.
  if (element.text !== null || node.children.length === 0) {
    return [pad + generateNodeJsx(node)]
  }

  return [
    pad + openTag(element),
    ...node.children.flatMap((child) => treeLines(child, depth + 1)),
    `${pad}</${element.tag}>`,
  ]
}

/** Generates indented JSX for a node and all of its children. */
export function generateTreeJsx(node: ComponentNode, depth = 0): string {
  return treeLines(node, depth).join('\n')
}
