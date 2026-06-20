import { useEffect, useState } from 'react'
import {
  absoluteCubicBezierPointsFromControlMode,
  cubicBezierControlModeLabel,
  relativeCartesianControlModeFromPoints,
  relativePolarControlModeFromPoints,
} from '../../geometry/bezierControls.ts'
import type {
  AmbientDimension,
  ConcatenatedPathStratum,
  CoordinateComponent,
  CubicBezierCurveStratum,
  CubicBezierControlMode,
  CurveStratum,
  Diagram,
  HexColor,
  LineStyle,
  PathSegment,
  GridParameterRange,
  GridRectangleClip,
  Vec3,
} from '../../model/types.ts'
import { hasCurveStyleOverride, resolveCurveStyle } from '../../model/styles.ts'
import { gridPreviewSegments } from '../../model/grids.ts'
import { createScalarInputValue } from '../../model/scalarExpressions.ts'
import type { ScalarInputValue } from '../../model/scalarExpressions.ts'
import { resolveSymbolicVariables } from '../../model/variables.ts'
import { lineStyles } from '../../model/types.ts'
import {
  formatGridIssue,
  formatSymbolicInputError,
} from '../symbolicInputMessages.ts'
import {
  type CoordinateAxis,
  updateStratumById,
  updateVec3Coordinate,
} from '../diagramUpdates.ts'
import { describeCurvePoints } from '../inspectorSummary.ts'
import { CoordinateEditor } from './CoordinateEditor.tsx'
import {
  EditableColorField,
  EditableNumberField,
  EditableOpacityField,
  EditablePositiveNumberField,
  EditableSelectField,
  ReadOnlyField,
} from './InspectorField.tsx'
import { formatSelectedGeometry } from './geometryPreview.ts'
import type { DiagramChangeHandler } from './types.ts'
import {
  appendCubicSegmentToConcatenatedPath,
  appendLineSegmentToConcatenatedPath,
  bezierControlModeOptions as pathBezierControlModeOptions,
  clearConcatenatedPathSegmentStyleOverride,
  describeConcatenatedPathSegments,
  removeLastSegmentFromConcatenatedPath,
  updateConcatenatedPathCoordinate,
  updateConcatenatedPathCubicControlMode,
  updateConcatenatedPathRelativeCartesianOffset,
  updateConcatenatedPathRelativePolarControl,
  updateConcatenatedPathSegmentStyleOverrideField,
  type ConcatenatedPathPointDescription,
  type ConcatenatedPathSegmentDescription,
  type InspectorBezierControlMode as PathInspectorBezierControlMode,
  type PathSegmentStyleOverrideField,
} from '../pathEditing.ts'

type InspectorBezierControlMode =
  | 'absolute'
  | 'relativeCartesian'
  | 'relativePolar'

type GridScalarField =
  | 'uMin'
  | 'uMax'
  | 'uStep'
  | 'vMin'
  | 'vMax'
  | 'vStep'
  | 'clipUMin'
  | 'clipUMax'
  | 'clipVMin'
  | 'clipVMax'

export type CurveGeometryEditorProps = {
  diagram: Diagram
  curve: CurveStratum
  onDiagramChange: DiagramChangeHandler
}

export function CurveGeometryEditor({
  diagram,
  curve,
  onDiagramChange,
}: CurveGeometryEditorProps) {
  const bezierControlMode =
    curve.kind === 'cubicBezier'
      ? editableInspectorBezierControlMode(curve.bezierControls)
      : null

  return (
    <section className="inspector-section">
      <h3>Geometry</h3>
      <div className="inspector-form">
        <ReadOnlyField label="Curve kind" value={curve.kind} />
        {curve.kind === 'cubicBezier' && bezierControlMode === null && (
          <ReadOnlyField
            label="Bezier control mode"
            value={cubicBezierControlModeLabel(curve.bezierControls)}
          />
        )}
        {curve.kind === 'cubicBezier' && bezierControlMode !== null && (
          <EditableSelectField
            label="Bezier control mode"
            value={bezierControlMode}
            options={bezierControlModeOptions(diagram.ambientDimension)}
            onChange={(value) =>
              onDiagramChange((currentDiagram) =>
                updateStratumById(currentDiagram, curve.id, (current) => {
                  if (
                    current.geometricKind !== 'curve' ||
                    current.kind !== 'cubicBezier'
                  ) {
                    return current
                  }

                  return updateCubicBezierControlMode(
                    current,
                    currentDiagram.ambientDimension,
                    value,
                  )
                }),
              )
            }
          />
        )}
        <ReadOnlyField
          label="Style segments"
          value={String(curve.styleSegments.length)}
        />
        {renderCurveCoordinateEditors(curve, diagram, onDiagramChange)}
        <ReadOnlyField
          label="Preview"
          value={formatSelectedGeometry(curve, diagram.ambientDimension)}
        />
      </div>
    </section>
  )
}

