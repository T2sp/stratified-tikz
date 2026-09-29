import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { importTikzStyleFile } from '../../src/model/importedTikzStyles.ts'
import { resolveTikzPaint } from '../../src/model/importedTikzPaint.ts'
import { pointShapeTikzKeys } from '../../src/model/importedTikzShapes.ts'
import { defaultPointShapeParameters, pointShapeParameterIssues, resolvePointShapeParameters } from '../../src/model/pointShapeParameters.ts'
import { clonePointStyle, defaultPointStyle, pointStylesEqual } from '../../src/model/styles.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { applyUserStylePresetToStratum, createUserStylePresetFromStyle } from '../../src/model/stylePresets.ts'
import { pointShapes, type Diagram, type PointShapeParameters, type PointStratum } from '../../src/model/types.ts'
import { duplicateSelectedElements } from '../../src/ui/bulkEditing.ts'
import { copyStyleFromSelection, pasteStyleClipboardToSelection } from '../../src/ui/styleClipboard.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import { commitDiagramChange, createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange, type UndoableEditorState } from '../../src/ui/undo.ts'

const nondefaults: Required<PointShapeParameters> = {
  aspect: 2, borderRotate: 37, borderUsesIncircle: true,
  trapeziumLeftAngle: 75, trapeziumRightAngle: 110, trapeziumStretches: true, trapeziumStretchesBody: true,
  regularPolygonSides: 7, starPoints: 8, starPointHeight: 12, starPointRatio: 2.4, starPointMode: 'height',
  isoscelesTriangleApexAngle: 70, isoscelesTriangleStretches: true,
  kiteUpperVertexAngle: 90, kiteLowerVertexAngle: 50, dartTipAngle: 30, dartTailAngle: 120,
  circularSectorAngle: 150, cylinderUsesCustomFill: true, cylinderEndFill: '#AABBCC', cylinderBodyFill: '#123456',
}
function point(diagram: Diagram, index = 0): PointStratum {
  const result = diagram.strata[index]
  assert.equal(result.geometricKind, 'point')
  if (result.geometricKind !== 'point') throw Error('Expected point')
  return result
}
test('deterministic PGF defaults remain separate from optional saved parameters', () => {
  assert.deepEqual(resolvePointShapeParameters(), defaultPointShapeParameters)
  assert.deepEqual(pointShapeParameterIssues(defaultPointShapeParameters), [])
  assert.deepEqual(pointShapeParameterIssues(nondefaults), [])
  assert.equal(pointStylesEqual(defaultPointStyle, { ...defaultPointStyle, shapeParameters: {} }), true)
})
for (const [field, value] of Object.entries(nondefaults)) {
  test(`literal shape parameter is supported with an observable nondefault: ${field}`, () => {
    if (field === 'starPointMode') return
    const key = pointShapeTikzKeys[field as keyof PointShapeParameters]
    const literal = field === 'cylinderEndFill' ? 'red' : field === 'cylinderBodyFill' ? 'blue' : `${value}${field === 'starPointHeight' ? 'pt' : ''}`
    const preview = resolveTikzPaint(`${key}=${literal}`)
    assert.equal(preview.diagnostics, undefined)
    assert.equal(preview.shapeParameters?.[field as keyof PointShapeParameters], field === 'cylinderEndFill' ? '#FF0000' : field === 'cylinderBodyFill' ? '#0000FF' : value)
  })
}
test('aliases, shorthand pairs, false and nested style order follow PGF key order', () => {
  const preview = resolveTikzPaint('shape aspect=2,aspect=3,trapezium angle=75,trapezium left angle=80,kite vertex angles={90 and 70},kite lower vertex angle=60,shape border uses incircle,cylinder uses custom fill=true,cylinder uses custom fill=false,trapezium stretches=false')
  assert.equal(preview.diagnostics, undefined)
  assert.deepEqual(preview.shapeParameters, { aspect: 3, trapeziumLeftAngle: 80, trapeziumRightAngle: 75, kiteUpperVertexAngle: 90, kiteLowerVertexAngle: 60, borderUsesIncircle: true, cylinderUsesCustomFill: false, trapeziumStretches: false })
  const nested = resolveTikzPaint('inner,star point height=3pt', { styles: [{ key: 'inner', options: 'star,star points=9,star point ratio=2' }] })
  assert.equal(nested.pointShape, 'star')
  assert.equal(nested.shapeParameters?.starPointMode, 'height')
  assert.equal(resolveTikzPaint('star point height=3pt,star point ratio=2').shapeParameters?.starPointMode, 'ratio')
})
for (const [field, value] of [
  ['regularPolygonSides', 2], ['regularPolygonSides', 65], ['regularPolygonSides', 3.5], ['starPoints', 65],
  ['aspect', 0], ['aspect', 101], ['borderRotate', 360001], ['borderUsesIncircle', 1],
  ['trapeziumLeftAngle', 0], ['trapeziumRightAngle', 180], ['trapeziumStretches', 'false'],
  ['starPointHeight', -1], ['starPointHeight', 10001], ['starPointRatio', .9], ['starPointMode', 'other'],
  ['isoscelesTriangleApexAngle', 180], ['kiteUpperVertexAngle', 0], ['kiteLowerVertexAngle', NaN],
  ['dartTipAngle', 179], ['dartTailAngle', 1], ['circularSectorAngle', 360], ['circularSectorAngle', 0], ['circularSectorAngle', 180], ['circularSectorAngle', 240], ['circularSectorAngle', 300], ['circularSectorAngle', 359],
  ['cylinderUsesCustomFill', 'true'], ['cylinderEndFill', 'red'], ['cylinderBodyFill', '#abc'], ['unknown', 1],
] as const) test(`invalid parameter rejects visibly: ${field}=${String(value)}`, () => {
  assert.ok(pointShapeParameterIssues({ [field]: value }).length)
})
test('legal finite boundaries and malformed objects do not clamp or silently normalize', () => {
  for (const parameters of [{ regularPolygonSides: 3, starPoints: 64 }, { aspect: .01, borderRotate: -360000 }, { aspect: 100, starPointRatio: 100, starPointHeight: 10000 }, { circularSectorAngle: 1 }, { circularSectorAngle: 179 }]) assert.deepEqual(pointShapeParameterIssues(parameters), [])
  for (const invalid of [null, [], Infinity, { aspect: Infinity }]) assert.ok(pointShapeParameterIssues(invalid).length)
  const preview = resolveTikzPaint('star,star points=65,star point ratio=Infinity')
  assert.equal(preview.pointShape, 'star')
  assert.ok(preview.unresolvedFields?.includes('shapeParameters.starPoints'))
  assert.ok(preview.diagnostics?.length)
})
for (const shape of pointShapes) test(`${shape}: JSON, presets, duplicate, clipboard and history preserve parameters, raw body and codim`, () => {
  for (const ambientDimension of [2, 3] as const) {
    const diagram = createEmptyDiagram({ ambientDimension })
    diagram.strata = [createPointStratum({ ambientDimension, id: 'p', position: { x: 0, y: 0, z: 0 }, text: '  $F$\t\n', style: { ...defaultPointStyle, shape, shapeParameters: { ...nondefaults } } }),
      createPointStratum({ ambientDimension, id: 'q', position: { x: 1, y: 0, z: 0 } })]
    const created = createUserStylePresetFromStyle(diagram, 'point', shape, point(diagram).style)
    assert.ok(created)
    const applied = applyUserStylePresetToStratum(created.diagram, 'q', created.preset.id)
    const copy = copyStyleFromSelection(applied, { kind: 'stratum', id: 'p' }); assert.ok(copy.ok)
    const pasted = pasteStyleClipboardToSelection(applied, { kind: 'stratum', id: 'q' }, copy.clipboard); assert.ok(pasted.ok)
    const duplicate = duplicateSelectedElements(pasted.diagram, { kind: 'stratum', id: 'p' })
    const loaded = parseSavedDiagramJson(serializeDiagram(duplicate.diagram)); assert.ok(loaded.ok)
    const loadedPoint = point(loaded.diagram)
    assert.deepEqual(loadedPoint.style.shapeParameters, nondefaults)
    assert.equal(loadedPoint.style.shape, shape); assert.equal(loadedPoint.codim, ambientDimension)
    assert.equal(loadedPoint.text, '  $F$\t\n')
    const clone = clonePointStyle(loadedPoint.style); clone.shapeParameters!.aspect = 3
    assert.equal(loadedPoint.style.shapeParameters?.aspect, 2)
    assert.equal(pointStylesEqual(clone, loadedPoint.style), false)
    const initial: UndoableEditorState = { editableDiagram: diagram, selectedElement: { kind: 'stratum', id: 'p' }, layerFilter: allLayersFilter, polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null, history: createDiagramHistory(diagram) }
    const committed = commitDiagramChange(initial, { ...initial, editableDiagram: duplicate.diagram })
    assert.deepEqual(undoLastDiagramChange(committed).editableDiagram, diagram)
    assert.deepEqual(redoLastDiagramChange(undoLastDiagramChange(committed)).editableDiagram, duplicate.diagram)
  }
})
test('invalid saved shape parameters are rejected rather than replaced with defaults', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata = [createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 } })]
  const document = JSON.parse(serializeDiagram(diagram)) as { diagram: { strata: { style: Record<string, unknown> }[] } }
  for (const invalid of [null, { starPoints: 100000 }, { cylinderUsesCustomFill: 'false' }]) {
    document.diagram.strata[0].style.shapeParameters = invalid
    const loaded = parseSavedDiagramJson(JSON.stringify(document)); assert.equal(loaded.ok, false)
  }
})

