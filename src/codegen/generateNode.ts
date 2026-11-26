import type { CSSProperties } from 'react'
import type { ComponentNode } from '../schema/types'
import {
  columnsLayoutDefaults,
  heroLayoutDefaults,
  isColumnFlow,
  layoutStyle,
} from '../renderer/layout'
import { safeHref } from '../renderer/safeHref'

// Describes a single component node as a JSX element. Tags, class names and
// layout styles match the canvas (see renderer/Renderer.tsx), so the
// generated code looks the same.

export interface JsxElement {
  tag: string
  attributes: string[]
  /** Escaped text content of leaf elements; null for containers and images. */
  text: string | null
}

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
  // Samples often repeat the base class in the style slot; write it once.
  const classes = `${base} ${node.style[slot] ?? ''}`.split(/\s+/)
  return jsxAttribute(
    'className',
    [...new Set(classes)].filter(Boolean).join(' '),
  )
}

/**
 * Writes a style object as `style={{ ... }}`. CSS variables (`--sw-align`,
 * `--sw-justify`) are kept for website.css; the exported `css-vars.d.ts`
 * lets React's CSSProperties type accept them.
 */
function styleAttribute(style: CSSProperties): string {
  const entries = Object.entries(style)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const name = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)
      const literal =
        typeof value === 'number'
          ? String(value)
          : JSON.stringify(String(value))
      return `${name}: ${literal}`
    })
  return `style={{ ${entries.join(', ')} }}`
}

const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

function headingTag(level: string | undefined): string {
  return headingTags[Number(level) - 1] ?? 'h2'
}

function container(
  node: ComponentNode,
  tag: string,
  base: string,
  extra: string[] = [],
): JsxElement {
  return {
    tag,
    attributes: [classNameAttribute(node, 'container', base), ...extra],
    text: null,
  }
}

export function describeElement(node: ComponentNode): JsxElement {
  const text = escapeJsxText(node.content.text ?? '')

  switch (node.type) {
    case 'website':
      return {
        tag: 'div',
        attributes: [classNameAttribute(node, 'background', 'sw-website')],
        text: null,
      }
    case 'navbar':
      return container(node, 'nav', 'sw-navbar', [
        jsxAttribute('aria-label', 'Main navigation'),
      ])
    case 'hero':
      return container(
        node,
        'header',
        isColumnFlow(node.layout, heroLayoutDefaults)
          ? 'sw-hero is-column'
          : 'sw-hero',
        [styleAttribute(layoutStyle(node.layout, heroLayoutDefaults))],
      )
    case 'section':
      return container(node, 'section', 'sw-section')
    case 'columns': {
      const base = [
        'sw-columns',
        node.layout.display === 'flex' ? 'is-flex' : '',
        isColumnFlow(node.layout, columnsLayoutDefaults) ? 'is-column' : '',
      ]
        .filter(Boolean)
        .join(' ')
      return container(node, 'div', base, [
        styleAttribute(layoutStyle(node.layout, columnsLayoutDefaults)),
      ])
    }
    case 'card':
      return container(node, 'article', 'sw-card')
    case 'footer':
      return container(node, 'footer', 'sw-footer')
    case 'heading':
      return {
        tag: headingTag(node.content.level),
        attributes: [classNameAttribute(node, 'text', 'sw-heading')],
        text,
      }
    case 'text':
      return {
        tag: 'p',
        attributes: [classNameAttribute(node, 'text', 'sw-text')],
        text,
      }
    case 'button': {
      // Unsafe or missing links fall back to "#" so the export never
      // contains a javascript: URL.
      const href = (node.content.href && safeHref(node.content.href)) || '#'
      return {
        tag: 'a',
        attributes: [
          classNameAttribute(node, 'button', 'sw-button'),
          jsxAttribute('href', href),
        ],
        text,
      }
    }
    case 'image':
      return {
        tag: 'img',
        attributes: [
          classNameAttribute(node, 'image', 'sw-image'),
          jsxAttribute('src', node.content.src ?? ''),
          jsxAttribute('alt', node.content.alt ?? ''),
        ],
        text: null,
      }
  }
}

export function openTag(element: JsxElement, selfClosing = false): string {
  const attributes = element.attributes.map((entry) => ` ${entry}`).join('')
  return `<${element.tag}${attributes}${selfClosing ? ' />' : '>'}`
}

/** Generates JSX for one node, without its children, on a single line. */
export function generateNodeJsx(node: ComponentNode): string {
  const element = describeElement(node)
  if (element.text === null) return openTag(element, true)
  return `${openTag(element)}${element.text}</${element.tag}>`
}
