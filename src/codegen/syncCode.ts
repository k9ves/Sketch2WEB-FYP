import type { CSSProperties } from 'react'
import { safeHref } from '../renderer/safeHref'
import type { ComponentNode, WebsiteDocument } from '../schema/types'
import { styleGroups, styleGroupsBySlot } from '../editor/styleTokens'
import { componentNames } from './componentNames'
import { formatTsx } from './formatCode'
import { elementSpec, headingTags, imageSrc, specClasses } from './generateNode'
import { generatableChildren } from './generateTree'
import {
  cleanJsxText,
  parseComponentFile,
  type JsxAttribute,
  type JsxElementNode,
  type ParsedComponentFile,
  type SourceIssue,
} from './parseJsx'

// Reads an edited code file back into component tree updates (T57b). Only
// edits the canvas can show are accepted: text, style tokens, links, image
// source/alt and heading level. Anything else is reported with its line.

export interface NodeUpdate {
  id: string
  content?: Record<string, string>
  style?: Record<string, string>
}

export type SyncResult =
  /** The file matches the tree; `updates` may be empty. */
  | { status: 'synced'; updates: NodeUpdate[] }
  /** Not valid code yet (e.g. still typing). */
  | { status: 'syntax-error'; issue: SourceIssue }
  /** Valid code, but the canvas cannot show it. */
  | { status: 'unsupported'; issue: SourceIssue }
  /** Not a file built from the canvas (package.json, CSS, ...). */
  | { status: 'not-canvas-file' }

class Unsupported extends Error {
  readonly line: number

  constructor(message: string, line: number) {
    super(message)
    this.line = line
  }
}

/** Every tag the generator writes (see elementSpec). */
const canvasTags: ReadonlySet<string> = new Set([
  'div',
  'nav',
  'header',
  'section',
  'article',
  'footer',
  'p',
  'a',
  'img',
  ...headingTags,
])

const APP_PATH = 'src/App.tsx'
const COMPONENT_PREFIX = 'src/components/'

/** Tokens the Properties panel offers for a style slot. */
function slotTokens(slot: string): ReadonlySet<string> {
  const groups = styleGroupsBySlot[slot] ?? []
  return new Set(
    groups.flatMap((group) =>
      styleGroups[group].tokens.map((entry) => entry.token),
    ),
  )
}

function splitClasses(value: string): string[] {
  return value.split(/\s+/).filter(Boolean)
}

function sameClasses(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index])
}

function styleEntries(style: CSSProperties | null): Record<string, string> {
  return Object.fromEntries(
    Object.entries(style ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  )
}

function sameEntries(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => a[key] === b[key])
  )
}

class UpdateCollector {
  private readonly byId = new Map<string, NodeUpdate>()

  content(id: string, key: string, value: string): void {
    const update = this.entry(id)
    update.content = { ...update.content, [key]: value }
  }

  style(id: string, slot: string, value: string): void {
    const update = this.entry(id)
    update.style = { ...update.style, [slot]: value }
  }

  list(): NodeUpdate[] {
    return [...this.byId.values()]
  }

  private entry(id: string): NodeUpdate {
    const existing = this.byId.get(id)
    if (existing) return existing
    const created: NodeUpdate = { id }
    this.byId.set(id, created)
    return created
  }
}

function stringValue(attribute: JsxAttribute): string {
  if (attribute.value.kind === 'string') return attribute.value.value
  if (attribute.value.kind === 'expression') {
    throw new Unsupported(
      `JavaScript in ${attribute.name}={...} is not supported yet; use plain text.`,
      attribute.line,
    )
  }
  throw new Unsupported(
    `${attribute.name} needs a plain text value.`,
    attribute.line,
  )
}

function compareClassName(
  attribute: JsxAttribute | undefined,
  element: JsxElementNode,
  node: ComponentNode,
  updates: UpdateCollector,
): void {
  const spec = elementSpec(node)
  if (!attribute) {
    throw new Unsupported(
      `Keep className on <${element.tag}>; it gives the component its look.`,
      element.line,
    )
  }
  const classes = [...new Set(splitClasses(stringValue(attribute)))]
  const generated = specClasses(spec, node)
  if (sameClasses(classes, generated)) return

  for (const base of spec.baseClasses) {
    if (!classes.includes(base)) {
      throw new Unsupported(
        `Keep the class "${base}"; it comes from the component type or its layout.`,
        attribute.line,
      )
    }
  }
  const current = new Set(generated)
  const allowed = slotTokens(spec.slot)
  const slotClasses = classes.filter(
    (entry) => !spec.baseClasses.includes(entry),
  )
  for (const entry of slotClasses) {
    if (!current.has(entry) && !allowed.has(entry)) {
      throw new Unsupported(
        `The class "${entry}" is not available for this component on the canvas yet (Properties panel styles only).`,
        attribute.line,
      )
    }
  }
  updates.style(node.id, spec.slot, slotClasses.join(' '))
}

