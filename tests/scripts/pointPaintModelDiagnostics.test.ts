import assert from 'node:assert/strict'
import test from 'node:test'
import { pointPaintModelDiagnostics } from '../../scripts/fixtures/pointPaintModelDiagnostics.ts'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { importTikzStyleFile } from '../../src/model/importedTikzStyles.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import type { SavedDiagramFile } from '../../src/model/serialization.ts'
import { applyUserStylePresetToStratum } from '../../src/model/stylePresets.ts'
import type { Diagram, PointStratum } from '../../src/model/types.ts'

function fixture(ambientDimension: 2 | 3, id = 'app-point'): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension })
  diagram.strata = [createPointStratum({ ambientDimension, id,
    text: '  $F$\r\n 日本  ', position: { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 } })]
  const imported = importTikzStyleFile(diagram, 'diagnostics.sty',
    String.raw`\tikzset{diagnosticPoint/.style={fill=red,text=green,draw=blue}}`)
  const preset = imported.diagram.userStylePresets?.find((entry) => entry.kind === 'point')
  assert.ok(preset)
  return applyUserStylePresetToStratum(imported.diagram, id, preset.id)
}

function point(diagram: Diagram): PointStratum {
  const result = diagram.strata[0]
  assert.ok(result.geometricKind === 'point')
  return result
}

for (const ambientDimension of [2, 3] as const) {
  test(`${ambientDimension}D point diagnostics validate the runtime model when saved JSON omits camera`, () => {
    const diagram = fixture(ambientDimension)
    const saved = JSON.parse(serializeDiagram(diagram)) as SavedDiagramFile
    assert.equal(saved.diagram.camera, undefined, 'Saved camera omission is intentional')
    assert.equal(diagram.camera.mode, ambientDimension === 2 ? '2d' : '3d')

    const result = pointPaintModelDiagnostics(JSON.stringify(diagram))
    assert.deepEqual(result.validation, { valid: true, errors: [] })
    assert.equal(result.reference?.id, point(diagram).importedTikzStyleReferenceId)
    assert.equal(result.reference?.key, 'diagnosticPoint')
    assert.equal(result.resolution?.fillColor, '#FF0000')
    assert.equal(result.resolution?.textColor, '#00FF00')
    assert.equal(result.resolution?.drawColor, '#0000FF')
    assert.deepEqual(result.resolution?.unresolvedFields ?? [], [])
  })

  test(`${ambientDimension}D diagnostics report detached provenance without repairing it`, () => {
    const diagram = fixture(ambientDimension)
    const importedPoint = point(diagram)
    assert.ok(importedPoint.style.importedPaint)
    delete importedPoint.stylePresetId
    delete importedPoint.importedTikzStyleReferenceId
    const runtimeJson = JSON.stringify(diagram)

    const result = pointPaintModelDiagnostics(runtimeJson)
    assert.equal(result.validation.valid, false)
    assert.ok(result.validation.errors.some((issue) =>
      issue.path === 'strata[0].style.importedPaint.referenceId' &&
      issue.message === 'Imported paint metadata must match the active imported reference.'))
    assert.equal(result.reference, undefined)
    assert.equal(result.resolution, null)
    assert.equal(JSON.stringify(diagram), runtimeJson)
    assert.ok(point(diagram).style.importedPaint, 'Observation retains the invalid evidence')
  })

  test(`${ambientDimension}D diagnostics retain invalid runtime camera evidence`, () => {
    const diagram = fixture(ambientDimension)
    if (diagram.camera.mode === '2d') diagram.camera.scale = -1
    else diagram.camera.zoom = -1
    const runtimeJson = JSON.stringify(diagram)

    const result = pointPaintModelDiagnostics(runtimeJson)
    assert.equal(result.validation.valid, false)
    assert.ok(result.validation.errors.some((issue) =>
      issue.path === (ambientDimension === 2 ? 'camera.scale' : 'camera.zoom')))
    assert.equal(JSON.stringify(diagram), runtimeJson, 'No default camera is substituted')
  })
}

test('diagnostics own their observations and preserve earlier runtime snapshots', () => {
  const diagram = fixture(2, 'custom-point')
  const original = structuredClone(diagram)
  const runtimeJson = JSON.stringify(diagram)
  const first = pointPaintModelDiagnostics(runtimeJson, 'custom-point')
  const second = pointPaintModelDiagnostics(runtimeJson, 'custom-point')
  assert.deepEqual(first, second)
  assert.deepEqual(diagram, original)
  assert.ok(first.reference)
  first.reference.key = 'changed observation'
  assert.equal(second.reference?.key, 'diagnosticPoint')
  assert.deepEqual(pointPaintModelDiagnostics(runtimeJson, 'custom-point'), second)

  const later = importTikzStyleFile(diagram, 'later.sty',
    String.raw`\tikzset{diagnosticPoint/.style={fill=blue,text=green,draw=blue}}`).diagram
  assert.equal(pointPaintModelDiagnostics(JSON.stringify(later), 'custom-point').resolution?.fillColor, '#0000FF')
  assert.equal(pointPaintModelDiagnostics(runtimeJson, 'custom-point').resolution?.fillColor, '#FF0000')
  assert.deepEqual(diagram, original, 'Later observation does not mutate the prior model')
})
