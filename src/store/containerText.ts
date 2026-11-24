// Turns text that containers used to render from their own `content`
// (hero title, card title, section text, ...) into independent heading/text
// child nodes, so every piece of text can be dragged and edited on its own.
// Generated nodes keep the old look through style classes.

import type { ComponentNode, WebsiteDocument } from '../schema/types'

interface LiftRule {
  field: string
  type: 'heading' | 'text'
  level?: string
  styleClass: string
}

const liftRules: Partial<Record<ComponentNode['type'], LiftRule[]>> = {
  hero: [
    {
      field: 'title',
      type: 'heading',
      level: '1',
      styleClass: 'sw-hero-title',
    },
    { field: 'description', type: 'text', styleClass: 'sw-hero-description' },
  ],
  section: [
    {
      field: 'title',
      type: 'heading',
      level: '2',
      styleClass: 'sw-section-title',
    },
    { field: 'text', type: 'text', styleClass: 'sw-section-description' },
  ],
  card: [
    {
      field: 'title',
      type: 'heading',
      level: '3',
      styleClass: 'sw-card-title',
    },
    { field: 'text', type: 'text', styleClass: 'sw-card-text' },
    { field: 'description', type: 'text', styleClass: 'sw-card-text' },
  ],
  footer: [{ field: 'text', type: 'text', styleClass: 'sw-footer-text' }],
}

function collectIds(node: ComponentNode, ids: Set<string>): Set<string> {
  ids.add(node.id)
  node.children.forEach((child) => collectIds(child, ids))
  return ids
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base
  for (let suffix = 2; used.has(id); suffix += 1) id = `${base}-${suffix}`
  used.add(id)
  return id
}

function navLinkHref(label: string): string {
  return `#${label.toLowerCase().replace(/\s+/g, '-')}`
}

function linkNode(
  id: string,
  text: string,
  href: string,
  styleClass: string,
): ComponentNode {
  return {
    id,
    type: 'button',
    content: { text, href },
    layout: {},
    style: { button: styleClass },
    children: [],
  }
}

const navbarFields = ['brand', 'title', 'links'] as const

/**
 * Navbar brand and links become button (link) nodes, so a logo, heading or
 * text can be placed before, after or between them.
 */
function liftNavbar(
  content: Record<string, string>,
  navbarId: string,
  used: Set<string>,
): ComponentNode[] {
  const lifted: ComponentNode[] = []
  const brand = content.brand ?? content.title
  if (brand !== undefined && brand.trim() !== '') {
    lifted.push(
      linkNode(uniqueId(`${navbarId}-brand`, used), brand, '#top', 'sw-brand'),
    )
  }

  const labels = (content.links ?? '')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
  labels.forEach((label, index) =>
    lifted.push(
      linkNode(
        uniqueId(`${navbarId}-link-${index + 1}`, used),
        label,
        navLinkHref(label),
        'sw-nav-link',
      ),
    ),
  )

  navbarFields.forEach((field) => delete content[field])
  return lifted
}

function liftNode(node: ComponentNode, used: Set<string>): ComponentNode {
  const children = node.children.map((child) => liftNode(child, used))
  const rules = liftRules[node.type] ?? []
  const content = { ...node.content }
  const lifted: ComponentNode[] =
    node.type === 'navbar' ? liftNavbar(content, node.id, used) : []

  for (const rule of rules) {
    if (!(rule.field in content)) continue
    const value = content[rule.field]
    delete content[rule.field]
    if (value.trim() === '') continue

    lifted.push({
      id: uniqueId(`${node.id}-${rule.field}`, used),
      type: rule.type,
      content: rule.level
        ? { text: value, level: rule.level }
        : { text: value },
      layout: {},
      style: { text: rule.styleClass },
      children: [],
    })
  }

  const changed =
    lifted.length > 0 ||
    rules.some((rule) => rule.field in node.content) ||
    (node.type === 'navbar' &&
      navbarFields.some((field) => field in node.content)) ||
    children.some((child, index) => child !== node.children[index])
  if (!changed) return node

  return { ...node, content, children: [...lifted, ...children] }
}

/** Idempotent: a tree without container text is returned unchanged. */
export function liftContainerText(website: WebsiteDocument): WebsiteDocument {
  const used = collectIds(website, new Set())
  const children = website.children.map((child) => liftNode(child, used))
  return children.every((child, index) => child === website.children[index])
    ? website
    : { ...website, children }
}
