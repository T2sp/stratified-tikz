import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCurveStratum,
  createEmptyDiagram,
} from '../../src/model/constructors.ts'
import {
  createPathArrowOptions,
  defaultPathArrowOptions,
} from '../../src/model/pathArrows.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type {
  ArrowHeadKind,
  Diagram,
  EndpointArrowMode,
  MidArrowDirection,
} from '../../src/model/types.ts'

test('old diagram without arrow options loads curve defaults', () => {
  const diagram = createArrowTestDiagram()
  const saved = JSON.parse(serializeDiagram(diagram)) as {
    diagram: {
      strata: Array<{
        arrows?: unknown
      }>
    }
  }

  delete saved.diagram.strata[0].arrows

  const loaded = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }

  const curve = loaded.diagram.strata[0]

  assert.equal(curve.geometricKind, 'curve')
  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected a curve.')
  }

  assert.deepEqual(curve.arrows, defaultPathArrowOptions)
})

test('valid arrow options validate', () => {
  const diagram = createArrowTestDiagram()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected a curve.')
  }

  curve.arrows = createPathArrowOptions({
    endpoint: 'both',
    mid: {
      enabled: true,
      position: 0.25,
      direction: 'backward',
      head: 'stealthHarpoonSwap',
    },
  })

  const validation = validateDiagram(diagram)

  assert.equal(
    validation.valid,
    true,
    validation.errors.map((issue) => issue.message).join('\n'),
  )
})

test('mid-arrow creation defaults to position 0.5 and standard head', () => {
  const options = createPathArrowOptions({
    mid: {
      enabled: true,
    },
  })

  assert.deepEqual(options, {
    endpoint: 'none',
    mid: {
      enabled: true,
      position: 0.5,
      direction: 'forward',
      head: 'standard',
    },
  })
})

test('invalid mid-arrow position is rejected', () => {
  const diagram = createArrowTestDiagram()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected a curve.')
  }

  curve.arrows = createPathArrowOptions({
    mid: {
      enabled: true,
      position: 1,
    },
  })

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(
    validation.errors
      .map((issue) => `${issue.path} ${issue.message}`)
      .join('\n'),
    /arrows\.mid\.position/,
  )
})

test('invalid arrow head kind is rejected', () => {
  const diagram = createArrowTestDiagram()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected a curve.')
  }

  curve.arrows = {
    endpoint: 'none',
    mid: {
      enabled: true,
      position: 0.5,
      direction: 'forward',
      head: 'diamond' as ArrowHeadKind,
    },
  }

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(
    validation.errors
      .map((issue) => `${issue.path} ${issue.message}`)
      .join('\n'),
    /arrows\.mid\.head/,
  )
})

test('invalid endpoint arrow mode is rejected', () => {
  const diagram = createArrowTestDiagram()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected a curve.')
  }

  curve.arrows = {
    endpoint: 'sideways' as EndpointArrowMode,
    mid: {
      enabled: false,
      position: 0.5,
      direction: 'forward',
      head: 'standard',
    },
  }

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(
    validation.errors
      .map((issue) => `${issue.path} ${issue.message}`)
      .join('\n'),
    /arrows\.endpoint/,
  )
})

test('invalid mid-arrow direction is rejected', () => {
  const diagram = createArrowTestDiagram()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected a curve.')
  }

  curve.arrows = {
    endpoint: 'none',
    mid: {
      enabled: true,
      position: 0.5,
      direction: 'sideways' as MidArrowDirection,
      head: 'standard',
    },
  }

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(
    validation.errors
      .map((issue) => `${issue.path} ${issue.message}`)
      .join('\n'),
    /arrows\.mid\.direction/,
  )
})

function createArrowTestDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata.push(
    createCurveStratum({
      ambientDimension: 2,
      id: 'arrow-test-curve',
      name: 'Arrow Test Curve',
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
    }),
  )

  return diagram
}
