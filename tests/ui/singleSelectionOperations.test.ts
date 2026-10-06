import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCurvedSheetStratum,
  createEmptyDiagram,
  createFilledRegion2DStratum,
  createGridStratum,
  createPointStratum,
  createRegionStratum,
  createSheetStratum,
  createTemplatePathStratum,
  createTextLabel,
  createWorkPlaneFilledSheet3DStratum,
} from '../../src/model/constructors.ts'
import { createCoordinateAnchor } from '../../src/model/coordinateAnchors.ts'
import {
  coordinateReferenceSourceForPoint,
  coordinateReferenceVec3ForAnchorId,
} from '../../src/model/coordinateReferences.ts'
import { createNumericScalarInputValue, xyGridFrame } from '../../src/model/grids.ts'
import { defaultPointStyle, defaultSheetStyle } from '../../src/model/styles.ts'
import { parseTranslationVectorFromInputs, type TranslationVector } from '../../src/model/translation.ts'
import { pointShapes } from '../../src/model/types.ts'
import type {
  ClosedPathBoundary,
  Diagram,
  PointShape,
  PointStyle,
  Stratum,
  TextLabel,
  Vec3,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import {
  applyBulkDuplicateToEditorState,
  applyBulkTranslateToEditorState,
  type BulkOperationEditorState,
} from '../../src/ui/bulkEditing.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import type { SingleSelectedElement } from '../../src/ui/selection.ts'
import { createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange } from '../../src/ui/undo.ts'

type SelectableObject = Stratum | TextLabel
type OperationCase = {
  name: string
  ambientDimension: 2 | 3
  object: SelectableObject
  translatedGeometry: (object: SelectableObject) => unknown
  geometry: (object: SelectableObject) => unknown
}

const delta = { x: 2, y: -3, z: 4 }
const rawText = 'literal $F^{(1)}L$\r\n\\alpha \\colon f \\Rightarrow g'

for (const ambientDimension of [2, 3] as const) {
  for (const shape of pointShapes) {
    const object = createPointStratum({
      ambientDimension,
      id: `point-${shape}`,
      position: { x: 1, y: 2, z: ambientDimension === 2 ? 0 : 3 },
      text: rawText,
      style: pointStyle(shape),
    })
    exerciseSingleOperations({
      name: `${ambientDimension}D point ${shape}`,
      ambientDimension,
      object,
      geometry: (candidate) => requirePoint(candidate).position,
      translatedGeometry: (candidate) => shifted(requirePoint(candidate).position, ambientDimension),
    })
  }

  exerciseSingleOperations({
    name: `${ambientDimension}D free text label`,
    ambientDimension,
    object: createTextLabel({
      ambientDimension,
      id: 'free-label',
      text: rawText,
      position: { x: -2, y: 1, z: ambientDimension === 2 ? 0 : 5 },
      style: { kind: 'labelStyle', color: '#123456', opacity: .6, fontSize: 13, anchor: 'north east' },
    }),
    geometry: (candidate) => requireLabel(candidate).position,
    translatedGeometry: (candidate) => shifted(requireLabel(candidate).position, ambientDimension),
  })

  for (const templateKind of ['circleTemplate', 'ellipseTemplate'] as const) {
    const z = ambientDimension === 2 ? 0 : 5
    exerciseSingleOperations({
      name: `${ambientDimension}D ${templateKind}`,
      ambientDimension,
      object: createTemplatePathStratum({
        ambientDimension,
        id: templateKind,
        pathLabel: 'template source',
        template: templateKind === 'circleTemplate'
          ? { kind: templateKind, center: { x: 1, y: 2, z }, radius: 2, frame: frame(z) }
          : { kind: templateKind, center: { x: 1, y: 2, z }, radiusX: 2, radiusY: 3, rotationDeg: 23, frame: frame(z) },
        styleSegments: [{ id: 'template-style', from: 0, to: .5, style: { strokeColor: '#AB3412' } }],
        inlineNodes: [],
      }),
      geometry: (candidate) => requireTemplate(candidate).template,
      translatedGeometry: (candidate) => {
        const template = requireTemplate(candidate).template
        return { ...template, center: shifted(template.center, ambientDimension), frame: { ...template.frame, origin: shifted(frame(z).origin, ambientDimension) } }
      },
    })
  }

  exerciseSingleOperations({
    name: `${ambientDimension}D grid`,
    ambientDimension,
    object: createGridStratum({
      ambientDimension,
      id: 'grid',
      pathLabel: 'grid source',
      latticePattern: 'honeycomb',
      frame: ambientDimension === 2 ? xyGridFrame() : { kind: 'workPlane', frame: frame(5) },
      uRange: { min: scalar(-2), max: scalar(3), step: scalar(1) },
      vRange: { min: scalar(-1), max: scalar(4), step: scalar(1) },
      clip: { kind: 'rectangle', uMin: scalar(-1), uMax: scalar(2), vMin: scalar(0), vMax: scalar(3) },
      inlineNodes: [],
    }),
    geometry: (candidate) => requireGrid(candidate),
    translatedGeometry: (candidate) => {
      const grid = requireGrid(candidate)
      return { ...grid, frame: { ...grid.frame, frame: { ...grid.frame.frame, origin: shifted(grid.frame.frame.origin, ambientDimension) } } }
    },
  })

  test(`${ambientDimension}D ambient region duplicates but translation does not create history`, () => {
    const object = createRegionStratum({ ambientDimension, id: 'ambient', label: '$A$' })
    const initial = state(diagramWithObject(ambientDimension, object), { kind: 'stratum', id: object.id })
    const duplicated = applyBulkDuplicateToEditorState(initial)
    const copied = selectedObject(duplicated)

    assertIndependentCopy(object, copied)
    assert.equal(duplicated.history.past.length, 1)
    const translated = applyBulkTranslateToEditorState(duplicated, translation(initial.editableDiagram))
    assert.deepEqual(translated.editableDiagram, duplicated.editableDiagram)
    assert.equal(translated.history, duplicated.history)
    assert.equal(translated.layerOperationStatus, 'No selected objects translated.')
    assert.deepEqual(undoLastDiagramChange(translated).editableDiagram, initial.editableDiagram)
  })
}

exerciseSingleOperations({
  name: '2D filled region with outer and hole boundaries',
  ambientDimension: 2,
  object: createFilledRegion2DStratum({ id: 'filled', boundaries: [boundary('outer', 0), boundary('hole', 0, .2)], fillRule: 'evenOdd' }),
  geometry: (candidate) => requireFilledRegion(candidate).boundaries,
  translatedGeometry: (candidate) => shiftedBoundaries(requireFilledRegion(candidate).boundaries, 2),
})

const quad = createSheetStratum({
  ambientDimension: 3,
  id: 'quad',
  corners: [{ x: 0, y: 0, z: 5 }, { x: 1, y: 0, z: 5 }, { x: 1, y: 1, z: 5 }, { x: 0, y: 1, z: 5 }],
})
exerciseSingleOperations({
  name: '3D quad sheet', ambientDimension: 3, object: quad,
  geometry: (candidate) => requireQuad(candidate).corners,
  translatedGeometry: (candidate) => requireQuad(candidate).corners.map((point) => shifted(point, 3)),
})
exerciseSingleOperations({
  name: '3D polygon sheet', ambientDimension: 3,
  object: { id: 'polygon', geometricKind: 'sheet', codim: 1, kind: 'polygonSheet', name: 'Polygon', layer: 0, style: { ...defaultSheetStyle }, pathLabel: 'polygon source', vertices: [{ x: 0, y: 0, z: 5 }, { x: 2, y: 0, z: 5 }, { x: 1, y: 2, z: 5 }] },
  geometry: (candidate) => requirePolygon(candidate).vertices,
  translatedGeometry: (candidate) => requirePolygon(candidate).vertices.map((point) => shifted(point, 3)),
})
exerciseSingleOperations({
  name: '3D work-plane filled sheet', ambientDimension: 3,
  object: createWorkPlaneFilledSheet3DStratum({ id: 'work-plane', planeFrame: frame(5), boundaries: [boundary('plane-boundary', 5)] }),
  geometry: (candidate) => { const sheet = requireWorkPlane(candidate); return { planeFrame: sheet.planeFrame, boundaries: sheet.boundaries } },
  translatedGeometry: (candidate) => { const sheet = requireWorkPlane(candidate); return { planeFrame: { ...sheet.planeFrame, origin: shifted(sheet.planeFrame.origin, 3) }, boundaries: shiftedBoundaries(sheet.boundaries, 3) } },
})

for (const primitive of [
  { kind: 'hemisphere' as const, center: { x: 0, y: 0, z: 5 }, frame: frame(5), radius: 2, hemisphereSide: 'negative' as const, sampling: { uSegments: 4, vSegments: 3 } },
  { kind: 'saddle' as const, frame: frame(5), width: 2, depth: 3, height: 1, sampling: { uSegments: 4, vSegments: 3 } },
  { kind: 'ruledSurface' as const, boundary0: { id: 'boundary-source-a', segments: [{ kind: 'line' as const, start: { x: 0, y: 0, z: 5 }, end: { x: 2, y: 0, z: 5 } }] }, boundary1: { id: 'boundary-source-b', segments: [{ kind: 'line' as const, start: { x: 0, y: 2, z: 6 }, end: { x: 2, y: 2, z: 6 } }] }, sampling: { segments: 4 } },
]) {
  exerciseSingleOperations({
    name: `3D ${primitive.kind} sheet`, ambientDimension: 3,
    object: createCurvedSheetStratum({ id: primitive.kind, primitive }),
    geometry: (candidate) => requireCurved(candidate).primitive,
    translatedGeometry: (candidate) => {
      const source = requireCurved(candidate).primitive
      switch (source.kind) {
        case 'hemisphere': return { ...source, center: shifted(source.center, 3), frame: { ...source.frame, origin: shifted(source.frame.origin, 3) } }
        case 'saddle': return { ...source, frame: { ...source.frame, origin: shifted(source.frame.origin, 3) } }
        case 'ruledSurface': return { ...source, boundary0: { ...source.boundary0, segments: shiftedLines(source.boundary0.segments, 3) }, boundary1: { ...source.boundary1, segments: shiftedLines(source.boundary1.segments, 3) } }
        default: throw new Error('Expected a non-Coons curved sheet.')
      }
    },
  })
}

for (const kind of ['stratum', 'label'] as const) {
  test(`single ${kind} translation detaches its coordinate reference and undo restores it`, () => {
    const empty = createEmptyDiagram({ ambientDimension: 3 })
    const anchor = createCoordinateAnchor(empty, { id: 'anchor', name: 'Anchor', position: { kind: 'global', value: { x: { kind: 'numeric', value: 7 }, y: { kind: 'numeric', value: 8 }, z: { kind: 'numeric', value: 9 } } } })
    const diagram = { ...empty, coordinateAnchors: [anchor] }
    const position = coordinateReferenceVec3ForAnchorId(diagram, anchor.id)
    assert.notEqual(position, null)
    if (position === null) throw new Error('Expected a resolved anchor position.')
    const object = kind === 'stratum'
      ? createPointStratum({ ambientDimension: 3, id: 'referenced', position, text: rawText })
      : createTextLabel({ ambientDimension: 3, id: 'referenced', position, text: rawText })
    const initial = state({ ...diagram, strata: kind === 'stratum' ? [object as Stratum] : [], labels: kind === 'label' ? [object as TextLabel] : [] }, { kind, id: object.id })
    const translated = applyBulkTranslateToEditorState(initial, translation(initial.editableDiagram))
    const moved = selectedObject(translated)
    assert.ok('position' in moved)
    assert.deepEqual({ x: moved.position.x, y: moved.position.y, z: moved.position.z }, { x: 9, y: 5, z: 13 })
    assert.equal(coordinateReferenceSourceForPoint(moved.position), null)
    assert.deepEqual(translated.editableDiagram.coordinateAnchors, [anchor])
    const undone = undoLastDiagramChange(translated)
    const restored = selectedObject(undone)
    assert.ok('position' in restored)
    assert.equal(coordinateReferenceSourceForPoint(restored.position)?.coordinateId, anchor.id)
    assert.deepEqual(undone.editableDiagram, initial.editableDiagram)
    assert.deepEqual(redoLastDiagramChange(undone).editableDiagram, translated.editableDiagram)
  })
}

test('single point translation overflow preserves diagram, selection and history atomically', () => {
  const object = createPointStratum({ ambientDimension: 3, id: 'huge', position: { x: Number.MAX_VALUE, y: 0, z: 0 } })
  const initial = state(diagramWithObject(3, object), { kind: 'stratum', id: object.id })
  const next = applyBulkTranslateToEditorState(initial, { x: { kind: 'numeric', value: Number.MAX_VALUE }, y: { kind: 'numeric', value: 0 }, z: { kind: 'numeric', value: 0 } })
  assert.equal(next.editableDiagram, initial.editableDiagram)
  assert.equal(next.selectedElement, initial.selectedElement)
  assert.equal(next.history, initial.history)
  assert.match(next.layerOperationStatus, /non-finite coordinate/)
})

function exerciseSingleOperations(operation: OperationCase): void {
  test(`${operation.name} single duplicate and translation preserve source and undo as separate operations`, () => {
    const initial = state(diagramWithObject(operation.ambientDimension, operation.object), selectionFor(operation.object))
    const sourceSnapshot = structuredClone(operation.object)
    const duplicated = applyBulkDuplicateToEditorState(initial)
    const copied = selectedObject(duplicated)
    assertIndependentCopy(operation.object, copied)
    assert.deepEqual(findObject(duplicated.editableDiagram, operation.object.id), sourceSnapshot)
    assert.equal(duplicated.history.past.length, 1)
    assert.deepEqual(undoLastDiagramChange(duplicated).editableDiagram, initial.editableDiagram)
    assert.deepEqual(redoLastDiagramChange(undoLastDiagramChange(duplicated)).editableDiagram, duplicated.editableDiagram)

    const translated = applyBulkTranslateToEditorState(duplicated, translation(initial.editableDiagram))
    const moved = selectedObject(translated)
    assert.equal(translated.history.past.length, 2)
    assert.deepEqual(operation.geometry(moved), operation.translatedGeometry(copied))
    assert.deepEqual(moved.style, copied.style)
    assert.deepEqual(findObject(translated.editableDiagram, operation.object.id), sourceSnapshot)
    assert.deepEqual(operation.object, sourceSnapshot)
    assert.deepEqual(undoLastDiagramChange(translated).editableDiagram, duplicated.editableDiagram)
    assert.deepEqual(redoLastDiagramChange(undoLastDiagramChange(translated)).editableDiagram, translated.editableDiagram)
    const validation = validateDiagram(translated.editableDiagram)
    assert.equal(validation.valid, true, JSON.stringify(validation.errors))
    if ('text' in copied) assert.equal(copied.text, rawText)
    if ('text' in moved) assert.equal(moved.text, rawText)
    if ('codim' in copied) assert.equal(copied.codim, operation.object.geometricKind === 'label' ? undefined : operation.object.codim)
  })
}

function assertIndependentCopy(source: SelectableObject, copy: SelectableObject): void {
  assert.notEqual(copy.id, source.id)
  assert.equal(copy.geometricKind, source.geometricKind)
  assert.deepEqual(withoutAllocatedIdentities(copy), withoutAllocatedIdentities(source))
  assertNoSharedObjects(source, copy)
  if (source.geometricKind === 'curve' && copy.geometricKind === 'curve') {
    for (const [index, segment] of source.styleSegments.entries()) {
      assert.notEqual(copy.styleSegments[index]?.id, segment.id)
    }
  }
  if ('pathLabel' in source && source.pathLabel !== undefined) {
    assert.ok('pathLabel' in copy)
    assert.notEqual(copy.pathLabel, source.pathLabel)
  }
  if ('boundaries' in source && 'boundaries' in copy) {
    const ids = [...source.boundaries, ...copy.boundaries].map((candidate) => candidate.id)
    assert.equal(new Set(ids).size, ids.length)
  }
  if (source.geometricKind === 'sheet' && source.kind === 'curvedSheet' && source.primitive.kind === 'ruledSurface') {
    const primitive = requireCurved(copy).primitive
    assert.equal(primitive.kind, 'ruledSurface')
    if (primitive.kind !== 'ruledSurface') throw new Error('Expected ruled surface copy.')
    assert.equal(primitive.boundary0.id, source.primitive.boundary0.id)
    assert.equal(primitive.boundary1.id, source.primitive.boundary1.id)
  }
}

function withoutAllocatedIdentities(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutAllocatedIdentities)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'id' && key !== 'pathLabel').map(([key, child]) => [key, withoutAllocatedIdentities(child)]))
}

