import { useEffect, useMemo, useState } from 'react'
import {
  createCoordinateComponentFromInput,
  emptyCoordinateExpressionContext,
  numericCoordinateComponent,
  type CoordinateExpressionContext,
} from '../../model/symbolicCoordinates.ts'
import { resolveSymbolicVariables } from '../../model/variables.ts'
import type {
  AmbientDimension,
  CoordinateComponent,
  SymbolicVariable,
  Vec3,
} from '../../model/types.ts'
import {
  coordinateAxesForAmbientDimension,
  parseFiniteNumber,
  type CoordinateAxis,
} from '../diagramUpdates.ts'
import { formatNumberInput } from './InspectorField.tsx'

export type CoordinateEditorProps = {
  label: string
  point: Vec3
  ambientDimension: AmbientDimension
  variables?: readonly SymbolicVariable[]
  allowSymbolic?: boolean
  onCoordinateChange: (axis: CoordinateAxis, value: CoordinateComponent) => void
}

export function CoordinateEditor({
  label,
  point,
  ambientDimension,
  variables,
  allowSymbolic = false,
  onCoordinateChange,
}: CoordinateEditorProps) {
  const expressionContext = useMemo(
    () => coordinateExpressionContextFromVariables(variables ?? []),
    [variables],
  )

  return (
    <fieldset className="coordinate-group">
      <legend>{label}</legend>
      <div className="coordinate-grid">
        {coordinateAxesForAmbientDimension(ambientDimension).map((axis) => (
          <CoordinateAxisInput
            key={axis}
            axis={axis}
            point={point}
            allowSymbolic={allowSymbolic}
            expressionContext={expressionContext}
            onCoordinateChange={onCoordinateChange}
          />
        ))}
      </div>
    </fieldset>
  )
}

function CoordinateAxisInput({
  axis,
  point,
  allowSymbolic,
  expressionContext,
  onCoordinateChange,
}: {
  axis: CoordinateAxis
  point: Vec3
  allowSymbolic: boolean
  expressionContext: CoordinateExpressionContext
  onCoordinateChange: (axis: CoordinateAxis, value: CoordinateComponent) => void
}) {
  const committedValue = coordinateInputValue(point, axis)
  const symbolicComponent =
    point.symbolic?.[axis].kind === 'symbolic' ? point.symbolic[axis] : null
  const [draft, setDraft] = useState(committedValue)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    setDraft(committedValue)
    setInvalid(false)
  }, [committedValue])

  return (
    <label className="coordinate-input-row">
      <span>{axis}</span>
      <input
        className="inspector-input"
        type="text"
        inputMode="decimal"
        spellCheck={false}
        value={draft}
        aria-invalid={invalid}
        onChange={(event) => {
          const nextDraft = event.currentTarget.value
          const parsed = parseCoordinateDraft(
            nextDraft,
            allowSymbolic,
            expressionContext,
          )

          setDraft(nextDraft)
          setInvalid(parsed === null)

          if (parsed !== null) {
            onCoordinateChange(axis, parsed)
          }
        }}
      />
      {symbolicComponent !== null && (
        <span className="coordinate-preview">
          preview: {formatNumberInput(symbolicComponent.previewValue)}
        </span>
      )}
    </label>
  )
}

function parseCoordinateDraft(
  rawValue: string,
  allowSymbolic: boolean,
  expressionContext: CoordinateExpressionContext,
): CoordinateComponent | null {
  if (!allowSymbolic) {
    const parsedValue = parseFiniteNumber(rawValue)

    return parsedValue === null ? null : numericCoordinateComponent(parsedValue)
  }

  const parsed = createCoordinateComponentFromInput(rawValue, expressionContext)

  return parsed.ok ? parsed.component : null
}

function coordinateInputValue(point: Vec3, axis: CoordinateAxis): string {
  const component = point.symbolic?.[axis]

  return component?.kind === 'symbolic'
    ? component.expression
    : formatNumberInput(point[axis])
}

function coordinateExpressionContextFromVariables(
  variables: readonly SymbolicVariable[],
): CoordinateExpressionContext {
  const resolved = resolveSymbolicVariables(variables)

  if (!resolved.ok) {
    return emptyCoordinateExpressionContext
  }

  return {
    variableNames: resolved.variables.map((variable) => variable.name),
    previewValues: resolved.values,
  }
}
