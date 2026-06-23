import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCurveStratum,
  createEmptyDiagram,
} from '../../src/model/constructors.ts'
import { reverseCurvePathDirection } from '../../src/model/paths.ts'
import type { Diagram, Vec3 } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import { updateStratumById } from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import {
  updatePathEndpointArrow,
  updatePathMidArrowEnabled,
  updatePathMidArrowPosition,
} from '../../src/ui/pathArrowEditing.ts'
import type { ConcatenatedPathDraft } from '../../src/ui/pathDraft.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type DiagramHistory,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'

type TestEditorState = UndoableEditorState & {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
  polylineDraft: null
  cubicBezierDraft: null
  pathDraft: ConcatenatedPathDraft | null
  sheetPolygonDraft: null
  history: DiagramHistory
}

test('arrow helper applies endpoint arrow option', () => {
  const curve = createTestCurve()
  const updated = updatePathEndpointArrow(curve, 'forward')

  assert.equal(updated.geometricKind, 'curve')
  if (updated.geometricKind !== 'curve') {
    throw new Error('Expected a curve.')
  }

  assert.equal(updated.arrows?.endpoint, 'forward')
  assert.equal(curve.arrows?.endpoint, 'none')
})

test('arrow helper applies mid-arrow option and position', () => {
  const curve = createTestCurve()
  const enabled = updatePathMidArrowEnabled(curve, true)
  const positioned = updatePathMidArrowPosition(enabled, 0.35)

  assert.equal(positioned.geometricKind, 'curve')
  if (positioned.geometricKind !== 'curve') {
    throw new Error('Expected a curve.')
  }

  assert.equal(positioned.arrows?.mid.enabled, true)
  assert.equal(positioned.arrows?.mid.position, 0.35)
})

test('arrow helper rejects invalid mid-arrow position', () => {
  const curve = createTestCurve()

  assert.equal(updatePathMidArrowPosition(curve, 0), curve)
  assert.equal(updatePathMidArrowPosition(curve, 1), curve)
  assert.equal(updatePathMidArrowPosition(curve, Number.NaN), curve)
})

test('arrow helper has no effect on non-path objects', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const updated = updatePathEndpointArrow(
    {
      id: 'point',
      codim: 2,
      geometricKind: 'point',
      name: 'Point',
      style: {
        kind: 'pointStyle',
        color: '#000000',
        opacity: 1,
        shape: 'circle',
        fill: 'filled',
        size: 3,
      },
      position: { x: 0, y: 0, z: 0 },
      layer: 0,
    },
    'forward',
  )

  assert.equal(updated.geometricKind, 'point')
  assert.equal(diagram.strata.length, 0)
})

test('TikZ output updates after arrow edits', () => {
  const diagram = diagramWithCurve()
  const edited = updateStratumById(diagram, 'arrow-edit-curve', (stratum) =>
    updatePathMidArrowEnabled(
      updatePathEndpointArrow(stratum, 'forward'),
      true,
    ),
  )
  const tikz = generateTikz(edited)

  assert.match(tikz, /\n\s+->,/)
  assert.match(tikz, /mark=at position 0\.5/)
  assert.match(tikz, /\\arrow\{>\}/)
})

test('path reversal participates in undo and redo', () => {
  const initial = createUndoState(diagramWithCurve())
  const reversedDiagram = updateStratumById(
    initial.editableDiagram,
    'arrow-edit-curve',
    (stratum) => {
      if (stratum.geometricKind !== 'curve') {
        return stratum
      }

      return reverseCurvePathDirection(stratum) ?? stratum
    },
  )
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: reversedDiagram,
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.deepEqual(curvePoints(committed.editableDiagram), [
    { x: 2, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ])
  assert.deepEqual(curvePoints(undone.editableDiagram), [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
  ])
  assert.deepEqual(curvePoints(redone.editableDiagram), [
    { x: 2, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ])
})

function createTestCurve() {
  return createCurveStratum({
    ambientDimension: 2,
    id: 'arrow-edit-curve',
    name: 'Arrow edit curve',
    kind: 'polyline',
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ],
  })
}

function diagramWithCurve(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(createTestCurve())
  return diagram
}

function createUndoState(diagram: Diagram): TestEditorState {
  return {
    editableDiagram: diagram,
    selectedElement: { kind: 'stratum', id: 'arrow-edit-curve' },
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: createDiagramHistory(diagram),
  }
}

function curvePoints(diagram: Diagram): Vec3[] {
  const curve = diagram.strata.find((stratum) => stratum.id === 'arrow-edit-curve')

  if (curve?.geometricKind !== 'curve' || curve.kind !== 'polyline') {
    throw new Error('Expected test polyline.')
  }

  return curve.points
}
