import assert from 'node:assert/strict'
import test from 'node:test'
import {
  threeDimensionalExample,
  twoDimensionalExample,
} from '../../src/examples/index.ts'
import {
  createInspectorSections,
  describeCurvePoints,
  formatLabelStyleSummary,
  formatStratumStyleSummary,
  formatVec3,
} from '../../src/ui/inspectorSummary.ts'
import type { CurveStyle } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  addPointStratum,
  addPointStratumWithResult,
  addTextLabel,
  addTextLabelWithResult,
  cloneDiagram,
  makeUniqueId,
  parseFiniteNumber,
  parseOpacity,
  parsePositiveFiniteNumber,
  updateLabelById,
  updateLabelStyleById,
  updateSelectedElement,
  updateStratumById,
  updateStratumNameById,
  updateStratumStyleById,
  updateVec3Coordinate,
} from '../../src/ui/diagramUpdates.ts'
import {
  isHexColorString,
  normalizeColorInputValue,
} from '../../src/ui/colorInput.ts'
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

test('style summaries display opacity with readable labels', () => {
  const curve = twoDimensionalExample.strata.find(
    (stratum) => stratum.id === 'hiddenWire',
  )

  assert.equal(curve?.geometricKind, 'curve')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected hiddenWire to be a curve.')
  }

  const summary = formatStratumStyleSummary(curve.style)

  assert.equal(summary.includes('@'), false)
  assert.equal(summary.includes('stroke opacity: 0.85'), true)
  assert.equal(summary.includes('line style: denselyDotted'), true)
})

test('label style summaries display opacity with readable labels', () => {
  const label = twoDimensionalExample.labels.find(
    (textLabel) => textLabel.id === 'mathMorphismLabel',
  )

  assert.notEqual(label, undefined)

  if (label === undefined) {
    throw new Error('Expected mathMorphismLabel to exist.')
  }

  const summary = formatLabelStyleSummary(label.style)

  assert.equal(summary.includes('@'), false)
  assert.equal(summary.includes('opacity: 1'), true)
  assert.equal(summary.includes('anchor: south'), true)
})

test('style summaries omit missing opacity values cleanly', () => {
  const style = {
    kind: 'curveStyle',
    strokeColor: '#000000',
    lineWidth: 1.2,
    lineStyle: 'solid',
  } as unknown as CurveStyle
  const summary = formatStratumStyleSummary(style)

  assert.equal(summary.includes('@'), false)
  assert.equal(summary.includes('undefined'), false)
  assert.equal(summary.includes('stroke opacity'), false)
  assert.equal(summary.includes('line width: 1.2pt'), true)
})

