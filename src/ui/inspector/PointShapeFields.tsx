import { useId, useState } from 'react'
import { pointShapeTikzKeys } from '../../model/importedTikzShapes.ts'
import { markPointShapeOverrides, pointShapeParameterIssues, resolvePointShapeParameters } from '../../model/pointShapeParameters.ts'
import type { HexColor, PointShapeParameters, PointStyle } from '../../model/types.ts'
import { isHexColorString } from '../colorInput.ts'
import { EditableColorField, EditableParsedNumberField, EditableSelectField } from './InspectorField.tsx'

const shapeFields: Readonly<Partial<Record<PointStyle['shape'], readonly (keyof PointShapeParameters)[]>>> = {
  diamond: ['aspect'],
  trapezium: ['trapeziumLeftAngle', 'trapeziumRightAngle', 'trapeziumStretches', 'trapeziumStretchesBody'],
  'regular polygon': ['regularPolygonSides'],
  star: ['starPoints', 'starPointMode', 'starPointHeight', 'starPointRatio'],
  'isosceles triangle': ['isoscelesTriangleApexAngle', 'isoscelesTriangleStretches'],
  kite: ['kiteUpperVertexAngle', 'kiteLowerVertexAngle'],
  dart: ['dartTipAngle', 'dartTailAngle'],
  'circular sector': ['circularSectorAngle'],
  cylinder: ['aspect', 'cylinderUsesCustomFill', 'cylinderEndFill', 'cylinderBodyFill'],
}

export function PointShapeFields({ style, prefix = '', onChange }: {
  style: PointStyle; prefix?: string; onChange: (style: PointStyle) => void
}) {
  const values = resolvePointShapeParameters(style.shapeParameters)
  function update<K extends keyof PointShapeParameters>(key: K, value: Required<PointShapeParameters>[K]) {
    const parameters: PointShapeParameters = { ...style.shapeParameters, [key]: value }
    if (key === 'starPointHeight') parameters.starPointMode = 'height'
    if (key === 'starPointRatio') parameters.starPointMode = 'ratio'
    onChange(markPointShapeOverrides({ ...style, shapeParameters: parameters },
      key === 'starPointHeight' || key === 'starPointRatio' ? [key, 'starPointMode'] : [key]))
  }
  const fields = [...(shapeFields[style.shape] ?? []),
    ...(['circle', 'rectangle', 'ellipse', 'diamond'].includes(style.shape) ? [] : ['borderRotate', 'borderUsesIncircle'] as const)]
  return <>{fields.map((key) => {
    const rawLabel = pointShapeTikzKeys[key]
    const label = `${prefix}${rawLabel.charAt(0).toUpperCase()}${rawLabel.slice(1)}`
    const value = values[key]
    if (typeof value === 'boolean') return <label key={key} className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <input type="checkbox" checked={value} onChange={(event) => update(key, event.currentTarget.checked)} />
    </label>
    if (key === 'starPointMode') return <EditableSelectField key={key} label={label} value={values.starPointMode}
      options={['ratio', 'height'] as const} onChange={(next) => update(key, next)} />
    if (key === 'cylinderEndFill' || key === 'cylinderBodyFill') return <PointShapeColorField key={key} label={label}
      value={values[key]} onChange={(next) => update(key, next)} />
    return <EditableParsedNumberField key={key} label={label} value={value as number}
      parse={(draft) => {
        if (!draft.trim()) return null
        const number = Number(draft)
        return pointShapeParameterIssues({ ...style.shapeParameters, [key]: number }).length ? null : number
      }} invalidMessage={`Enter a supported ${rawLabel}; shape limits prevent degenerate or unbounded contours.`}
      onChange={(next) => update(key, next)} />
  })}</>
}

// Keep the swatch and an editable exact color value for the cylinder's two paints.
function PointShapeColorField({ label, value, onChange }: {
  label: string; value: HexColor; onChange: (value: HexColor) => void
}) {
  const [draft, setDraft] = useState<{ committed: HexColor; text: string }>({ committed: value, text: value })
  const warningId = useId()
  if (draft.committed !== value) setDraft({ committed: value, text: value })
  const text = draft.committed === value ? draft.text : value
  const invalid = !isHexColorString(text)
  return <>
    <EditableColorField label={label} value={value} onChange={(next) => {
      if (isHexColorString(next)) onChange(next)
    }} />
    <label className="inspector-field">
      <span className="inspector-field-label">{label} hex</span>
      <input className="inspector-input" type="text" value={text} spellCheck={false}
        aria-invalid={invalid} aria-describedby={invalid ? warningId : undefined}
        onChange={(event) => {
          const next = event.currentTarget.value
          setDraft({ committed: value, text: next })
          if (isHexColorString(next)) onChange(next)
        }} />
      {invalid && <span id={warningId} className="inspector-field-error" role="status">Enter a #RRGGBB color.</span>}
    </label>
  </>
}
