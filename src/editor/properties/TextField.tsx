import { useId, useState } from 'react'
import type { KeyboardEvent } from 'react'

interface TextFieldProps {
  label: string
  value: string
  multiline?: boolean
  placeholder?: string
  /** Returns a problem with the draft to show under the field, if any. */
  validate?: (value: string) => string | undefined
  onCommit: (value: string) => void
}

/**
 * Input with a local draft. The store is updated on blur or Enter, so one
 * edit is one undo step. Escape restores the stored value.
 */
function TextField({
  label,
  value,
  multiline = false,
  placeholder,
  validate,
  onCommit,
}: TextFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState(value)
  const [storedValue, setStoredValue] = useState(value)

  // Follow outside changes (undo, inline editing) of the stored value.
  if (value !== storedValue) {
    setStoredValue(value)
    setDraft(value)
  }

  const hint = validate?.(draft)

  function commit() {
    if (draft !== value) onCommit(draft)
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (event.key === 'Enter' && !(multiline && event.shiftKey)) {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(value)
    }
  }

  const inputProps = {
    id,
    className: 'property-input',
    value: draft,
    placeholder,
    'aria-describedby': hint ? `${id}-hint` : undefined,
    'aria-invalid': hint ? true : undefined,
    onBlur: commit,
    onKeyDown: handleKeyDown,
  }

  return (
    <div className="property-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          {...inputProps}
          rows={3}
          onChange={(event) => setDraft(event.target.value)}
        />
      ) : (
        <input
          {...inputProps}
          type="text"
          onChange={(event) => setDraft(event.target.value)}
        />
      )}
      {hint && (
        <p className="property-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  )
}

export default TextField
