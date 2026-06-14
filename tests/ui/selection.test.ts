import assert from 'node:assert/strict'
import test from 'node:test'
import {
  threeDimensionalExample,
  twoDimensionalExample,
} from '../../src/examples/index.ts'
import {
  createInspectorSections,
  describeCurvePoints,
  formatVec3,
} from '../../src/ui/inspector.ts'
import {
  clearSelectionIfMissing,
  findSelectedElement,
  selectionExistsInDiagram,
  type SelectedElement,
} from '../../src/ui/selection.ts'

test('findSelectedElement finds a selected stratum by id', () => {
  const selected = findSelectedElement(twoDimensionalExample, {
    kind: 'stratum',
    id: 'visibleWire',
  })

  assert.equal(selected?.kind, 'stratum')
  assert.equal(selected?.element.id, 'visibleWire')
})

test('findSelectedElement finds a selected label by id', () => {
  const selected = findSelectedElement(twoDimensionalExample, {
    kind: 'label',
    id: 'mathMorphismLabel',
  })

  assert.equal(selected?.kind, 'label')
  assert.equal(selected?.element.id, 'mathMorphismLabel')
})

test('clearSelectionIfMissing clears selection when switching diagrams', () => {
  const selection: SelectedElement = { kind: 'stratum', id: 'visibleWire' }

  assert.equal(selectionExistsInDiagram(twoDimensionalExample, selection), true)
  assert.equal(selectionExistsInDiagram(threeDimensionalExample, selection), false)
  assert.equal(clearSelectionIfMissing(threeDimensionalExample, selection), null)
})

test('formatVec3 formats coordinates for inspector display', () => {
  assert.equal(formatVec3({ x: 1.23456, y: -0, z: 2 }), '(1.235, 0, 2)')
})

test('createInspectorSections reports curve geometry and style summaries', () => {
  const sections = createInspectorSections(twoDimensionalExample, {
    kind: 'stratum',
    id: 'dashedMorphism',
  })

  assert.equal(sections[0].title, 'Selection')
  assert.equal(
    sections
      .flatMap((section) => section.fields)
      .some((field) => field.label === 'Curve kind' && field.value === 'cubicBezier'),
    true,
  )
  assert.equal(
    sections
      .flatMap((section) => section.fields)
      .some((field) => field.value.includes('dashed')),
    true,
  )
})

test('describeCurvePoints labels cubic Bezier points semantically', () => {
  const curve = twoDimensionalExample.strata.find(
    (stratum) => stratum.id === 'dashedMorphism',
  )

  assert.equal(curve?.geometricKind, 'curve')
  assert.equal(curve?.kind, 'cubicBezier')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected dashedMorphism to be a curve.')
  }

  assert.deepEqual(
    describeCurvePoints(curve).map((description) => description.label),
    ['Start', 'Control point 1', 'Control point 2', 'End'],
  )
})

test('describeCurvePoints labels polyline points as vertices', () => {
  const curve = threeDimensionalExample.strata.find(
    (stratum) => stratum.id === 'solidLine',
  )

  assert.equal(curve?.geometricKind, 'curve')
  assert.equal(curve?.kind, 'polyline')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected solidLine to be a curve.')
  }

  assert.deepEqual(
    describeCurvePoints(curve).map((description) => description.label),
    ['Vertex 0', 'Vertex 1', 'Vertex 2'],
  )
})

test('createInspectorSections shows cubic Bezier control point labels', () => {
  const sections = createInspectorSections(twoDimensionalExample, {
    kind: 'stratum',
    id: 'dashedMorphism',
  })
  const labels = sections.flatMap((section) =>
    section.fields.map((field) => field.label),
  )

  assert.equal(labels.includes('Start'), true)
  assert.equal(labels.includes('Control point 1'), true)
  assert.equal(labels.includes('Control point 2'), true)
  assert.equal(labels.includes('End'), true)
})

test('createInspectorSections reports free text label content', () => {
  const sections = createInspectorSections(twoDimensionalExample, {
    kind: 'label',
    id: 'mathMorphismLabel',
  })

  assert.equal(
    sections
      .flatMap((section) => section.fields)
      .some((field) => field.label === 'Text' && field.value === '$F^{(1)}L$'),
    true,
  )
})