function renderCurveCoordinateEditors(
  curve: CurveStratum,
  diagram: Diagram,
  onDiagramChange: DiagramChangeHandler,
) {
  if (curve.kind === 'templatePath') {
    return (
      <TemplatePathGeometryEditor
        diagram={diagram}
        path={curve}
        onDiagramChange={onDiagramChange}
      />
    )
  }

  if (curve.kind === 'grid') {
    return (
      <GridGeometryEditor
        diagram={diagram}
        grid={curve}
        onDiagramChange={onDiagramChange}
      />
    )
  }

  if (curve.kind === 'concatenatedPath') {
    return (
      <ConcatenatedPathGeometryEditor
        diagram={diagram}
        path={curve}
        onDiagramChange={onDiagramChange}
      />
    )
  }

  if (curve.kind !== 'cubicBezier' || curve.points.length !== 4) {
    return describeCurvePoints(curve).map((description, pointIndex) => (
      <AbsoluteCurvePointEditor
        key={`${description.label}-${pointIndex}`}
        diagram={diagram}
        curve={curve}
        label={description.label}
        point={description.point}
        pointIndex={pointIndex}
        onDiagramChange={onDiagramChange}
      />
    ))
  }

  if (curve.bezierControls?.kind === 'relativeCartesian') {
    return [
      <RelativeEndpointEditor
        key="start"
        diagram={diagram}
        curve={curve}
        label="Start"
        pointIndex={0}
        onDiagramChange={onDiagramChange}
      />,
      <CoordinateEditor
        key="first-control-offset"
        label="Control 1 offset from start"
        point={curve.bezierControls.firstControlOffset}
        ambientDimension={diagram.ambientDimension}
        onCoordinateChange={(axis, value) =>
          updateRelativeCartesianOffset(
            diagram,
            curve,
            'firstControlOffset',
            axis,
            value,
            onDiagramChange,
          )
        }
      />,
      <CoordinateEditor
        key="second-control-offset"
        label="Control 2 offset from end"
        point={curve.bezierControls.secondControlOffset}
        ambientDimension={diagram.ambientDimension}
        onCoordinateChange={(axis, value) =>
          updateRelativeCartesianOffset(
            diagram,
            curve,
            'secondControlOffset',
            axis,
            value,
            onDiagramChange,
          )
        }
      />,
      <RelativeEndpointEditor
        key="end"
        diagram={diagram}
        curve={curve}
        label="End"
        pointIndex={3}
        onDiagramChange={onDiagramChange}
      />,
    ]
  }

  if (curve.bezierControls?.kind === 'relativePolar') {
    return [
      <RelativeEndpointEditor
        key="start"
        diagram={diagram}
        curve={curve}
        label="Start"
        pointIndex={0}
        onDiagramChange={onDiagramChange}
      />,
      <EditableNumberField
        key="first-angle"
        label="Control 1 angle"
        value={curve.bezierControls.firstControl.angleDegrees}
        onChange={(value) =>
          updateRelativePolarControl(
            curve,
            'firstControl',
            'angleDegrees',
            value,
            onDiagramChange,
          )
        }
      />,
      <EditableNumberField
        key="first-radius"
        label="Control 1 radius"
        value={curve.bezierControls.firstControl.radius}
        onChange={(value) =>
          updateRelativePolarControl(
            curve,
            'firstControl',
            'radius',
            value,
            onDiagramChange,
          )
        }
      />,
      <EditableNumberField
        key="second-angle"
        label="Control 2 angle"
        value={curve.bezierControls.secondControl.angleDegrees}
        onChange={(value) =>
          updateRelativePolarControl(
            curve,
            'secondControl',
            'angleDegrees',
            value,
            onDiagramChange,
          )
        }
      />,
      <EditableNumberField
        key="second-radius"
        label="Control 2 radius"
        value={curve.bezierControls.secondControl.radius}
        onChange={(value) =>
          updateRelativePolarControl(
            curve,
            'secondControl',
            'radius',
            value,
            onDiagramChange,
          )
        }
      />,
      <RelativeEndpointEditor
        key="end"
        diagram={diagram}
        curve={curve}
        label="End"
        pointIndex={3}
        onDiagramChange={onDiagramChange}
      />,
    ]
  }

  return describeCurvePoints(curve).map((description, pointIndex) => (
    <AbsoluteCurvePointEditor
      key={`${description.label}-${pointIndex}`}
      diagram={diagram}
      curve={curve}
      label={description.label}
      point={description.point}
      pointIndex={pointIndex}
      onDiagramChange={onDiagramChange}
    />
  ))
}

