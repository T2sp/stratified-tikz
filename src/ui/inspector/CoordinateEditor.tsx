import { useEffect, useMemo, useState } from 'react'
import {
  createScalarInputValue,
  type ScalarInputValue,
} from '../../model/scalarExpressions.ts'
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
  type WorkPlaneLocalCoordinateAxis,
  workPlaneLocalCoordinateAxisLabel,
  workPlaneLocalCoordinateInspectorView,
} from '../diagramUpdates.ts'
import { formatSymbolicInputError } from '../symbolicInputMessages.ts'
import { formatNumberInput } from './InspectorField.tsx'

export type CoordinateEditorProps = {
  label: string
  point: Vec3
  ambientDimension: AmbientDimension
  variables?: readonly SymbolicVariable[]
  allowSymbolic?: boolean
  showWorkPlaneLocalSummary?: boolean
  onCoordinateChange: (axis: CoordinateAxis, value: CoordinateComponent) => void
  onWorkPlaneLocalCoordinateChange?: (
    axis: WorkPlaneLocalCoordinateAxis,
    value: ScalarInputValue,
  ) => void
}

export function CoordinateEditor({
  label,
  point,
  ambientDimension,
  variables,
  allowSymbolic = false,
  showWorkPlaneLocalSummary = true,
  onCoordinateChange,
  onWorkPlaneLocalCoordinateChange,
}: CoordinateEditorProps) {
  const expressionContext = useMemo(
    () => coordinateExpressionContextFromVariables(variables ?? []),
    [variables],
  )
  const localView = workPlaneLocalCoordinateInspectorView(point, ambientDimension)

  if (localView !== null) {
    return (
      <WorkPlaneLocalCoordinateEditor
        label={label}
        view={localView}
        showSummary={showWorkPlaneLocalSummary}
        expressionContext={expressionContext}
        onWorkPlaneLocalCoordinateChange={onWorkPlaneLocalCoordinateChange}
      />
    )
  }

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

function WorkPlaneLocalCoordinateEditor({
  label,
  view,
  showSummary,
  expressionContext,
  onWorkPlaneLocalCoordinateChange,
}: {
  label: string
  view: NonNullable<ReturnType<typeof workPlaneLocalCoordinateInspectorView>>
  showSummary: boolean
  expressionContext: CoordinateExpressionContext
  onWorkPlaneLocalCoordinateChange:
    | ((axis: WorkPlaneLocalCoordinateAxis, value: ScalarInputValue) => void)
    | undefined
}) {
  return (
    <fieldset className="coordinate-group">
      <legend>{label}</legend>
      {showSummary && (
        <dl className="work-plane-local-coordinate-summary">
          <div>
            <dt>Source</dt>
            <dd>{view.coordinateSource}</dd>
          </div>
          <div>
            <dt>Preview</dt>
            <dd>{formatEditorVec3(view.globalPreview)}</dd>
          </div>
          <div>
            <dt>Stored frame</dt>
            <dd>{view.frameSummary}</dd>
          </div>
        </dl>
      )}
      <div className="coordinate-grid">
        {(['a', 'b'] as const).map((axis) => (
          <WorkPlaneLocalAxisInput
            key={axis}
            axis={axis}
            inputValue={view.local[axis].inputValue}
            previewValue={view.local[axis].previewValue}
            expressionContext={expressionContext}
            onWorkPlaneLocalCoordinateChange={onWorkPlaneLocalCoordinateChange}
          />
        ))}
      </div>
    </fieldset>
  )
}

function WorkPlaneLocalAxisInput({
  axis,
  inputValue,
  previewValue,
  expressionContext,
  onWorkPlaneLocalCoordinateChange,
}: {
  axis: WorkPlaneLocalCoordinateAxis
  inputValue: string
  previewValue: number
  expressionContext: CoordinateExpressionContext
  onWorkPlaneLocalCoordinateChange:
    | ((axis: WorkPlaneLocalCoordinateAxis, value: ScalarInputValue) => void)
    | undefined
}) {
  const [draft, setDraft] = useState(inputValue)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(inputValue)
    setError('')
  }, [inputValue])

  return (
    <label className="coordinate-input-row">
      <span>{workPlaneLocalCoordinateAxisLabel(axis)}</span>
      <input
        className="inspector-input"
        type="text"
        inputMode="decimal"
        spellCheck={false}
        value={draft}
        readOnly={onWorkPlaneLocalCoordinateChange === undefined}
        aria-invalid={error !== ''}
        onChange={(event) => {
          const nextDraft = event.currentTarget.value
          const parsed = parseWorkPlaneLocalDraft(nextDraft, expressionContext)

          setDraft(nextDraft)
          setError(parsed.ok ? '' : parsed.error)

          if (parsed.ok && onWorkPlaneLocalCoordinateChange !== undefined) {
            onWorkPlaneLocalCoordinateChange(axis, parsed.scalar)
          }
        }}
      />
      <span className="coordinate-preview">
        preview: {formatNumberInput(previewValue)}
      </span>
      {error !== '' && (
        <span className="coordinate-input-error" role="status">
          {error}
        </span>
      )}
    </label>
  )
}

type CoordinateDraftParseResult =
  | {
      ok: true
      component: CoordinateComponent
    }
  | {
      ok: false
      error: string
    }

type WorkPlaneLocalDraftParseResult =
  | {
      ok: true
      scalar: ScalarInputValue
    }
  | {
      ok: false
      error: string
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
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(committedValue)
    setError('')
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
        aria-invalid={error !== ''}
        onChange={(event) => {
          const nextDraft = event.currentTarget.value
          const parsed = parseCoordinateDraft(
            nextDraft,
            allowSymbolic,
            expressionContext,
          )

          setDraft(nextDraft)
          setError(parsed.ok ? '' : parsed.error)

          if (parsed.ok) {
            onCoordinateChange(axis, parsed.component)
          }
        }}
      />
      {symbolicComponent !== null && (
        <span className="coordinate-preview">
          preview: {formatNumberInput(symbolicComponent.previewValue)}
        </span>
      )}
      {error !== '' && (
        <span className="coordinate-input-error" role="status">
          {error}
        </span>
      )}
    </label>
  )
}

function parseWorkPlaneLocalDraft(
  rawValue: string,
  expressionContext: CoordinateExpressionContext,
): WorkPlaneLocalDraftParseResult {
  const parsed = createScalarInputValue(rawValue, {
    variables: expressionContext.variableNames,
    previewValues: expressionContext.previewValues,
  })

  return parsed.ok
    ? {
        ok: true,
        scalar: parsed.scalar,
      }
    : {
        ok: false,
        error: formatSymbolicInputError(parsed.error),
      }
}

function parseCoordinateDraft(
  rawValue: string,
  allowSymbolic: boolean,
  expressionContext: CoordinateExpressionContext,
): CoordinateDraftParseResult {
  if (!allowSymbolic) {
    const parsedValue = parseFiniteNumber(rawValue)

    return parsedValue === null
      ? {
          ok: false,
          error: 'Invalid expression: coordinate must be a finite number.',
        }
      : {
          ok: true,
          component: numericCoordinateComponent(parsedValue),
        }
  }

  const parsed = createCoordinateComponentFromInput(rawValue, expressionContext)

  return parsed.ok
    ? {
        ok: true,
        component: parsed.component,
      }
    : {
        ok: false,
        error: formatSymbolicInputError(parsed.error),
      }
}

function formatEditorVec3(point: Vec3): string {
  return `(${formatNumberInput(point.x)}, ${formatNumberInput(
    point.y,
  )}, ${formatNumberInput(point.z)})`
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
