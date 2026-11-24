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
  const fullWidth = isContainerType(node.type)
  const className = [
    'sw-node',
    isContainerType(node.type) ? 'is-container' : 'is-leaf',
    box ? 'is-positioned' : '',
    ...extraClasses,
  ]
    .filter(Boolean)
    .join(' ')
  // Leaves hug their content; their stored width is only the wrap limit.
  const style: CSSProperties | undefined = box
    ? fullWidth
      ? { left: box.x, top: box.y, width: box.width }
      : { left: box.x, top: box.y, maxWidth: box.width }
    : undefined

  return {
    className,
    style,
    'data-sw-positioned': box ? 'true' : undefined,
    // Minimum height kept for containers whose content was pinned in place.
    'data-sw-min-height': isContainerType(node.type)
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
