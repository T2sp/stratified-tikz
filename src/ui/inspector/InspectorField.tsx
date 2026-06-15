import { parseFiniteNumber } from '../diagramUpdates.ts'

export function ReadOnlyField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <span className="readonly-value">{value}</span>
    </div>
  )
}

export function EditableTextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <input
        className="inspector-input"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

export function EditableLongTextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <textarea
        className="inspector-input inspector-textarea"
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

export function EditableNumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <input
        className="inspector-input"
        type="number"
        step="any"
        value={formatNumberInput(value)}
        onChange={(event) => {
          const parsedValue = parseFiniteNumber(event.currentTarget.value)

          if (parsedValue !== null) {
            onChange(parsedValue)
          }
        }}
      />
    </label>
  )
}

export function formatNumberInput(value: number): string {
  return Object.is(value, -0) ? '0' : String(value)
}
