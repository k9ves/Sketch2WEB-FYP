import type { ComponentType } from '../../schema/types'
import { findNode } from '../../store/tree'
import { useWebsiteStore } from '../../store/websiteStore'
import ContentFields from './ContentFields'
import StyleFields from './StyleFields'

const typeLabels: Record<ComponentType, string> = {
  website: 'Website',
  navbar: 'Navbar',
  hero: 'Hero',
  section: 'Section',
  columns: 'Columns',
  heading: 'Heading',
  text: 'Text',
  button: 'Link / button',
  image: 'Image',
  card: 'Card',
  footer: 'Footer',
}

/** Right panel: edits the selected node, or the website when none is. */
function PropertiesPanel() {
  const website = useWebsiteStore((state) => state.website)
  const selectedId = useWebsiteStore((state) => state.selectedId)
  const updateNode = useWebsiteStore((state) => state.updateNode)
  const duplicateNode = useWebsiteStore((state) => state.duplicateNode)
  const removeNode = useWebsiteStore((state) => state.removeNode)

  const node = (selectedId && findNode(website, selectedId)) || website
  const isRoot = node.id === website.id

  return (
    <aside
      className="editor-panel properties-panel"
      aria-label="Properties"
      // Clicks inside the panel must not clear the selection.
      onClick={(event) => event.stopPropagation()}
    >
      <h2>Properties</h2>
      <p className="property-type">
        {typeLabels[node.type]}
        {isRoot && selectedId === null && (
          <span className="property-type-note">Nothing selected</span>
        )}
      </p>
      <section className="property-group" aria-label="Content">
        <h3>Content</h3>
        {/* Remount per node so drafts never leak between components. */}
        <ContentFields
          key={node.id}
          node={node}
          onChange={(key, value) =>
            updateNode(node.id, { content: { [key]: value } })
          }
        />
      </section>
      <section className="property-group" aria-label="Style">
        <h3>Style</h3>
        <StyleFields
          node={node}
          onChange={(slot, value) =>
            updateNode(node.id, { style: { [slot]: value } })
          }
        />
      </section>
      {!isRoot && (
        <div className="property-actions">
          <button
            className="toolbar-button duplicate-selected-button"
            type="button"
            onClick={() => duplicateNode(node.id)}
          >
            Duplicate
          </button>
          <button
            className="toolbar-button delete-selected-button"
            type="button"
            onClick={() => removeNode(node.id)}
          >
            Delete
          </button>
        </div>
      )}
    </aside>
  )
}

export default PropertiesPanel