function assertNoSharedObjects(source: unknown, copy: unknown): void {
  if (source === null || typeof source !== 'object') return
  assert.notEqual(source, copy)
  assert.ok(copy !== null && typeof copy === 'object')
  for (const [key, child] of Object.entries(source)) assertNoSharedObjects(child, Reflect.get(copy, key))
}

function state(editableDiagram: Diagram, selectedElement: SingleSelectedElement): BulkOperationEditorState {
  return { editableDiagram, selectedElement, layerFilter: allLayersFilter, polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null, layerOperationStatus: '', history: createDiagramHistory(editableDiagram) }
}

function diagramWithObject(ambientDimension: 2 | 3, object: SelectableObject): Diagram {
  return { ...createEmptyDiagram({ ambientDimension }), strata: object.geometricKind === 'label' ? [] : [object], labels: object.geometricKind === 'label' ? [object] : [] }
}

function selectionFor(object: SelectableObject): SingleSelectedElement { return { kind: object.geometricKind === 'label' ? 'label' : 'stratum', id: object.id } }
function selectedObject(editor: BulkOperationEditorState): SelectableObject {
  assert.ok(editor.selectedElement !== null && editor.selectedElement.kind !== 'multi')
  return findObject(editor.editableDiagram, editor.selectedElement.id)
}
function findObject(diagram: Diagram, id: string): SelectableObject {
  const object = [...diagram.strata, ...diagram.labels].find((candidate) => candidate.id === id)
  assert.ok(object !== undefined)
  return object
}

