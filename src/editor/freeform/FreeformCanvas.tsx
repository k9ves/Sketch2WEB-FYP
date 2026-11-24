import { useDndContext, useDroppable } from '@dnd-kit/core'
import { useCallback, useLayoutEffect, useRef } from 'react'
import Renderer from '../../renderer/Renderer'
import { NodeFrameContext } from '../../renderer/nodeFrame'
import { useWebsiteStore } from '../../store/websiteStore'
import { CanvasNodeFrame } from './CanvasNodeFrame'
import { readLength } from './canvasLayout'
import {
  collectCollisionFixes,
  containPositionedChildren,
} from './positionedLayout'
import { shrinkWrapText } from './shrinkWrap'

const MAX_FIX_STREAK = 5

/** Hybrid canvas: flow layout plus Alt-placed absolute components. */
function FreeformCanvas() {
  const website = useWebsiteStore((state) => state.website)
  const setLayouts = useWebsiteStore((state) => state.setLayouts)
  const { active } = useDndContext()
  const isDragging = active !== null
  const rootRef = useRef<HTMLDivElement | null>(null)
  const fixStreak = useRef(0)
  const { setNodeRef, isOver } = useDroppable({ id: website.id })
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
      // A layout bug must never take the whole editor (and the user's work)
      // down; report it and keep the canvas as it is.
      try {
        shrinkWrapText(root)
        containPositionedChildren(root)
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
    <NodeFrameContext.Provider value={CanvasNodeFrame}>
      <div
        ref={setRef}
        className={`sw-canvas-root${isOver ? ' is-drop-target' : ''}`}
        data-sw-node={website.id}
        data-sw-min-height={readLength(website.layout.height) ?? undefined}
      >
        <Renderer node={website} />
      </div>
    </NodeFrameContext.Provider>
  )
}

export default FreeformCanvas
