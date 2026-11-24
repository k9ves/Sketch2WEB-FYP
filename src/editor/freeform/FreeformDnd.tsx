import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  Collision,
  CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import Renderer from '../../renderer/Renderer'
import { NodeFrameContext } from '../../renderer/nodeFrame'
import type { ComponentNode } from '../../schema/types'
import { findNode, findParent, isContainerType } from '../../store/tree'
import { useWebsiteStore } from '../../store/websiteStore'
import {
  createComponentNode,
  isAddableComponentType,
} from '../componentFactory'
import type { AddableComponentType } from '../componentFactory'
import { StaticNodeFrame } from './CanvasNodeFrame'
import { nodeElement } from './canvasDom'
import type { Point, Rect } from './geometry'
import { planFlowDrop } from './flowPlacement'
import type { FlowPlan } from './flowPlacement'
import {
  containPositionedChildren,
  freezeFlowSiblings,
  planFreeDrop,
} from './positionedLayout'
import type { FreePlan } from './positionedLayout'

/**
 * Edge zone in px. A normal drop this close to a container's edge goes to
 * its parent instead (before or after the container), so a component can
 * always be moved out again, even when children cover their container.
 */
const EDGE_ZONE = 12

interface EdgeRect {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

function isNearEdge(rect: EdgeRect, point: Point): boolean {
  // Small containers keep most of their area for dropping inside.
  const zone = Math.min(EDGE_ZONE, rect.width / 4, rect.height / 4)
  return (
    point.x - rect.left < zone ||
    rect.right - point.x < zone ||
    point.y - rect.top < zone ||
    rect.bottom - point.y < zone
  )
}

export interface PaletteDragData {
  kind: 'palette'
  componentType: AddableComponentType
}

interface ActiveDrag {
  kind: 'node' | 'palette'
  node: ComponentNode
  /** Ids that cannot be drop targets (the dragged node and its subtree). */
  excluded: Set<string>
  /** Overlay width in px; undefined lets the component size itself. */
  width: number | undefined
  /** Viewport rect of the drag source when the drag started. */
  origin: Rect
  /** Window scroll offset when the drag started. */
  scroll: Point
  /** Pointer position at drag start, null for keyboard drags. */
  pointer: Point | null
}

type DropPlan =
  | ({ mode: 'flow'; containerId: string } & FlowPlan)
  | ({ mode: 'free'; containerId: string } & FreePlan)

/** Default overlay width for new containers dragged from the palette. */
const paletteWidths: Partial<Record<AddableComponentType, number>> = {
  navbar: 720,
  hero: 640,
  section: 640,
  columns: 560,
  card: 280,
  footer: 640,
}

function collectIds(node: ComponentNode, ids = new Set<string>()) {
  ids.add(node.id)
  node.children.forEach((child) => collectIds(child, ids))
  return ids
}

function pointerOf(event: Event): Point | null {
  return event instanceof MouseEvent || event instanceof PointerEvent
    ? { x: event.clientX, y: event.clientY }
    : null
}

function isPaletteDragData(value: unknown): value is PaletteDragData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    value.kind === 'palette' &&
    'componentType' in value &&
    isAddableComponentType(value.componentType)
  )
}

function nodeIdOf(value: unknown): string | null {
  return typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    value.kind === 'node' &&
    'nodeId' in value &&
    typeof value.nodeId === 'string'
    ? value.nodeId
    : null
}

function OverlayContent({ drag }: { drag: ActiveDrag }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (ref.current) containPositionedChildren(ref.current)
  })

  return (
    <div
      ref={ref}
      className={`sw-drag-overlay${isContainerType(drag.node.type) ? ' is-container' : ''}`}
      style={{ width: drag.width }}
      data-sw-drag-overlay=""
    >
      <NodeFrameContext.Provider value={StaticNodeFrame}>
        <Renderer node={drag.node} />
      </NodeFrameContext.Provider>
    </div>
  )
}

/**
 * Drag and drop for the hybrid canvas.
 * - Normal drag: insert into the target container's flow at the pointer.
 * - Alt + drag: place absolutely at the dropped spot, moved to the nearest
 *   free position when it would overlap or touch another component.
 * Esc cancels. Invalid drops change nothing.
 */
