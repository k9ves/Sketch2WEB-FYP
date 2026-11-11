export type ComponentType =
  | 'website'
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

export interface ComponentNode {
  id: string
  type: ComponentType
  content: Record<string, string>
  layout: Record<string, string>
  style: Record<string, string>
  children: ComponentNode[]
}