test('cross-invalid dart imports retain raw intent with a valid, visibly limited preview fallback', () => {
  const options = 'dart,dart tip angle=150,dart tail angle=100'
  const preview = resolveTikzPaint(options)
  assert.equal(preview.pointShape, 'dart')
  assert.ok(preview.diagnostics?.some((message) => message.includes('Dart tail')))
  assert.ok(preview.unresolvedFields?.includes('shapeParameters.dartTipAngle'))
  assert.ok(preview.unresolvedFields?.includes('shapeParameters.dartTailAngle'))
  assert.deepEqual(pointShapeParameterIssues(preview.shapeParameters), [])
  const imported = importTikzStyleFile(createEmptyDiagram({ ambientDimension: 2 }), 'dart.sty', `\\tikzset{geometric/.style={${options}}}`)
  assert.equal(imported.references[0].options, options)
  assert.ok(parseSavedDiagramJson(serializeDiagram(imported.diagram)).ok)
})

test('new shape primitive redefinitions cannot change trusted literal handlers', () => {
  for (const key of ['star points', 'shape aspect', 'kite vertex angles', 'cylinder end fill', 'trapezium']) {
    const imported = importTikzStyleFile(createEmptyDiagram({ ambientDimension: 2 }), 'unsafe.sty', `\\tikzset{${key}/.code={\\def\\unsafe{1}},geometric/.style={star}}`)
    assert.equal(imported.source, null, key)
    assert.equal(imported.references.length, 0, key)
  }
})

