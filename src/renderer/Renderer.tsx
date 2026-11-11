import type { CSSProperties, ReactNode } from 'react'
import {
  isComponentNode,
  isComponentType,
  type ComponentNode,
} from '../schema/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function className(node: ComponentNode, slot: string, base: string): string {
  return [base, node.style[slot]].filter(Boolean).join(' ')
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
  return node.children.map((child) => <Renderer key={child.id} node={child} />)
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

  switch (node.type) {
    case 'website':
      return (
        <div className={className(node, 'background', 'sw-website')}>
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
          className={className(node, 'container', 'sw-navbar')}
          aria-label="Main navigation"
        >
          <a className="sw-brand" href="#top">
            {brand}
          </a>
          <div className="sw-nav-links">
            {links.map((label, index) => {
              if (!label) return null
              const href = `#${label.toLowerCase().replace(/\s+/g, '-')}`
              return (
                <a key={`${node.id}-link-${index}`} href={safeHref(href)}>
                  {label}
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
          className={className(node, 'container', 'sw-hero')}
          style={layoutStyle(node.layout, 'flex')}
        >
          {title && <h1 className="sw-hero-heading">{title}</h1>}
          {content.description && <p>{content.description}</p>}
          {children}
        </header>
      )
    case 'section':
      return (
        <section className={className(node, 'container', 'sw-section')}>
          {title && <h2>{title}</h2>}
          {text && <p className="sw-section-description">{text}</p>}
          {children}
        </section>
      )
    case 'columns':
      return (
        <div
          className={className(
            node,
            'container',
            `sw-columns${node.layout.display === 'flex' ? ' is-flex' : ''}`,
          )}
          style={layoutStyle(node.layout)}
        >
          {children}
        </div>
      )
    case 'heading':
      return text ? (
        <h2 className={className(node, 'text', 'sw-heading')}>{text}</h2>
      ) : (
        <WarningBox message="Heading is missing its text." />
      )
    case 'text':
      return text ? (
        <p className={className(node, 'text', 'sw-text')}>{text}</p>
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
        <a className={className(node, 'button', 'sw-button')} href={href}>
          {text}
        </a>
      )
    }
    case 'image': {
      if (!content.src || !content.alt) {
        return <WarningBox message="Image is missing its source or alt text." />
      }
      return (
        <img
          className={className(node, 'image', 'sw-image')}
          src={content.src}
          alt={content.alt}
        />
      )
    }
    case 'card':
      if (!title) return <WarningBox message="Card is missing its title." />
      return (
        <article className={className(node, 'container', 'sw-card')}>
          <h3>{title}</h3>
          {text && <p>{text}</p>}
          {content.description && <p>{content.description}</p>}
          {children}
        </article>
      )
    case 'footer':
      return (
        <footer className={className(node, 'container', 'sw-footer')}>
          {text && <p>{text}</p>}
          {children}
        </footer>
      )
  }
}

export default Renderer