function GridGeometryEditor({
  diagram,
  grid,
  onDiagramChange,
}: {
  diagram: Diagram
  grid: Extract<CurveStratum, { kind: 'grid' }>
  onDiagramChange: DiagramChangeHandler
}) {
  const preview = gridPreviewSegments(grid, diagram.ambientDimension)

  return (
    <>
      <ReadOnlyField label="Frame" value={grid.frame.kind} />
      {gridScalarFields(grid).map((field) => (
        <GridScalarEditor
          key={field.id}
          diagram={diagram}
          grid={grid}
          field={field.id}
          label={field.label}
          value={field.value}
          onDiagramChange={onDiagramChange}
        />
      ))}
      <ReadOnlyField
        label="Preview lines"
        value={preview.ok ? String(preview.lineCount) : formatGridIssue(preview.errors[0])}
      />
      <ReadOnlyField
        label="TikZ range"
        value={
          gridHasSymbolicForeachRange(grid)
            ? 'unsupported symbolic grid range'
            : 'foreach range'
        }
      />
    </>
  )
}

function GridScalarEditor({
  diagram,
  grid,
  field,
  label,
  value,
  onDiagramChange,
}: {
  diagram: Diagram
  grid: Extract<CurveStratum, { kind: 'grid' }>
  field: GridScalarField
  label: string
  value: ScalarInputValue
  onDiagramChange: DiagramChangeHandler
}) {
  const committedValue = formatGridScalarInput(value)
  const [draft, setDraft] = useState(committedValue)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(committedValue)
    setError('')
  }, [committedValue])

  return (
    <label className="inspector-field inspector-field-with-note">
      <span className="inspector-field-label">{label}</span>
      <input
        className="inspector-input"
        type="text"
        inputMode="decimal"
        spellCheck={false}
        value={draft}
        aria-invalid={error !== ''}
        onChange={(event) => {
          const source = event.currentTarget.value
          const scalar = createGridScalarInput(source, diagram)

          setDraft(source)

          if (!scalar.ok) {
            setError(scalar.error)
            return
          }

          const nextGrid = gridWithScalarField(grid, field, scalar.scalar)
          const preview = gridPreviewSegments(nextGrid, diagram.ambientDimension)

          if (!preview.ok) {
            setError(formatGridIssue(preview.errors[0]))
            return
          }

          setError('')
          updateGridScalarField(
            grid,
            field,
            scalar.scalar,
            onDiagramChange,
          )
        }}
      />
      {value.kind === 'symbolic' && (
        <span className="inspector-field-note">
          preview {formatCompactNumber(value.previewValue)}
        </span>
      )}
      {error !== '' && (
        <span className="inspector-field-error" role="status">
          {error}
        </span>
      )}
    </label>
  )
}

function gridScalarFields(
  grid: Extract<CurveStratum, { kind: 'grid' }>,
): Array<{
  id: GridScalarField
  label: string
  value: ScalarInputValue
}> {
  return [
    { id: 'uMin', label: 'u min', value: grid.uRange.min },
    { id: 'uMax', label: 'u max', value: grid.uRange.max },
    { id: 'uStep', label: 'u step', value: grid.uRange.step },
    { id: 'vMin', label: 'v min', value: grid.vRange.min },
    { id: 'vMax', label: 'v max', value: grid.vRange.max },
    { id: 'vStep', label: 'v step', value: grid.vRange.step },
    { id: 'clipUMin', label: 'clip u min', value: grid.clip.uMin },
    { id: 'clipUMax', label: 'clip u max', value: grid.clip.uMax },
    { id: 'clipVMin', label: 'clip v min', value: grid.clip.vMin },
    { id: 'clipVMax', label: 'clip v max', value: grid.clip.vMax },
  ]
}

function updateGridScalarField(
  grid: Extract<CurveStratum, { kind: 'grid' }>,
  field: GridScalarField,
  scalar: ScalarInputValue,
  onDiagramChange: DiagramChangeHandler,
): void {
  onDiagramChange((currentDiagram) =>
    updateStratumById(currentDiagram, grid.id, (current) => {
      if (current.geometricKind !== 'curve' || current.kind !== 'grid') {
        return current
      }

      const nextGrid = gridWithScalarField(current, field, scalar)

      return gridPreviewSegments(nextGrid, currentDiagram.ambientDimension).ok
        ? nextGrid
        : current
    }),
  )
}

