import type { ComponentType } from '../schema/types'

/** Display names for component types, shared by the editor panels. */
export const typeLabels: Record<ComponentType, string> = {
  website: 'Website',
  navbar: 'Navbar',
  hero: 'Hero',
  section: 'Section',
  columns: 'Columns',
  heading: 'Heading',
  text: 'Text',
  button: 'Link / button',
  image: 'Image',
  card: 'Card',
  footer: 'Footer',
}