function translation(diagram: Diagram): TranslationVector {
  const parsed = parseTranslationVectorFromInputs(diagram, { dx: '2', dy: '-3', dz: diagram.ambientDimension === 2 ? '999' : '4' })
  assert.ok(parsed.ok)
  return parsed.translation
}
function shifted(point: Vec3, ambientDimension: 2 | 3): Vec3 { return { x: point.x + delta.x, y: point.y + delta.y, z: ambientDimension === 2 ? 0 : point.z + delta.z } }
function scalar(value: number) { return createNumericScalarInputValue(value) }
function frame(z: number): WorkPlaneFrameSnapshot { return { origin: { x: 0, y: 0, z }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 }, normal: { x: 0, y: 0, z: 1 } } }
function boundary(id: string, z: number, inset = 0): ClosedPathBoundary {
  const points = [{ x: inset, y: inset, z }, { x: 1 - inset, y: inset, z }, { x: 1 - inset, y: 1 - inset, z }, { x: inset, y: 1 - inset, z }]
  return { id, segments: points.map((start, index) => ({ kind: 'line', start, end: points[(index + 1) % points.length]! })) }
}
function shiftedLines(segments: ClosedPathBoundary['segments'], ambientDimension: 2 | 3): ClosedPathBoundary['segments'] {
  return segments.map((segment) => { assert.equal(segment.kind, 'line'); return { ...segment, start: shifted(segment.start, ambientDimension), end: shifted(segment.end, ambientDimension) } })
}
function shiftedBoundaries(boundaries: ClosedPathBoundary[], ambientDimension: 2 | 3): ClosedPathBoundary[] { return boundaries.map((source) => ({ ...source, segments: shiftedLines(source.segments, ambientDimension) })) }

