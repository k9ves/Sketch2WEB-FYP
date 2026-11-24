import { useDraggable } from '@dnd-kit/core'
import type { AddableComponentType } from './componentFactory'
import type { PaletteDragData } from './freeform/FreeformDnd'

interface PaletteItemProps {
  type: AddableComponentType
  selected: boolean
  onSelect: (type: AddableComponentType) => void
}

/** Click to choose for the Add button, or drag onto the canvas. */
function PaletteItem({ type, selected, onSelect }: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { kind: 'palette', componentType: type } satisfies PaletteDragData,
  })

  return (
    <button
      ref={setNodeRef}
      className={`component-palette-button${isDragging ? ' is-dragging' : ''}`}
      type="button"
      {...attributes}
      {...listeners}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(type)
      }}
    >
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </button>
  )
}

export default PaletteItem