function createGridScalarInput(
  source: string,
  diagram: Diagram,
):
  | {
      ok: true
      scalar: ScalarInputValue
    }
  | {
      ok: false
      error: string
    } {
  const resolved = resolveSymbolicVariables(diagram.variables ?? [])
  const parsed = createScalarInputValue(source, {
    variables: resolved.ok
      ? resolved.variables.map((variable) => variable.name)
      : [],
    previewValues: resolved.ok ? resolved.values : new Map(),
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

function gridWithScalarField(
  grid: Extract<CurveStratum, { kind: 'grid' }>,
  field: GridScalarField,
  scalar: ScalarInputValue,
): Extract<CurveStratum, { kind: 'grid' }> {
  switch (field) {
    case 'uMin':
      return { ...grid, uRange: updateGridRange(grid.uRange, 'min', scalar) }
    case 'uMax':
      return { ...grid, uRange: updateGridRange(grid.uRange, 'max', scalar) }
    case 'uStep':
      return { ...grid, uRange: updateGridRange(grid.uRange, 'step', scalar) }
    case 'vMin':
      return { ...grid, vRange: updateGridRange(grid.vRange, 'min', scalar) }
    case 'vMax':
      return { ...grid, vRange: updateGridRange(grid.vRange, 'max', scalar) }
    case 'vStep':
      return { ...grid, vRange: updateGridRange(grid.vRange, 'step', scalar) }
    case 'clipUMin':
      return { ...grid, clip: updateGridClip(grid.clip, 'uMin', scalar) }
    case 'clipUMax':
      return { ...grid, clip: updateGridClip(grid.clip, 'uMax', scalar) }
    case 'clipVMin':
      return { ...grid, clip: updateGridClip(grid.clip, 'vMin', scalar) }
    case 'clipVMax':
      return { ...grid, clip: updateGridClip(grid.clip, 'vMax', scalar) }
  }
}

function updateGridRange(
  range: GridParameterRange,
  field: keyof GridParameterRange,
  scalar: ScalarInputValue,
): GridParameterRange {
  return {
    ...range,
    [field]: scalar,
  }
}

function updateGridClip(
  clip: GridRectangleClip,
  field: Exclude<keyof GridRectangleClip, 'kind'>,
  scalar: ScalarInputValue,
): GridRectangleClip {
  return {
    ...clip,
    [field]: scalar,
  }
}

function formatGridScalarInput(value: ScalarInputValue): string {
  return value.kind === 'symbolic' ? value.expression : formatCompactNumber(value.value)
}

function gridHasSymbolicForeachRange(
  grid: Extract<CurveStratum, { kind: 'grid' }>,
): boolean {
  return [...gridRangeScalars(grid.uRange), ...gridRangeScalars(grid.vRange)].some(
    (value) => value.kind === 'symbolic',
  )
}

function gridRangeScalars(range: GridParameterRange): ScalarInputValue[] {
  return [range.min, range.max, range.step]
}

function formatCompactNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)))
}

function TemplatePathGeometryEditor({
  diagram,
  path,
  onDiagramChange,
}: {
  diagram: Diagram
  path: Extract<CurveStratum, { kind: 'templatePath' }>
  onDiagramChange: DiagramChangeHandler
}) {
  const template = path.template

  return (
    <>
      <CoordinateEditor
        label="Center"
        point={template.center}
        ambientDimension={diagram.ambientDimension}
        variables={diagram.variables}
        allowSymbolic={diagram.ambientDimension === 2}
        onCoordinateChange={(axis, value) =>
          updateTemplatePathInDiagram(path.id, onDiagramChange, (current) => {
            const center = updateVec3Coordinate(
                current.template.center,
                axis,
                value,
                diagram.ambientDimension,
              )

            return {
              ...current,
              template: {
                ...current.template,
                center,
                ...(current.template.frame === undefined
                  ? {}
                  : {
                      frame: {
                        ...current.template.frame,
                        origin: center,
                      },
                    }),
              },
            }
          })
        }
      />
      {template.kind === 'circleTemplate' && (
        <EditablePositiveNumberField
          label="Radius"
          value={template.radius}
          onChange={(value) =>
            updateTemplatePathInDiagram(path.id, onDiagramChange, (current) =>
              current.template.kind === 'circleTemplate'
                ? {
                    ...current,
                    template: {
                      ...current.template,
                      radius: value,
                    },
                  }
                : current,
            )
          }
        />
      )}
      {template.kind === 'ellipseTemplate' && (
        <>
          <EditablePositiveNumberField
            label="Radius x"
            value={template.radiusX}
            onChange={(value) =>
              updateTemplatePathInDiagram(path.id, onDiagramChange, (current) =>
                current.template.kind === 'ellipseTemplate'
                  ? {
                      ...current,
                      template: {
                        ...current.template,
                        radiusX: value,
                      },
                    }
                  : current,
              )
            }
          />
          <EditablePositiveNumberField
            label="Radius y"
            value={template.radiusY}
            onChange={(value) =>
              updateTemplatePathInDiagram(path.id, onDiagramChange, (current) =>
                current.template.kind === 'ellipseTemplate'
                  ? {
                      ...current,
                      template: {
                        ...current.template,
                        radiusY: value,
                      },
                    }
                  : current,
              )
            }
          />
          <EditableNumberField
            label="Rotation"
            value={template.rotationDeg ?? 0}
            onChange={(value) =>
              updateTemplatePathInDiagram(path.id, onDiagramChange, (current) =>
                current.template.kind === 'ellipseTemplate'
                  ? {
                      ...current,
                      template: {
                        ...current.template,
                        rotationDeg: value,
                      },
                    }
                  : current,
              )
            }
          />
        </>
      )}
    </>
  )
}