function pointStyle(shape: PointShape): PointStyle {
  return { ...defaultPointStyle, shape, fill: 'hollow', opacity: .8, size: 7, shapeParameters: { aspect: 1.7, borderRotate: 17, regularPolygonSides: 7, starPoints: 6, starPointRatio: 2, cylinderUsesCustomFill: true, cylinderEndFill: '#AA0044', cylinderBodyFill: '#118822' }, paint: { text: { color: '#123456', opacity: .7 }, fill: { enabled: true, color: '#FFFFFF', opacity: .3 }, stroke: { enabled: true, color: '#BB2200', opacity: .9, width: 2, lineStyle: 'dashed', dashPattern: [4, 2], dashPhase: .5, lineCap: 'rect', lineJoin: 'bevel' } } }
}

function requirePoint(object: SelectableObject) { assert.equal(object.geometricKind, 'point'); if (object.geometricKind !== 'point') throw new Error('Expected point.'); return object }
function requireLabel(object: SelectableObject) { assert.equal(object.geometricKind, 'label'); if (object.geometricKind !== 'label') throw new Error('Expected label.'); return object }
function requireTemplate(object: SelectableObject) { assert.ok(object.geometricKind === 'curve' && object.kind === 'templatePath'); return object }
function requireGrid(object: SelectableObject) { assert.ok(object.geometricKind === 'curve' && object.kind === 'grid'); return object }
function requireFilledRegion(object: SelectableObject) { assert.ok(object.geometricKind === 'region' && object.kind === 'filledRegion'); return object }
function requireQuad(object: SelectableObject) { assert.ok(object.geometricKind === 'sheet' && object.kind === 'quadSheet'); return object }
function requirePolygon(object: SelectableObject) { assert.ok(object.geometricKind === 'sheet' && object.kind === 'polygonSheet'); return object }
function requireWorkPlane(object: SelectableObject) { assert.ok(object.geometricKind === 'sheet' && object.kind === 'workPlaneFilledSheet'); return object }
function requireCurved(object: SelectableObject) { assert.ok(object.geometricKind === 'sheet' && object.kind === 'curvedSheet'); return object }
