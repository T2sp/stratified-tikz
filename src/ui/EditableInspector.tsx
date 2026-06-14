import type { Dispatch, SetStateAction } from 'react'
import type {
  AmbientDimension,
  CurveStratum,
  Diagram,
  PointStratum,
  SheetStratum,
  Stratum,
  TextLabel,
  Vec3,
} from '../model/types.ts'
import {
  coordinateAxesForAmbientDimension,
  parseFiniteNumber,
  updateLabelById,
  updateStratumById,
  updateVec3Coordinate,
  type CoordinateAxis,
} from './diagramUpdates.ts'
import {
  describeCurvePoints,
  formatLabelStyleSummary,
  formatStratumStyleSummary,
  formatVec3,
} from './inspector.ts'
import { findSelectedElement, type SelectedElement } from './selection.ts'

export type EditableInspectorProps = {
  diagram: Diagram
  selectedElement: SelectedElement
  onDiagramChange: Dispatch<SetStateAction<Diagram>>
}

type EditablePointProps = {
  point: Vec3
  ambientDimension: AmbientDimension
  onCoordinateChange: (axis: CoordinateAxis, value: number) => void
}

export function EditableInspector({
  diagram,
  selectedElement,
  onDiagramChange,
}: EditableInspectorProps) {
  const selected = findSelectedElement(diagram, selectedElement)

  if (selected === null) {
    return (
      <div className="empty-inspector">
        <h3>No selection</h3>
        <p>Click a stratum or free text label in the SVG preview.</p>
      </div>
    )
  }

  return selected.kind === 'stratum'
    ? renderStratumInspector(
        diagram,
        selected.element,
        onDiagramChange,
      )
    : renderLabelInspector(diagram, selected.element, onDiagramChange)
}

function renderStratumInspector(
  diagram: Diagram,
  stratum: Stratum,
  onDiagramChange: Dispatch<SetStateAction<Diagram>>,
) {
  return (
    <div className="inspector-content editable-inspector">
      <section className="inspector-section">
        <h3>Selection</h3>
        <div className="inspector-form">
          <ReadOnlyField label="Type" value="stratum" />
          <ReadOnlyField label="ID" value={stratum.id} />
          <EditableTextField
            label="Name"
            value={stratum.name}
            onChange={(name) =>
              onDiagramChange((currentDiagram) =>
                updateStratumById(currentDiagram, stratum.id, (current) => ({
                  ...current,
                  name,
                })),
              )
            }
          />
          <ReadOnlyField label="Geometric kind" value={stratum.geometricKind} />
          <ReadOnlyField label="Codimension" value={String(stratum.codim)} />
          <EditableNumberField
            label="Layer"
            value={stratum.layer}
            onChange={(layer) =>
              onDiagramChange((currentDiagram) =>
                updateStratumById(currentDiagram, stratum.id, (current) => ({
                  ...current,
                  layer,
                })),
              )
            }
          />
          <EditableTextField
            label="Attached label"
            value={stratum.label ?? ''}
            placeholder="none"
            onChange={(label) =>
              onDiagramChange((currentDiagram) =>
                updateStratumById(currentDiagram, stratum.id, (current) =>
                  label === ''
                    ? removeAttachedLabel(current)
                    : { ...current, label },
                ),
              )
            }
          />
        </div>
      </section>

      {renderStratumGeometry(diagram, stratum, onDiagramChange)}

      <section className="inspector-section">
        <h3>Style</h3>
        <div className="inspector-form">
          <ReadOnlyField
            label={stratum.style.kind}
            value={formatStratumStyleSummary(stratum.style)}
          />
        </div>
      </section>
    </div>
  )
}

