import type { ComponentNode } from '../../schema/types'
import { findNode, findParent } from '../../store/tree'
import { readNodeBox, readNodeSize } from '../freeform/canvasLayout'
import { typeLabels } from '../typeLabels'
import LayoutFields from './LayoutFields'
import { useWebsiteStore } from '../../store/websiteStore'
import ContentFields from './ContentFields'
import StyleFields from './StyleFields'

/** Nearest ancestor (below the website) with a free position, if any. */
function findFreeAncestor(
  website: ComponentNode,
  id: string,
): ComponentNode | undefined {
  let parent = findParent(website, id)
  while (parent && parent.id !== website.id) {
    if (readNodeBox(parent) !== null) return parent
    parent = findParent(website, parent.id)
  }
  return undefined
}

/** Right panel: edits the selected node, or the website when none is. */
function PropertiesPanel() {
  const website = useWebsiteStore((state) => state.website)
  const selectedId = useWebsiteStore((state) => state.selectedId)
  const updateNode = useWebsiteStore((state) => state.updateNode)
  const duplicateNode = useWebsiteStore((state) => state.duplicateNode)
  const removeNode = useWebsiteStore((state) => state.removeNode)
  const selectNode = useWebsiteStore((state) => state.selectNode)
  const returnToFlow = useWebsiteStore((state) => state.returnToFlow)
  const returnChildrenToFlow = useWebsiteStore(
    (state) => state.returnChildrenToFlow,
  )

  const node = (selectedId && findNode(website, selectedId)) || website
  const isRoot = node.id === website.id
  const box = readNodeBox(node)
  const size = readNodeSize(node)
  const freeChildren = node.children.filter(
    (child) => readNodeBox(child) !== null,
  ).length
  const freeAncestor = box ? undefined : findFreeAncestor(website, node.id)

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
      {(!isRoot || freeChildren > 0) && (
        <section className="property-group" aria-label="Layout">
          <h3>Layout</h3>
          <LayoutFields
            node={node}
            onChange={(key, value) =>
              updateNode(node.id, { layout: { [key]: value } })
            }
          />
          {freeChildren > 0 && (
            <div className="property-free-children">
              <p className="property-note">
                {freeChildren} of {node.children.length} components inside have
                a free position, so layout settings do not move them.
              </p>
              <button
                className="toolbar-button"
                type="button"
                onClick={() => returnChildrenToFlow(node.id)}
              >
                Return all to flow
              </button>
            </div>
          )}
          {!isRoot && (
            <div className="property-position">
              <span>
                Size:{' '}
                {size.width === null && size.height === null
                  ? 'Auto'
                  : `${size.width === null ? 'auto' : Math.round(size.width)} × ${
                      size.height === null ? 'auto' : Math.round(size.height)
                    }`}
              </span>
              {(size.width !== null || size.height !== null) && (
                <button
                  className="toolbar-button"
                  type="button"
                  // An empty value reads as "not set" (see readNodeSize).
                  onClick={() =>
                    updateNode(node.id, {
                      layout: { boxWidth: '', boxHeight: '' },
                    })
                  }
                >
                  Reset size
                </button>
              )}
            </div>
          )}
          {!isRoot && (
            <div className="property-position">
              <span>{box ? 'Free position' : 'In flow'}</span>
              {box && (
                <button
                  className="toolbar-button"
                  type="button"
                  onClick={() => returnToFlow(node.id)}
                >
                  Return to flow
                </button>
              )}
            </div>
          )}
          {freeAncestor && (
            <div className="property-free-children">
              <p className="property-note">
                It sits inside a {typeLabels[freeAncestor.type].toLowerCase()}{' '}
                that has a free position.
              </p>
              <button
                className="toolbar-button"
                type="button"
                onClick={() => selectNode(freeAncestor.id)}
              >
                Select {typeLabels[freeAncestor.type].toLowerCase()}
              </button>
            </div>
          )}
        </section>
      )}
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
