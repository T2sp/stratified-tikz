import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyTwoDimensionalDiagram } from '../../src/examples/index.ts'
import {
  addSymbolicVariableToDiagram,
  updateSymbolicVariableInDiagram,
} from '../../src/model/variables.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import type {
  Diagram,
  PointStratum,
  SymbolicVariable,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  addConcatenatedPathFromDirectInput,
  addPointStratumFromDirectInput,
} from '../../src/ui/diagramUpdates.ts'

test('direct symbolic point input stores expressions and preview values', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: 'R',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const point = findPoint(result.diagram, result.id)

  assertClose(point.position.x, Math.sqrt(3))
  assertClose(point.position.y, 1)
  assert.equal(point.position.z, 0)
  assert.equal(point.position.symbolic?.x.kind, 'symbolic')
  assert.equal(point.position.symbolic?.x.expression, 'R*cos(q)')
  assertClose(point.position.symbolic?.x.previewValue ?? Number.NaN, Math.sqrt(3))
  assert.equal(point.position.symbolic?.y.kind, 'symbolic')
  assert.equal(point.position.symbolic?.y.expression, 'R*sin(q)')
  assertClose(point.position.symbolic?.y.previewValue ?? Number.NaN, 1)
  assert.equal(point.position.symbolic?.z.kind, 'numeric')
  assert.equal(point.position.symbolic?.z.value, 0)
})

test('symbolic point coordinates export as TikZ macro expressions', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: '0',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const tikz = generateTikz(result.diagram)

  assert.match(tikz, /\\pgfmathsetmacro\{\\R\}\{2\}/)
  assert.match(tikz, /\\pgfmathsetmacro\{\\q\}\{30\}/)
  assert.match(tikz, /\(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\)/)
})

test('mixed numeric and symbolic coordinates export component-wise', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R',
    y: '0',
    z: '0',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected mixed point creation to succeed.')
  }

  assert.match(generateTikz(result.diagram), /\(\{\\R\},0\)/)
})

test('variable updates recompute symbolic coordinate preview values', () => {
  const initial = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: '0',
  })

  assert.equal(initial.ok, true)
  if (!initial.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const updated = expectVariableDiagramOk(
    updateSymbolicVariableInDiagram(initial.diagram, 'var-R', {
      expression: '4',
    }),
  )
  const point = findPoint(updated, initial.id)

  assertClose(point.position.x, 2 * Math.sqrt(3))
  assertClose(point.position.y, 2)
  assert.equal(point.position.symbolic?.x.kind, 'symbolic')
  assert.equal(point.position.symbolic?.x.expression, 'R*cos(q)')
  assertClose(
    point.position.symbolic?.x.previewValue ?? Number.NaN,
    2 * Math.sqrt(3),
  )
})

test('unknown variables and invalid coordinate expressions are rejected', () => {
  const unknownVariable = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'S',
    y: '0',
    z: '0',
  })
  const invalidExpression = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R*',
    y: '0',
    z: '0',
  })

  assert.equal(unknownVariable.ok, false)
  assert.equal(invalidExpression.ok, false)
})

test('non-finite symbolic coordinate previews are rejected', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'sqrt(-1)',
    y: '0',
    z: '0',
  })

  assert.equal(result.ok, false)
})

test('direct symbolic path creation stores symbolic vertices and exports them', () => {
  const result = addConcatenatedPathFromDirectInput(symbolicDiagram(), {
    start: { x: 'R', y: '0', z: '0' },
    segments: [
      {
        kind: 'line',
        end: { x: 'R*cos(q)', y: 'R*sin(q)', z: '0' },
      },
    ],
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const path = result.diagram.strata.find(
    (stratum) => stratum.id === result.id,
  )

  assert.equal(path?.geometricKind, 'curve')
  assert.equal(path?.kind, 'concatenatedPath')
  if (path?.geometricKind !== 'curve' || path.kind !== 'concatenatedPath') {
    throw new Error('Expected a concatenated path.')
  }

  assert.equal(path.segments[0].start.symbolic?.x.kind, 'symbolic')
  assert.equal(path.segments[0].end.symbolic?.y.kind, 'symbolic')
  assert.match(generateTikz(result.diagram), /\(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\)/)
})

test('symbolic coordinate save and load round-trip preserves expressions', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: '0',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const parsed = parseSavedDiagramJson(serializeDiagram(result.diagram))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const point = findPoint(parsed.diagram, result.id)

  assert.equal(point.position.symbolic?.x.kind, 'symbolic')
  assert.equal(point.position.symbolic?.x.expression, 'R*cos(q)')
  assert.equal(point.position.symbolic?.y.kind, 'symbolic')
  assert.equal(point.position.symbolic?.y.expression, 'R*sin(q)')
})

test('existing numeric coordinate input remains numeric-only in the model', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: '1.5',
    y: '-2',
    z: 'R',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected numeric point creation to succeed.')
  }

  const point = findPoint(result.diagram, result.id)

  assert.deepEqual(point.position, { x: 1.5, y: -2, z: 0 })
})

test('inline math output with symbolic coordinates has no blank lines', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: '0',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const tikz = generateTikz(result.diagram, { exportMode: 'inlineMath' })

  assert.doesNotMatch(tikz, /\n\s*\n/)
  assert.match(tikz, /\(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\)/)
})

function symbolicDiagram(): Diagram {
  const withR = expectVariableDiagramOk(
    addSymbolicVariableToDiagram(emptyTwoDimensionalDiagram, variable('var-R', 'R', '2')),
  )

  return expectVariableDiagramOk(
    addSymbolicVariableToDiagram(withR, variable('var-q', 'q', '30')),
  )
}

function variable(
  id: string,
  name: string,
  expression: string,
): Omit<SymbolicVariable, 'previewValue'> {
  return {
    id,
    name,
    macroName: name,
    expression,
  }
}

function expectVariableDiagramOk(
  result: ReturnType<
    typeof addSymbolicVariableToDiagram | typeof updateSymbolicVariableInDiagram
  >,
): Diagram {
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.diagram
}

function findPoint(diagram: Diagram, id: string): PointStratum {
  const point = diagram.strata.find(
    (stratum): stratum is PointStratum =>
      stratum.id === id && stratum.geometricKind === 'point',
  )

  if (point === undefined) {
    throw new Error(`Point ${id} not found.`)
  }

  return point
}

function assertClose(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `Expected ${actual} to be close to ${expected}.`,
  )
}
