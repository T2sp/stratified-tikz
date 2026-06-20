import type {
  BoundaryPathSnapshot,
  CurvedSheetPrimitive,
  CurvedSheetStratum,
  Diagram,
  SurfaceSampling,
  Vec3,
} from '../../model/types.ts'
import {
  maxCurvedSheetSamplingSegments,
  updateCurvedSheetPrimitiveById,
  updateVec3Coordinate,
} from '../diagramUpdates.ts'
import { CoordinateEditor } from './CoordinateEditor.tsx'
import {
  EditableNumberField,
  EditablePositiveNumberField,
  EditableSelectField,
  ReadOnlyField,
  formatNumberInput,
} from './InspectorField.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type CurvedSheetGeometryEditorProps = {
  diagram: Diagram
  sheet: CurvedSheetStratum
  onDiagramChange: DiagramChangeHandler
}

export function CurvedSheetGeometryEditor({
  diagram,
  sheet,
  onDiagramChange,
}: CurvedSheetGeometryEditorProps) {
  const primitive = sheet.primitive

  return (
    <section className="inspector-section">
      <h3>Geometry</h3>
      <div className="inspector-form">
        <ReadOnlyField label="Primitive" value={primitive.kind} />
        {renderPrimitiveFields(diagram, sheet, onDiagramChange)}
        {renderSamplingFields(sheet, onDiagramChange)}
        {renderFrameFields(primitive)}
      </div>
    </section>
  )
}

function renderPrimitiveFields(
  diagram: Diagram,
  sheet: CurvedSheetStratum,
  onDiagramChange: DiagramChangeHandler,
) {
  const primitive = sheet.primitive

  switch (primitive.kind) {
    case 'hemisphere':
      return (
        <>
          <CoordinateEditor
            label="Center"
            point={primitive.center}
            ambientDimension={diagram.ambientDimension}
            onCoordinateChange={(axis, value) =>
              onDiagramChange((currentDiagram) =>
                updateCurvedSheetPrimitiveById(
                  currentDiagram,
                  sheet.id,
                  (currentPrimitive) =>
                    currentPrimitive.kind === 'hemisphere'
                      ? {
                          ...currentPrimitive,
                          center: updateVec3Coordinate(
                            currentPrimitive.center,
                            axis,
                            value,
                            currentDiagram.ambientDimension,
                          ),
                          frame: {
                            ...currentPrimitive.frame,
                            origin: updateVec3Coordinate(
                              currentPrimitive.frame.origin,
                              axis,
                              value,
                              currentDiagram.ambientDimension,
                            ),
                          },
                        }
                      : currentPrimitive,
                ),
              )
            }
          />
          <EditablePositiveNumberField
            label="Radius"
            value={primitive.radius}
            onChange={(radius) =>
              updatePrimitive(sheet.id, onDiagramChange, (currentPrimitive) =>
                currentPrimitive.kind === 'hemisphere'
                  ? { ...currentPrimitive, radius }
                  : currentPrimitive,
              )
            }
          />
          <EditableSelectField
            label="Side"
            value={primitive.hemisphereSide}
            options={['positive', 'negative'] as const}
            onChange={(hemisphereSide) =>
              updatePrimitive(sheet.id, onDiagramChange, (currentPrimitive) =>
                currentPrimitive.kind === 'hemisphere'
                  ? { ...currentPrimitive, hemisphereSide }
                  : currentPrimitive,
              )
            }
          />
        </>
      )
    case 'saddle':
      return (
        <>
          <CoordinateEditor
            label="Origin"
            point={primitive.frame.origin}
            ambientDimension={diagram.ambientDimension}
            onCoordinateChange={(axis, value) =>
              onDiagramChange((currentDiagram) =>
                updateCurvedSheetPrimitiveById(
                  currentDiagram,
                  sheet.id,
                  (currentPrimitive) =>
                    currentPrimitive.kind === 'saddle'
                      ? {
                          ...currentPrimitive,
                          frame: {
                            ...currentPrimitive.frame,
                            origin: updateVec3Coordinate(
                              currentPrimitive.frame.origin,
                              axis,
                              value,
                              currentDiagram.ambientDimension,
                            ),
                          },
                        }
                      : currentPrimitive,
                ),
              )
            }
          />
          <EditablePositiveNumberField
            label="Width"
            value={primitive.width}
            onChange={(width) =>
              updatePrimitive(sheet.id, onDiagramChange, (currentPrimitive) =>
                currentPrimitive.kind === 'saddle'
                  ? { ...currentPrimitive, width }
                  : currentPrimitive,
              )
            }
          />
          <EditablePositiveNumberField
            label="Depth"
            value={primitive.depth}
            onChange={(depth) =>
              updatePrimitive(sheet.id, onDiagramChange, (currentPrimitive) =>
                currentPrimitive.kind === 'saddle'
                  ? { ...currentPrimitive, depth }
                  : currentPrimitive,
              )
            }
          />
          <EditableNumberField
            label="Height"
            value={primitive.height}
            onChange={(height) =>
              updatePrimitive(sheet.id, onDiagramChange, (currentPrimitive) =>
                currentPrimitive.kind === 'saddle'
                  ? { ...currentPrimitive, height }
                  : currentPrimitive,
              )
            }
          />
        </>
      )
    case 'ruledSurface':
      return (
        <>
          <ReadOnlyField
            label="Boundary 0"
            value={formatBoundarySummary(primitive.boundary0)}
          />
          <ReadOnlyField
            label="Boundary 1"
            value={formatBoundarySummary(primitive.boundary1)}
          />
        </>
      )
    case 'coonsPatch':
      return (
        <>
          <ReadOnlyField
            label="Bottom"
            value={formatBoundarySummary(primitive.bottom)}
          />
          <ReadOnlyField
            label="Right"
            value={formatBoundarySummary(primitive.right)}
          />
          <ReadOnlyField
            label="Top"
            value={formatBoundarySummary(primitive.top)}
          />
          <ReadOnlyField
            label="Left"
            value={formatBoundarySummary(primitive.left)}
          />
        </>
      )
  }
}

