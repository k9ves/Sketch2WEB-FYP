import { useId } from 'react'
import type { ComponentNode } from '../../schema/types'
import {
  getStyleToken,
  setStyleToken,
  styleGroups,
  styleGroupsBySlot,
  styleSlotByType,
} from '../styleTokens'
import type { StyleGroup, StyleToken } from '../styleTokens'

interface StyleFieldsProps {
  node: ComponentNode
  onChange: (slot: string, value: string) => void
}

interface GroupFieldProps {
  group: StyleGroup
  value: string | null
  onSelect: (token: string | null) => void
}

function ColorField({ group, value, onSelect }: GroupFieldProps) {
  const { label } = styleGroups[group]
  const tokens: readonly StyleToken[] = styleGroups[group].tokens
  return (
    <fieldset className="property-field property-swatches">
      <legend>{label}</legend>
      <button
        type="button"
        className="property-swatch is-default"
        aria-label={`${label}: Default`}
        aria-pressed={value === null}
        title="Default"
        onClick={() => onSelect(null)}
      />
      {tokens.map((entry) => (
        <button
          key={entry.token}
          type="button"
          className="property-swatch"
          style={{ background: entry.swatch }}
          aria-label={`${label}: ${entry.label}`}
          aria-pressed={value === entry.token}
          title={entry.label}
          onClick={() => onSelect(entry.token)}
        />
      ))}
    </fieldset>
  )
}

function ScaleField({ group, value, onSelect }: GroupFieldProps) {
  const id = useId()
  const { label } = styleGroups[group]
  const tokens: readonly StyleToken[] = styleGroups[group].tokens
  return (
    <div className="property-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="property-input"
        value={value ?? ''}
        onChange={(event) => onSelect(event.target.value || null)}
      >
        <option value="">Default</option>
        {tokens.map((entry) => (
          <option key={entry.token} value={entry.token}>
            {entry.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Tailwind token pickers for the node's style slot (see docs/T36). */
function StyleFields({ node, onChange }: StyleFieldsProps) {
  const slot = styleSlotByType[node.type]
  const slotValue = node.style[slot] ?? ''

  return (
    <>
      {styleGroupsBySlot[slot].map((group) => {
        const Field =
          styleGroups[group].kind === 'color' ? ColorField : ScaleField
        return (
          <Field
            key={group}
            group={group}
            value={getStyleToken(slotValue, group)}
            onSelect={(token) =>
              onChange(slot, setStyleToken(slotValue, group, token))
            }
          />
        )
      })}
    </>
  )
}

export default StyleFields
