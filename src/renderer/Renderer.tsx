import { createElement } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import {
  isComponentNode,
  isComponentType,
  type ComponentNode,
} from '../schema/types'
import { useWebsiteStore } from '../store/websiteStore'
import InlineText from '../editor/InlineText'
import { useNodeFrame, type NodeFrame } from './nodeFrame'

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

function WarningBox({
  message,
  selected = false,
  onClick,
}: {
  message: string
  selected?: boolean
  onClick?: (event: MouseEvent<HTMLElement>) => void
}) {
  return (
    <div
      className={[
        'sw-warning',
        onClick ? 'sw-component' : '',
        selected ? 'sw-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="alert"
      onClick={onClick}
    >
      {message}
    </div>
  )
}

function renderChildren(node: ComponentNode, Frame: NodeFrame): ReactNode {
  return node.children.map((child) => (
    <Frame key={child.id} node={child}>
      <Renderer node={child} />
    </Frame>
  ))
}

const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

function headingTag(level: string | undefined) {
  return headingTags[Number(level) - 1] ?? 'h2'
}

function layoutStyle(
  layout: Record<string, string>,
  defaultDisplay: 'flex' | 'grid' = 'grid',
  flexDefaults: {
    direction: 'row' | 'column'
    align: 'start' | 'center' | 'end' | 'stretch'
  } = { direction: 'row', align: 'stretch' },
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
      flexDirection:
        layout.direction === 'row' || layout.direction === 'column'
          ? layout.direction
          : flexDefaults.direction,
      alignItems: alignItems[layout.align] ?? alignItems[flexDefaults.align],
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
  const Frame = useNodeFrame()

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
  const children = renderChildren(node, Frame)
  const text = content.text
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    event.preventDefault()
    selectNode(node.type === 'website' ? null : node.id)
  }
  // Empty text shows a placeholder instead of a warning, so the component
  // can still be selected, renamed and deleted.
  const editableContent = (
    field: string,
    value: string | undefined,
    placeholder?: string,
  ) => (
    <InlineText
      value={value ?? ''}
      placeholder={placeholder}
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
    case 'navbar':
      // Brand, links, logo, etc. are child nodes (see store/containerText).
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
          {children}
        </nav>
      )
    case 'hero':
      return (
        <header
          className={selectableClassName(
            node,
            'container',
            'sw-hero',
            selectedId,
          )}
          // Hero content stacks vertically unless layout.direction says
          // otherwise (matches the .sw-hero design in App.css).
          style={layoutStyle(node.layout, 'flex', {
            direction: 'column',
            align: 'start',
          })}
          onClick={handleClick}
        >
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
    case 'heading': {
      return createElement(
        headingTag(content.level),
        {
          className: selectableClassName(
            node,
            'text',
            'sw-heading',
            selectedId,
          ),
          onClick: handleClick,
        },
        editableContent('text', text, 'Heading'),
      )
    }
    case 'text':
      return (
        <p
          className={selectableClassName(node, 'text', 'sw-text', selectedId)}
          onClick={handleClick}
        >
          {editableContent('text', text, 'Text')}
        </p>
      )
    case 'button': {
      const href = content.href ? safeHref(content.href) : undefined
      if (!href) {
        return (
          <WarningBox
            message="Button is missing a safe link."
            selected={node.id === selectedId}
            onClick={handleClick}
          />
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
          {editableContent('text', text, 'Button')}
        </a>
      )
    }
    case 'image': {
      if (!content.src || !content.alt) {
        return (
          <WarningBox
            message="Image is missing its source or alt text."
            selected={node.id === selectedId}
            onClick={handleClick}
          />
        )
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
          {children}
        </footer>
      )
  }
}

export default Renderer
