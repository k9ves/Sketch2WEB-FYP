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
 * A JSX attribute. JSX string attributes have no backslash escapes and
 * decode HTML entities (`&amp;` would become `&`), so a value with a quote,
 * backslash or `&` is written as a JS expression instead.
 */
function jsxAttribute(name: string, value: string): string {
  return /["\\&]/.test(value)
    ? `${name}={${JSON.stringify(value)}}`
    : `${name}="${value}"`
}

/**
 * What the generator writes for one node, before it becomes JSX text. The
 * code-to-canvas sync (syncCode.ts) reads edited code back with the same
 * spec, so both directions follow one set of rules.
 */
export interface ElementSpec {
  tag: string
  /** Classes the generator always writes (type and layout flags). */
  baseClasses: string[]
  /** Style slot that holds the user's classes (Properties panel tokens). */
  slot: string
  /** Attributes after className and style, e.g. href or alt. */
  attributes: { name: string; value: string }[]
  /** Layout style of hero and columns. */
  style: CSSProperties | null
  /** Unescaped text of leaf elements; null for containers and images. */
  text: string | null
}

function splitClasses(value: string | undefined): string[] {
  return (value ?? '').split(/\s+/).filter(Boolean)
}

/** Base classes, then the slot's classes; each class written once. */
export function specClasses(spec: ElementSpec, node: ComponentNode): string[] {
  return [
    ...new Set([...spec.baseClasses, ...splitClasses(node.style[spec.slot])]),
  ]
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

export const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

function headingTag(level: string | undefined): string {
  return headingTags[Number(level) - 1] ?? 'h2'
}

function spec(
  tag: string,
  baseClasses: string,
  slot: string,
  extra: Partial<Pick<ElementSpec, 'attributes' | 'style' | 'text'>> = {},
): ElementSpec {
  return {
    tag,
    baseClasses: splitClasses(baseClasses),
    slot,
    attributes: extra.attributes ?? [],
    style: extra.style ?? null,
    text: extra.text ?? null,
  }
}

export function elementSpec(node: ComponentNode): ElementSpec {
  const text = node.content.text ?? ''

  switch (node.type) {
    case 'website':
      return spec('div', 'sw-website', 'background')
    case 'navbar':
      return spec('nav', 'sw-navbar', 'container', {
        attributes: [{ name: 'aria-label', value: 'Main navigation' }],
      })
    case 'hero':
      return spec(
        'header',
        isColumnFlow(node.layout, heroLayoutDefaults)
          ? 'sw-hero is-column'
          : 'sw-hero',
        'container',
        { style: layoutStyle(node.layout, heroLayoutDefaults) },
      )
    case 'section':
      return spec('section', 'sw-section', 'container')
    case 'columns':
      return spec(
        'div',
        [
          'sw-columns',
          node.layout.display === 'flex' ? 'is-flex' : '',
          isColumnFlow(node.layout, columnsLayoutDefaults) ? 'is-column' : '',
        ].join(' '),
        'container',
        { style: layoutStyle(node.layout, columnsLayoutDefaults) },
      )
    case 'card':
      return spec('article', 'sw-card', 'container')
    case 'footer':
      return spec('footer', 'sw-footer', 'container')
    case 'heading':
      return spec(headingTag(node.content.level), 'sw-heading', 'text', {
        text,
      })
    case 'text':
      return spec('p', 'sw-text', 'text', { text })
    case 'button':
      // Unsafe or missing links fall back to "#" so the export never
      // contains a javascript: URL.
      return spec('a', 'sw-button', 'button', {
        attributes: [
          {
            name: 'href',
            value: (node.content.href && safeHref(node.content.href)) || '#',
          },
        ],
        text,
      })
    case 'image': {
      // A missing or unsafe source is left out: src="" makes the browser
      // download the page again, and React blocks javascript: URLs.
      const src = imageSrc(node.content.src)
      return spec('img', 'sw-image', 'image', {
        attributes: [
          ...(src ? [{ name: 'src', value: src }] : []),
          { name: 'alt', value: node.content.alt ?? '' },
        ],
      })
    }
  }
}

export function describeElement(node: ComponentNode): JsxElement {
  const element = elementSpec(node)
  return {
    tag: element.tag,
    attributes: [
      jsxAttribute('className', specClasses(element, node).join(' ')),
      ...(element.style ? [styleAttribute(element.style)] : []),
      ...element.attributes.map(({ name, value }) => jsxAttribute(name, value)),
    ],
    text: element.text === null ? null : escapeJsxText(element.text),
  }
}

/** A safe image source: a normal link or an embedded `data:image/` URL. */
export function imageSrc(value: string | undefined): string | undefined {
  const src = value?.trim()
  if (!src) return undefined
  return /^data:image\//i.test(src) ? src : safeHref(src)
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
