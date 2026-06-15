import type {
  CurveStratum,
  Diagram,
  PolygonSheetStratum,
  Stratum,
} from '../../model/types.ts'
import {
  updateStratumById,
  updateStratumNameById,
} from '../diagramUpdates.ts'
import { CurveGeometryEditor } from './CurveGeometryEditor.tsx'
import {
  EditableNumberField,
  EditableTextField,
  ReadOnlyField,
} from './InspectorField.tsx'
import { PointGeometryEditor } from './PointGeometryEditor.tsx'
import { SheetGeometryEditor } from './SheetGeometryEditor.tsx'
import { StyleEditor } from './StyleEditor.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type StratumInspectorProps = {
  diagram: Diagram
  stratum: Stratum
  onDiagramChange: DiagramChangeHandler
}

export function StratumInspector({
  diagram,
  stratum,
  onDiagramChange,
}: StratumInspectorProps) {
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
                updateStratumNameById(currentDiagram, stratum.id, name),
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
          <ReadOnlyField
            label="Attached label metadata"
            value={stratum.label ?? 'none'}
          />
          <PathLabelField stratum={stratum} onDiagramChange={onDiagramChange} />
        </div>
      </section>

      <StratumGeometrySection
        diagram={diagram}
        stratum={stratum}
        onDiagramChange={onDiagramChange}
      />

      <StyleEditor stratum={stratum} onDiagramChange={onDiagramChange} />
    </div>
  )
}

type PathLabelStratum = CurveStratum | PolygonSheetStratum

function PathLabelField({
  stratum,
  onDiagramChange,
}: {
  stratum: Stratum
  onDiagramChange: DiagramChangeHandler
}) {
  if (!isPathLabelStratum(stratum)) {
    return <ReadOnlyField label="Path label" value="not applicable" />
  }

  return (
    <EditableTextField
      label="Path label"
      value={stratum.pathLabel ?? ''}
      onChange={(pathLabel) =>
        onDiagramChange((currentDiagram) =>
          updateStratumById(currentDiagram, stratum.id, (current) => {
            if (!isPathLabelStratum(current)) {
              return current
            }

            if (pathLabel.trim().length === 0) {
              return omitPathLabel(current)
            }

            return {
              ...current,
              pathLabel,
            }
          }),
        )
      }
    />
  )
}

function isPathLabelStratum(stratum: Stratum): stratum is PathLabelStratum {
  return (
    stratum.geometricKind === 'curve' ||
    (stratum.geometricKind === 'sheet' && stratum.kind === 'polygonSheet')
  )
}

function omitPathLabel(stratum: PathLabelStratum): PathLabelStratum {
  const withoutPathLabel = { ...stratum }
  delete withoutPathLabel.pathLabel

  return withoutPathLabel
}

function StratumGeometrySection({
  diagram,
  stratum,
  onDiagramChange,
}: StratumInspectorProps) {
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
      return (
        <SheetGeometryEditor
          diagram={diagram}
          sheet={stratum}
          onDiagramChange={onDiagramChange}
        />
      )
    case 'curve':
      return (
        <CurveGeometryEditor
          diagram={diagram}
          curve={stratum}
          onDiagramChange={onDiagramChange}
        />
      )
    case 'point':
      return (
        <PointGeometryEditor
          diagram={diagram}
          point={stratum}
          onDiagramChange={onDiagramChange}
        />
      )
  }
}