function updateTemplatePathInDiagram(
  pathId: string,
  onDiagramChange: DiagramChangeHandler,
  updater: (
    path: Extract<CurveStratum, { kind: 'templatePath' }>,
  ) => Extract<CurveStratum, { kind: 'templatePath' }>,
): void {
  onDiagramChange((currentDiagram) =>
    updateStratumById(currentDiagram, pathId, (current) => {
      if (
        current.geometricKind !== 'curve' ||
        current.kind !== 'templatePath'
      ) {
        return current
      }

      return updater(current)
    }),
  )
}

function ConcatenatedPathGeometryEditor({
  diagram,
  path,
  onDiagramChange,
}: {
  diagram: Diagram
  path: ConcatenatedPathStratum
  onDiagramChange: DiagramChangeHandler
}) {
  const segmentDescriptions = describeConcatenatedPathSegments(path)

  return (
    <>
      <div className="path-segment-operations">
        <button
          type="button"
          className="toolbar-button"
          onClick={() =>
            updateConcatenatedPathInDiagram(path.id, onDiagramChange, (current) =>
              appendLineSegmentToConcatenatedPath(
                current,
                diagram.ambientDimension,
              ),
            )
          }
        >
          Append line
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={() =>
            updateConcatenatedPathInDiagram(path.id, onDiagramChange, (current) =>
              appendCubicSegmentToConcatenatedPath(
                current,
                diagram.ambientDimension,
              ),
            )
          }
        >
          Append cubic
        </button>
        <button
          type="button"
          className="toolbar-button"
          disabled={path.segments.length <= 1}
          onClick={() =>
            updateConcatenatedPathInDiagram(path.id, onDiagramChange, (current) =>
              removeLastSegmentFromConcatenatedPath(current),
            )
          }
        >
          Remove last
        </button>
      </div>
      {segmentDescriptions.map((segment) => (
        <ConcatenatedPathSegmentEditor
          key={`path-segment-${segment.segmentIndex}`}
          diagram={diagram}
          path={path}
          segment={segment}
          onDiagramChange={onDiagramChange}
        />
      ))}
    </>
  )
}

function ConcatenatedPathSegmentEditor({
  diagram,
  path,
  segment,
  onDiagramChange,
}: {
  diagram: Diagram
  path: ConcatenatedPathStratum
  segment: ConcatenatedPathSegmentDescription
  onDiagramChange: DiagramChangeHandler
}) {
  const pathSegment = path.segments[segment.segmentIndex]
  const effectiveStyle = resolveCurveStyle(path.style, pathSegment.styleOverride)

  return (
    <details className="path-segment-editor" open={segment.segmentIndex === 0}>
      <summary>
        Segment {segment.segmentNumber} - {segment.kindLabel}
      </summary>
      {pathSegment.kind === 'cubicBezier' &&
        renderPathCubicControlModeEditor(
          diagram,
          path,
          segment,
          onDiagramChange,
        )}
      {renderPathSegmentPointEditors(
        diagram,
        path,
        pathSegment,
        segment,
        onDiagramChange,
      )}
      {renderPathSegmentStyleOverrideEditor(
        path,
        segment.segmentIndex,
        effectiveStyle,
        hasCurveStyleOverride(pathSegment.styleOverride),
        onDiagramChange,
      )}
    </details>
  )
}

function renderPathSegmentStyleOverrideEditor(
  path: ConcatenatedPathStratum,
  segmentIndex: number,
  effectiveStyle: ConcatenatedPathStratum['style'],
  hasOverride: boolean,
  onDiagramChange: DiagramChangeHandler,
) {
  return (
    <div className="path-segment-style-editor">
      <ReadOnlyField
        label="Segment style"
        value={hasOverride ? 'Override' : 'Inherit path'}
      />
      <EditableColorField
        label="Stroke color"
        value={effectiveStyle.strokeColor}
        onChange={(strokeColor) =>
          updatePathSegmentStyleOverrideField(
            path,
            segmentIndex,
            'strokeColor',
            strokeColor as HexColor,
            onDiagramChange,
          )
        }
      />
      <EditableOpacityField
        label="Stroke opacity"
        value={effectiveStyle.strokeOpacity}
        onChange={(strokeOpacity) =>
          updatePathSegmentStyleOverrideField(
            path,
            segmentIndex,
            'strokeOpacity',
            strokeOpacity,
            onDiagramChange,
          )
        }
      />
      <EditablePositiveNumberField
        label="Line width"
        value={effectiveStyle.lineWidth}
        onChange={(lineWidth) =>
          updatePathSegmentStyleOverrideField(
            path,
            segmentIndex,
            'lineWidth',
            lineWidth,
            onDiagramChange,
          )
        }
      />
      <EditableSelectField<LineStyle>
        label="Line style"
        value={effectiveStyle.lineStyle}
        options={lineStyles}
        onChange={(lineStyle) =>
          updatePathSegmentStyleOverrideField(
            path,
            segmentIndex,
            'lineStyle',
            lineStyle,
            onDiagramChange,
          )
        }
      />
      <button
        type="button"
        className="toolbar-button path-segment-clear-style"
        disabled={!hasOverride}
        onClick={() =>
          updateConcatenatedPathInDiagram(path.id, onDiagramChange, (current) =>
            clearConcatenatedPathSegmentStyleOverride(current, segmentIndex),
          )
        }
      >
        Clear override
      </button>
    </div>
  )
}