function renderStratumGeometry(
  diagram: Diagram,
  stratum: Stratum,
  onDiagramChange: Dispatch<SetStateAction<Diagram>>,
) {
  switch (stratum.geometricKind) {
    case 'region':
      return (
        <section className="inspector-section">
          <h3>Geometry</h3>
          <div className="inspector-form">
            <ReadOnlyField
              label="Visible"
              value={stratum.visible ? 'yes' : 'no'}
            />
          </div>
        </section>
      )
    case 'sheet':
      return renderSheetGeometry(diagram, stratum, onDiagramChange)
    case 'curve':
      return renderCurveGeometry(diagram, stratum, onDiagramChange)
    case 'point':
      return renderPointGeometry(diagram, stratum, onDiagramChange)
  }
}

function renderSheetGeometry(
  diagram: Diagram,
  sheet: SheetStratum,
  onDiagramChange: Dispatch<SetStateAction<Diagram>>,
) {
  return (
    <section className="inspector-section">
      <h3>Geometry</h3>
      <div className="inspector-form">
        {sheet.corners.map((corner, cornerIndex) => (
          <EditablePointGroup
            key={`corner-${cornerIndex}`}
            label={`Corner ${cornerIndex + 1}`}
            point={corner}
            ambientDimension={diagram.ambientDimension}
            onCoordinateChange={(axis, value) =>
              onDiagramChange((currentDiagram) =>
                updateStratumById(currentDiagram, sheet.id, (current) => {
                  if (current.geometricKind !== 'sheet') {
                    return current
                  }

                  const corners = current.corners.map((currentCorner, index) =>
                    index === cornerIndex
                      ? updateVec3Coordinate(
                          currentCorner,
                          axis,
                          value,
                          currentDiagram.ambientDimension,
                        )
                      : currentCorner,
                  ) as SheetStratum['corners']

                  return { ...current, corners }
                }),
              )
            }
          />
        ))}
        <ReadOnlyField
          label="Preview"
          value={formatSelectedGeometry(sheet, diagram.ambientDimension)}
        />
      </div>
    </section>
  )
}

function renderCurveGeometry(
  diagram: Diagram,
  curve: CurveStratum,
  onDiagramChange: Dispatch<SetStateAction<Diagram>>,
) {
  return (
    <section className="inspector-section">
      <h3>Geometry</h3>
      <div className="inspector-form">
        <ReadOnlyField label="Curve kind" value={curve.kind} />
        <ReadOnlyField
          label="Style segments"
          value={String(curve.styleSegments.length)}
        />
        {describeCurvePoints(curve).map((description, pointIndex) => (
          <EditablePointGroup
            key={`${description.label}-${pointIndex}`}
            label={description.label}
            point={description.point}
            ambientDimension={diagram.ambientDimension}
            onCoordinateChange={(axis, value) =>
              onDiagramChange((currentDiagram) =>
                updateStratumById(currentDiagram, curve.id, (current) => {
                  if (current.geometricKind !== 'curve') {
                    return current
                  }

                  return {
                    ...current,
                    points: current.points.map((point, index) =>
                      index === pointIndex
                        ? updateVec3Coordinate(
                            point,
                            axis,
                            value,
                            currentDiagram.ambientDimension,
                          )
                        : point,
                    ),
                  }
                }),
              )
            }
          />
        ))}
        <ReadOnlyField
          label="Preview"
          value={formatSelectedGeometry(curve, diagram.ambientDimension)}
        />
      </div>
    </section>
  )
}

function renderPointGeometry(
  diagram: Diagram,
  point: PointStratum,
  onDiagramChange: Dispatch<SetStateAction<Diagram>>,
) {
  return (
    <section className="inspector-section">
      <h3>Geometry</h3>
      <div className="inspector-form">
        <EditablePointGroup
          label="Position"
          point={point.position}
          ambientDimension={diagram.ambientDimension}
          onCoordinateChange={(axis, value) =>
            onDiagramChange((currentDiagram) =>
              updateStratumById(currentDiagram, point.id, (current) => {
                if (current.geometricKind !== 'point') {
                  return current
                }

                return {
                  ...current,
                  position: updateVec3Coordinate(
                    current.position,
                    axis,
                    value,
                    currentDiagram.ambientDimension,
                  ),
                }
              }),
            )
          }
        />
        <ReadOnlyField
          label="Preview"
          value={formatSelectedGeometry(point, diagram.ambientDimension)}
        />
      </div>
    </section>
  )
}