function FreeformDndProvider({ children }: { children: ReactNode }) {
  const addNode = useWebsiteStore((state) => state.addNode)
  const placeNode = useWebsiteStore((state) => state.placeNode)
  const selectNode = useWebsiteStore((state) => state.selectNode)
  const [drag, setDrag] = useState<ActiveDrag | null>(null)
  const [plan, setPlan] = useState<DropPlan | null>(null)
  const dragRef = useRef<ActiveDrag | null>(null)
  const overIdRef = useRef<string | null>(null)
  const deltaRef = useRef<Point>({ x: 0, y: 0 })
  const altRef = useRef(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  // Deepest container under the pointer wins; the dragged subtree is skipped.
  // Near that container's edge (normal drag only), its parent wins: one
  // level out per edge, so the component lands right before or after it.
  const collisionDetection = useCallback<CollisionDetection>(
    ({
      droppableContainers,
      droppableRects,
      pointerCoordinates,
      collisionRect,
    }) => {
      const point = pointerCoordinates ?? {
        x: collisionRect.left + collisionRect.width / 2,
        y: collisionRect.top + collisionRect.height / 2,
      }
      const excluded = dragRef.current?.excluded
      const hits: { collision: Collision; area: number }[] = []

      for (const container of droppableContainers) {
        if (container.disabled || excluded?.has(String(container.id))) continue
        const rect = droppableRects.get(container.id)
        if (
          !rect ||
          point.x < rect.left ||
          point.x > rect.right ||
          point.y < rect.top ||
          point.y > rect.bottom
        ) {
          continue
        }
        const area = rect.width * rect.height
        hits.push({
          collision: {
            id: container.id,
            data: { droppableContainer: container, value: area },
          },
          area,
        })
      }

      const sorted = hits
        .sort((a, b) => a.area - b.area)
        .map((hit) => hit.collision)
      const inner = sorted[0]
      const innerRect = inner ? droppableRects.get(inner.id) : undefined
      // Alt places freely, where a spot by the edge can be meant.
      if (
        !altRef.current &&
        inner &&
        innerRect &&
        isNearEdge(innerRect, point)
      ) {
        const { website } = useWebsiteStore.getState()
        const parent = findParent(website, String(inner.id))
        const outer = parent && sorted.find((hit) => hit.id === parent.id)
        if (outer) {
          return [outer, ...sorted.filter((hit) => hit !== outer)]
        }
      }
      return sorted
    },
    [],
  )

  const computePlan = useCallback((): DropPlan | null => {
    const current = dragRef.current
    const containerId = overIdRef.current
    if (!current || !containerId) return null

    // dnd-kit's delta includes page auto-scroll; subtract it to get the
    // on-screen movement, since all rects here are viewport rects.
    const delta = {
      x: deltaRef.current.x - (window.scrollX - current.scroll.x),
      y: deltaRef.current.y - (window.scrollY - current.scroll.y),
    }
    const excludeId = current.kind === 'node' ? current.node.id : null

    if (altRef.current) {
      const overlay = document.querySelector('[data-sw-drag-overlay]')
      const size = overlay?.getBoundingClientRect() ?? current.origin
      const free = planFreeDrop(
        containerId,
        {
          x: current.origin.x + delta.x,
          y: current.origin.y + delta.y,
          width: size.width,
          height: size.height,
        },
        excludeId,
      )
      return free && { mode: 'free', containerId, ...free }
    }

    const start = current.pointer ?? {
      x: current.origin.x + current.origin.width / 2,
      y: current.origin.y + current.origin.height / 2,
    }
    const flow = planFlowDrop(
      containerId,
      { x: start.x + delta.x, y: start.y + delta.y },
      excludeId,
    )
    return flow && { mode: 'flow', containerId, ...flow }
  }, [])

  // Alt can be pressed or released at any time during a drag.
  useEffect(() => {
    if (!drag) return

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Alt') return
      event.preventDefault() // keep the browser menu bar from taking focus
      altRef.current = event.type === 'keydown'
      setPlan(computePlan())
    }
    const handlePointer = (event: PointerEvent) => {
      if (event.altKey === altRef.current) return
      altRef.current = event.altKey
      setPlan(computePlan())
    }

    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKey)
    window.addEventListener('pointermove', handlePointer)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKey)
      window.removeEventListener('pointermove', handlePointer)
    }
  }, [drag, computePlan])

  function reset() {
    dragRef.current = null
    overIdRef.current = null
    deltaRef.current = { x: 0, y: 0 }
    setDrag(null)
    setPlan(null)
  }

  function handleDragStart(event: DragStartEvent) {
    const { website } = useWebsiteStore.getState()
    const data = event.active.data.current
    const nodeId = nodeIdOf(data)
    const activator = event.activatorEvent
    // dnd-kit measures the active rect after this event, so read the DOM.
    const source =
      nodeId !== null
        ? nodeElement(nodeId)
        : activator.target instanceof Element
          ? activator.target.closest('.component-palette-button')
          : null
    const bounds = source?.getBoundingClientRect()
    const origin: Rect = bounds
      ? {
          x: bounds.left,
          y: bounds.top,
          width: bounds.width,
          height: bounds.height,
        }
      : { x: 0, y: 0, width: 0, height: 0 }
    const pointer = pointerOf(activator)
    const scroll = { x: window.scrollX, y: window.scrollY }
    altRef.current =
      activator instanceof MouseEvent || activator instanceof KeyboardEvent
        ? activator.altKey
        : false

    let next: ActiveDrag | null = null
    if (nodeId !== null) {
      const node = findNode(website, nodeId)
      if (node) {
        next = {
          kind: 'node',
          node,
          excluded: collectIds(node),
          width: origin.width,
          origin,
          scroll,
          pointer,
        }
      }
    } else if (isPaletteDragData(data)) {
      next = {
        kind: 'palette',
        node: createComponentNode(data.componentType),
        excluded: new Set(),
        width: paletteWidths[data.componentType],
        origin,
        scroll,
        pointer,
      }
    }

    dragRef.current = next
    setDrag(next)
  }

  function handleDragMove(event: DragMoveEvent) {
    overIdRef.current = event.over ? String(event.over.id) : null
    deltaRef.current = event.delta
    setPlan(computePlan())
  }

  function handleDragEnd(event: DragEndEvent) {
    overIdRef.current = event.over ? String(event.over.id) : null
    deltaRef.current = event.delta
    const current = dragRef.current
    const finalPlan = computePlan()
    reset()
    if (!current || !finalPlan) return

    try {
      commitDrop(current, finalPlan)
    } catch (error) {
      // A rejected drop must never break the editor.
      console.warn('Drop was not applied:', error)
    }
  }

  function commitDrop(current: ActiveDrag, drop: DropPlan) {
    const { website } = useWebsiteStore.getState()
    const container = findNode(website, drop.containerId)
    if (!container || !isContainerType(container.type)) return
    if (current.excluded.has(container.id)) return

    if (current.kind === 'palette') {
      if (drop.mode === 'flow') {
        const index = drop.beforeId
          ? container.children.findIndex((child) => child.id === drop.beforeId)
          : container.children.length
        addNode(container.id, current.node, index === -1 ? undefined : index)
      } else {
        if (!drop.position) return
        const { x, y, width } = drop.position
        addNode(container.id, {
          ...current.node,
          layout: {
            ...current.node.layout,
            x: String(Math.round(x)),
            y: String(Math.round(y)),
            width: String(Math.round(width)),
          },
        })
      }
      selectNode(current.node.id)
      return
    }

    const nodeId = current.node.id
    const parent = findParent(website, nodeId)
    if (!parent) return
    const others = container.children.filter((child) => child.id !== nodeId)
    const currentIndex = parent.children.findIndex(
      (child) => child.id === nodeId,
    )

    if (drop.mode === 'flow') {
      const index = drop.beforeId
        ? others.findIndex((child) => child.id === drop.beforeId)
        : others.length
      if (index === -1) return
      const unchanged =
        parent.id === container.id &&
        index === currentIndex &&
        current.node.layout.x === undefined
      if (!unchanged) placeNode(nodeId, container.id, index, null)
      return
    }

    if (!drop.position) return
    const index = parent.id === container.id ? currentIndex : others.length
    // Leaving the flow would close the gap and shift the old neighbours, so
    // pin them where they are (measured before anything changes).
    const leavesFlow = current.node.layout.x === undefined
    const pinned = leavesFlow ? freezeFlowSiblings(parent.id, nodeId) : {}
    // Remember where the node sat in flow, so "Return to flow" can put it
    // back there even after it moved to another container.
    // A pinned neighbour still sits at its flow index, so the same applies.
    const { flowParent, flowIndex, pinned: wasPinned } = current.node.layout
    const home =
      leavesFlow || wasPinned === 'true'
        ? { flowParent: parent.id, flowIndex: String(currentIndex) }
        : flowParent !== undefined && flowIndex !== undefined
          ? { flowParent, flowIndex }
          : undefined
    placeNode(
      nodeId,
      container.id,
      index,
      drop.position,
      home ? { ...pinned, [nodeId]: home } : pinned,
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {drag ? <OverlayContent drag={drag} /> : null}
      </DragOverlay>
      {plan && (
        <div
          className={[
            'sw-drop-preview',
            plan.mode === 'flow' ? 'is-flow' : 'is-free',
            plan.mode === 'free' && !plan.position ? 'is-invalid' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={
            plan.mode === 'flow'
              ? {
                  left: plan.indicator.x,
                  top: plan.indicator.y,
                  width: plan.indicator.width,
                  height: plan.indicator.height,
                }
              : {
                  left: plan.preview.x,
                  top: plan.preview.y,
                  width: plan.preview.width,
                  height: plan.preview.height,
                }
          }
          data-container={plan.containerId}
          aria-hidden="true"
        />
      )}
    </DndContext>
  )
}

export default FreeformDndProvider
