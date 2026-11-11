import type { CSSProperties } from 'react'
import type { ReactNode } from 'react'
import type { ComponentNode } from '../schema/types'

interface RendererProps {
  node: ComponentNode
}

function renderNode(node: ComponentNode): ReactNode {
  const children = node.children.map((child) => (
    <Renderer key={child.id} node={child} />
  ))

  switch (node.type) {
    case 'navbar': {
      const links = (node.content.links ?? '')
        .split(',')
        .map((link) => link.trim())
        .filter(Boolean)

      return (
        <nav
          aria-label="Main navigation"
          className={node.style.container ?? ''}
        >
          <div className="flex items-center justify-between gap-6">
            <a
              className="font-semibold text-slate-900"
              href="/"
              aria-label={`${node.content.brand ?? 'Home'} home`}
            >
              {node.content.brand ?? 'Home'}
            </a>
            <ul className="flex flex-wrap items-center gap-6">
              {links.map((link) => (
                <li key={link}>
                  <a
                    className="text-slate-600 hover:text-slate-950"
                    href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )
    }
    case 'heading':
      return (
        <h1 className={node.style.text ?? ''}>{node.content.text ?? ''}</h1>
      )
    case 'text':
      return <p className={node.style.text ?? ''}>{node.content.text ?? ''}</p>
    case 'button': {
      const label = node.content.text ?? 'Learn more'
      const className = node.style.button ?? ''

      return node.content.href ? (
        <a className={className} href={node.content.href}>
          {label}
        </a>
      ) : (
        <button className={className} type="button">
          {label}
        </button>
      )
    }
    case 'image': {
      const src = node.content.src

      return src ? (
        <img
          className={node.style.image ?? ''}
          src={src}
          alt={node.content.alt ?? ''}
        />
      ) : null
    }
    case 'section':
      return (
        <section
          className={`${node.layout.container ?? ''} ${node.style.container ?? ''}`.trim()}
        >
          {node.content.title ? (
            <h2
              className={
                node.style.title ?? 'text-2xl font-semibold text-slate-900'
              }
            >
              {node.content.title}
            </h2>
          ) : null}
          {children}
        </section>
      )
    case 'columns': {
      const requestedColumns = Number(node.layout.columns)
      const columnCount =
        Number.isInteger(requestedColumns) &&
        requestedColumns > 0 &&
        requestedColumns <= 12
          ? requestedColumns
          : Math.max(node.children.length, 1)
      const requestedGap =
        node.layout.gap === undefined ? 6 : Number(node.layout.gap)
      const gap =
        Number.isFinite(requestedGap) && requestedGap >= 0 && requestedGap <= 24
          ? `${requestedGap / 4}rem`
          : '1.5rem'
      const isFlex = node.layout.display === 'flex'
      const containerStyle: CSSProperties = isFlex
        ? { display: 'flex', flexWrap: 'wrap', gap }
        : {
            display: 'grid',
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
            gap,
          }

      return (
        <div className={node.style.container ?? ''} style={containerStyle}>
          {node.children.map((child) => (
            <div key={child.id} style={isFlex ? { flex: '1 1 0' } : undefined}>
              <Renderer node={child} />
            </div>
          ))}
        </div>
      )
    }
    case 'footer':
      return (
        <footer className={node.style.container ?? ''}>
          {node.content.text ?? ''}
          {children}
        </footer>
      )
    default:
      return <>{children}</>
  }
}

export function Renderer({ node }: RendererProps) {
  return <>{renderNode(node)}</>
}
