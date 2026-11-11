import type {
  ComponentLayout,
  ComponentNode,
  ComponentProps,
  ComponentType,
  WebsiteDocument,
} from './types'

const componentTypes: ReadonlySet<string> = new Set([
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
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isComponentType(value: unknown): value is ComponentType {
  return typeof value === 'string' && componentTypes.has(value)
}

function isComponentProps(value: unknown): value is ComponentProps {
  if (!isRecord(value)) return false

  const stringFields = [
    'title',
    'text',
    'description',
    'label',
    'href',
    'src',
    'alt',
    'brand',
  ]
  if (
    stringFields.some(
      (field) => field in value && typeof value[field] !== 'string',
    )
  ) {
    return false
  }

  if ('links' in value) {
    if (!Array.isArray(value.links)) return false
    if (
      !value.links.every(
        (link) =>
          isRecord(link) &&
          typeof link.label === 'string' &&
          typeof link.href === 'string',
      )
    ) {
      return false
    }
  }

  return true
}

function isComponentLayout(value: unknown): value is ComponentLayout {
  if (!isRecord(value)) return false

  return (
    (!('display' in value) ||
      value.display === 'grid' ||
      value.display === 'flex') &&
    (!('columns' in value) ||
      (typeof value.columns === 'number' && Number.isFinite(value.columns))) &&
    (!('gap' in value) ||
      (typeof value.gap === 'number' && Number.isFinite(value.gap))) &&
    (!('align' in value) ||
      value.align === 'start' ||
      value.align === 'center' ||
      value.align === 'end' ||
      value.align === 'stretch') &&
    (!('direction' in value) ||
      value.direction === 'row' ||
      value.direction === 'column')
  )
}

function isComponentNode(value: unknown): value is ComponentNode {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || !isComponentType(value.type)) {
    return false
  }
  if ('props' in value && !isComponentProps(value.props)) return false
  if ('layout' in value && !isComponentLayout(value.layout)) return false
  if (
    'children' in value &&
    (!Array.isArray(value.children) || !value.children.every(isComponentNode))
  ) {
    return false
  }

  return true
}

export function isWebsiteDocument(value: unknown): value is WebsiteDocument {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.title === 'string' &&
    isComponentNode(value.root)
  )
}
