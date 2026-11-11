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
    default:
      return <>{children}</>
  }
}

export function Renderer({ node }: RendererProps) {
  return <>{renderNode(node)}</>
}
