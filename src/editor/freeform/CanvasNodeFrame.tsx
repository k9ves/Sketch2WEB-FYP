import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useCallback } from 'react'
import type { CSSProperties } from 'react'
import type { NodeFrameProps } from '../../renderer/nodeFrame'
import type { ComponentNode } from '../../schema/types'
import { isContainerType } from '../../store/tree'
import { readLength, readNodeBox } from './canvasLayout'

export interface CanvasNodeDragData {
  kind: 'node'
  nodeId: string
}

/** Shared wrapper attributes: flow layout, or absolute when positioned. */
function frameAttributes(node: ComponentNode, extraClasses: string[] = []) {
  const box = readNodeBox(node)
  const container = isContainerType(node.type)
  const className = [
    'sw-node',
    container ? 'is-container' : 'is-leaf',
    box ? 'is-positioned' : '',
    ...extraClasses,
  ]
    .filter(Boolean)
    .join(' ')

  // Leaves hug their content (their stored width is only the wrap limit);
  // positioned containers keep their stored width. Nothing gets wider than
  // its container (e.g. when a scrollbar appears and the canvas gets
  // narrower).
  const style: CSSProperties | undefined = box
    ? container
      ? { left: box.x, top: box.y, width: box.width, maxWidth: '100%' }
      : { left: box.x, top: box.y, maxWidth: `min(${box.width}px, 100%)` }
    : undefined

  return {
    className,
    style,
    'data-sw-positioned': box ? 'true' : undefined,
    // Right edge it is meant to reach; the container keeps this much width
    // (see containPositionedChildren), whatever it is drawn at right now.
    'data-sw-right': box ? box.x + box.width : undefined,
    // Neighbour pinned automatically by an Alt move (see positionedLayout).
    'data-sw-pinned': box && node.layout.pinned === 'true' ? 'true' : undefined,
    // Minimum height kept for containers whose content was pinned in place.
    'data-sw-min-height': container
      ? (readLength(node.layout.height) ?? undefined)
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

  return (
    <div
      ref={setRef}
      {...frameAttributes(node, [
        isDragging ? 'is-dragging' : '',
        isOver ? 'is-drop-target' : '',
      ])}
      data-sw-node={node.id}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

/** Same layout without drag/drop, for the drag overlay. */
export function StaticNodeFrame({ node, children }: NodeFrameProps) {
  return <div {...frameAttributes(node)}>{children}</div>
}
