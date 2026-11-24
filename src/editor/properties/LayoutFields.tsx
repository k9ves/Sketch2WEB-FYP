import { useId } from 'react'
import type { ComponentNode } from '../../schema/types'
import {
  alignValues,
  columnsLayoutDefaults,
  heroLayoutDefaults,
  gapSteps,
  justifyValues,
  resolveLayout,
} from '../../renderer/layout'
import type { LayoutDefaults } from '../../renderer/layout'

interface LayoutFieldsProps {
  node: ComponentNode
  onChange: (key: string, value: string) => void
}

interface Option {
  value: string
  label: string
}

const columnOptions: Option[] = ['1', '2', '3', '4', '5', '6'].map((n) => ({
  value: n,
  label: n,
}))

const gapOptions: Option[] = gapSteps.map((step) => ({
  value: String(step),
  label: `${step * 4}px`,
}))

const labels: Record<string, string> = {
  start: 'Start',
  center: 'Center',
  end: 'End',
  between: 'Space between',
  around: 'Space around',
  evenly: 'Space evenly',
}
const toOptions = (values: readonly string[]): Option[] =>
  values.map((value) => ({ value, label: labels[value] ?? value }))

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="property-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="property-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function layoutDefaults(node: ComponentNode): LayoutDefaults | null {
  if (node.type === 'columns') return columnsLayoutDefaults
  if (node.type === 'hero') return heroLayoutDefaults
  return null
}

/** Flow layout controls for hero and columns (see docs/T36 §2). */
function LayoutFields({ node, onChange }: LayoutFieldsProps) {
  const defaults = layoutDefaults(node)
  if (defaults === null) return null

  const layout = resolveLayout(node.layout, defaults)
  const isGrid = layout.display === 'grid'
  // Names follow the axes: in a row, "align" is vertical; in a column it is
  // horizontal. A grid aligns each cell's content.
  const vertical = isGrid || layout.direction === 'row'
  // A value not in the list (e.g. "2.5" or a CSS length) is shown as is.
  const gapValue = layout.gap === null ? '' : String(layout.gap)
  const gapChoices = gapOptions.some((option) => option.value === gapValue)
    ? gapOptions
    : [
        {
          value: gapValue,
          label:
            layout.gap === null
              ? (node.layout.gap ?? '')
              : `${layout.gap * 4}px`,
        },
        ...gapOptions,
      ]

  return (
    <>
      {node.type === 'columns' && (
        <SelectField
          label="Display"
          value={layout.display}
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'flex', label: 'Flex' },
          ]}
          onChange={(value) => onChange('display', value)}
        />
      )}
      {isGrid ? (
        <SelectField
          label="Columns"
          value={String(layout.columns)}
          options={columnOptions}
          onChange={(value) => onChange('columns', value)}
        />
      ) : (
        <SelectField
          label="Direction"
          value={layout.direction}
          options={[
            { value: 'row', label: 'Row' },
            { value: 'column', label: 'Column' },
          ]}
          onChange={(value) => onChange('direction', value)}
        />
      )}
      <SelectField
        label="Gap"
        value={gapValue}
        options={gapChoices}
        onChange={(value) => onChange('gap', value)}
      />
      <SelectField
        label={vertical ? 'Vertical align' : 'Horizontal align'}
        value={layout.align}
        options={toOptions(alignValues)}
        onChange={(value) => onChange('align', value)}
      />
      <SelectField
        label={
          isGrid
            ? 'Horizontal align'
            : vertical
              ? 'Horizontal spacing'
              : 'Vertical spacing'
        }
        value={
          isGrid && !alignValues.some((v) => v === layout.justify)
            ? 'start'
            : layout.justify
        }
        options={toOptions(isGrid ? alignValues : justifyValues)}
        onChange={(value) => onChange('justify', value)}
      />
    </>
  )
}

export default LayoutFields
