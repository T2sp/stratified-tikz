import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialCamera3D } from '../../src/model/camera.ts'
import {
  addSymbolicVariableToDiagram,
  createEmptyDiagram,
  createPointStratum,
  parseSavedDiagramJson,
  serializeDiagram,
  updateSymbolicVariableInDiagram,
  validateDiagram,
} from '../../src/model/index.ts'
import type {
  CoordinateComponent,
  Diagram,
  PointStyle,
  SymbolicVariable,
  Vec3,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  addGridStratumFromDirectInput,
  addPointStratumFromDirectInput,
} from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import {
  canRedoDiagramChange,
  canUndoDiagramChange,
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'

type TestEditorState = UndoableEditorState

test('variables plus symbolic coordinate export as PGF math macros', () => {
  const created = addPointStratumFromDirectInput(symbolic2DDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: '0',
  })

  assert.equal(created.ok, true)
  if (!created.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const tikz = generateTikz(created.diagram)

  assert.match(tikz, /\\pgfmathsetmacro\{\\R\}\{2\}/)
  assert.match(tikz, /\\pgfmathsetmacro\{\\q\}\{30\}/)
  assert.match(tikz, /\(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\)/)
})

test('variables plus inline math output has no blank lines', () => {
  const created = addPointStratumFromDirectInput(symbolic2DDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: '0',
  })

  assert.equal(created.ok, true)
  if (!created.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const tikz = generateTikz(created.diagram, { exportMode: 'inlineMath' })

  assert.doesNotMatch(tikz, /\n\s*\n/)
  assert.match(tikz, /\\pgfmathsetmacro\{\\R\}\{2\}/)
  assert.match(tikz, /\{\\R \* cos\(\\q\)\}/)
})

test('variables plus grid export preserve symbolic clip and foreach ranges', () => {
  const created = addGridStratumFromDirectInput(
    symbolic2DDiagram(),
    {
      uRange: { min: '0', max: '2', step: '1' },
      vRange: { min: '-1', max: '1', step: '1' },
      clip: { uMin: '0', uMax: 'R', vMin: '-1', vMax: '1' },
    },
    { kind: 'xy', z: 0 },
    { diagram: symbolic2DDiagram(), id: 'symbolic-grid' },
  )

  assert.equal(created.ok, true)
  if (!created.ok) {
    throw new Error(created.message)
  }

  const tikz = generateTikz(created.diagram)

  assert.match(tikz, /\\pgfmathsetmacro\{\\R\}\{2\}/)
  assert.match(tikz, /\\clip \(0,-1\) rectangle \(\{\\R\},1\);/)
  assert.match(tikz, /\\foreach \\stzGridU in \{0,1,\.\.\.,2\}/)
  assert.match(tikz, /\\foreach \\stzGridV in \{-1,0,\.\.\.,1\}/)
})

test('style, layer, and camera output work with symbolic 3D coordinates', () => {
  const diagram = symbolic3DDiagram()
  const style: PointStyle = {
    kind: 'pointStyle',
    color: '#C44536',
    opacity: 0.8,
    shape: 'square',
    fill: 'hollow',
    size: 4,
  }

  diagram.strata.push(
    createPointStratum({
      ambientDimension: 3,
      id: 'symbolic-3d-point',
      name: 'Symbolic 3D point',
      style,
      position: symbolicVec3(symbolicComponent('R', 2), numericComponent(0), 1),
      layer: 5,
    }),
  )

  const camera = {
    ...createInitialCamera3D(),
    thetaDeg: 70,
    phiDeg: 110,
  }
  const tikz = generateTikz(diagram, { camera3d: camera })

  assert.match(tikz, /\\tdplotsetmaincoords\{70\}\{110\}/)
  assert.match(tikz, /stratifiedLayer5/)
  assert.match(tikz, /\{HTML\}\{C44536\}/)
  assert.match(tikz, /\(\{\\R\},0,1\)/)
})

test('save and load round-trip variables, symbolic coordinates, and grids', () => {
  const withPoint = addPointStratumFromDirectInput(symbolic2DDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: '0',
  })

  assert.equal(withPoint.ok, true)
  if (!withPoint.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const withGrid = addGridStratumFromDirectInput(
    withPoint.diagram,
    {
      uRange: { min: '0', max: '2', step: '1' },
      vRange: { min: '0', max: '2', step: '1' },
      clip: { uMin: '0', uMax: 'R', vMin: '0', vMax: '2' },
    },
    { kind: 'xy', z: 0 },
    { diagram: withPoint.diagram, id: 'round-trip-grid' },
  )

  assert.equal(withGrid.ok, true)
  if (!withGrid.ok) {
    throw new Error(withGrid.message)
  }

  const parsed = parseSavedDiagramJson(serializeDiagram(withGrid.diagram))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const validation = validateDiagram(parsed.diagram)

  assert.equal(validation.valid, true)
  assert.equal(parsed.diagram.variables?.[0]?.name, 'R')
  assert.equal(parsed.diagram.strata.some((stratum) => stratum.kind === 'grid'), true)
  assert.match(generateTikz(parsed.diagram), /\\clip \(0,0\) rectangle \(\{\\R\},2\);/)
})

test('undo and redo preserve variable edits', () => {
  const initialDiagram = symbolic2DDiagram()
  const updated = updateSymbolicVariableInDiagram(initialDiagram, 'var-R', {
    expression: '4',
  })

  assert.equal(updated.ok, true)
  if (!updated.ok) {
    throw new Error(updated.error)
  }

  const initialState = createUndoState(initialDiagram)
  const committed = commitDiagramChange(initialState, {
    ...initialState,
    editableDiagram: updated.diagram,
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.equal(canUndoDiagramChange(committed.history), true)
  assert.equal(canRedoDiagramChange(undone.history), true)
  assert.equal(variableExpression(undone.editableDiagram, 'R'), '2')
  assert.equal(variableExpression(redone.editableDiagram, 'R'), '4')
})

test('invalid symbolic expressions do not corrupt the diagram', () => {
  const initialDiagram = symbolic2DDiagram()
  const invalid = addPointStratumFromDirectInput(initialDiagram, {
    x: 'R*',
    y: '0',
    z: '0',
  })

  assert.equal(invalid.ok, false)
  assert.deepEqual(invalid.diagram, initialDiagram)
  assert.equal(initialDiagram.strata.length, 0)
  assert.equal(generateTikz(initialDiagram).includes('R*'), false)
})

function symbolic2DDiagram(): Diagram {
  return variablesDiagram(createEmptyDiagram({ ambientDimension: 2 }))
}

function symbolic3DDiagram(): Diagram {
  return variablesDiagram(createEmptyDiagram({ ambientDimension: 3 }), [
    variable('var-R', 'R', '2'),
  ])
}

function variablesDiagram(
  diagram: Diagram,
  variables: readonly SymbolicVariable[] = [
    variable('var-R', 'R', '2'),
    variable('var-q', 'q', '30'),
  ],
): Diagram {
  return variables.reduce((current, item) => {
    const result = addSymbolicVariableToDiagram(current, item)

    assert.equal(result.ok, true)
    if (!result.ok) {
      throw new Error(result.error)
    }

    return result.diagram
  }, diagram)
}

function variable(
  id: string,
  name: string,
  expression: string,
): SymbolicVariable {
  return {
    id,
    name,
    macroName: name,
    expression,
    previewValue: Number(expression),
  }
}

function symbolicVec3(
  x: CoordinateComponent,
  y: CoordinateComponent,
  z: CoordinateComponent | number,
): Vec3 {
  const zComponent = typeof z === 'number' ? numericComponent(z) : z

  return {
    x: componentPreviewValue(x),
    y: componentPreviewValue(y),
    z: componentPreviewValue(zComponent),
    symbolic: { x, y, z: zComponent },
  }
}

function numericComponent(value: number): CoordinateComponent {
  return { kind: 'numeric', value }
}

function symbolicComponent(
  expression: string,
  previewValue: number,
): CoordinateComponent {
  return { kind: 'symbolic', expression, previewValue }
}

function componentPreviewValue(component: CoordinateComponent): number {
  return component.kind === 'numeric' ? component.value : component.previewValue
}

function variableExpression(diagram: Diagram, name: string): string | null {
  return diagram.variables?.find((variable) => variable.name === name)?.expression ?? null
}

function createUndoState(diagram: Diagram): TestEditorState {
  return {
    editableDiagram: diagram,
    selectedElement: null,
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: createDiagramHistory(diagram),
  }
}
