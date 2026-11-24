import { useId } from 'react'
import type { ComponentNode } from '../../schema/types'
import { safeHref } from '../../renderer/safeHref'
import TextField from './TextField'

interface ContentFieldsProps {
  node: ComponentNode
  onChange: (key: string, value: string) => void
}

const headingLevels = ['1', '2', '3', '4', '5', '6'] as const

function linkHint(href: string): string | undefined {
  if (href.trim() === '') return 'A link is required.'
  if (safeHref(href) === undefined) return 'This link is not allowed.'
  return undefined
}

function HeadingLevelField({
  value,
  onCommit,
}: {
  value: string
  onCommit: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="property-field">
      <label htmlFor={id}>Level</label>
      <select
        id={id}
        className="property-input"
        value={value}
        onChange={(event) => onCommit(event.target.value)}
      >
        {headingLevels.map((level) => (
          <option key={level} value={level}>
            H{level}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Content fields of the selected node, by type (see docs/T36). */
function ContentFields({ node, onChange }: ContentFieldsProps) {
  const { content } = node
  const field = (key: string) => content[key] ?? ''

  switch (node.type) {
    case 'website':
      return (
        <TextField
          label="Site title"
          value={field('title')}
          placeholder="Untitled website"
          onCommit={(value) => onChange('title', value)}
        />
      )
    case 'heading': {
      const level = headingLevels.find((l) => l === content.level) ?? '2'
      return (
        <>
          <TextField
            label="Text"
            value={field('text')}
            placeholder="Heading"
            onCommit={(value) => onChange('text', value)}
          />
          <HeadingLevelField
            value={level}
            onCommit={(value) => onChange('level', value)}
          />
        </>
      )
    }
    case 'text':
      return (
        <TextField
          label="Text"
          value={field('text')}
          placeholder="Text"
          multiline
          onCommit={(value) => onChange('text', value)}
        />
      )
    case 'button':
      return (
        <>
          <TextField
            label="Label"
            value={field('text')}
            placeholder="Button"
            onCommit={(value) => onChange('text', value)}
          />
          <TextField
            label="Link"
            value={field('href')}
            placeholder="https://example.com or #section"
            validate={linkHint}
            onCommit={(value) => onChange('href', value)}
          />
        </>
      )
    case 'image':
      return (
        <>
          <TextField
            label="Image URL"
            value={field('src')}
            placeholder="https://example.com/image.png"
            validate={(value) =>
              value.trim() ? undefined : 'An image URL is required.'
            }
            onCommit={(value) => onChange('src', value)}
          />
          <TextField
            label="Alt text"
            value={field('alt')}
            placeholder="Describe the image"
            validate={(value) =>
              value.trim() ? undefined : 'Alt text is required.'
            }
            onCommit={(value) => onChange('alt', value)}
          />
        </>
      )
    default:
      return (
        <p className="property-note">
          This container has no text of its own. Select a heading, text or link
          inside it to edit its content.
        </p>
      )
  }
}

export default ContentFields
