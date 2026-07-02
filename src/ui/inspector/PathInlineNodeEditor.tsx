import {
  curveInlineNodeSegmentCount,
  isPathInlineNodeEditableCurve,
} from '../../model/pathInlineNodes.ts'
import {
  pathInlineNodeMarkers,
  pathInlineNodePlacements,
} from '../../model/types.ts'
import type {
  CurveStratum,
  PathInlineNode,
  PathInlineNodeMarker,
  PathInlineNodePlacement,
} from '../../model/types.ts'
import { updateStratumById } from '../diagramUpdates.ts'
import {
  addPathInlineNode,
  deletePathInlineNode,
  pathInlineNodeBooleanOptions,
  updatePathInlineNodeAllowUpsideDown,
  updatePathInlineNodeAnchor,
  updatePathInlineNodeMarker,
  updatePathInlineNodePlacement,
  updatePathInlineNodePosition,
  updatePathInlineNodeSegmentIndex,
  updatePathInlineNodeSloped,
  updatePathInlineNodeText,
  type PathInlineNodeBooleanOption,
} from '../pathInlineNodeEditing.ts'
import {
  EditableNumberField,
  EditableSelectField,
  EditableTextField,
  ReadOnlyField,
} from './InspectorField.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type PathInlineNodeEditorProps = {
  curve: CurveStratum
  onDiagramChange: DiagramChangeHandler
}

export function PathInlineNodeEditor({
  curve,
  onDiagramChange,
}: PathInlineNodeEditorProps) {
  if (!isPathInlineNodeEditableCurve(curve)) {
    return null
  }

  const segmentCount = curveInlineNodeSegmentCount(curve)
  const inlineNodes = curve.inlineNodes ?? []

  return (
    <section className="inspector-section">
      <h3>Path nodes</h3>
      <div className="inspector-form">
        <ReadOnlyField label="TikZ syntax" value="node[pos=...]" />
        <ReadOnlyField label="Count" value={String(inlineNodes.length)} />
        <div className="inspector-field">
          <span className="inspector-field-label">Add path node</span>
          <button
            type="button"
            className="toolbar-button"
            disabled={segmentCount === 0}
            title={
              segmentCount === 0
                ? 'This path has no editable path segment.'
                : 'Add a TikZ node[pos=...] attachment without changing path geometry.'
            }
            onClick={() =>
              onDiagramChange((currentDiagram) =>
                updateStratumById(currentDiagram, curve.id, addPathInlineNode),
              )
            }
          >
            Add path node
          </button>
        </div>
        {inlineNodes.map((node, index) => (
          <PathInlineNodeFields
            key={node.id}
            curve={curve}
            node={node}
            index={index}
            segmentCount={segmentCount}
            onDiagramChange={onDiagramChange}
          />
        ))}
      </div>
    </section>
  )
}

function PathInlineNodeFields({
  curve,
  node,
  index,
  segmentCount,
  onDiagramChange,
}: {
  curve: CurveStratum
  node: PathInlineNode
  index: number
  segmentCount: number
  onDiagramChange: DiagramChangeHandler
}) {
  const segmentOptions = Array.from({ length: segmentCount }, (_, segmentIndex) =>
    String(segmentIndex + 1),
  )

  return (
    <>
      <ReadOnlyField label={`Path node ${index + 1}`} value={node.id} />
      {segmentOptions.length > 0 && (
        <EditableSelectField
          label="Segment"
          value={String(node.position.segmentIndex + 1)}
          options={segmentOptions}
          onChange={(value) =>
            onDiagramChange((currentDiagram) =>
              updateStratumById(currentDiagram, curve.id, (current) =>
                updatePathInlineNodeSegmentIndex(
                  current,
                  node.id,
                  Number(value) - 1,
                ),
              ),
            )
          }
        />
      )}
      <EditableNumberField
        label="pos"
        value={node.position.value}
        onChange={(value) =>
          onDiagramChange((currentDiagram) =>
            updateStratumById(currentDiagram, curve.id, (current) =>
              updatePathInlineNodePosition(current, node.id, value),
            ),
          )
        }
      />
      <EditableTextField
        label="Text"
        value={node.text}
        placeholder="$f$"
        onChange={(text) =>
          onDiagramChange((currentDiagram) =>
            updateStratumById(currentDiagram, curve.id, (current) =>
              updatePathInlineNodeText(current, node.id, text),
            ),
          )
        }
      />
      <EditableSelectField<PathInlineNodePlacement>
        label="Placement"
        value={node.options.placement ?? 'above'}
        options={pathInlineNodePlacements}
        onChange={(placement) =>
          onDiagramChange((currentDiagram) =>
            updateStratumById(currentDiagram, curve.id, (current) =>
              updatePathInlineNodePlacement(current, node.id, placement),
            ),
          )
        }
      />
      <EditableSelectField<PathInlineNodeBooleanOption>
        label="Sloped"
        value={node.options.sloped === true ? 'on' : 'off'}
        options={pathInlineNodeBooleanOptions}
        onChange={(value) =>
          onDiagramChange((currentDiagram) =>
            updateStratumById(currentDiagram, curve.id, (current) =>
              updatePathInlineNodeSloped(current, node.id, value === 'on'),
            ),
          )
        }
      />
      <EditableSelectField<PathInlineNodeBooleanOption>
        label="Allow upside down"
        value={node.options.allowUpsideDown === true ? 'on' : 'off'}
        options={pathInlineNodeBooleanOptions}
        onChange={(value) =>
          onDiagramChange((currentDiagram) =>
            updateStratumById(currentDiagram, curve.id, (current) =>
              updatePathInlineNodeAllowUpsideDown(
                current,
                node.id,
                value === 'on',
              ),
            ),
          )
        }
      />
      <EditableTextField
        label="Anchor"
        value={node.options.anchor ?? ''}
        placeholder="south"
        onChange={(anchor) =>
          onDiagramChange((currentDiagram) =>
            updateStratumById(currentDiagram, curve.id, (current) =>
              updatePathInlineNodeAnchor(current, node.id, anchor),
            ),
          )
        }
      />
      <EditableSelectField<PathInlineNodeMarker>
        label="Marker"
        value={node.options.marker ?? 'none'}
        options={pathInlineNodeMarkers}
        onChange={(marker) =>
          onDiagramChange((currentDiagram) =>
            updateStratumById(currentDiagram, curve.id, (current) =>
              updatePathInlineNodeMarker(current, node.id, marker),
            ),
          )
        }
      />
      <div className="inspector-field">
        <span className="inspector-field-label">Delete path node</span>
        <button
          type="button"
          className="toolbar-button"
          onClick={() =>
            onDiagramChange((currentDiagram) =>
              updateStratumById(currentDiagram, curve.id, (current) =>
                deletePathInlineNode(current, node.id),
              ),
            )
          }
        >
          Delete
        </button>
      </div>
    </>
  )
}
