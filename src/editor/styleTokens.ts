import type { ComponentType } from '../schema/types'

// Tailwind only generates classes it finds written out in the source, so
// every token the Properties panel offers is listed here in full.

export interface StyleToken {
  token: string
  label: string
  /** Preview color for color groups. */
  swatch?: string
}

interface StyleGroupDefinition {
  label: string
  kind: 'color' | 'scale'
  tokens: readonly StyleToken[]
}

export const styleGroups = {
  textColor: {
    label: 'Text color',
    kind: 'color',
    tokens: [
      { token: 'text-slate-900', label: 'Ink', swatch: '#0f172b' },
      { token: 'text-slate-600', label: 'Slate', swatch: '#45556c' },
      { token: 'text-white', label: 'White', swatch: '#ffffff' },
      { token: 'text-indigo-600', label: 'Indigo', swatch: '#4f39f6' },
      { token: 'text-emerald-600', label: 'Emerald', swatch: '#009966' },
      { token: 'text-rose-600', label: 'Rose', swatch: '#ec003f' },
    ],
  },
  fontSize: {
    label: 'Font size',
    kind: 'scale',
    tokens: [
      { token: 'text-sm', label: 'Small (14px)' },
      { token: 'text-base', label: 'Base (16px)' },
      { token: 'text-lg', label: 'Large (18px)' },
      { token: 'text-xl', label: 'XL (20px)' },
      { token: 'text-2xl', label: '2XL (24px)' },
      { token: 'text-3xl', label: '3XL (30px)' },
      { token: 'text-4xl', label: '4XL (36px)' },
      { token: 'text-5xl', label: '5XL (48px)' },
    ],
  },
  padding: {
    label: 'Padding',
    kind: 'scale',
    tokens: [
      { token: 'p-0', label: 'None (0px)' },
      { token: 'p-2', label: 'XS (8px)' },
      { token: 'p-4', label: 'S (16px)' },
      { token: 'p-6', label: 'M (24px)' },
      { token: 'p-8', label: 'L (32px)' },
      { token: 'p-12', label: 'XL (48px)' },
      { token: 'p-16', label: '2XL (64px)' },
    ],
  },
  background: {
    label: 'Background',
    kind: 'color',
    tokens: [
      { token: 'bg-white', label: 'White', swatch: '#ffffff' },
      { token: 'bg-slate-50', label: 'Mist', swatch: '#f8fafc' },
      { token: 'bg-slate-100', label: 'Cloud', swatch: '#f1f5f9' },
      { token: 'bg-slate-900', label: 'Night', swatch: '#0f172b' },
      { token: 'bg-indigo-50', label: 'Lavender', swatch: '#eef2ff' },
      { token: 'bg-indigo-600', label: 'Indigo', swatch: '#4f39f6' },
      { token: 'bg-emerald-50', label: 'Mint', swatch: '#ecfdf5' },
      { token: 'bg-rose-50', label: 'Blush', swatch: '#fff1f2' },
    ],
  },
} as const satisfies Record<string, StyleGroupDefinition>

export type StyleGroup = keyof typeof styleGroups

/** The one style slot each component type renders (see Renderer.tsx). */
export const styleSlotByType: Record<ComponentType, string> = {
  website: 'background',
  navbar: 'container',
  hero: 'container',
  section: 'container',
  columns: 'container',
  card: 'container',
  footer: 'container',
  heading: 'text',
  text: 'text',
  button: 'button',
  image: 'image',
}

/** Style groups the panel offers, per slot. */
export const styleGroupsBySlot: Record<string, readonly StyleGroup[]> = {
  background: ['background'],
  container: ['background', 'textColor', 'padding'],
  text: ['textColor', 'fontSize'],
  button: ['background', 'textColor', 'fontSize', 'padding'],
  image: ['background', 'padding'],
}

function groupTokens(group: StyleGroup): readonly string[] {
  return styleGroups[group].tokens.map((entry) => entry.token)
}

function splitClasses(slotValue: string): string[] {
  return slotValue.split(/\s+/).filter(Boolean)
}

/** The group's token currently in the slot, or null for the default. */
export function getStyleToken(
  slotValue: string,
  group: StyleGroup,
): string | null {
  const tokens = groupTokens(group)
  return splitClasses(slotValue).find((cls) => tokens.includes(cls)) ?? null
}

/**
 * Replaces the group's token in a slot, keeping every other class (e.g.
 * `sw-hero-title`). A null token removes it, restoring the default look.
 */
export function setStyleToken(
  slotValue: string,
  group: StyleGroup,
  token: string | null,
): string {
  const tokens = groupTokens(group)
  if (token !== null && !tokens.includes(token)) {
    throw new Error(`"${token}" is not a ${group} token.`)
  }
  const kept = splitClasses(slotValue).filter((cls) => !tokens.includes(cls))
  return (token === null ? kept : [...kept, token]).join(' ')
}
