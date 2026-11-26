import type { ComponentNode, ComponentType } from '../schema/types'

// Picks a file and component name for each top-level part of the website,
// e.g. Navbar, Hero, WhatWeDo, Footer. Sections are named after their first
// heading so developers can find them in the exported code.

const MAX_WORDS = 5

/** Types whose name already says what they are. */
const namedByType: ReadonlySet<ComponentType> = new Set([
  'navbar',
  'hero',
  'footer',
])

/** Names that would clash with the App component or its imports. */
const reservedNames: ReadonlySet<string> = new Set(['App', 'React'])

function firstHeadingText(node: ComponentNode): string | null {
  if (node.type === 'heading' && node.content.text?.trim()) {
    return node.content.text
  }
  for (const child of node.children) {
    const text = firstHeadingText(child)
    if (text) return text
  }
  return null
}

/** "Let's work!" → "LetsWork"; returns "" when nothing usable is left. */
function toPascalCase(text: string): string {
  return text
    .replace(/['’]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .slice(0, MAX_WORDS)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join('')
    .replace(/^[0-9]+/, '')
}

function baseName(node: ComponentNode): string {
  const typeName = toPascalCase(node.type)
  if (namedByType.has(node.type)) return typeName

  const heading = firstHeadingText(node)
  const fromHeading = heading ? toPascalCase(heading) : ''
  return fromHeading && !reservedNames.has(fromHeading) ? fromHeading : typeName
}

/** One unique PascalCase name per node, in the same order. */
export function componentNames(nodes: readonly ComponentNode[]): string[] {
  const used = new Set<string>(reservedNames)
  return nodes.map((node) => {
    const base = baseName(node)
    let name = base
    for (let suffix = 2; used.has(name); suffix += 1) name = `${base}${suffix}`
    used.add(name)
    return name
  })
}
