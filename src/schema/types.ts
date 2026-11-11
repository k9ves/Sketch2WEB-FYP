export const componentTypes = [
  'website',
  'navbar',
  'hero',
  'section',
  'columns',
  'heading',
  'text',
  'button',
  'image',
  'card',
  'footer',
] as const

export type ComponentType = (typeof componentTypes)[number]

export interface ComponentNode {
  id: string
  type: ComponentType
  content: Record<string, string>
  layout: Record<string, string>
  style: Record<string, string>
  children: ComponentNode[]
}

export const schemaVersion = 1 as const

export interface WebsiteDocument extends ComponentNode {
  type: 'website'
  version: typeof schemaVersion
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  )
}

export function isComponentNode(value: unknown): value is ComponentNode {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const node = value as Record<string, unknown>

  return (
    typeof node.id === 'string' &&
    componentTypes.some((type) => type === node.type) &&
    isStringRecord(node.content) &&
    isStringRecord(node.layout) &&
    isStringRecord(node.style) &&
    Array.isArray(node.children) &&
    node.children.every(isComponentNode)
  )
}

export function isWebsiteDocument(value: unknown): value is WebsiteDocument {
  return (
    isComponentNode(value) &&
    value.type === 'website' &&
    'version' in value &&
    value.version === schemaVersion
  )
}