function compareAttributes(
  element: JsxElementNode,
  node: ComponentNode,
  updates: UpdateCollector,
): void {
  const spec = elementSpec(node)
  const byName = new Map(element.attributes.map((entry) => [entry.name, entry]))
  const expected = new Map(spec.attributes.map((entry) => [entry.name, entry]))

  for (const attribute of element.attributes) {
    const known =
      attribute.name === 'className' ||
      attribute.name === 'style' ||
      expected.has(attribute.name) ||
      (node.type === 'image' && attribute.name === 'src')
    if (!known) {
      throw new Unsupported(
        `The attribute "${attribute.name}" on <${element.tag}> is not supported yet.`,
        attribute.line,
      )
    }
  }

  compareClassName(byName.get('className'), element, node, updates)

  const style = byName.get('style')
  if (style || spec.style) {
    const written =
      style?.value.kind === 'object' ? style.value.entries : undefined
    if (!written || !sameEntries(written, styleEntries(spec.style))) {
      throw new Unsupported(
        'Layout styles cannot be edited in code yet; use the Layout controls in the Properties panel.',
        style?.line ?? element.line,
      )
    }
  }

  switch (node.type) {
    case 'navbar': {
      const label = byName.get('aria-label')
      if (!label || stringValue(label) !== 'Main navigation') {
        throw new Unsupported(
          'Keep aria-label="Main navigation" on the navbar.',
          label?.line ?? element.line,
        )
      }
      return
    }
    case 'button': {
      const href = byName.get('href')
      if (!href) {
        throw new Unsupported('Keep the href of the link.', element.line)
      }
      const value = stringValue(href).trim()
      if (value === expected.get('href')?.value) return
      if (!safeHref(value)) {
        throw new Unsupported(`The link "${value}" is not allowed.`, href.line)
      }
      updates.content(node.id, 'href', value)
      return
    }
    case 'image': {
      const src = byName.get('src')
      const value = src ? stringValue(src).trim() : ''
      if (value !== (expected.get('src')?.value ?? '')) {
        if (value && !imageSrc(value)) {
          throw new Unsupported(
            `The image source "${value}" is not allowed.`,
            src?.line ?? element.line,
          )
        }
        updates.content(node.id, 'src', value)
      }
      const alt = byName.get('alt')
      if (!alt) {
        throw new Unsupported('Keep the alt text of the image.', element.line)
      }
      const altValue = stringValue(alt)
      if (altValue !== (node.content.alt ?? '')) {
        updates.content(node.id, 'alt', altValue)
      }
      return
    }
    default:
      return
  }
}

function compareTag(element: JsxElementNode, node: ComponentNode): string {
  const spec = elementSpec(node)
  if (element.tag === spec.tag) return spec.tag
  const headingIndex = (headingTags as readonly string[]).indexOf(element.tag)
  if (node.type === 'heading' && headingIndex !== -1) return element.tag
  throw new Unsupported(
    `Changing <${spec.tag}> to <${element.tag}> is not supported yet.`,
    element.line,
  )
}

function compareLeafText(
  element: JsxElementNode,
  node: ComponentNode,
  updates: UpdateCollector,
): void {
  let text = ''
  for (const child of element.children) {
    if (child.kind === 'element') {
      throw new Unsupported(
        `Tags inside text (like <${child.tag}>) are not supported yet.`,
        child.line,
      )
    }
    if (child.kind === 'expression') {
      throw new Unsupported(
        `JavaScript in text (${child.raw}) is not supported yet.`,
        child.line,
      )
    }
    text += child.value
  }
  // Stored text is compared the way JSX shows it, so formatting alone
  // (line breaks, extra spaces) is not a change.
  const stored = node.content.text ?? ''
  if (text !== cleanJsxText(stored)) updates.content(node.id, 'text', text)
}

