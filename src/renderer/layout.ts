import type { CSSProperties } from 'react'

// Reads the flow layout keys of a container (`node.layout`) and turns them
// into CSS. The Properties panel uses the same resolver, so it always shows
// the value the canvas actually renders.

export const alignValues = ['start', 'center', 'end'] as const
export const justifyValues = [
  'start',
  'center',
  'end',
  'between',
  'around',
  'evenly',
] as const

/** Gap steps (× 0.25rem) the Properties panel offers. */
export const gapSteps = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16] as const

export type LayoutAlign = (typeof alignValues)[number]
export type LayoutJustify = (typeof justifyValues)[number]

export interface ResolvedLayout {
  display: 'grid' | 'flex'
  columns: number
  /** Gap in steps of 0.25rem, or null when `gap` holds a CSS length. */
  gap: number | null
  direction: 'row' | 'column'
  align: LayoutAlign
  justify: LayoutJustify
}

export interface LayoutDefaults {
  display: 'grid' | 'flex'
  direction: 'row' | 'column'
}

export const columnsLayoutDefaults: LayoutDefaults = {
  display: 'grid',
  direction: 'row',
}

/** Hero content stacks vertically (matches the .sw-hero design). */
export const heroLayoutDefaults: LayoutDefaults = {
  display: 'flex',
  direction: 'column',
}

const DEFAULT_COLUMNS = 2
const DEFAULT_GAP = 4

function oneOf<T extends string>(
  values: readonly T[],
  value: string | undefined,
  fallback: T,
): T {
  return values.find((entry) => entry === value) ?? fallback
}

export function resolveLayout(
  layout: Record<string, string>,
  defaults: LayoutDefaults,
): ResolvedLayout {
  const rawColumns = Number(layout.columns)
  const rawGap = layout.gap === undefined ? NaN : Number(layout.gap)
  const hasCssGap = layout.gap !== undefined && !Number.isFinite(rawGap)

  return {
    display: oneOf(['grid', 'flex'], layout.display, defaults.display),
    columns: Number.isFinite(rawColumns)
      ? Math.min(6, Math.max(1, Math.floor(rawColumns)))
      : DEFAULT_COLUMNS,
    gap: hasCssGap
      ? null
      : Number.isFinite(rawGap)
        ? Math.min(32, Math.max(0, rawGap))
        : DEFAULT_GAP,
    direction: oneOf(['row', 'column'], layout.direction, defaults.direction),
    // Old documents may hold "stretch"; stretched components caused hidden
    // drop blockers, so it falls back to "start".
    align: oneOf(alignValues, layout.align, 'start'),
    justify: oneOf(justifyValues, layout.justify, 'start'),
  }
}

/** True when children stack in a flex column (they get the full width). */
export function isColumnFlow(
  layout: Record<string, string>,
  defaults: LayoutDefaults,
): boolean {
  const resolved = resolveLayout(layout, defaults)
  return resolved.display === 'flex' && resolved.direction === 'column'
}

const flexAlign: Record<LayoutAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
}

const flexJustify: Record<LayoutJustify, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
}

/** Grid cells have no free space to distribute, so those map to start. */
function gridJustify(justify: LayoutJustify): LayoutAlign {
  return justify === 'center' || justify === 'end' ? justify : 'start'
}

/**
 * Container CSS. `--sw-align` / `--sw-justify` are read by the child
 * wrappers in App.css, because each wrapper sets its own `align-self`.
 */
export function layoutStyle(
  layout: Record<string, string>,
  defaults: LayoutDefaults,
): CSSProperties {
  const resolved = resolveLayout(layout, defaults)
  const gap = resolved.gap === null ? layout.gap : `${resolved.gap * 0.25}rem`
  const alignVars = {
    '--sw-align': resolved.align,
    '--sw-justify':
      resolved.display === 'grid' ? gridJustify(resolved.justify) : 'auto',
  } as CSSProperties

  if (resolved.display === 'flex') {
    return {
      ...alignVars,
      display: 'flex',
      flexDirection: resolved.direction,
      alignItems: flexAlign[resolved.align],
      justifyContent: flexJustify[resolved.justify],
      gap,
    }
  }

  return {
    ...alignVars,
    display: 'grid',
    gridTemplateColumns: `repeat(${resolved.columns}, minmax(0, 1fr))`,
    gap,
  }
}
