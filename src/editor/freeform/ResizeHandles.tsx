import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ComponentNode } from '../../schema/types'
import { isContainerType } from '../../store/tree'
import { useWebsiteStore } from '../../store/websiteStore'
import { readNodeBox } from './canvasLayout'
import type { Rect } from './geometry'
import { readVisibleFrame } from './positionedLayout'
import { FLOW_HANDLES, FREE_HANDLES, resizeRect } from './resizeGeometry'
import type { ResizeHandle } from './resizeGeometry'

/** Set on <body> while a resize runs; the canvas layout pass waits for it. */
export const RESIZING_FLAG = 'swResizing'

const px = (value: number) => String(Math.round(value * 100) / 100)

interface Gesture {
  wrapper: HTMLElement
  /** Element the user sees (a leaf's inner element, or the wrapper). */
  visible: HTMLElement
  start: Rect
  startPointer: { x: number; y: number }
  startScroll: number
  bounds: { width: number; height: number | null }
  obstacles: Rect[]
  current: Rect
  keepRatio: boolean
  /** Wrapper state before the gesture, restored before React redraws. */
  savedStyle: string | null
  savedClass: string
}

/** Shows the rectangle live, without touching the store. */
function preview(node: ComponentNode, gesture: Gesture, rect: Rect) {
  const { wrapper } = gesture
  wrapper.classList.add('has-width', 'has-height')
  wrapper.style.width = `${rect.width}px`
  wrapper.style.maxWidth = '100%'
  wrapper.style.setProperty('--sw-box-height', `${rect.height}px`)
  // Text hugging (shrinkWrap) set a fixed width; the box decides now.
  if (gesture.visible !== wrapper) gesture.visible.style.width = ''
  if (isContainerType(node.type)) {
    const content = wrapper.firstElementChild
    if (content instanceof HTMLElement) {
      content.style.minHeight = `${rect.height}px`
    }
  }
  if (readNodeBox(node)) {
    wrapper.style.left = `${rect.x}px`
    wrapper.style.top = `${rect.y}px`
  }
}

function clearPreview(gesture: Gesture) {
  const { wrapper } = gesture
  if (gesture.savedStyle === null) wrapper.removeAttribute('style')
  else wrapper.setAttribute('style', gesture.savedStyle)
  wrapper.className = gesture.savedClass
  const content = wrapper.firstElementChild
  if (content instanceof HTMLElement) content.style.minHeight = ''
}

/**
 * Runs one resize gesture from a handle's pointerdown until pointerup (or
 * Esc / pointercancel, which undo the preview). Only the final size reaches
 * the store, so a gesture is one undo step.
 */
function beginResize(
  node: ComponentNode,
  handle: ResizeHandle,
  event: ReactPointerEvent<HTMLElement>,
) {
  const positioned = readNodeBox(node) !== null
  if (event.button !== 0) return
  // The wrapper starts drags on pointerdown; a resize is not a drag.
  event.stopPropagation()
  event.preventDefault()

  const wrapper = event.currentTarget.closest<HTMLElement>('[data-sw-node]')
  const parentId =
    wrapper?.parentElement?.closest<HTMLElement>('[data-sw-node]')?.dataset
      .swNode
  if (!wrapper || !parentId) return
  const frame = readVisibleFrame(parentId, node.id)
  if (!frame) return

  const visible =
    wrapper.classList.contains('is-leaf') &&
    wrapper.firstElementChild instanceof HTMLElement
      ? wrapper.firstElementChild
      : wrapper
  const rect = visible.getBoundingClientRect()
  const start: Rect = {
    x: rect.left - frame.origin.x,
    y: rect.top - frame.origin.y,
    width: rect.width,
    height: rect.height,
  }
  const gesture: Gesture = {
    wrapper,
    visible,
    start,
    startPointer: { x: event.clientX, y: event.clientY },
    startScroll: window.scrollY,
    bounds: frame.bounds,
    // Only a free component stops at its siblings; flow pushes them.
    obstacles: positioned ? frame.obstacles : [],
    current: start,
    keepRatio: node.type === 'image',
    savedStyle: wrapper.getAttribute('style'),
    savedClass: wrapper.className,
  }
  document.body.dataset[RESIZING_FLAG] = 'true'
  document.body.style.cursor = getComputedStyle(event.currentTarget).cursor

  const move = (moveEvent: PointerEvent) => {
    gesture.keepRatio = node.type === 'image' || moveEvent.shiftKey
    gesture.current = resizeRect({
      start,
      handle,
      delta: {
        x: moveEvent.clientX - gesture.startPointer.x,
        y:
          moveEvent.clientY -
          gesture.startPointer.y +
          (window.scrollY - gesture.startScroll),
      },
      keepRatio: gesture.keepRatio,
      bounds: gesture.bounds,
      obstacles: gesture.obstacles,
    })
    preview(node, gesture, gesture.current)
  }

  const finish = (commit: boolean) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', key, true)
    delete document.body.dataset[RESIZING_FLAG]
    document.body.style.cursor = ''
    clearPreview(gesture)

    const rect = gesture.current
    const changed =
      Math.abs(rect.width - start.width) >= 0.5 ||
      Math.abs(rect.height - start.height) >= 0.5
    if (!commit || !changed) return

    // Only the axes the handle moves get a fixed size; the other stays
    // automatic (e.g. text can still grow taller after a width resize).
    // With a kept ratio both change.
    const horizontal = /[ew]/.test(handle)
    const vertical = /[ns]/.test(handle)
    const layout: Record<string, string> = {}
    if (horizontal || gesture.keepRatio) layout.boxWidth = px(rect.width)
    if (vertical || gesture.keepRatio) layout.boxHeight = px(rect.height)
    if (positioned) {
      layout.x = px(rect.x)
      layout.y = px(rect.y)
      layout.width = px(rect.width)
    }
    useWebsiteStore.getState().updateNode(node.id, { layout })
  }
  const up = () => {
    // The pointer went down on the handle but comes up elsewhere, so the
    // browser sends the click to a container, which would select it (or
    // clear the selection). Swallow that one click.
    const swallow = (clickEvent: MouseEvent) => {
      clickEvent.stopPropagation()
      clickEvent.preventDefault()
    }
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', swallow, true), 0)
    finish(true)
  }
  const cancel = () => finish(false)
  const key = (keyEvent: KeyboardEvent) => {
    if (keyEvent.key !== 'Escape') return
    keyEvent.preventDefault()
    keyEvent.stopPropagation()
    finish(false)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
  window.addEventListener('keydown', key, true)
}

/**
 * Resize handles of the selected component. Free components get all eight;
 * flow components grow right / down (their top-left is set by the flow).
 */
function ResizeHandles({ node }: { node: ComponentNode }) {
  const handles = readNodeBox(node) !== null ? FREE_HANDLES : FLOW_HANDLES

  return (
    <>
      {handles.map((handle) => (
        <span
          key={handle}
          className={`sw-resize-handle is-${handle}`}
          data-handle={handle}
          aria-hidden="true"
          onPointerDown={(event) => beginResize(node, handle, event)}
          // A click after resizing must not select the parent.
          onClick={(event) => event.stopPropagation()}
        />
      ))}
    </>
  )
}

export default ResizeHandles