test('stratum attached label is reported as metadata in helper output', () => {
  const sections = createInspectorSections(twoDimensionalExample, {
    kind: 'stratum',
    id: 'visibleWire',
  })
  const fields = sections.flatMap((section) => section.fields)

  assert.equal(
    fields.some((field) => field.label === 'Attached label metadata'),
    true,
  )
  assert.equal(fields.some((field) => field.label === 'Attached label'), false)
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

test('updateStratumNameById updates valid non-empty names', () => {
  const updated = updateStratumNameById(
    twoDimensionalExample,
    'visibleWire',
    'my curve',
  )

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(
    updated.strata.find((stratum) => stratum.id === 'visibleWire')?.name,
    'my curve',
  )
  assert.equal(
    updated.strata.find((stratum) => stratum.id === 'hiddenWire'),
    twoDimensionalExample.strata.find((stratum) => stratum.id === 'hiddenWire'),
  )
  assert.equal(updated.labels, twoDimensionalExample.labels)
})

test('updateStratumNameById rejects empty names', () => {
  const updated = updateStratumNameById(twoDimensionalExample, 'visibleWire', '')

  assert.equal(updated, twoDimensionalExample)
  assert.equal(
    twoDimensionalExample.strata.find((stratum) => stratum.id === 'visibleWire')
      ?.name,
    'Visible wire',
  )
})

test('updateStratumNameById rejects whitespace-only names', () => {
  const updated = updateStratumNameById(twoDimensionalExample, 'visibleWire', '   ')

  assert.equal(updated, twoDimensionalExample)
  assert.equal(
    twoDimensionalExample.strata.find((stratum) => stratum.id === 'visibleWire')
      ?.name,
    'Visible wire',
  )
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

test('makeUniqueId avoids collisions across strata and labels', () => {
  const diagram = {
    ...twoDimensionalExample,
    strata: [
      ...twoDimensionalExample.strata,
      {
        ...twoDimensionalExample.strata[0],
        id: 'point-1',
      },
    ],
    labels: [
      ...twoDimensionalExample.labels,
      {
        ...twoDimensionalExample.labels[0],
        id: 'point-2',
      },
    ],
  }

  assert.equal(makeUniqueId(diagram, 'point'), 'point-3')
})

test('addPointStratum returns a new 2D diagram with codim 2 and z normalized', () => {
  const updated = addPointStratum(
    twoDimensionalExample,
    { x: 3, y: 4, z: 9 },
    { id: 'point-1' },
  )
  const point = updated.strata.find((stratum) => stratum.id === 'point-1')

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(updated.labels, twoDimensionalExample.labels)
  assert.equal(twoDimensionalExample.strata.some((stratum) => stratum.id === 'point-1'), false)
  assert.equal(point?.geometricKind, 'point')

  if (point?.geometricKind !== 'point') {
    throw new Error('Expected added stratum to be a point.')
  }

  assert.equal(point.codim, 2)
  assert.deepEqual(point.position, { x: 3, y: 4, z: 0 })
  assert.equal(point.name.length > 0, true)
})

test('addPointStratumWithResult returns the updated diagram and created id atomically', () => {
  const result = addPointStratumWithResult(
    twoDimensionalExample,
    { x: 3, y: 4, z: 9 },
  )

  assert.equal(result.id, 'point-1')
  assert.equal(
    result.diagram.strata.some((stratum) => stratum.id === result.id),
    true,
  )
})

test('addPointStratum returns a new 3D diagram with codim 3', () => {
  const updated = addPointStratum(
    threeDimensionalExample,
    { x: 3, y: 4, z: 5 },
    { id: 'point-1' },
  )
  const point = updated.strata.find((stratum) => stratum.id === 'point-1')

  assert.equal(point?.geometricKind, 'point')

  if (point?.geometricKind !== 'point') {
    throw new Error('Expected added stratum to be a point.')
  }

  assert.equal(point.codim, 3)
  assert.deepEqual(point.position, { x: 3, y: 4, z: 5 })
})

test('addTextLabel returns a new diagram with default text and valid style', () => {
  const updated = addTextLabel(
    twoDimensionalExample,
    { x: 1, y: 2, z: 8 },
    { id: 'label-1' },
  )
  const label = updated.labels.find((candidate) => candidate.id === 'label-1')

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(updated.strata, twoDimensionalExample.strata)
  assert.equal(label?.text, 'Label')
  assert.equal(label?.name.length ? label.name.length > 0 : false, true)
  assert.deepEqual(label?.position, { x: 1, y: 2, z: 0 })
  assert.equal(label?.style.kind, 'labelStyle')
})

test('addTextLabelWithResult returns the updated diagram and created id atomically', () => {
  const result = addTextLabelWithResult(
    twoDimensionalExample,
    { x: 1, y: 2, z: 8 },
  )

  assert.equal(result.id, 'label-1')
  assert.equal(
    result.diagram.labels.some((label) => label.id === result.id),
    true,
  )
})

test('generated TikZ includes newly added point and label', () => {
  const withPoint = addPointStratum(
    twoDimensionalExample,
    { x: 3, y: 4, z: 0 },
    { id: 'point-1' },
  )
  const withLabel = addTextLabel(
    withPoint,
    { x: 5, y: 6, z: 0 },
    { id: 'label-1', text: 'New label' },
  )
  const tikz = generateTikz(withLabel)

  assert.equal(tikz.includes('\\coordinate (pointpoint1'), true)
  assert.equal(tikz.includes('New label'), true)
  assert.equal(tikz.includes('(5,6)'), true)
})

test('updateStratumStyleById updates curve style immutably', () => {
  const updated = updateStratumStyleById(
    twoDimensionalExample,
    'visibleWire',
    (style) =>
      style.kind === 'curveStyle'
        ? { ...style, lineStyle: 'dashed', strokeColor: '#123456' }
        : style,
  )
  const curve = updated.strata.find((stratum) => stratum.id === 'visibleWire')
  const originalCurve = twoDimensionalExample.strata.find(
    (stratum) => stratum.id === 'visibleWire',
  )

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(curve?.geometricKind, 'curve')
  assert.equal(originalCurve?.geometricKind, 'curve')

  if (curve?.geometricKind !== 'curve' || originalCurve?.geometricKind !== 'curve') {
    throw new Error('Expected visibleWire to be a curve.')
  }

  assert.equal(curve.style.lineStyle, 'dashed')
  assert.equal(curve.style.strokeColor, '#123456')
  assert.equal(originalCurve.style.lineStyle, 'solid')
  assert.equal(updated.labels, twoDimensionalExample.labels)
  assert.equal(
    updated.strata.find((stratum) => stratum.id === 'hiddenWire'),
    twoDimensionalExample.strata.find((stratum) => stratum.id === 'hiddenWire'),
  )
})

test('updateStratumStyleById updates point shape and fill immutably', () => {
  const updated = updateStratumStyleById(
    twoDimensionalExample,
    'circlePoint',
    (style) =>
      style.kind === 'pointStyle'
        ? { ...style, shape: 'star', fill: 'hollow' }
        : style,
  )
  const point = updated.strata.find((stratum) => stratum.id === 'circlePoint')

  assert.equal(point?.geometricKind, 'point')

  if (point?.geometricKind !== 'point') {
    throw new Error('Expected circlePoint to be a point.')
  }

  assert.equal(point.style.shape, 'star')
  assert.equal(point.style.fill, 'hollow')
  assert.equal(
    twoDimensionalExample.strata.find((stratum) => stratum.id === 'circlePoint')
      ?.geometricKind,
    'point',
  )
})

test('updateStratumStyleById updates sheet style immutably', () => {
  const updated = updateStratumStyleById(
    threeDimensionalExample,
    'roseSheet',
    (style) =>
      style.kind === 'sheetStyle'
        ? { ...style, fillOpacity: 0.6, strokeColor: '#654321' }
        : style,
  )
  const sheet = updated.strata.find((stratum) => stratum.id === 'roseSheet')

  assert.equal(sheet?.geometricKind, 'sheet')

  if (sheet?.geometricKind !== 'sheet') {
    throw new Error('Expected roseSheet to be a sheet.')
  }

  assert.equal(sheet.style.fillOpacity, 0.6)
  assert.equal(sheet.style.strokeColor, '#654321')
  assert.equal(updated.labels, threeDimensionalExample.labels)
})

test('updateLabelStyleById updates label anchor immutably', () => {
  const updated = updateLabelStyleById(
    twoDimensionalExample,
    'mathMorphismLabel',
    (style) => ({ ...style, anchor: 'north east', color: '#112233' }),
  )
  const label = updated.labels.find(
    (candidate) => candidate.id === 'mathMorphismLabel',
  )

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(label?.style.anchor, 'north east')
  assert.equal(label?.style.color, '#112233')
  assert.equal(
    twoDimensionalExample.labels.find(
      (candidate) => candidate.id === 'mathMorphismLabel',
    )?.style.anchor,
    'south',
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

test('parseFiniteNumber rejects invalid numeric input', () => {
  assert.equal(parseFiniteNumber(''), null)
  assert.equal(parseFiniteNumber('   '), null)
  assert.equal(parseFiniteNumber('abc'), null)
  assert.equal(parseFiniteNumber('NaN'), null)
  assert.equal(parseFiniteNumber('Infinity'), null)
  assert.equal(parseFiniteNumber('-Infinity'), null)
})

test('parseFiniteNumber accepts finite numeric input', () => {
  assert.equal(parseFiniteNumber('3.25'), 3.25)
  assert.equal(parseFiniteNumber('  -2  '), -2)
})

test('parseOpacity rejects invalid opacity input', () => {
  assert.equal(parseOpacity(''), null)
  assert.equal(parseOpacity('NaN'), null)
  assert.equal(parseOpacity('-0.1'), null)
  assert.equal(parseOpacity('1.1'), null)
})

test('parseOpacity accepts opacity values from 0 to 1', () => {
  assert.equal(parseOpacity('0'), 0)
  assert.equal(parseOpacity('0.5'), 0.5)
  assert.equal(parseOpacity('1'), 1)
})

test('parsePositiveFiniteNumber rejects nonpositive and invalid input', () => {
  assert.equal(parsePositiveFiniteNumber(''), null)
  assert.equal(parsePositiveFiniteNumber('NaN'), null)
  assert.equal(parsePositiveFiniteNumber('0'), null)
  assert.equal(parsePositiveFiniteNumber('-1'), null)
})

test('invalid opacity input does not write NaN into diagram state', () => {
  const parsedValue = parseOpacity('2')
  const updated =
    parsedValue === null
      ? twoDimensionalExample
      : updateStratumStyleById(twoDimensionalExample, 'visibleWire', (style) =>
          style.kind === 'curveStyle'
            ? { ...style, strokeOpacity: parsedValue }
            : style,
        )

  assert.equal(updated, twoDimensionalExample)
  const curve = updated.strata.find((stratum) => stratum.id === 'visibleWire')

  assert.equal(curve?.geometricKind, 'curve')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected visibleWire to be a curve.')
  }

  assert.equal(Number.isNaN(curve.style.strokeOpacity), false)
  assert.equal(curve.style.strokeOpacity, 1)
})

test('style edits are reflected in generated TikZ', () => {
  const updated = updateStratumStyleById(
    twoDimensionalExample,
    'visibleWire',
    (style) =>
      style.kind === 'curveStyle'
        ? {
            ...style,
            strokeColor: '#123456',
            strokeOpacity: 0.45,
            lineWidth: 2.5,
            lineStyle: 'dashed',
          }
        : style,
  )
  const tikz = generateTikz(updated)

  assert.equal(tikz.includes('{HTML}{123456}'), true)
  assert.equal(tikz.includes('draw opacity=0.45'), true)
  assert.equal(tikz.includes('line width=2.5pt'), true)
  assert.equal(tikz.includes('dashed'), true)
})

test('sheet style edits through update helpers are reflected in generated TikZ', () => {
  const updated = updateStratumStyleById(
    threeDimensionalExample,
    'roseSheet',
    (style) =>
      style.kind === 'sheetStyle'
        ? {
            ...style,
            fillColor: '#ABCDEF',
            fillOpacity: 0.72,
            strokeColor: '#123ABC',
            strokeOpacity: 0.44,
          }
        : style,
  )
  const tikz = generateTikz(updated)

  assert.equal(tikz.includes('{HTML}{ABCDEF}'), true)
  assert.equal(tikz.includes('fill opacity=0.72'), true)
  assert.equal(tikz.includes('{HTML}{123ABC}'), true)
  assert.equal(tikz.includes('draw opacity=0.44'), true)
})

test('point style edits through update helpers are reflected in generated TikZ', () => {
  const updated = updateStratumStyleById(
    twoDimensionalExample,
    'circlePoint',
    (style) =>
      style.kind === 'pointStyle'
        ? {
            ...style,
            color: '#445566',
            opacity: 0.5,
            shape: 'square',
            fill: 'hollow',
            size: 5,
          }
        : style,
  )
  const tikz = generateTikz(updated)

  assert.equal(tikz.includes('{HTML}{445566}'), true)
  assert.equal(tikz.includes('regular polygon sides=4'), true)
  assert.equal(tikz.includes('fill=white'), true)
  assert.equal(tikz.includes('opacity=0.5'), true)
  assert.equal(tikz.includes('inner sep=2.5pt'), true)
})

test('label style edits through update helpers are reflected in generated TikZ', () => {
  const updated = updateLabelStyleById(
    twoDimensionalExample,
    'mathMorphismLabel',
    (style) => ({
      ...style,
      color: '#778899',
      opacity: 0.6,
      fontSize: 13,
      anchor: 'north west',
    }),
  )
  const tikz = generateTikz(updated)

  assert.equal(tikz.includes('{HTML}{778899}'), true)
  assert.equal(tikz.includes('text=stzLabelmathMorphismLabel'), true)
  assert.equal(tikz.includes('opacity=0.6'), true)
  assert.equal(tikz.includes('\\fontsize{13pt}{15.6pt}\\selectfont'), true)
  assert.equal(tikz.includes('anchor=north west'), true)
})

test('color input guard accepts valid hex colors and falls back for malformed values', () => {
  assert.equal(isHexColorString('#A1b2C3'), true)
  assert.equal(isHexColorString('not-a-color'), false)
  assert.equal(normalizeColorInputValue('#A1b2C3'), '#A1b2C3')
  assert.equal(normalizeColorInputValue('not-a-color'), '#000000')
  assert.equal(normalizeColorInputValue(''), '#000000')
  assert.equal(normalizeColorInputValue(undefined), '#000000')
})

test('color input fallback does not automatically commit to the diagram', () => {
  const malformedColor = 'not-a-color'
  const diagramWithMalformedColor = {
    ...twoDimensionalExample,
    labels: twoDimensionalExample.labels.map((label) =>
      label.id === 'mathMorphismLabel'
        ? {
            ...label,
            style: {
              ...label.style,
              color: malformedColor,
            },
          }
        : label,
    ),
  }

  assert.equal(normalizeColorInputValue(malformedColor), '#000000')
  assert.equal(
    diagramWithMalformedColor.labels.find(
      (label) => label.id === 'mathMorphismLabel',
    )?.style.color,
    malformedColor,
  )
})

test('invalid numeric input does not write NaN into diagram state', () => {
  const parsedValue = parseFiniteNumber('not a number')
  const updated =
    parsedValue === null
      ? twoDimensionalExample
      : updateStratumById(twoDimensionalExample, 'circlePoint', (stratum) => {
          if (stratum.geometricKind !== 'point') {
            return stratum
          }

          return {
            ...stratum,
            position: updateVec3Coordinate(stratum.position, 'x', parsedValue, 2),
          }
        })

  assert.equal(updated, twoDimensionalExample)
  const point = updated.strata.find((stratum) => stratum.id === 'circlePoint')

  assert.equal(point?.geometricKind, 'point')

  if (point?.geometricKind !== 'point') {
    throw new Error('Expected circlePoint to be a point.')
  }

  assert.equal(Number.isNaN(point.position.x), false)
})

test('valid numeric input updates coordinates through parsing helper', () => {
  const parsedValue = parseFiniteNumber('4.5')

  assert.notEqual(parsedValue, null)

  if (parsedValue === null) {
    throw new Error('Expected 4.5 to parse as a finite number.')
  }

  const updated = updateStratumById(
    twoDimensionalExample,
    'circlePoint',
    (stratum) => {
      if (stratum.geometricKind !== 'point') {
        return stratum
      }

      return {
        ...stratum,
        position: updateVec3Coordinate(stratum.position, 'x', parsedValue, 2),
      }
    },
  )
  const point = updated.strata.find((stratum) => stratum.id === 'circlePoint')

  assert.equal(point?.geometricKind, 'point')

  if (point?.geometricKind !== 'point') {
    throw new Error('Expected circlePoint to be a point.')
  }

  assert.equal(point.position.x, 4.5)
  assert.equal(point.position.z, 0)
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
