import type { CSSProperties, ReactNode } from 'react'
import type { ComponentLayout, ComponentProps } from '../schema/types'
import { isComponentType } from '../schema/validate'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getProps(value: unknown): ComponentProps {
  if (!isRecord(value)) return {}
  return value as ComponentProps
}

function getLayout(value: unknown): ComponentLayout {
  if (!isRecord(value)) return {}
  return value as ComponentLayout
}

function getChildren(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function safeHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
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

function renderChildren(children: unknown, parentId: string): ReactNode {
  return getChildren(children).map((child, index) => (
    <Renderer key={`${parentId}-${index}`} node={child} />
  ))
}

function layoutStyle(layout: ComponentLayout): CSSProperties {
  const columns =
    typeof layout.columns === 'number' && Number.isFinite(layout.columns)
      ? Math.min(6, Math.max(1, Math.floor(layout.columns)))
      : 2
  const gap =
    typeof layout.gap === 'number' && Number.isFinite(layout.gap)
      ? Math.min(8, Math.max(0, layout.gap))
      : 1

  if (layout.display === 'flex') {
    return {
      display: 'flex',
      flexDirection: layout.direction === 'column' ? 'column' : 'row',
      alignItems:
        layout.align === 'start'
          ? 'flex-start'
          : layout.align === 'end'
            ? 'flex-end'
            : (layout.align ?? 'stretch'),
      gap: `${gap}rem`,
    }
  }

  return {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: `${gap}rem`,
  }
}

function Renderer({ node }: { node: unknown }) {
  if (!isRecord(node))
    return <WarningBox message="Invalid component: expected an object." />

  const id = typeof node.id === 'string' ? node.id : 'unknown'
  if (!isComponentType(node.type)) {
    return (
      <WarningBox
        message={`Unknown component type: ${String(node.type ?? 'missing')}.`}
      />
    )
  }

  const props = getProps(node.props)
  const children = renderChildren(node.children, id)
  const title = typeof props.title === 'string' ? props.title : undefined
  const text = typeof props.text === 'string' ? props.text : undefined

  switch (node.type) {
    case 'navbar': {
      const brand = typeof props.brand === 'string' ? props.brand : title
      if (!brand) return <WarningBox message="Navbar is missing its brand." />
      const links = Array.isArray(props.links) ? props.links : []

      return (
        <nav className="sw-navbar" aria-label="Main navigation">
          <a className="sw-brand" href="#top">
            {brand}
          </a>
          <div className="sw-nav-links">
            {links.map((link, index) => {
              if (!isRecord(link) || typeof link.label !== 'string') return null
              const href = safeHref(link.href)
              return href ? (
                <a key={`${id}-link-${index}`} href={href}>
                  {link.label}
                </a>
              ) : null
            })}
          </div>
        </nav>
      )
    }
    case 'hero':
      if (!title) return <WarningBox message="Hero is missing its title." />
      return (
        <header className="sw-hero">
          <h1>{title}</h1>
          {typeof props.description === 'string' && <p>{props.description}</p>}
          <div className="sw-hero-children">{children}</div>
        </header>
      )
    case 'section':
      return (
        <section className="sw-section">
          {title && <h2>{title}</h2>}
          {text && <p className="sw-section-description">{text}</p>}
          {children}
        </section>
      )
    case 'columns': {
      const layout = getLayout(node.layout)
      return (
        <div
          className={`sw-columns${layout.display === 'flex' ? ' is-flex' : ''}`}
          style={layoutStyle(layout)}
        >
          {children}
        </div>
      )
    }
    case 'heading': {
      const content = text ?? title
      return content ? (
        <h2>{content}</h2>
      ) : (
        <WarningBox message="Heading is missing its text." />
      )
    }
    case 'text':
      return text ? (
        <p>{text}</p>
      ) : (
        <WarningBox message="Text component is missing its text." />
      )
    case 'button': {
      const label = typeof props.label === 'string' ? props.label : text
      const href = safeHref(props.href)
      if (!label || !href)
        return (
          <WarningBox message="Button is missing a label or a safe link." />
        )
      return (
        <a className="sw-button" href={href}>
          {label}
        </a>
      )
    }
    case 'image': {
      if (typeof props.src !== 'string' || typeof props.alt !== 'string') {
        return <WarningBox message="Image is missing its source or alt text." />
      }
      return <img className="sw-image" src={props.src} alt={props.alt} />
    }
    case 'card':
      if (!title) return <WarningBox message="Card is missing its title." />
      return (
        <article className="sw-card">
          <h3>{title}</h3>
          {text && <p>{text}</p>}
          {children}
        </article>
      )
    case 'footer':
      return (
        <footer className="sw-footer">
          {text && <p>{text}</p>}
          {children}
        </footer>
      )
  }
}

export default Renderer
