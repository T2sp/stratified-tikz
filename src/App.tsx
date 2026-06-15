import { useMemo, useState, type SetStateAction } from 'react'
import './App.css'
import {
  threeDimensionalExample,
  twoDimensionalExample,
} from './examples'
import {
  normalizePointForAmbientDimension,
  screenToModelOnWorkPlane,
} from './geometry/projection'
import type {
  Camera,
  CoordinateInputMode,
  Diagram,
  Vec2,
  Vec3,
  WorkPlane,
} from './model/types'
import { SvgDiagram } from './rendering'
import { generateTikz } from './tikz'
import {
  addPolylineCurveStratumWithResult,
  addPointStratumWithResult,
  addTextLabelWithResult,
  clearSelectionIfMissing,
  cloneDiagram,
  EditableInspector,
  type SelectedElement,
} from './ui'

type ExampleId = '2d' | '3d'
type CopyStatus = 'idle' | 'copied' | 'failed'
type CreationTool = 'select' | 'createPoint' | 'createLabel' | 'createPolyline'
type PolylineDraft = {
  points: Vec3[]
} | null

type EditableEditorState = {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  polylineDraft: PolylineDraft
}

type ExampleOption = {
  id: ExampleId
  name: string
  summary: string
  diagram: Diagram
}

const exampleOptions: ExampleOption[] = [
  {
    id: '2d',
    name: '2D example',
    summary: 'codim 1 curves, codim 2 points',
    diagram: twoDimensionalExample,
  },
  {
    id: '3d',
    name: '3D example',
    summary: 'codim 1 sheets, codim 2 curves, codim 3 points',
    diagram: threeDimensionalExample,
  },
]

const coordinateInputModes: CoordinateInputMode[] = ['cursor', 'direct']
const creationTools: Array<{ id: CreationTool; label: string }> = [
  { id: 'select', label: 'Select' },
  { id: 'createPoint', label: 'Add point' },
  { id: 'createLabel', label: 'Add label' },
  { id: 'createPolyline', label: 'Add polyline' },
]
const workPlaneKinds: WorkPlane['kind'][] = ['xy', 'xz', 'yz']