function compareElement(
  element: JsxElementNode,
  node: ComponentNode,
  updates: UpdateCollector,
): void {
  const tag = compareTag(element, node)
  if (node.type === 'heading' && tag !== elementSpec(node).tag) {
    updates.content(
      node.id,
      'level',
      String((headingTags as readonly string[]).indexOf(tag) + 1),
    )
  }
  compareAttributes(element, node, updates)

  if (elementSpec(node).text !== null) {
    compareLeafText(element, node, updates)
    return
  }

  const childElements: JsxElementNode[] = []
  for (const child of element.children) {
    if (child.kind === 'text') {
      throw new Unsupported(
        `Text directly inside <${element.tag}> is not supported yet; use a Text component on the canvas.`,
        child.line,
      )
    }
    if (child.kind === 'expression') {
      throw new Unsupported(
        `JavaScript inside <${element.tag}> (${child.raw}) is not supported yet.`,
        child.line,
      )
    }
    childElements.push(child)
  }

  for (const child of childElements) {
    if (!canvasTags.has(child.tag)) {
      throw new Unsupported(
        `<${child.tag}> is not a canvas component yet.`,
        child.line,
      )
    }
  }
  if (node.type === 'image' && childElements.length > 0) {
    throw new Unsupported('An image cannot have children.', element.line)
  }
  const nodes = generatableChildren(node)
  if (childElements.length !== nodes.length) {
    throw new Unsupported(
      'Adding or removing elements in code is not supported yet; use the canvas.',
      (childElements[nodes.length] ?? element).line,
    )
  }
  childElements.forEach((child, index) => {
    const childNode = nodes[index]
    if (childNode) compareElement(child, childNode, updates)
  })
}

function compareComponentFile(
  file: ParsedComponentFile,
  name: string,
  node: ComponentNode,
): NodeUpdate[] {
  const firstImport = file.imports[0]
  if (firstImport) {
    throw new Unsupported(
      'Imports in component files are not supported yet.',
      firstImport.line,
    )
  }
  if (file.name !== name) {
    throw new Unsupported(
      `Keep the component name ${name}; the file name follows the section heading.`,
      1,
    )
  }
  const updates = new UpdateCollector()
  compareElement(file.root, node, updates)
  return updates.list()
}

function compareAppFile(
  file: ParsedComponentFile,
  website: WebsiteDocument,
  names: readonly string[],
): NodeUpdate[] {
  const expectedImports = [
    './App.css',
    ...names.map((name) => `${name} ./components/${name}`),
  ]
  const written = file.imports.map((entry) =>
    entry.name ? `${entry.name} ${entry.from}` : entry.from,
  )
  if (!sameClasses(written, expectedImports)) {
    throw new Unsupported(
      'Changing imports in App.tsx is not supported yet.',
      file.imports[0]?.line ?? 1,
    )
  }
  if (file.name !== 'App') {
    throw new Unsupported('Keep the component name App.', 1)
  }

  const updates = new UpdateCollector()
  const root = file.root
  compareTag(root, website)
  compareAttributes(root, website, updates)
  const tags = root.children.map((child) => {
    if (child.kind !== 'element') {
      throw new Unsupported(
        'Only the section components are supported inside App yet.',
        child.line,
      )
    }
    if (child.attributes.length > 0 || child.children.length > 0) {
      throw new Unsupported(
        `Props or children on <${child.tag} /> are not supported yet.`,
        child.line,
      )
    }
    return child.tag
  })
  if (!sameClasses(tags, names)) {
    throw new Unsupported(
      'Adding, removing or reordering sections in code is not supported yet; use the canvas.',
      root.line,
    )
  }
  return updates.list()
}

function syntaxIssue(error: unknown): SourceIssue {
  const message =
    error instanceof Error ? (error.message.split('\n')[0] ?? '') : ''
  const location =
    typeof error === 'object' && error !== null && 'loc' in error
      ? (error as { loc?: { start?: { line?: number } } }).loc?.start?.line
      : undefined
  return {
    message: message.replace(/\s*\(\d+:\d+\)\s*$/, ''),
    line: location ?? 1,
  }
}

/**
 * Compares an edited file with the current website. Returns the tree
 * updates that make the canvas match, or why that is not possible.
 */
export async function syncCodeFile(
  path: string,
  content: string,
  website: WebsiteDocument,
): Promise<SyncResult> {
  const parts = generatableChildren(website)
  const names = componentNames(parts)
  const isApp = path === APP_PATH
  const index = names.findIndex(
    (name) => path === `${COMPONENT_PREFIX}${name}.tsx`,
  )
  if (!isApp && index === -1) return { status: 'not-canvas-file' }

  try {
    await formatTsx(content)
  } catch (error) {
    return { status: 'syntax-error', issue: syntaxIssue(error) }
  }

  const parsed = parseComponentFile(content)
  if (!parsed.ok) return { status: 'unsupported', issue: parsed.issue }

  try {
    const part = parts[index]
    const updates = isApp
      ? compareAppFile(parsed.file, website, names)
      : part
        ? compareComponentFile(parsed.file, names[index] ?? '', part)
        : []
    return { status: 'synced', updates }
  } catch (error) {
    if (error instanceof Unsupported) {
      return {
        status: 'unsupported',
        issue: { message: error.message, line: error.line },
      }
    }
    throw error
  }
}
