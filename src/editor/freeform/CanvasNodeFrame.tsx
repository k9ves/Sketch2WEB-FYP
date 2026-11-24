import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useCallback } from 'react'
import type { CSSProperties } from 'react'
import type { NodeFrameProps } from '../../renderer/nodeFrame'
import type { ComponentNode } from '../../schema/types'
import { isContainerType } from '../../store/tree'
import { useWebsiteStore } from '../../store/websiteStore'
import ResizeHandles from './ResizeHandles'
import { readLength, readNodeBox, readNodeSize } from './canvasLayout'

export interface CanvasNodeDragData {
  kind: 'node'
  nodeId: string
}

/** Shared wrapper attributes: flow layout, or absolute when positioned. */
function frameAttributes(node: ComponentNode, extraClasses: string[] = []) {
  const box = readNodeBox(node)
  const container = isContainerType(node.type)
  const size = readNodeSize(node)
  const className = [
    'sw-node',
    container ? 'is-container' : 'is-leaf',
    box ? 'is-positioned' : '',
    size.width !== null ? 'has-width' : '',
    size.height !== null ? 'has-height' : '',
    ...extraClasses,
  ]
    .filter(Boolean)
    .join(' ')

  // A size set by resizing wins. Otherwise leaves hug their content (their
  // stored width is only the wrap limit) and positioned containers keep
  // their stored width. Nothing gets wider than its container (e.g. when a
  // scrollbar appears and the canvas gets narrower).
  const style: CSSProperties & { '--sw-box-height'?: string } = {}
  if (box) {
    style.left = box.x
    style.top = box.y
  }
  if (size.width !== null) {
    style.width = size.width
    style.maxWidth = '100%'
  } else if (box && container) {
    style.width = box.width
    style.maxWidth = '100%'
  } else if (box) {
    style.maxWidth = `min(${box.width}px, 100%)`
  }
  if (size.height !== null) {
    style['--sw-box-height'] = `${size.height}px`
  }

  const storedHeight = readLength(node.layout.height)
  return {
    className,
    style: Object.keys(style).length > 0 ? style : undefined,
    'data-sw-positioned': box ? 'true' : undefined,
    // Right edge it is meant to reach; the container keeps this much width
    // (see containPositionedChildren), whatever it is drawn at right now.
    'data-sw-right': box ? box.x + (size.width ?? box.width) : undefined,
    // Neighbour pinned automatically by an Alt move (see positionedLayout).
    'data-sw-pinned': box && node.layout.pinned === 'true' ? 'true' : undefined,
    // Minimum height of a container: kept when its content was pinned in
    // place, or set by resizing.
    'data-sw-min-height': container
      ? Math.max(storedHeight ?? 0, size.height ?? 0) || undefined
      : undefined,
  }
}

/** Editor wrapper: every component is draggable, containers accept drops. */
export function CanvasNodeFrame({ node, children }: NodeFrameProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `node:${node.id}`,
    data: { kind: 'node', nodeId: node.id } satisfies CanvasNodeDragData,
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    disabled: !isContainerType(node.type),
  })
  const setRef = useCallback(
    (element: HTMLDivElement | null) => {
      setDragRef(element)
      setDropRef(element)
    },
    [setDragRef, setDropRef],
  )
  const selected = useWebsiteStore((state) => state.selectedId === node.id)

  return (
    <div
      ref={setRef}
      {...frameAttributes(node, [
        isDragging ? 'is-dragging' : '',
        isOver ? 'is-drop-target' : '',
        selected ? 'is-selected' : '',
      ])}
      data-sw-node={node.id}
      {...attributes}
      {...listeners}
    >
      {children}
      {selected && !isDragging && <ResizeHandles node={node} />}
    </div>
  )
}

/**
 * Preview wrapper: same layout and node id (the layout pass measures it),
 * but no dragging, dropping, selection or resize handles.
 */
export function PreviewNodeFrame({ node, children }: NodeFrameProps) {
  return (
    <div {...frameAttributes(node)} data-sw-node={node.id}>
      {children}
    </div>
  )
}

/** Same layout without drag/drop, for the drag overlay. */
export function StaticNodeFrame({ node, children }: NodeFrameProps) {
  return <div {...frameAttributes(node)}>{children}</div>
}
