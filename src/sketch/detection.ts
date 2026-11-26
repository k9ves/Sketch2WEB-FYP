// Element list returned by the vision model (docs/sketch-detection.md §3)
// and the checks it must pass (§5) before the app uses it.

export const sketchElementTypes = [
  'navbar',
  'hero',
  'section',
  'card',
  'footer',
  'heading',
  'text',
  'button',
  'image',
] as const

export type SketchElementType = (typeof sketchElementTypes)[number]

/** Position and size as a share of the photo, from 0 to 1. */
export interface SketchBox {
  x: number
  y: number
  w: number
  h: number
}

export interface SketchElement {
  type: SketchElementType
  text?: string
  box: SketchBox
}

export type DetectionResult =
  | { ok: true; elements: SketchElement[]; skipped: number }
  | { ok: false; message: string }

/** Rounding slack, so 0.3 + 0.7 counts as inside the photo. */
const EDGE = 0.01

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSketchElementType(value: unknown): value is SketchElementType {
  return (
    typeof value === 'string' &&
    (sketchElementTypes as readonly string[]).includes(value)
  )
}

function isShare(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1
}

function readBox(value: unknown): SketchBox | null {
  if (!isRecord(value)) return null
  const { x, y, w, h } = value
  if (!isShare(x) || !isShare(y) || !isShare(w) || !isShare(h)) return null
  if (w === 0 || h === 0) return null
  if (x + w > 1 + EDGE || y + h > 1 + EDGE) return null
  return { x, y, w, h }
}

function readElement(value: unknown): SketchElement | null {
  if (!isRecord(value) || !isSketchElementType(value.type)) return null
  const box = readBox(value.box)
  if (!box) return null
  const text = typeof value.text === 'string' ? value.text.trim() : ''
  return text ? { type: value.type, text, box } : { type: value.type, box }
}

/**
 * The JSON part of a pasted answer: the whole text, a ```json code block,
 * or the outermost `{...}` when the chat added words around it.
 */
function jsonPart(pasted: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(pasted)
  if (fenced?.[1]) return fenced[1].trim()
  const start = pasted.indexOf('{')
  const end = pasted.lastIndexOf('}')
  return start !== -1 && end > start ? pasted.slice(start, end + 1) : pasted
}

/** Reads a pasted model answer. Invalid elements are skipped and counted. */
export function parseDetection(pasted: string): DetectionResult {
  if (pasted.trim() === '') {
    return { ok: false, message: "Paste Claude's answer first." }
  }

  let value: unknown
  try {
    value = JSON.parse(jsonPart(pasted))
  } catch {
    return {
      ok: false,
      message: "This is not the JSON result. Copy Claude's whole answer.",
    }
  }

  if (!isRecord(value) || !Array.isArray(value.elements)) {
    return {
      ok: false,
      message: 'The result has no "elements" list. Use the copied prompt.',
    }
  }

  const elements = value.elements
    .map(readElement)
    .filter((element): element is SketchElement => element !== null)
  if (elements.length === 0) {
    return {
      ok: false,
      message: 'No layout found. Use a clear photo with dark lines.',
    }
  }
  return {
    ok: true,
    elements,
    skipped: value.elements.length - elements.length,
  }
}
