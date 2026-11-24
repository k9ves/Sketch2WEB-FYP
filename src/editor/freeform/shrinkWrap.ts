// Makes text components hug their text. A wrapped block (e.g. a two-line
// heading) normally keeps the full available width, leaving empty space to
// the right of its lines; CSS cannot shrink it to the longest line, so the
// longest line is measured here and set as the element's width.

const TEXT_ELEMENTS =
  '.sw-node.is-leaf:not(.is-full-width, .has-width) > :is(.sw-heading, .sw-text, .sw-button)'

// A width set by resizing wins; such text fills its box (see App.css).
const SIZED_ELEMENTS = '.sw-node.is-leaf.has-width > :not(.sw-resize-handle)'

/** Width of the widest rendered line of the element's text, or null. */
function longestLineWidth(element: HTMLElement): number | null {
  const range = document.createRange()
  range.selectNodeContents(element)
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0,
  )
  range.detach()
  if (rects.length === 0) return null

  const left = Math.min(...rects.map((rect) => rect.left))
  const right = Math.max(...rects.map((rect) => rect.right))
  const style = getComputedStyle(element)
  return (
    right -
    left +
    parseFloat(style.paddingLeft) +
    parseFloat(style.paddingRight) +
    parseFloat(style.borderLeftWidth) +
    parseFloat(style.borderRightWidth)
  )
}

export function shrinkWrapText(root: HTMLElement): void {
  const all = Array.from(root.querySelectorAll<HTMLElement>(TEXT_ELEMENTS))
  // Text being edited keeps its natural width so it can grow while typing.
  const elements = all.filter(
    (element) => !element.querySelector('[contenteditable="true"]'),
  )

  // Measure everything at its natural width first, then apply, so one
  // element's change cannot affect another element's measurement.
  all.forEach((element) => (element.style.width = ''))
  root
    .querySelectorAll<HTMLElement>(SIZED_ELEMENTS)
    .forEach((element) => (element.style.width = ''))
  const widths = elements.map(longestLineWidth)
  elements.forEach((element, index) => {
    const width = widths[index]
    if (width !== null) element.style.width = `${Math.ceil(width)}px`
  })
}
