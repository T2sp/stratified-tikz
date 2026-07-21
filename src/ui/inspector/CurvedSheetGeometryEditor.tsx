import type {
  CoonsBoundarySnapshot,
  CoonsConstantPointBoundarySnapshot,
  CurvedSheetPrimitive,
  CurvedSheetStratum,
  Diagram,
  SurfaceSampling,
  Vec3,
} from '../../model/types.ts'
import { coonsPatchBoundaryRoles } from '../../model/types.ts'
import {
  coonsPatchBoundaryLinkStatus,
  coonsPatchBoundarySourceId,
  detachCoonsPatchBoundaryLinks,
} from '../../model/coonsPatchLinks.ts'
import {
  maxCurvedSheetSamplingSegments,
  updateCurvedSheetPrimitiveById,
  updateVec3Coordinate,
} from '../diagramUpdates.ts'
import { CoordinateEditor } from './CoordinateEditor.tsx'
import {
  EditableNumberField,
  EditableParsedNumberField,
  EditablePositiveNumberField,
  EditableSelectField,
  ReadOnlyField,
} from './InspectorField.tsx'
import { type InspectorNumberParser } from './numericInput.ts'
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
    <>
      <section className="inspector-section">
        <h3>Geometry</h3>
        <div className="inspector-form">
          <ReadOnlyField label="Primitive" value={primitive.kind} />
          {renderPrimitiveFields(diagram, sheet, onDiagramChange)}
          {renderSamplingFields(sheet, onDiagramChange)}
          {renderFrameFields(primitive)}
        </div>
      </section>
      {primitive.kind === 'coonsPatch' && (
        <CoonsPatchBoundarySourcesInspector
          diagram={diagram}
          sheet={sheet}
          onDiagramChange={onDiagramChange}
        />
      )}
    </>
  )
}

function CoonsPatchBoundarySourcesInspector({
  diagram,
  sheet,
  onDiagramChange,
}: CurvedSheetGeometryEditorProps) {
  if (sheet.primitive.kind !== 'coonsPatch') {
    return null
  }

  const sources = sheet.primitive.boundarySources
  const status = coonsPatchBoundaryLinkStatus(diagram, sheet.id)
  const statusLabel =
    status.kind === 'static'
      ? 'Static'
      : status.kind === 'linkedUpToDate'
        ? 'Linked — up to date'
        : 'Linked — stale'

  return (
    <section className="inspector-section">
      <h3>Boundary sources</h3>
      <div className="inspector-form">
        <ReadOnlyField label="Boundary sources" value={statusLabel} />
        {sources !== undefined &&
          coonsPatchBoundaryRoles.map((role) => {
            const source = sources[role]
            const sourceId = coonsPatchBoundarySourceId(source)
            const sourceStratum = diagram.strata.find(
              (stratum) => stratum.id === sourceId,
            )
            const sourceName =
              sourceStratum?.name.trim().length === 0 || sourceStratum === undefined
                ? sourceId
                : sourceStratum.name
            const suffix =
              source.kind === 'path' && source.reversed ? ' — reversed' : ''

            return (
              <ReadOnlyField
                key={role}
                label={role}
                value={`${sourceName}${suffix}`}
              />
            )
          })}
        {status.kind === 'linkedStale' && (
          <>
            <p className="toolbar-status">
              The last valid patch geometry is being displayed.
            </p>
            {status.issues.slice(0, 4).map((issue, index) => (
              <p
                className="toolbar-status"
                key={`${issue.kind}-${issue.role ?? 'patch'}-${index}`}
              >
                {issue.message}
              </p>
            ))}
          </>
        )}
        {sources !== undefined && (
          <button
            type="button"
            className="toolbar-button"
            onClick={() =>
              onDiagramChange((currentDiagram) =>
                detachCoonsPatchBoundaryLinks(currentDiagram, sheet.id),
              )
            }
          >
            Detach boundary links
          </button>
        )}
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

function formatBoundarySummary(boundary: CoonsBoundarySnapshot): string {
  if (isConstantPointBoundary(boundary)) {
    const prefix =
      boundary.name !== undefined
        ? boundary.name
        : boundary.sourceId !== undefined
          ? boundary.sourceId
          : 'copied point'

    return `${prefix}, constant point`
  }

  const prefix =
    boundary.name !== undefined
      ? boundary.name
      : boundary.id !== undefined
        ? boundary.id
        : 'copied path'

  return `${prefix}, ${boundary.segments.length} segment${boundary.segments.length === 1 ? '' : 's'}`
}

function isConstantPointBoundary(
  boundary: CoonsBoundarySnapshot,
): boundary is CoonsConstantPointBoundarySnapshot {
  return 'kind' in boundary && boundary.kind === 'constantPoint'
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
    <EditableParsedNumberField
      label={label}
      value={value}
      parse={parseSamplingSegmentsInput}
      invalidMessage={`${label} must be an integer from 1 to ${maxCurvedSheetSamplingSegments}.`}
      inputMode="numeric"
      onChange={onChange}
    />
  )
}

const parseSamplingSegmentsInput: InspectorNumberParser = (rawValue) => {
  const nextValue = Number(rawValue)

  return Number.isInteger(nextValue) &&
    nextValue > 0 &&
    nextValue <= maxCurvedSheetSamplingSegments
    ? nextValue
    : null
}

function formatVec3(point: Vec3): string {
  return `(${formatNumber(point.x)}, ${formatNumber(point.y)}, ${formatNumber(
    point.z,
  )})`
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3)
}
