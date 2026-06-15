import type { Diagram, Stratum } from '../../model/types.ts'
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
          <ReadOnlyField
            label="Path labels"
            value="not implemented in TikZ export yet"
          />
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
