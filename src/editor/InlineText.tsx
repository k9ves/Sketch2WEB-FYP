import { useEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, MouseEvent } from 'react'

interface InlineTextProps {
  value: string
  onSave: (value: string) => void
}

function InlineText({ value, onSave }: InlineTextProps) {
  const [editing, setEditing] = useState(false)
  const editorRef = useRef<HTMLSpanElement>(null)
  const originalValue = useRef(value)
  const cancelEdit = useRef(false)

  useEffect(() => {
    if (!editing || !editorRef.current) return

    editorRef.current.focus()
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(editorRef.current)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [editing])

  function startEditing(event: MouseEvent<HTMLSpanElement>) {
    event.preventDefault()
    event.stopPropagation()
    originalValue.current = value
    cancelEdit.current = false
    setEditing(true)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (!editing) return
    event.stopPropagation()

    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelEdit.current = true
      event.currentTarget.textContent = originalValue.current
      event.currentTarget.blur()
    }
  }

  function finishEditing(event: FocusEvent<HTMLSpanElement>) {
    if (!cancelEdit.current) {
      const nextValue = event.currentTarget.textContent ?? ''
      if (nextValue !== originalValue.current) onSave(nextValue)
    }

    cancelEdit.current = false
    setEditing(false)
  }

  return (
    <span
      ref={editorRef}
      className="sw-inline-text"
      title={editing ? undefined : 'Double-click to edit'}
      contentEditable={editing}
      suppressContentEditableWarning
      role={editing ? 'textbox' : undefined}
      aria-label={editing ? 'Edit text' : undefined}
      aria-multiline={false}
      onClick={(event) => {
        if (!editing) return
        event.preventDefault()
        event.stopPropagation()
      }}
      onDoubleClick={startEditing}
      onKeyDown={handleKeyDown}
      onBlur={finishEditing}
    >
      {value}
    </span>
  )
}

export default InlineText
