// Saving and opening a project as a JSON file (T47). The file is the
// website document itself (schema v1), the same format as the templates.
// Pure functions; downloading and reading files live in the editor.

import { isWebsiteDocument, schemaVersion } from '../schema/types'
import type { ComponentNode, WebsiteDocument } from '../schema/types'

/** Larger files are refused before parsing. */
export const MAX_PROJECT_BYTES = 5 * 1024 * 1024

export const PROJECT_FILE_ACCEPT = '.json,application/json'

export type ParseProjectResult =
  { ok: true; website: WebsiteDocument } | { ok: false; message: string }

export function serializeProject(website: WebsiteDocument): string {
  return `${JSON.stringify(website, null, 2)}\n`
}

/** e.g. "Flowbase — Startup landing" → "flowbase-startup-landing.json" */
export function projectFileName(website: WebsiteDocument): string {
  const slug = (website.content.title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'website'}.json`
}

function findDuplicateId(website: ComponentNode): string | null {
  const seen = new Set<string>()
  let duplicate: string | null = null
  const visit = (node: ComponentNode) => {
    if (duplicate !== null) return
    if (seen.has(node.id)) {
      duplicate = node.id
      return
    }
    seen.add(node.id)
    node.children.forEach(visit)
  }
  visit(website)
  return duplicate
}

function hasNestedWebsite(node: ComponentNode): boolean {
  return node.children.some(
    (child) => child.type === 'website' || hasNestedWebsite(child),
  )
}

/** Checks a project file's text; every problem gives a friendly message. */
export function parseProject(text: string): ParseProjectResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { ok: false, message: 'This file is not valid JSON.' }
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version !== schemaVersion
  ) {
    return {
      ok: false,
      message: `This project uses schema version ${String(value.version)}; this editor opens version ${schemaVersion}.`,
    }
  }
  if (!isWebsiteDocument(value)) {
    return {
      ok: false,
      message: 'This file is not a Sketch2Web project (website schema v1).',
    }
  }
  if (hasNestedWebsite(value)) {
    return {
      ok: false,
      message: 'This project is damaged: a website is nested inside it.',
    }
  }
  const duplicate = findDuplicateId(value)
  if (duplicate !== null) {
    return {
      ok: false,
      message: `This project is damaged: the id "${duplicate}" is used twice.`,
    }
  }
  return { ok: true, website: value }
}