function renderLabelInspector(
  diagram: Diagram,
  label: TextLabel,
  onDiagramChange: Dispatch<SetStateAction<Diagram>>,
) {
  return (
    <div className="inspector-content editable-inspector">
      <section className="inspector-section">
        <h3>Selection</h3>
        <div className="inspector-form">
          <ReadOnlyField label="Type" value="free text label" />
          <ReadOnlyField label="ID" value={label.id} />
          <ReadOnlyField label="Name" value={label.name} />
          <EditableLongTextField
            label="Text"
            value={label.text}
            onChange={(text) =>
              onDiagramChange((currentDiagram) =>
                updateLabelById(currentDiagram, label.id, (current) => ({
                  ...current,
                  text,
                })),
              )
            }
          />
          <EditableNumberField
            label="Layer"
            value={label.layer}
            onChange={(layer) =>
              onDiagramChange((currentDiagram) =>
                updateLabelById(currentDiagram, label.id, (current) => ({
                  ...current,
                  layer,
                })),
              )
            }
          />
        </div>
      </section>

      <section className="inspector-section">
        <h3>Geometry</h3>
        <div className="inspector-form">
          <EditablePointGroup
            label="Position"
            point={label.position}
            ambientDimension={diagram.ambientDimension}
            onCoordinateChange={(axis, value) =>
              onDiagramChange((currentDiagram) =>
                updateLabelById(currentDiagram, label.id, (current) => ({
                  ...current,
                  position: updateVec3Coordinate(
                    current.position,
                    axis,
                    value,
                    currentDiagram.ambientDimension,
                  ),
                })),
              )
            }
          />
          <ReadOnlyField
            label="Preview"
            value={formatVec3(label.position, diagram.ambientDimension)}
          />
        </div>
      </section>

      <section className="inspector-section">
        <h3>Style</h3>
        <div className="inspector-form">
          <ReadOnlyField
            label={label.style.kind}
            value={formatLabelStyleSummary(label.style)}
          />
        </div>
      </section>
    </div>
  )
}

function ReadOnlyField({
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

function EditableTextField({
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

function EditableLongTextField({
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

function EditableNumberField({
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

function EditablePointGroup({
  label,
  point,
  ambientDimension,
  onCoordinateChange,
}: {
  label: string
} & EditablePointProps) {
  return (
    <fieldset className="coordinate-group">
      <legend>{label}</legend>
      <div className="coordinate-grid">
        {coordinateAxesForAmbientDimension(ambientDimension).map((axis) => (
          <label key={axis} className="coordinate-input-row">
            <span>{axis}</span>
            <input
              className="inspector-input"
              type="number"
              step="any"
              value={formatNumberInput(point[axis])}
              onChange={(event) => {
                const parsedValue = parseFiniteNumber(event.currentTarget.value)

                if (parsedValue !== null) {
                  onCoordinateChange(axis, parsedValue)
                }
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function removeAttachedLabel(stratum: Stratum): Stratum {
  return { ...stratum, label: undefined }
}

function formatSelectedGeometry(
  stratum: SheetStratum | CurveStratum | PointStratum,
  ambientDimension: AmbientDimension,
): string {
  switch (stratum.geometricKind) {
    case 'sheet':
      return stratum.corners
        .map((corner, index) => `Corner ${index + 1} ${formatVec3(corner, ambientDimension)}`)
        .join('; ')
    case 'curve':
      return describeCurvePoints(stratum)
        .map(
          (description) =>
            `${description.label} ${formatVec3(description.point, ambientDimension)}`,
        )
        .join('; ')
    case 'point':
      return formatVec3(stratum.position, ambientDimension)
  }
}

function formatNumberInput(value: number): string {
  return Object.is(value, -0) ? '0' : String(value)
}