for (const angle of [180, 240, 300, 359]) test(`unsupported sector angle ${angle} retains external raw intent with an explicit limitation`, () => {
  const options = `circular sector,circular sector angle=${angle}`
  const preview = resolveTikzPaint(options)
  assert.equal(preview.pointShape, 'circular sector')
  assert.ok(preview.diagnostics?.length)
  assert.ok(preview.unresolvedFields?.includes('shapeParameters.circularSectorAngle'))
  assert.equal(preview.shapeParameters?.circularSectorAngle, undefined)
  const imported = importTikzStyleFile(createEmptyDiagram({ ambientDimension: 2 }), 'sector.sty', `\\tikzset{geometric/.style={${options}}}`)
  assert.equal(imported.references[0].options, options)
  assert.ok(imported.references[0].previewDiagnostics?.length)
  assert.ok(parseSavedDiagramJson(serializeDiagram(imported.diagram)).ok)
})
test('internal legacy names and the star UI mode are not invented PGF primitives', () => {
  for (const key of ['square', 'triangle']) {
    const preview = resolveTikzPaint(`shape=${key}`)
    assert.equal(preview.pointShape, undefined)
    assert.ok(preview.diagnostics?.length)
  }
  for (const key of ['square', 'triangle', 'star point mode']) {
    const source = `\\tikzset{${key}/.style={fill=red},geometric/.style={${key}}}`
    const imported = importTikzStyleFile(createEmptyDiagram({ ambientDimension: 2 }), 'names.sty', source)
    assert.ok(imported.source, `${key} is a legal external style name`)
    const resolved = resolveTikzPaint(key, { styles: [{ key, options: 'fill=red' }] })
    assert.equal(resolved.fillColor, '#FF0000')
    assert.equal(resolved.diagnostics?.length ?? 0, 0)
  }
})