function App() {
  const [selectedExampleId, setSelectedExampleId] = useState<ExampleId>('2d')
  const [coordinateInputMode, setCoordinateInputMode] =
    useState<CoordinateInputMode>('cursor')
  const [creationTool, setCreationTool] = useState<CreationTool>('select')
  const [polylineStatus, setPolylineStatus] = useState<string>('')
  const [activeWorkPlane, setActiveWorkPlane] = useState<WorkPlane>({
    kind: 'xy',
    z: 0,
  })
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [editorState, setEditorState] = useState<EditableEditorState>(() => ({
    editableDiagram: cloneDiagram(exampleOptions[0].diagram),
    selectedElement: null,
    polylineDraft: null,
  }))
  const { editableDiagram, selectedElement, polylineDraft } = editorState
  const selectedExample =
    exampleOptions.find((example) => example.id === selectedExampleId) ??
    exampleOptions[0]
  const tikzSource = useMemo(
    () => generateTikz(editableDiagram),
    [editableDiagram],
  )

  async function copyTikz(): Promise<void> {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API unavailable.')
      }

      await navigator.clipboard.writeText(tikzSource)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  function selectExample(exampleId: ExampleId): void {
    const nextExample =
      exampleOptions.find((example) => example.id === exampleId) ?? exampleOptions[0]
    const nextDiagram = cloneDiagram(nextExample.diagram)

    setSelectedExampleId(exampleId)
    setEditorState((current) => ({
      editableDiagram: nextDiagram,
      selectedElement: clearSelectionIfMissing(nextDiagram, current.selectedElement),
      polylineDraft: null,
    }))
    setCopyStatus('idle')
    setPolylineStatus('')
  }

  function updateEditableDiagram(update: SetStateAction<Diagram>): void {
    setEditorState((current) => {
      const nextDiagram =
        typeof update === 'function' ? update(current.editableDiagram) : update

      return {
        ...current,
        editableDiagram: nextDiagram,
      }
    })
    setCopyStatus('idle')
  }

  function updateSelectedElement(selection: SelectedElement): void {
    setEditorState((current) => ({
      ...current,
      selectedElement: selection,
    }))
  }

  function updateCreationTool(tool: CreationTool): void {
    setCreationTool(tool)

    if (tool !== 'createPolyline') {
      setEditorState((current) =>
        current.polylineDraft === null
          ? current
          : {
              ...current,
              polylineDraft: null,
            },
      )
      setPolylineStatus('')
      return
    }

    setPolylineStatus('Click the preview to add vertices.')
  }

  function handlePreviewCreationClick(
    svgPoint: Vec2,
    viewportHeight: number,
    previewCamera: Camera,
  ): void {
    if (creationTool === 'select') {
      return
    }

    if (creationTool === 'createPolyline') {
      setPolylineStatus(
        `${(polylineDraft?.points.length ?? 0) + 1} vertices in draft.`,
      )
    }

    setEditorState((current) => {
      const modelPoint = normalizePointForAmbientDimension(
        current.editableDiagram.ambientDimension,
        screenToModelOnWorkPlane(
          previewCamera,
          { x: svgPoint.x, y: viewportHeight - svgPoint.y },
          activeWorkPlane,
        ),
      )

      if (creationTool === 'createPolyline') {
        const draftPoints = current.polylineDraft?.points ?? []

        return {
          ...current,
          polylineDraft: {
            points: [...draftPoints, modelPoint],
          },
        }
      }

      if (creationTool === 'createPoint') {
        const result = addPointStratumWithResult(current.editableDiagram, modelPoint)

        return {
          editableDiagram: result.diagram,
          selectedElement: { kind: 'stratum', id: result.id },
          polylineDraft: null,
        }
      }

      const result = addTextLabelWithResult(current.editableDiagram, modelPoint)

      return {
        editableDiagram: result.diagram,
        selectedElement: { kind: 'label', id: result.id },
        polylineDraft: null,
      }
    })

    if (creationTool !== 'createPolyline') {
      setCopyStatus('idle')
    }
  }

  function finishPolylineDraft(): void {
    if (polylineDraft === null || polylineDraft.points.length < 2) {
      setPolylineStatus('A polyline needs at least 2 vertices.')
      return
    }

    const result = addPolylineCurveStratumWithResult(
      editableDiagram,
      polylineDraft.points,
    )

    if (result.id === null) {
      setPolylineStatus('A polyline needs at least 2 vertices.')
      return
    }

    const createdId = result.id

    setEditorState((current) => ({
      ...current,
      editableDiagram: result.diagram,
      selectedElement: { kind: 'stratum', id: createdId },
      polylineDraft: null,
    }))
    setPolylineStatus('Polyline created.')
    setCopyStatus('idle')
  }

  function cancelPolylineDraft(): void {
    setEditorState((current) =>
      current.polylineDraft === null
        ? current
        : {
            ...current,
            polylineDraft: null,
          },
    )
    setPolylineStatus('Polyline canceled.')
  }

  function updateWorkPlaneKind(kind: WorkPlane['kind']): void {
    setActiveWorkPlane((current) => {
      const fixedValue = workPlaneFixedValue(current)

      switch (kind) {
        case 'xy':
          return { kind, z: fixedValue }
        case 'xz':
          return { kind, y: fixedValue }
        case 'yz':
          return { kind, x: fixedValue }
      }
    })
  }

  function updateWorkPlaneFixedValue(rawValue: string): void {
    const fixedValue = Number(rawValue)

    if (!Number.isFinite(fixedValue)) {
      return
    }

    setActiveWorkPlane((current) => {
      switch (current.kind) {
        case 'xy':
          return { ...current, z: fixedValue }
        case 'xz':
          return { ...current, y: fixedValue }
        case 'yz':
          return { ...current, x: fixedValue }
      }
    })
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>StratifiedTikZ</h1>
          <p>Basic preview and TikZ source workspace.</p>
        </div>
        <div className="status-strip" aria-label="Current diagram summary">
          <span>{selectedExample.name}</span>
          <span>{editableDiagram.ambientDimension}D</span>
          <span>{coordinateInputMode}</span>
          <span>{creationTool}</span>
          <span>{selectedElement === null ? 'no selection' : selectedElement.id}</span>
        </div>
      </header>

      <section className="toolbar" aria-label="Diagram controls">
        <div className="control-stack">
          <div className="control-group">
            <span className="control-label">Example</span>
            <div className="segmented-control">
              {exampleOptions.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  className={
                    selectedExampleId === example.id ? 'is-selected' : undefined
                  }
                  aria-pressed={selectedExampleId === example.id}
                  onClick={() => selectExample(example.id)}
                >
                  {example.name}
                </button>
              ))}
            </div>
          </div>
          <p className="toolbar-note">
            Edits are temporary in this phase and reset when switching examples.
          </p>
        </div>

        <div className="control-group">
          <span className="control-label">Tool</span>
          <div className="segmented-control">
            {creationTools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                className={creationTool === tool.id ? 'is-selected' : undefined}
                aria-pressed={creationTool === tool.id}
                onClick={() => updateCreationTool(tool.id)}
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        {creationTool === 'createPolyline' && (
          <div className="control-group polyline-draft-control">
            <span className="control-label">Polyline</span>
            <button
              type="button"
              className="toolbar-button"
              onClick={finishPolylineDraft}
            >
              Finish polyline
            </button>
            <button
              type="button"
              className="toolbar-button"
              onClick={cancelPolylineDraft}
            >
              Cancel polyline
            </button>
            <span className="toolbar-status" role="status">
              {polylineStatus}
            </span>
          </div>
        )}

        <div className="control-group">
          <span className="control-label">Input</span>
          <div className="segmented-control">
            {coordinateInputModes.map((mode) => (
              <button
                key={mode}
                type="button"
                className={coordinateInputMode === mode ? 'is-selected' : undefined}
                aria-pressed={coordinateInputMode === mode}
                onClick={() => setCoordinateInputMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {editableDiagram.ambientDimension === 3 && (
          <div className="control-group work-plane-control">
            <span className="control-label">Work plane</span>
            <select
              className="toolbar-select"
              value={activeWorkPlane.kind}
              onChange={(event) =>
                updateWorkPlaneKind(event.currentTarget.value as WorkPlane['kind'])
              }
            >
              {workPlaneKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {workPlaneLabel(kind)}
                </option>
              ))}
            </select>
            <label className="work-plane-fixed">
              <span>{workPlaneFixedAxis(activeWorkPlane)}</span>
              <input
                type="number"
                step="any"
                value={String(workPlaneFixedValue(activeWorkPlane))}
                onChange={(event) =>
                  updateWorkPlaneFixedValue(event.currentTarget.value)
                }
              />
            </label>
          </div>
        )}
      </section>

      <section className="workspace" aria-label="Preview and TikZ source">
        <article className="workspace-panel preview-panel">
          <div className="panel-heading">
            <div>
              <h2>SVG Preview</h2>
              <span>{selectedExample.summary}</span>
            </div>
          </div>
          <SvgDiagram
            diagram={editableDiagram}
            fitToView
            selectedElement={selectedElement}
            polylineDraft={polylineDraft?.points}
            onSelectionChange={
              creationTool === 'select' ? updateSelectedElement : undefined
            }
            onCanvasClick={
              creationTool === 'select' ? undefined : handlePreviewCreationClick
            }
          />
        </article>

        <article className="workspace-panel inspector-panel">
          <div className="panel-heading">
            <div>
              <h2>Inspector</h2>
              <span>basic fields and coordinates</span>
            </div>
          </div>
          <EditableInspector
            diagram={editableDiagram}
            selectedElement={selectedElement}
            onDiagramChange={updateEditableDiagram}
          />
        </article>

        <article className="workspace-panel source-panel">
          <div className="panel-heading">
            <div>
              <h2>Generated TikZ</h2>
              <span>read-only source</span>
            </div>
            <div className="copy-controls">
              <button type="button" className="copy-button" onClick={copyTikz}>
                Copy TikZ
              </button>
              <span className="copy-status" role="status">
                {copyStatus === 'copied' && 'Copied'}
                {copyStatus === 'failed' && 'Copy failed'}
              </span>
            </div>
          </div>
          <textarea
            className="tikz-source"
            value={tikzSource}
            readOnly
            spellCheck={false}
            aria-label="Generated TikZ source"
          />
        </article>
      </section>
    </main>
  )
}

function workPlaneLabel(kind: WorkPlane['kind']): string {
  switch (kind) {
    case 'xy':
      return 'xy plane'
    case 'xz':
      return 'xz plane'
    case 'yz':
      return 'yz plane'
  }
}

function workPlaneFixedAxis(workPlane: WorkPlane): string {
  switch (workPlane.kind) {
    case 'xy':
      return 'z'
    case 'xz':
      return 'y'
    case 'yz':
      return 'x'
  }
}

function workPlaneFixedValue(workPlane: WorkPlane): number {
  switch (workPlane.kind) {
    case 'xy':
      return workPlane.z
    case 'xz':
      return workPlane.y
    case 'yz':
      return workPlane.x
  }
}

export default App