function renderSamplingFields(
  sheet: CurvedSheetStratum,
  onDiagramChange: DiagramChangeHandler,
) {
  const primitive = sheet.primitive

  if (primitive.kind === 'ruledSurface') {
    return (
      <SamplingField
        label="Segments"
        value={primitive.sampling.segments}
        onChange={(segments) =>
          updatePrimitive(sheet.id, onDiagramChange, (currentPrimitive) =>
            currentPrimitive.kind === 'ruledSurface'
              ? { ...currentPrimitive, sampling: { segments } }
              : currentPrimitive,
          )
        }
      />
    )
  }

  return (
    <>
      <SamplingField
        label="U segments"
        value={primitive.sampling.uSegments}
        onChange={(uSegments) =>
          updatePrimitive(sheet.id, onDiagramChange, (currentPrimitive) =>
            updateSurfaceSamplingPrimitive(currentPrimitive, { uSegments }),
          )
        }
      />
      <SamplingField
        label="V segments"
        value={primitive.sampling.vSegments}
        onChange={(vSegments) =>
          updatePrimitive(sheet.id, onDiagramChange, (currentPrimitive) =>
            updateSurfaceSamplingPrimitive(currentPrimitive, { vSegments }),
          )
        }
      />
    </>
  )
}

function renderFrameFields(primitive: CurvedSheetPrimitive) {
  switch (primitive.kind) {
    case 'hemisphere':
    case 'saddle':
      return (
        <>
          <ReadOnlyField label="Frame u" value={formatVec3(primitive.frame.u)} />
          <ReadOnlyField label="Frame v" value={formatVec3(primitive.frame.v)} />
          <ReadOnlyField
            label="Frame normal"
            value={formatVec3(primitive.frame.normal)}
          />
        </>
      )
    case 'ruledSurface':
    case 'coonsPatch':
      return null
  }
}

function updatePrimitive(
  sheetId: string,
  onDiagramChange: DiagramChangeHandler,
  updater: (primitive: CurvedSheetPrimitive) => CurvedSheetPrimitive,
): void {
  onDiagramChange((diagram) =>
    updateCurvedSheetPrimitiveById(diagram, sheetId, updater),
  )
}

function updateSampling(
  sampling: SurfaceSampling,
  patch: Partial<SurfaceSampling>,
): SurfaceSampling {
  return {
    ...sampling,
    ...patch,
  }
}

function updateSurfaceSamplingPrimitive(
  primitive: CurvedSheetPrimitive,
  patch: Partial<SurfaceSampling>,
): CurvedSheetPrimitive {
  switch (primitive.kind) {
    case 'hemisphere':
    case 'saddle':
    case 'coonsPatch':
      return {
        ...primitive,
        sampling: updateSampling(primitive.sampling, patch),
      }
    case 'ruledSurface':
      return primitive
  }
}

function formatBoundarySummary(boundary: BoundaryPathSnapshot): string {
  const prefix =
    boundary.name !== undefined
      ? boundary.name
      : boundary.id !== undefined
        ? boundary.id
        : 'copied path'

  return `${prefix}, ${boundary.segments.length} segment${boundary.segments.length === 1 ? '' : 's'}`
}

function SamplingField({
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
        min="1"
        max={maxCurvedSheetSamplingSegments}
        step="1"
        value={formatNumberInput(value)}
        onChange={(event) => {
          const nextValue = Number(event.currentTarget.value)

          if (
            Number.isInteger(nextValue) &&
            nextValue > 0 &&
            nextValue <= maxCurvedSheetSamplingSegments
          ) {
            onChange(nextValue)
          }
        }}
      />
    </label>
  )
}

function formatVec3(point: Vec3): string {
  return `(${formatNumber(point.x)}, ${formatNumber(point.y)}, ${formatNumber(
    point.z,
  )})`
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3)
}