function updatePathSegmentStyleOverrideField(
  path: ConcatenatedPathStratum,
  segmentIndex: number,
  field: PathSegmentStyleOverrideField,
  value: HexColor | number | LineStyle,
  onDiagramChange: DiagramChangeHandler,
): void {
  updateConcatenatedPathInDiagram(path.id, onDiagramChange, (current) =>
    updateConcatenatedPathSegmentStyleOverrideField(
      current,
      segmentIndex,
      field,
      value,
    ),
  )
}

function renderPathCubicControlModeEditor(
  diagram: Diagram,
  path: ConcatenatedPathStratum,
  segment: ConcatenatedPathSegmentDescription,
  onDiagramChange: DiagramChangeHandler,
) {
  if (segment.bezierControlMode === null) {
    return (
      <ReadOnlyField
        label="Bezier controls"
        value={segment.bezierControlModeLabel ?? 'unknown'}
      />
    )
  }

  return (
    <EditableSelectField<PathInspectorBezierControlMode>
      label="Bezier controls"
      value={segment.bezierControlMode}
      options={pathBezierControlModeOptions(diagram.ambientDimension)}
      onChange={(mode) =>
        updateConcatenatedPathInDiagram(path.id, onDiagramChange, (current) =>
          updateConcatenatedPathCubicControlMode(
            current,
            diagram.ambientDimension,
            segment.segmentIndex,
            mode,
          ),
        )
      }
    />
  )
}

function renderPathSegmentPointEditors(
  diagram: Diagram,
  path: ConcatenatedPathStratum,
  pathSegment: PathSegment,
  segment: ConcatenatedPathSegmentDescription,
  onDiagramChange: DiagramChangeHandler,
) {
  if (
    pathSegment.kind === 'cubicBezier' &&
    pathSegment.controlMode?.kind === 'relativeCartesian'
  ) {
    return [
      renderPathPointCoordinateEditor(
        diagram,
        path,
        segment.points[0],
        segment.segmentNumber,
        onDiagramChange,
      ),
      <CoordinateEditor
        key="control-1-offset"
        label={`Segment ${segment.segmentNumber} Control 1 offset`}
        point={pathSegment.controlMode.firstControlOffset}
        ambientDimension={diagram.ambientDimension}
        onCoordinateChange={(axis, value) =>
          updateConcatenatedPathInDiagram(path.id, onDiagramChange, (current) =>
            updateConcatenatedPathRelativeCartesianOffset(
              current,
              diagram.ambientDimension,
              segment.segmentIndex,
              'firstControlOffset',
              axis,
              value,
            ),
          )
        }
      />,
      <CoordinateEditor
        key="control-2-offset"
        label={`Segment ${segment.segmentNumber} Control 2 offset`}
        point={pathSegment.controlMode.secondControlOffset}
        ambientDimension={diagram.ambientDimension}
        onCoordinateChange={(axis, value) =>
          updateConcatenatedPathInDiagram(path.id, onDiagramChange, (current) =>
            updateConcatenatedPathRelativeCartesianOffset(
              current,
              diagram.ambientDimension,
              segment.segmentIndex,
              'secondControlOffset',
              axis,
              value,
            ),
          )
        }
      />,
      renderPathPointCoordinateEditor(
        diagram,
        path,
        segment.points[3],
        segment.segmentNumber,
        onDiagramChange,
      ),
    ]
  }

  if (
    pathSegment.kind === 'cubicBezier' &&
    pathSegment.controlMode?.kind === 'relativePolar'
  ) {
    return [
      renderPathPointCoordinateEditor(
        diagram,
        path,
        segment.points[0],
        segment.segmentNumber,
        onDiagramChange,
      ),
      <EditableNumberField
        key="control-1-angle"
        label={`Segment ${segment.segmentNumber} Control 1 angle`}
        value={pathSegment.controlMode.firstControl.angleDegrees}
        onChange={(value) =>
          updateConcatenatedPathInDiagram(path.id, onDiagramChange, (current) =>
            updateConcatenatedPathRelativePolarControl(
              current,
              diagram.ambientDimension,
              segment.segmentIndex,
              'firstControl',
              'angleDegrees',
              value,
            ),
          )
        }
      />,
      <EditableNumberField
        key="control-1-radius"
        label={`Segment ${segment.segmentNumber} Control 1 radius`}
        value={pathSegment.controlMode.firstControl.radius}
        onChange={(value) =>
          updateConcatenatedPathInDiagram(path.id, onDiagramChange, (current) =>
            updateConcatenatedPathRelativePolarControl(
              current,
              diagram.ambientDimension,
              segment.segmentIndex,
              'firstControl',
              'radius',
              value,
            ),
          )
        }
      />,
      <EditableNumberField
        key="control-2-angle"
        label={`Segment ${segment.segmentNumber} Control 2 angle`}
        value={pathSegment.controlMode.secondControl.angleDegrees}
        onChange={(value) =>
          updateConcatenatedPathInDiagram(path.id, onDiagramChange, (current) =>
            updateConcatenatedPathRelativePolarControl(
              current,
              diagram.ambientDimension,
              segment.segmentIndex,
              'secondControl',
              'angleDegrees',
              value,
            ),
          )
        }
      />,
      <EditableNumberField
        key="control-2-radius"
        label={`Segment ${segment.segmentNumber} Control 2 radius`}
        value={pathSegment.controlMode.secondControl.radius}
        onChange={(value) =>
          updateConcatenatedPathInDiagram(path.id, onDiagramChange, (current) =>
            updateConcatenatedPathRelativePolarControl(
              current,
              diagram.ambientDimension,
              segment.segmentIndex,
              'secondControl',
              'radius',
              value,
            ),
          )
        }
      />,
      renderPathPointCoordinateEditor(
        diagram,
        path,
        segment.points[3],
        segment.segmentNumber,
        onDiagramChange,
      ),
    ]
  }

  return segment.points.map((point) =>
    renderPathPointCoordinateEditor(
      diagram,
      path,
      point,
      segment.segmentNumber,
      onDiagramChange,
    ),
  )
}

