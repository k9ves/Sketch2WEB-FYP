import { useDndContext, useDroppable } from '@dnd-kit/core'
import { useCallback, useLayoutEffect, useRef } from 'react'
import Renderer from '../../renderer/Renderer'
import { EditableContext, NodeFrameContext } from '../../renderer/nodeFrame'
import { useWebsiteStore } from '../../store/websiteStore'
import { CanvasNodeFrame, PreviewNodeFrame } from './CanvasNodeFrame'
import { readLength } from './canvasLayout'
import {
  collectCollisionFixes,
  containPositionedChildren,
} from './positionedLayout'
import { RESIZING_FLAG } from './ResizeHandles'
import { shrinkWrapText } from './shrinkWrap'

const MAX_FIX_STREAK = 5

interface FreeformCanvasProps {
  /** Shows the page as the finished website: no selecting or editing. */
  preview?: boolean
}

/** Hybrid canvas: flow layout plus Alt-placed absolute components. */
function FreeformCanvas({ preview = false }: FreeformCanvasProps) {
  const website = useWebsiteStore((state) => state.website)
  const setLayouts = useWebsiteStore((state) => state.setLayouts)
  const { active } = useDndContext()
  const isDragging = active !== null
  const rootRef = useRef<HTMLDivElement | null>(null)
  const fixStreak = useRef(0)
  const { setNodeRef, isOver } = useDroppable({
    id: website.id,
    disabled: preview,
  })
  const setRef = useCallback(
    (element: HTMLDivElement | null) => {
      rootRef.current = element
      setNodeRef(element)
    },
    [setNodeRef],
  )

  // After every render and whenever a component changes size: keep
  // positioned components inside their containers and off each other.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || isDragging) return

    const arrange = () => {
      // A resize shows its preview straight in the DOM; wait until it ends.
      if (document.body.dataset[RESIZING_FLAG]) return
      // A layout bug must never take the whole editor (and the user's work)
      // down; report it and keep the canvas as it is.
      try {
        shrinkWrapText(root)
        containPositionedChildren(root)
        // A read-only canvas (preview, or a narrower device) only shows the
        // page. Collision fixes would move components (in the DOM and the
        // store) to fit that width and break the desktop layout.
        if (preview) {
          fixStreak.current = 0
          return
        }
        const fixes = collectCollisionFixes(useWebsiteStore.getState().website)
        if (Object.keys(fixes).length === 0) {
          fixStreak.current = 0
          return
        }
        // Guard against two fixes undoing each other forever.
        if (fixStreak.current >= MAX_FIX_STREAK) return
        fixStreak.current += 1
        setLayouts(fixes, { recordHistory: false })
      } catch (error) {
        console.error('Canvas layout pass failed:', error)
      }
    }
    arrange()

    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(arrange)
    })
    observer.observe(root)
    root
      .querySelectorAll('.sw-node')
      .forEach((element) => observer.observe(element))

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  })

  return (
    <NodeFrameContext.Provider
      value={preview ? PreviewNodeFrame : CanvasNodeFrame}
    >
      <EditableContext.Provider value={!preview}>
        <div
          ref={setRef}
          className={`sw-canvas-root${isOver ? ' is-drop-target' : ''}${preview ? ' is-preview' : ''}`}
          data-sw-node={website.id}
          data-sw-min-height={readLength(website.layout.height) ?? undefined}
        >
          <Renderer node={website} />
        </div>
      </EditableContext.Provider>
    </NodeFrameContext.Provider>
  )
}

export default FreeformCanvas
