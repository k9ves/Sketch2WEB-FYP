import type { ComponentNode } from '../schema/types'
import { safeHref } from '../renderer/safeHref'

// Turns a single component node into a JSX string. Class names match the
// canvas (see renderer/Renderer.tsx), so the generated code looks the same.

/** Characters that would break JSX text or end the element early. */
const jsxTextEscapes: Record<string, string> = {
  '{': '&#123;',
  '}': '&#125;',
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
}

function escapeJsxText(value: string): string {
  return value.replace(/[{}<>&]/g, (char) => jsxTextEscapes[char] ?? char)
}

/**
 * A JSX attribute. JSX string attributes have no backslash escapes, so a
 * value with a quote or backslash is written as a JS expression instead.
 */
function jsxAttribute(name: string, value: string): string {
  return /["\\]/.test(value)
    ? `${name}={${JSON.stringify(value)}}`
    : `${name}="${value}"`
}

function classNameAttribute(
  node: ComponentNode,
  slot: string,
  base: string,
): string {
  const classes = [base, node.style[slot]].filter(Boolean).join(' ')
  return jsxAttribute('className', classes)
}

const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

function headingTag(level: string | undefined): string {
  return headingTags[Number(level) - 1] ?? 'h2'
}

/**
 * Generates JSX for one heading, text or button node. Other types return
 * a JSX comment for now; containers are handled by the tree generator.
 */
export function generateNodeJsx(node: ComponentNode): string {
  const text = escapeJsxText(node.content.text ?? '')

  switch (node.type) {
    case 'heading': {
      const tag = headingTag(node.content.level)
      return `<${tag} ${classNameAttribute(node, 'text', 'sw-heading')}>${text}</${tag}>`
    }
    case 'text':
      return `<p ${classNameAttribute(node, 'text', 'sw-text')}>${text}</p>`
    case 'button': {
      // Unsafe or missing links fall back to "#" so the export never
      // contains a javascript: URL.
      const href = (node.content.href && safeHref(node.content.href)) || '#'
      return `<a ${classNameAttribute(node, 'button', 'sw-button')} ${jsxAttribute('href', href)}>${text}</a>`
    }
    default:
      return `{/* ${node.type} is not supported yet */}`
  }
}