function renderPathPointCoordinateEditor(
  diagram: Diagram,
  path: ConcatenatedPathStratum,
  point: ConcatenatedPathPointDescription,
  segmentNumber: number,
  onDiagramChange: DiagramChangeHandler,
) {
  return (
    <CoordinateEditor
      key={`${point.target.segmentIndex}-${point.target.role}`}
      label={`Segment ${segmentNumber} ${point.label}`}
      point={point.point}
      ambientDimension={diagram.ambientDimension}
      variables={diagram.variables}
      allowSymbolic
      onCoordinateChange={(axis, value) =>
        updateConcatenatedPathInDiagram(path.id, onDiagramChange, (current) =>
          updateConcatenatedPathCoordinate(
            current,
            diagram.ambientDimension,
            point.target,
            axis,
            value,
          ),
        )
      }
    />
  )
}

function updateConcatenatedPathInDiagram(
  pathId: string,
  onDiagramChange: DiagramChangeHandler,
  updater: (path: ConcatenatedPathStratum) => ConcatenatedPathStratum,
): void {
  onDiagramChange((currentDiagram) =>
    updateStratumById(currentDiagram, pathId, (current) => {
      if (
        current.geometricKind !== 'curve' ||
        current.kind !== 'concatenatedPath'
      ) {
        return current
      }

      return updater(current)
    }),
  )
}

function AbsoluteCurvePointEditor({
  diagram,
  curve,
  label,
  point,
  pointIndex,
  onDiagramChange,
}: {
  diagram: Diagram
  curve: CurveStratum
  label: string
  point: Vec3
  pointIndex: number
  onDiagramChange: DiagramChangeHandler
}) {
  return (
    <CoordinateEditor
      label={label}
      point={point}
      ambientDimension={diagram.ambientDimension}
      variables={diagram.variables}
      allowSymbolic
      onCoordinateChange={(axis, value) =>
        onDiagramChange((currentDiagram) =>
          updateStratumById(currentDiagram, curve.id, (current) => {
            if (
              current.geometricKind !== 'curve' ||
              current.kind === 'concatenatedPath' ||
              current.kind === 'templatePath' ||
              current.kind === 'grid'
            ) {
              return current
            }

            return {
              ...current,
              bezierControls:
                current.kind === 'cubicBezier' ? { kind: 'absolute' } : undefined,
              points: current.points.map((currentPoint, index) =>
                index === pointIndex
                  ? updateVec3Coordinate(
                      currentPoint,
                      axis,
                      value,
                      currentDiagram.ambientDimension,
                    )
                  : currentPoint,
              ),
            }
          }),
        )
      }
    />
  )
}

function RelativeEndpointEditor({
  diagram,
  curve,
  label,
  pointIndex,
  onDiagramChange,
}: {
  diagram: Diagram
  curve: CubicBezierCurveStratum
  label: string
  pointIndex: 0 | 3
  onDiagramChange: DiagramChangeHandler
}) {
  return (
    <CoordinateEditor
      label={label}
      point={curve.points[pointIndex]}
      ambientDimension={diagram.ambientDimension}
      variables={diagram.variables}
      allowSymbolic
      onCoordinateChange={(axis, value) =>
        onDiagramChange((currentDiagram) =>
          updateStratumById(currentDiagram, curve.id, (current) => {
            if (
              current.geometricKind !== 'curve' ||
              current.kind !== 'cubicBezier'
            ) {
              return current
            }

            return updateRelativeCubicBezierEndpoint(
              current,
              currentDiagram.ambientDimension,
              pointIndex,
              axis,
              value,
            )
          }),
        )
      }
    />
  )
}

