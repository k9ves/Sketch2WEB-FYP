// Checks that a template is "100% editable": everything in it can be read
// by the renderer and changed with the editor's own tools (canvas, tree,
// Properties panel). A template with no issues is safe to offer.
// Used by `npm run check:templates` and by the template gallery.

import { isWebsiteDocument } from '../schema/types'
import type { ComponentNode, ComponentType } from '../schema/types'
import { alignValues, gapSteps, justifyValues } from '../renderer/layout'
import { safeHref } from '../renderer/safeHref'
import { isContainerType } from '../store/tree'
import {
  styleGroups,
  styleGroupsBySlot,
  styleSlotByType,
} from '../editor/styleTokens'
import type { StyleGroup } from '../editor/styleTokens'

export interface TemplateIssue {
  /** Node the issue is about, or null for the whole template. */
  nodeId: string | null
  message: string
}

export interface ValidateTemplateOptions {
  /** Every id must start with `<idPrefix>-`, e.g. "saas". */
  idPrefix: string
  /** Checks that an image file exists; skipped when not given. */
  assetExists?: (src: string) => boolean
}

/** Image files of templates live in public/templates/<name>/. */
export const TEMPLATE_ASSET_ROOT = '/templates/'

/** Content fields the Properties panel edits, per type (docs/T36 §2). */
const contentFields: Record<ComponentType, readonly string[]> = {
  website: ['title'],
  heading: ['text', 'level'],
  text: ['text'],
  button: ['text', 'href'],
  image: ['src', 'alt'],
  navbar: [],
  hero: [],
  section: [],
  columns: [],
  card: [],
  footer: [],
}

/** Fields that must be present and not blank. */
const requiredFields: Partial<Record<ComponentType, readonly string[]>> = {
  website: ['title'],
  heading: ['text'],
  text: ['text'],
  button: ['text', 'href'],
  image: ['src', 'alt'],
}

/** Our own look classes (App.css), allowed per style slot. */
const lookClassesBySlot: Record<string, readonly string[]> = {
  text: [
    'sw-hero-title',
    'sw-hero-description',
    'sw-section-title',
    'sw-section-description',
    'sw-card-title',
    'sw-card-text',
    'sw-footer-text',
  ],
  button: ['sw-brand', 'sw-nav-link'],
}

/** Flow layout keys the Properties panel edits (LayoutFields). */
const layoutKeys: Partial<Record<ComponentType, readonly string[]>> = {
  columns: ['display', 'columns', 'gap', 'direction', 'align', 'justify'],
  hero: ['gap', 'direction', 'align', 'justify'],
}

function isIntegerIn(value: string, min: number, max: number): boolean {
  const number = Number(value)
  return /^\d+$/.test(value) && number >= min && number <= max
}

function layoutValueIsValid(key: string, value: string): boolean {
  switch (key) {
    case 'display':
      return value === 'grid' || value === 'flex'
    case 'columns':
      return isIntegerIn(value, 1, 6)
    case 'gap':
      return gapSteps.some((step) => String(step) === value)
    case 'direction':
      return value === 'row' || value === 'column'
    case 'align':
      return (alignValues as readonly string[]).includes(value)
    case 'justify':
      return (justifyValues as readonly string[]).includes(value)
    default:
      return false
  }
}

function groupOfToken(token: string, groups: readonly StyleGroup[]) {
  return groups.find((group) =>
    styleGroups[group].tokens.some((entry) => entry.token === token),
  )
}

function checkStyle(node: ComponentNode, report: (message: string) => void) {
  const slot = styleSlotByType[node.type]
  const groups = styleGroupsBySlot[slot]
  const lookClasses = lookClassesBySlot[slot] ?? []

  for (const [key, value] of Object.entries(node.style)) {
    if (key !== slot) {
      report(`style "${key}" is never rendered; use the "${slot}" slot.`)
      continue
    }
    const used = new Set<StyleGroup>()
    for (const cls of value.split(/\s+/).filter(Boolean)) {
      if (lookClasses.includes(cls)) continue
      const group = groupOfToken(cls, groups)
      if (!group && cls.startsWith('sw-')) {
        report(
          `class "${cls}" is not needed: the renderer adds the ` +
            `${node.type} look by itself.`,
        )
      } else if (!group) {
        report(
          `class "${cls}" cannot be edited in the Properties panel ` +
            `(not a ${slot} token or look class).`,
        )
      } else if (used.has(group)) {
        report(`more than one ${styleGroups[group].label} token.`)
      } else {
        used.add(group)
      }
    }
  }
}

function checkContent(
  node: ComponentNode,
  options: ValidateTemplateOptions,
  report: (message: string) => void,
) {
  const allowed = contentFields[node.type]
  for (const key of Object.keys(node.content)) {
    if (!allowed.includes(key)) {
      report(
        allowed.length === 0
          ? `content "${key}": ${node.type} has no content fields; ` +
              'put text in heading/text/button children.'
          : `content "${key}" cannot be edited (allowed: ${allowed.join(', ')}).`,
      )
    }
  }
  for (const key of requiredFields[node.type] ?? []) {
    if ((node.content[key] ?? '').trim() === '') {
      report(`content "${key}" is missing or empty.`)
    }
  }

  const { level, href, src } = node.content
  if (level !== undefined && !isIntegerIn(level, 1, 6)) {
    report(`heading level "${level}" must be 1 to 6.`)
  }
  if (href !== undefined && href.trim() !== '' && !safeHref(href)) {
    report(`link "${href}" is not safe and would show a warning.`)
  }
  if (src !== undefined && src.trim() !== '') {
    if (!src.startsWith(TEMPLATE_ASSET_ROOT)) {
      report(`image "${src}" must be a file in public${TEMPLATE_ASSET_ROOT}.`)
    } else if (options.assetExists && !options.assetExists(src)) {
      report(`image file "${src}" does not exist.`)
    }
  }
}

function checkLayout(node: ComponentNode, report: (message: string) => void) {
  const allowed = layoutKeys[node.type] ?? []
  for (const [key, value] of Object.entries(node.layout)) {
    if (!allowed.includes(key)) {
      report(
        `layout "${key}" is not allowed in templates ` +
          '(flow layout only, no free positions or fixed sizes).',
      )
    } else if (!layoutValueIsValid(key, value)) {
      report(`layout ${key} "${value}" is not a value the panel offers.`)
    }
  }
}

/**
 * Returns every rule a template breaks; an empty list means the editor can
 * read and edit all of it. Rules: docs/templates.md.
 */
export function validateTemplate(
  value: unknown,
  options: ValidateTemplateOptions,
): TemplateIssue[] {
  if (!isWebsiteDocument(value)) {
    return [
      {
        nodeId: null,
        message: 'Not a valid website document (schema v1).',
      },
    ]
  }

  const issues: TemplateIssue[] = []
  const seenIds = new Set<string>()
  const prefix = `${options.idPrefix}-`

  const visit = (node: ComponentNode, isRoot: boolean) => {
    const report = (message: string) =>
      issues.push({ nodeId: node.id, message })

    if (seenIds.has(node.id)) report('id is used more than once.')
    seenIds.add(node.id)
    if (!node.id.startsWith(prefix)) report(`id must start with "${prefix}".`)
    if (!isRoot && node.type === 'website') {
      report('a website can only be the root.')
    }
    if (!isContainerType(node.type) && node.children.length > 0) {
      report(`${node.type} cannot have children.`)
    }

    checkContent(node, options, report)
    checkStyle(node, report)
    checkLayout(node, report)
    node.children.forEach((child) => visit(child, false))
  }
  visit(value, true)

  return issues
}
