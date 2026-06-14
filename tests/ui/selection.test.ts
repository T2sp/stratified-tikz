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
  cloneDiagram,
  updateLabelById,
  updateSelectedElement,
  updateStratumById,
  updateVec3Coordinate,
} from '../../src/ui/diagramUpdates.ts'
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

test('formatVec3 formats 2D coordinates without z', () => {
  assert.equal(formatVec3({ x: 1.23456, y: -0, z: 2 }, 2), '(1.235, 0)')
})

test('formatVec3 formats 3D coordinates with z', () => {
  assert.equal(formatVec3({ x: 1.23456, y: -0, z: 2 }, 3), '(1.235, 0, 2)')
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

test('2D cubic Bezier control point coordinates omit z', () => {
  const sections = createInspectorSections(twoDimensionalExample, {
    kind: 'stratum',
    id: 'dashedMorphism',
  })
  const fields = sections.flatMap((section) => section.fields)

  assert.equal(
    fields.some(
      (field) =>
        field.label === 'Control point 1' && field.value === '(-0.7, 2.3)',
    ),
    true,
  )
  assert.equal(
    fields.some(
      (field) =>
        field.label === 'Control point 2' && field.value === '(0.8, 0.9)',
    ),
    true,
  )
})

test('2D point position coordinates omit z', () => {
  const sections = createInspectorSections(twoDimensionalExample, {
    kind: 'stratum',
    id: 'circlePoint',
  })

  assert.equal(
    sections
      .flatMap((section) => section.fields)
      .some((field) => field.label === 'Position' && field.value === '(-0.75, 1)'),
    true,
  )
})

test('3D polyline vertex coordinates include z', () => {
  const sections = createInspectorSections(threeDimensionalExample, {
    kind: 'stratum',
    id: 'solidLine',
  })

  assert.equal(
    sections
      .flatMap((section) => section.fields)
      .some(
        (field) =>
          field.label === 'Vertex 0' && field.value === '(-0.75, -0.75, 0.15)',
      ),
    true,
  )
})

test('3D sheet corner coordinates include z', () => {
  const sections = createInspectorSections(threeDimensionalExample, {
    kind: 'stratum',
    id: 'roseSheet',
  })

  assert.equal(
    sections
      .flatMap((section) => section.fields)
      .some(
        (field) =>
          field.label === 'Corner 1' && field.value === '(-0.5, 0.2, -0.5)',
      ),
    true,
  )
})

test('label positions follow ambient dimension coordinate display', () => {
  const twoDSections = createInspectorSections(twoDimensionalExample, {
    kind: 'label',
    id: 'mathMorphismLabel',
  })
  const threeDSections = createInspectorSections(threeDimensionalExample, {
    kind: 'label',
    id: 'lineLabel',
  })

  assert.equal(
    twoDSections
      .flatMap((section) => section.fields)
      .some((field) => field.label === 'Position' && field.value === '(0.15, 1.75)'),
    true,
  )
  assert.equal(
    threeDSections
      .flatMap((section) => section.fields)
      .some(
        (field) =>
          field.label === 'Position' && field.value === '(0.8, 0.15, 1.45)',
      ),
    true,
  )
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

test('updateStratumById returns a new diagram without mutating the original', () => {
  const originalName = twoDimensionalExample.strata[0].name
  const updated = updateStratumById(
    twoDimensionalExample,
    'visibleWire',
    (stratum) => ({
      ...stratum,
      name: 'Edited wire',
    }),
  )
  const updatedStratum = updated.strata.find(
    (stratum) => stratum.id === 'visibleWire',
  )

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(updatedStratum?.name, 'Edited wire')
  assert.equal(twoDimensionalExample.strata[0].name, originalName)
  assert.equal(
    updated.strata.find((stratum) => stratum.id === 'hiddenWire'),
    twoDimensionalExample.strata.find((stratum) => stratum.id === 'hiddenWire'),
  )
  assert.equal(updated.labels, twoDimensionalExample.labels)
})

test('updateLabelById returns a new diagram and preserves unrelated strata', () => {
  const updated = updateLabelById(
    twoDimensionalExample,
    'mathMorphismLabel',
    (label) => ({
      ...label,
      text: '$G$',
      layer: 7,
    }),
  )
  const updatedLabel = updated.labels.find(
    (label) => label.id === 'mathMorphismLabel',
  )

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(updatedLabel?.text, '$G$')
  assert.equal(updatedLabel?.layer, 7)
  assert.equal(
    twoDimensionalExample.labels.find((label) => label.id === 'mathMorphismLabel')
      ?.text,
    '$F^{(1)}L$',
  )
  assert.equal(updated.strata, twoDimensionalExample.strata)
})

test('updateSelectedElement updates the selected stratum helper path', () => {
  const updated = updateSelectedElement(
    twoDimensionalExample,
    { kind: 'stratum', id: 'circlePoint' },
    {
      stratum: (stratum) => ({
        ...stratum,
        layer: 4,
      }),
    },
  )

  assert.equal(
    updated.strata.find((stratum) => stratum.id === 'circlePoint')?.layer,
    4,
  )
})

test('updateSelectedElement updates the selected label helper path', () => {
  const updated = updateSelectedElement(
    twoDimensionalExample,
    { kind: 'label', id: 'mathMorphismLabel' },
    {
      label: (label) => ({
        ...label,
        text: '$H$',
      }),
    },
  )

  assert.equal(
    updated.labels.find((label) => label.id === 'mathMorphismLabel')?.text,
    '$H$',
  )
})

test('updateVec3Coordinate normalizes z to 0 for 2D coordinates', () => {
  const point = updateVec3Coordinate({ x: 1, y: 2, z: 0 }, 'z', 9, 2)

  assert.deepEqual(point, { x: 1, y: 2, z: 0 })
})

test('updateVec3Coordinate preserves editable z for 3D coordinates', () => {
  const point = updateVec3Coordinate({ x: 1, y: 2, z: 0 }, 'z', 9, 3)

  assert.deepEqual(point, { x: 1, y: 2, z: 9 })
})

test('cubic Bezier point labels remain semantic after coordinate editing', () => {
  const updated = updateStratumById(
    twoDimensionalExample,
    'dashedMorphism',
    (stratum) => {
      if (stratum.geometricKind !== 'curve') {
        return stratum
      }

      return {
        ...stratum,
        points: stratum.points.map((point, index) =>
          index === 1 ? updateVec3Coordinate(point, 'x', -1.1, 2) : point,
        ),
      }
    },
  )
  const curve = updated.strata.find((stratum) => stratum.id === 'dashedMorphism')

  assert.equal(curve?.geometricKind, 'curve')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected dashedMorphism to be a curve.')
  }

  assert.deepEqual(
    describeCurvePoints(curve).map((description) => description.label),
    ['Start', 'Control point 1', 'Control point 2', 'End'],
  )
  assert.deepEqual(curve.points[1], { x: -1.1, y: 2.3, z: 0 })
})

test('cloneDiagram creates an editable copy of an example diagram', () => {
  const cloned = cloneDiagram(twoDimensionalExample)

  assert.notEqual(cloned, twoDimensionalExample)
  assert.notEqual(cloned.strata, twoDimensionalExample.strata)
  assert.deepEqual(cloned, twoDimensionalExample)
})
