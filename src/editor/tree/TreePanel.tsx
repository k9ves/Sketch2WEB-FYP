import { useState } from 'react'
import type { ComponentNode } from '../../schema/types'
import { findPath } from '../../store/tree'
import { useWebsiteStore } from '../../store/websiteStore'
import { nodeElement } from '../freeform/canvasDom'
import { readNodeBox } from '../freeform/canvasLayout'
import { typeLabels } from '../typeLabels'

const PREVIEW_LENGTH = 28

/** Short text shown after the type label, or null when there is none. */
function nodePreview(node: ComponentNode): string | null {
  const text = (node.content.text || node.content.alt || '').trim()
  if (text === '') return null
  return text.length > PREVIEW_LENGTH
    ? `${text.slice(0, PREVIEW_LENGTH - 1)}…`
    : text
}

/** Ids of the ancestors of `id` (the node itself excluded). */
function ancestorIds(website: ComponentNode, id: string | null): string[] {
  if (id === null) return []
  const path = findPath(website, id) ?? []
  return path.slice(0, -1).map((node) => node.id)
}

function withoutIds(set: ReadonlySet<string>, ids: string[]): Set<string> {
  const next = new Set(set)
  ids.forEach((id) => next.delete(id))
  return next
}

interface TreeRowProps {
  node: ComponentNode
  depth: number
  selectedId: string | null
  collapsed: ReadonlySet<string>
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}

function TreeRow({
  node,
  depth,
  selectedId,
  collapsed,
  onToggle,
  onSelect,
}: TreeRowProps) {
  const hasChildren = node.children.length > 0
  const isExpanded = hasChildren && !collapsed.has(node.id)
  const isSelected = node.id === selectedId
  const isFree = readNodeBox(node) !== null
  const preview = nodePreview(node)

  return (
    <li
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
    >
      <div
        className={`tree-row${isSelected ? ' is-selected' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {hasChildren ? (
          <button
            className="tree-toggle"
            type="button"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            onClick={(event) => {
              event.stopPropagation()
              onToggle(node.id)
            }}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree-toggle" aria-hidden="true" />
        )}
        <button
          className="tree-label"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onSelect(node.id)
          }}
        >
          <span className="tree-type">{typeLabels[node.type]}</span>
          {preview !== null && <span className="tree-preview">{preview}</span>}
          {isFree && <span className="tree-badge">free</span>}
        </button>
      </div>
      {isExpanded && (
        <ul role="group">
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/** Left panel "Layers" tab: the component hierarchy, used for selection. */
function TreePanel() {
  const website = useWebsiteStore((state) => state.website)
  const selectedId = useWebsiteStore((state) => state.selectedId)
  const selectNode = useWebsiteStore((state) => state.selectNode)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [shownSelection, setShownSelection] = useState(selectedId)

  // A new selection (from the canvas or the tree) opens its ancestors.
  if (selectedId !== shownSelection) {
    setShownSelection(selectedId)
    const ancestors = ancestorIds(website, selectedId)
    if (ancestors.some((id) => collapsed.has(id))) {
      setCollapsed(withoutIds(collapsed, ancestors))
    }
  }

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function select(id: string) {
    // The website root is "selected" as no selection, which shows the
    // website settings and keeps Delete from targeting the root.
    selectNode(id === website.id ? null : id)
    nodeElement(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  return (
    <ul className="tree-panel" role="tree" aria-label="Component hierarchy">
      <TreeRow
        node={website}
        depth={0}
        selectedId={selectedId ?? website.id}
        collapsed={collapsed}
        onToggle={toggle}
        onSelect={select}
      />
    </ul>
  )
}

export default TreePanel
