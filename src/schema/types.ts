export type ComponentType =
  | 'navbar'
  | 'hero'
  | 'section'
  | 'columns'
  | 'heading'
  | 'text'
  | 'button'
  | 'image'
  | 'card'
  | 'footer'

export interface ComponentProps {
  title?: string
  text?: string
  description?: string
  label?: string
  href?: string
  src?: string
  alt?: string
  brand?: string
  links?: Array<{ label: string; href: string }>
}

export interface ComponentLayout {
  display?: 'grid' | 'flex'
  columns?: number
  gap?: number
  align?: 'start' | 'center' | 'end' | 'stretch'
  direction?: 'row' | 'column'
}

export interface ComponentNode {
  id: string
  type: ComponentType
  props?: ComponentProps
  layout?: ComponentLayout
  children?: ComponentNode[]
}

export interface WebsiteDocument {
  version: 1
  title: string
  root: ComponentNode
}
