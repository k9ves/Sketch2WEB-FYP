import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import {
  isComponentNode,
  isComponentType,
  type ComponentNode,
} from '../schema/types'
import {
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable'
import { useWebsiteStore } from '../store/websiteStore'
import InlineText from '../editor/InlineText'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function className(node: ComponentNode, slot: string, base: string): string {
  return [base, node.style[slot]].filter(Boolean).join(' ')
}

function selectableClassName(
  node: ComponentNode,
  slot: string,
  base: string,
  selectedId: string | null,
): string {
  return [
    className(node, slot, base),
    'sw-component',
    node.id === selectedId ? 'sw-selected' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function safeHref(value: string): string | undefined {
  const href = value.trim()
  if (
    /^(https?:|mailto:|tel:|#|\/)/i.test(href) ||
    !/^[a-z][a-z\d+.-]*:/i.test(href)
  ) {
    return href
  }
  return undefined
}

function WarningBox({ message }: { message: string }) {
  return (
    <div className="sw-warning" role="alert">
      {message}
    </div>
  )
}

function renderChildren(node: ComponentNode): ReactNode {
  const items = node.children.map((child) => `canvas-${child.id}`)
  return (
    <SortableContext items={items} strategy={rectSortingStrategy}>
      {node.children.map((child) => (
        <SortableChild key={child.id} node={child} parentId={node.id} />
      ))}
    </SortableContext>
  )
}

function SortableChild({
  node,
  parentId,
}: {
  node: ComponentNode
  parentId: string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `canvas-${node.id}`,
    data: { kind: 'canvas-node', nodeId: node.id, parentId },
  })
  const style: CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
      : undefined,
    transition,
    opacity: isDragging ? 0.45 : undefined,
    touchAction: 'none',
  }

  return (
    <div
      ref={setNodeRef}
      className="sw-sortable-item"
      style={style}
      {...attributes}
      {...listeners}
    >
      <Renderer node={node} />
    </div>
  )
}

function layoutStyle(
  layout: Record<string, string>,
  defaultDisplay: 'flex' | 'grid' = 'grid',
): CSSProperties {
  const rawColumns = Number(layout.columns)
  const columns = Number.isFinite(rawColumns)
    ? Math.min(6, Math.max(1, Math.floor(rawColumns)))
    : 2
  const rawGap = Number(layout.gap)
  const gap = Number.isFinite(rawGap)
    ? `${Math.min(32, Math.max(0, rawGap)) * 0.25}rem`
    : layout.gap || '1rem'

  if (
    layout.display === 'flex' ||
    (layout.display !== 'grid' && defaultDisplay === 'flex')
  ) {
    const alignItems: Record<string, CSSProperties['alignItems']> = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
      stretch: 'stretch',
    }
    const justifyContent: Record<string, CSSProperties['justifyContent']> = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
      between: 'space-between',
      around: 'space-around',
      evenly: 'space-evenly',
    }

    return {
      display: 'flex',
      flexDirection: layout.direction === 'column' ? 'column' : 'row',
      alignItems: alignItems[layout.align] ?? 'stretch',
      justifyContent: justifyContent[layout.justify] ?? 'flex-start',
      gap,
    }
  }

  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap,
  }
}

