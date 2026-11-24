import { componentTypes } from '../schema/types'
import type { ComponentNode, ComponentType } from '../schema/types'

export type AddableComponentType = Exclude<ComponentType, 'website'>

export function isAddableComponentType(
  value: unknown,
): value is AddableComponentType {
  return (
    typeof value === 'string' &&
    componentTypes.some((type) => type === value && type !== 'website')
  )
}

function leaf(
  type: ComponentType,
  content: Record<string, string>,
  style: Record<string, string> = {},
): ComponentNode {
  return {
    id: crypto.randomUUID(),
    type,
    content,
    layout: {},
    style,
    children: [],
  }
}

function heading(text: string, level: string, styleClass: string) {
  return leaf('heading', { text, level }, { text: styleClass })
}

function text(value: string, styleClass: string) {
  return leaf('text', { text: value }, { text: styleClass })
}

function navLink(label: string, href: string, styleClass: string) {
  return leaf('button', { text: label, href }, { button: styleClass })
}

type ComponentBlueprint = () => Omit<ComponentNode, 'id' | 'type'>

// Container text lives in its own heading/text child nodes, so every piece of
// text can be dragged and edited independently.
const blueprints: Record<AddableComponentType, ComponentBlueprint> = {
  // Brand and links are link (button) nodes, styled to look like a navbar.
  navbar: () => ({
    content: {},
    layout: {},
    style: {},
    children: [
      navLink('New website', '#top', 'sw-brand'),
      navLink('Home', '#home', 'sw-nav-link'),
      navLink('About', '#about', 'sw-nav-link'),
      navLink('Contact', '#contact', 'sw-nav-link'),
    ],
  }),
  hero: () => ({
    content: {},
    layout: {},
    style: {},
    children: [
      heading('New hero', '1', 'sw-hero-title'),
      text('Add a description', 'sw-hero-description'),
    ],
  }),
  section: () => ({
    content: {},
    layout: {},
    style: {},
    children: [heading('New section', '2', 'sw-section-title')],
  }),
  columns: () => ({
    content: {},
    layout: { columns: '2', gap: '4' },
    style: {},
    children: [],
  }),
  heading: () => ({
    content: { text: 'New heading' },
    layout: {},
    style: {},
    children: [],
  }),
  text: () => ({
    content: { text: 'New text' },
    layout: {},
    style: {},
    children: [],
  }),
  button: () => ({
    content: { text: 'New button', href: '#top' },
    layout: {},
    style: {},
    children: [],
  }),
  image: () => ({
    content: { src: '/favicon.svg', alt: 'Placeholder image' },
    layout: {},
    style: {},
    children: [],
  }),
  card: () => ({
    content: {},
    layout: {},
    style: {},
    children: [
      heading('New card', '3', 'sw-card-title'),
      text('Add a description', 'sw-card-text'),
    ],
  }),
  footer: () => ({
    content: {},
    layout: {},
    style: {},
    children: [text('New footer', 'sw-footer-text')],
  }),
}

export function createComponentNode(type: AddableComponentType): ComponentNode {
  return { id: crypto.randomUUID(), type, ...blueprints[type]() }
}