function updateCubicBezierControlMode(
  curve: CubicBezierCurveStratum,
  ambientDimension: AmbientDimension,
  mode: InspectorBezierControlMode,
): CubicBezierCurveStratum {
  if (mode === 'absolute') {
    return { ...curve, bezierControls: { kind: 'absolute' } }
  }

  const bezierControls =
    mode === 'relativeCartesian'
      ? relativeCartesianControlModeFromPoints(ambientDimension, curve.points)
      : relativePolarControlModeFromPoints(ambientDimension, curve.points)

  return bezierControls === null ? curve : { ...curve, bezierControls }
}

function updateRelativeCubicBezierEndpoint(
  curve: CubicBezierCurveStratum,
  ambientDimension: AmbientDimension,
  pointIndex: 0 | 3,
  axis: CoordinateAxis,
  value: CoordinateComponent,
): CubicBezierCurveStratum {
  const bezierControls = curve.bezierControls

  if (
    bezierControls?.kind !== 'relativeCartesian' &&
    bezierControls?.kind !== 'relativePolar'
  ) {
    return curve
  }

  const nextPoints = curve.points.map((point, index) =>
    index === pointIndex
      ? updateVec3Coordinate(point, axis, value, ambientDimension)
      : point,
  )
  const absolutePoints = absoluteCubicBezierPointsFromControlMode(
    ambientDimension,
    nextPoints[0],
    nextPoints[3],
    bezierControls,
  )

  return absolutePoints === null ? curve : { ...curve, points: absolutePoints }
}

function updateRelativeCartesianOffset(
  diagram: Diagram,
  curve: CurveStratum,
  offsetKey: 'firstControlOffset' | 'secondControlOffset',
  axis: CoordinateAxis,
  value: CoordinateComponent,
  onDiagramChange: DiagramChangeHandler,
): void {
  onDiagramChange((currentDiagram) =>
    updateStratumById(currentDiagram, curve.id, (current) => {
      if (
        current.geometricKind !== 'curve' ||
        current.kind !== 'cubicBezier' ||
        current.bezierControls?.kind !== 'relativeCartesian'
      ) {
        return current
      }

      const bezierControls: CubicBezierControlMode = {
        ...current.bezierControls,
        [offsetKey]: updateVec3Coordinate(
          current.bezierControls[offsetKey],
          axis,
          value,
          diagram.ambientDimension,
        ),
      }
      const absolutePoints = absoluteCubicBezierPointsFromControlMode(
        currentDiagram.ambientDimension,
        current.points[0],
        current.points[3],
        bezierControls,
      )

      return absolutePoints === null
        ? current
        : { ...current, points: absolutePoints, bezierControls }
    }),
  )
}

function updateRelativePolarControl(
  curve: CurveStratum,
  controlKey: 'firstControl' | 'secondControl',
  valueKey: 'angleDegrees' | 'radius',
  value: number,
  onDiagramChange: DiagramChangeHandler,
): void {
  onDiagramChange((currentDiagram) =>
    updateStratumById(currentDiagram, curve.id, (current) => {
      if (
        current.geometricKind !== 'curve' ||
        current.kind !== 'cubicBezier' ||
        current.bezierControls?.kind !== 'relativePolar'
      ) {
        return current
      }

      const bezierControls: CubicBezierControlMode = {
        ...current.bezierControls,
        [controlKey]: {
          ...current.bezierControls[controlKey],
          [valueKey]: value,
        },
      }
      const absolutePoints = absoluteCubicBezierPointsFromControlMode(
        currentDiagram.ambientDimension,
        current.points[0],
        current.points[3],
        bezierControls,
      )

      return absolutePoints === null
        ? current
        : { ...current, points: absolutePoints, bezierControls }
    }),
  )
}

function bezierControlModeOptions(
  ambientDimension: AmbientDimension,
): readonly InspectorBezierControlMode[] {
  return ambientDimension === 2
    ? ['absolute', 'relativeCartesian', 'relativePolar']
    : ['absolute', 'relativeCartesian']
}

function editableInspectorBezierControlMode(
  controlMode: CubicBezierControlMode | undefined,
): InspectorBezierControlMode | null {
  switch (controlMode?.kind ?? 'absolute') {
    case 'absolute':
      return 'absolute'
    case 'relativeCartesian':
      return 'relativeCartesian'
    case 'relativePolar':
      return 'relativePolar'
    case 'workPlaneRelativeCartesian':
    case 'workPlaneRelativePolar':
      return null
  }
}