function Renderer({ node }: { node: unknown }) {
  const selectedId = useWebsiteStore((state) => state.selectedId)
  const selectNode = useWebsiteStore((state) => state.selectNode)
  const updateNode = useWebsiteStore((state) => state.updateNode)

  if (!isRecord(node)) {
    return <WarningBox message="Invalid component: expected an object." />
  }
  if (!isComponentType(node.type)) {
    return (
      <WarningBox
        message={`Unknown component type: ${String(node.type ?? 'missing')}.`}
      />
    )
  }
  if (!isComponentNode(node)) {
    return (
      <WarningBox message="Invalid component: required fields are missing." />
    )
  }

  const content = node.content
  const children = renderChildren(node)
  const title = content.title
  const text = content.text
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    event.preventDefault()
    selectNode(node.type === 'website' ? null : node.id)
  }
  const editableContent = (field: string, value: string) => (
    <InlineText
      value={value}
      onSave={(nextValue) =>
        updateNode(node.id, { content: { [field]: nextValue } })
      }
    />
  )

  switch (node.type) {
    case 'website':
      return (
        <div
          className={selectableClassName(
            node,
            'background',
            'sw-website',
            selectedId,
          )}
          onClick={handleClick}
        >
          {children}
        </div>
      )
    case 'navbar': {
      const brand = content.brand || title
      if (!brand) return <WarningBox message="Navbar is missing its brand." />
      const links = content.links
        ? content.links.split(',').map((label) => label.trim())
        : []

      return (
        <nav
          className={selectableClassName(
            node,
            'container',
            'sw-navbar',
            selectedId,
          )}
          aria-label="Main navigation"
          onClick={handleClick}
        >
          <a className="sw-brand" href="#top">
            {editableContent('brand', brand)}
          </a>
          <div className="sw-nav-links">
            {links.map((label, index) => {
              if (!label) return null
              const href = `#${label.toLowerCase().replace(/\s+/g, '-')}`
              return (
                <a key={`${node.id}-link-${index}`} href={safeHref(href)}>
                  <InlineText
                    value={label}
                    onSave={(nextLabel) => {
                      const nextLinks = [...links]
                      nextLinks[index] = nextLabel
                      updateNode(node.id, {
                        content: { links: nextLinks.join(', ') },
                      })
                    }}
                  />
                </a>
              )
            })}
          </div>
        </nav>
      )
    }
    case 'hero':
      return (
        <header
          className={selectableClassName(
            node,
            'container',
            'sw-hero',
            selectedId,
          )}
          style={layoutStyle(node.layout, 'flex')}
          onClick={handleClick}
        >
          {title && (
            <h1 className="sw-hero-heading">
              {editableContent('title', title)}
            </h1>
          )}
          {content.description && (
            <p>{editableContent('description', content.description)}</p>
          )}
          {children}
        </header>
      )
    case 'section':
      return (
        <section
          className={selectableClassName(
            node,
            'container',
            'sw-section',
            selectedId,
          )}
          onClick={handleClick}
        >
          {title && <h2>{editableContent('title', title)}</h2>}
          {text && (
            <p className="sw-section-description">
              {editableContent('text', text)}
            </p>
          )}
          {children}
        </section>
      )
    case 'columns':
      return (
        <div
          className={selectableClassName(
            node,
            'container',
            `sw-columns${node.layout.display === 'flex' ? ' is-flex' : ''}`,
            selectedId,
          )}
          style={layoutStyle(node.layout)}
          onClick={handleClick}
        >
          {children}
        </div>
      )
    case 'heading':
      return text ? (
        <h2
          className={selectableClassName(
            node,
            'text',
            'sw-heading',
            selectedId,
          )}
          onClick={handleClick}
        >
          {editableContent('text', text)}
        </h2>
      ) : (
        <WarningBox message="Heading is missing its text." />
      )
    case 'text':
      return text ? (
        <p
          className={selectableClassName(node, 'text', 'sw-text', selectedId)}
          onClick={handleClick}
        >
          {editableContent('text', text)}
        </p>
      ) : (
        <WarningBox message="Text component is missing its text." />
      )
    case 'button': {
      const href = content.href ? safeHref(content.href) : undefined
      if (!text || !href) {
        return (
          <WarningBox message="Button is missing a label or a safe link." />
        )
      }
      return (
        <a
          className={selectableClassName(
            node,
            'button',
            'sw-button',
            selectedId,
          )}
          href={href}
          onClick={handleClick}
        >
          {editableContent('text', text)}
        </a>
      )
    }
    case 'image': {
      if (!content.src || !content.alt) {
        return <WarningBox message="Image is missing its source or alt text." />
      }
      return (
        <img
          className={selectableClassName(node, 'image', 'sw-image', selectedId)}
          src={content.src}
          alt={content.alt}
          onClick={handleClick}
        />
      )
    }
    case 'card':
      if (!title) return <WarningBox message="Card is missing its title." />
      return (
        <article
          className={selectableClassName(
            node,
            'container',
            'sw-card',
            selectedId,
          )}
          onClick={handleClick}
        >
          <h3>{editableContent('title', title)}</h3>
          {text && <p>{editableContent('text', text)}</p>}
          {content.description && (
            <p>{editableContent('description', content.description)}</p>
          )}
          {children}
        </article>
      )
    case 'footer':
      return (
        <footer
          className={selectableClassName(
            node,
            'container',
            'sw-footer',
            selectedId,
          )}
          onClick={handleClick}
        >
          {text && <p>{editableContent('text', text)}</p>}
          {children}
        </footer>
      )
  }
}

export default Renderer
