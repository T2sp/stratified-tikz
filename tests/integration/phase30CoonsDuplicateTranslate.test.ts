import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import {
  coonsPatchCornerEquationStatusesFromBoundaries,
  sampleCoonsPatch,
  validateCurvedSheetPrimitive,
} from '../../src/geometry/curvedSheets.ts'
import {
  coonsPatchBoundaryLinkStatus,
  synchronizeLinkedCoonsPatches,
} from '../../src/model/coonsPatchLinks.ts'
import {
  createCurvedSheetStratum,
  createEmptyDiagram,
  createPointStratum,
  createTextLabel,
} from '../../src/model/constructors.ts'
import {
  coordinateReferenceVec3ForAnchor,
} from '../../src/model/coordinateReferences.ts'
import { createArcPathSegmentFromAngles } from '../../src/model/paths.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import {
  defaultCurveStyle,
  defaultPointStyle,
  defaultSheetStyle,
} from '../../src/model/styles.ts'
import { symbolicVec3FromVec3 } from '../../src/model/coordinateAnchors.ts'
import {
  parseTranslationVectorFromInputs,
  translationVectorFromNumericVec3,
  type TranslationVector,
} from '../../src/model/translation.ts'
import type {
  ConcatenatedPathStratum,
  CoordinateAnchor,
  CoonsBoundarySnapshot,
  CoonsPatchPrimitive,
  CurvedSheetStratum,
  Diagram,
  PathSegment,
  PointStratum,
  Stratum,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinateSource,
} from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { prepareSvgSurfaceGeometry } from '../../src/rendering/svgSurfaceScene.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { duplicateSelectedElements } from '../../src/ui/bulkEditing.ts'
import {
  applyDuplicateAndTranslateCoonsPatchToEditorState,
  duplicateAndTranslateCoonsPatch,
  isCoonsPatchStratum,
  submitCoonsPatchDuplicateTranslation,
  type CoonsPatchStratum,
} from '../../src/ui/coonsPatchDuplicateTranslation.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import {
  createCoonsPatchFromBoundaryPaths,
  type CoonsPatchBoundaryPathSelections,
} from '../../src/ui/ruledSurface.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type DiagramHistory,
} from '../../src/ui/undo.ts'

type TestEditorState = {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: typeof allLayersFilter
  polylineDraft: null
  cubicBezierDraft: null
  pathDraft: null
  sheetPolygonDraft: null
  layerOperationStatus: string
  history: DiagramHistory
}

test('operation eligibility is exact and failures preserve the original diagram', () => {
  const diagram = createComplexPatchDiagram(false)
  const patch = findCoonsPatch(diagram, 'patch')
  const translation = numericTranslation(diagram, point(1, 2, 3))

  assert.equal(isCoonsPatchStratum(patch), true)
  for (const stratum of diagram.strata.filter((value) => value.id !== patch.id)) {
    assert.equal(isCoonsPatchStratum(stratum), false, stratum.id)
    const rejected = duplicateAndTranslateCoonsPatch(
      diagram,
      stratum.id,
      translation,
    )

    assert.equal(rejected.ok, false)
    assert.equal(rejected.diagram, diagram)
  }

  const missing = duplicateAndTranslateCoonsPatch(
    diagram,
    'missing-patch',
    translation,
  )
  assert.equal(missing.ok, false)
  assert.equal(missing.diagram, diagram)

  const zero = duplicateAndTranslateCoonsPatch(
    diagram,
    patch.id,
    numericTranslation(diagram, point(0, 0, 0)),
  )
  assert.equal(zero.ok, false)
  assert.equal(zero.diagram, diagram)

  const nonFinite = duplicateAndTranslateCoonsPatch(
    diagram,
    patch.id,
    {
      x: { kind: 'numeric', value: Number.POSITIVE_INFINITY },
      y: { kind: 'numeric', value: 0 },
      z: { kind: 'numeric', value: 0 },
    },
  )
  assert.equal(nonFinite.ok, false)
  assert.equal(nonFinite.diagram, diagram)

  const malformedPatch = {
    id: 'malformed-patch',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    name: 'Malformed',
    style: { ...defaultSheetStyle },
    layer: 0,
  } as unknown as Stratum
  const malformedDiagram = {
    ...diagram,
    strata: [...diagram.strata, malformedPatch],
  }
  assert.doesNotThrow(() =>
    duplicateAndTranslateCoonsPatch(
      malformedDiagram,
      malformedPatch.id,
      translation,
    ),
  )
  const malformed = duplicateAndTranslateCoonsPatch(
    malformedDiagram,
    malformedPatch.id,
    translation,
  )
  assert.equal(malformed.ok, false)
  assert.equal(malformed.diagram, malformedDiagram)
})

test('static duplication deeply clones metadata and translates every boundary form', () => {
  const diagram = createComplexPatchDiagram(false)
  const before = structuredClone(diagram)
  const source = findCoonsPatch(diagram, 'patch')
  const sourceMesh = sampleCoonsPatch(source.primitive)
  const delta = point(1.25, -0.5, 2)
  const result = duplicateAndTranslateCoonsPatch(
    diagram,
    source.id,
    numericTranslation(diagram, delta),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const copy = findCoonsPatch(result.diagram, result.duplicatedPatchId)
  assert.equal(copy.id, 'patch-copy')
  assert.equal(copy.name, source.name)
  assert.equal(copy.codim, source.codim)
  assert.equal(copy.geometricKind, source.geometricKind)
  assert.equal(copy.kind, source.kind)
  assert.equal(copy.layer, source.layer)
  assert.equal(copy.label, source.label)
  assert.equal(
    copy.importedTikzStyleReferenceId,
    source.importedTikzStyleReferenceId,
  )
  assert.deepEqual(copy.style, source.style)
  assert.deepEqual(copy.primitive.sampling, source.primitive.sampling)
  assert.equal(copy.primitive.boundarySources, undefined)
  assert.equal(copy.primitive.boundarySnapshotState, undefined)
  assert.deepEqual(diagram, before)
  assert.equal(findCoonsPatch(diagram, source.id), source)

  assert.notEqual(copy, source)
  assert.notEqual(copy.style, source.style)
  assert.notEqual(copy.primitive, source.primitive)
  assert.notEqual(copy.primitive.sampling, source.primitive.sampling)
  assertBoundaryDeepClone(source.primitive.bottom, copy.primitive.bottom)
  assertBoundaryDeepClone(source.primitive.right, copy.primitive.right)
  assertBoundaryDeepClone(source.primitive.top, copy.primitive.top)
  assertBoundaryDeepClone(source.primitive.left, copy.primitive.left)

  assertBoundaryTranslated(source.primitive.bottom, copy.primitive.bottom, delta)
  assertBoundaryTranslated(source.primitive.right, copy.primitive.right, delta)
  assertBoundaryTranslated(source.primitive.top, copy.primitive.top, delta)
  assertBoundaryTranslated(source.primitive.left, copy.primitive.left, delta)

  const sourceBottom = pathBoundary(source.primitive.bottom)
  const copyBottom = pathBoundary(copy.primitive.bottom)
  const sourceArc = sourceBottom.segments.find((segment) => segment.kind === 'arc')
  const copyArc = copyBottom.segments.find((segment) => segment.kind === 'arc')
  assert.notEqual(sourceArc, undefined)
  assert.notEqual(copyArc, undefined)
  if (sourceArc?.kind !== 'arc' || copyArc?.kind !== 'arc') {
    throw new Error('Expected the representative arc segment.')
  }
  assert.notEqual(copyArc.frame, sourceArc.frame)
  assertVec3Translated(sourceArc.frame?.origin, copyArc.frame?.origin, delta)
  assert.deepEqual(copyArc.frame?.u, sourceArc.frame?.u)
  assert.deepEqual(copyArc.frame?.v, sourceArc.frame?.v)
  assert.deepEqual(copyArc.frame?.normal, sourceArc.frame?.normal)
  assert.notEqual(copyArc.frame?.u, sourceArc.frame?.u)

  const cornerStatuses = coonsPatchCornerEquationStatusesFromBoundaries({
    bottom: copy.primitive.bottom,
    right: copy.primitive.right,
    top: copy.primitive.top,
    left: copy.primitive.left,
  })
  assert.equal(cornerStatuses.every((status) => status.matches), true)
  assert.equal(validateCurvedSheetPrimitive(copy.primitive).valid, true)

  const copyMesh = sampleCoonsPatch(copy.primitive)
  assert.equal(copyMesh.uSegments, sourceMesh.uSegments)
  assert.equal(copyMesh.vSegments, sourceMesh.vSegments)
  assert.deepEqual(copyMesh.faces, sourceMesh.faces)
  assert.equal(copyMesh.vertices.length, sourceMesh.vertices.length)
  sourceMesh.vertices.forEach((vertex, index) => {
    assertVec3Translated(vertex, copyMesh.vertices[index], delta, 1e-9)
  })

  const originalOpacity = source.style.fillOpacity
  const originalStartX = pathBoundary(source.primitive.bottom).segments[0]?.start.x
  copy.style.fillOpacity = 0.91
  const copiedFirst = pathBoundary(copy.primitive.bottom).segments[0]
  if (copiedFirst !== undefined) {
    copiedFirst.start.x += 10
  }
  assert.equal(source.style.fillOpacity, originalOpacity)
  assert.equal(
    pathBoundary(source.primitive.bottom).segments[0]?.start.x,
    originalStartX,
  )
})

test('linked duplication makes only the copy static and later source sync cannot move it', () => {
  const linked = createComplexPatchDiagram(true)
  const sourceBefore = findCoonsPatch(linked, 'patch')
  const linksBefore = structuredClone(sourceBefore.primitive.boundarySources)
  const result = duplicateAndTranslateCoonsPatch(
    linked,
    sourceBefore.id,
    numericTranslation(linked, point(0.5, 1, -0.25)),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  const original = findCoonsPatch(result.diagram, sourceBefore.id)
  const copy = findCoonsPatch(result.diagram, result.duplicatedPatchId)
  const frozenCopy = structuredClone(copy.primitive)

  assert.equal(original, sourceBefore)
  assert.deepEqual(original.primitive.boundarySources, linksBefore)
  assert.deepEqual(coonsPatchBoundaryLinkStatus(result.diagram, original.id), {
    kind: 'linkedUpToDate',
  })
  assert.deepEqual(coonsPatchBoundaryLinkStatus(result.diagram, copy.id), {
    kind: 'static',
  })

  const editedCandidate = {
    ...result.diagram,
    strata: result.diagram.strata.map((stratum) =>
      stratum.id === 'bottom'
        ? editBottomInteriorControl(stratum, 0.8)
        : stratum,
    ),
  }
  const synchronized = synchronizeLinkedCoonsPatches(
    result.diagram,
    editedCandidate,
  ).diagram

  assert.notDeepEqual(
    findCoonsPatch(synchronized, original.id).primitive.bottom,
    original.primitive.bottom,
  )
  assert.deepEqual(findCoonsPatch(synchronized, copy.id).primitive, frozenCopy)
  assert.deepEqual(coonsPatchBoundaryLinkStatus(synchronized, copy.id), {
    kind: 'static',
  })
})

test('stale linked duplication translates the exact frozen fallback and only the original recovers', () => {
  const linked = createComplexPatchDiagram(true)
  const bottomSource = findStratum(linked, 'bottom')
  const sourceMesh = sampleCoonsPatch(findCoonsPatch(linked, 'patch').primitive)
  const missingSourceCandidate = {
    ...linked,
    strata: linked.strata.filter((stratum) => stratum.id !== bottomSource.id),
  }
  const stale = synchronizeLinkedCoonsPatches(
    linked,
    missingSourceCandidate,
  ).diagram
  const stalePatch = findCoonsPatch(stale, 'patch')

  assert.equal(coonsPatchBoundaryLinkStatus(stale, stalePatch.id).kind, 'linkedStale')
  assert.equal(stalePatch.primitive.boundarySnapshotState, 'frozen')
  assert.deepEqual(sampleCoonsPatch(stalePatch.primitive), sourceMesh)

  const delta = point(-1, 0.25, 0.75)
  const duplicated = duplicateAndTranslateCoonsPatch(
    stale,
    stalePatch.id,
    numericTranslation(stale, delta),
  )
  assert.equal(duplicated.ok, true)
  if (!duplicated.ok) {
    throw new Error(duplicated.error)
  }
  const copy = findCoonsPatch(duplicated.diagram, duplicated.duplicatedPatchId)
  const copyBeforeRepair = structuredClone(copy.primitive)

  assert.equal(copy.primitive.boundarySources, undefined)
  assert.equal(copy.primitive.boundarySnapshotState, 'frozen')
  sourceMesh.vertices.forEach((vertex, index) => {
    assertVec3Translated(
      vertex,
      sampleCoonsPatch(copy.primitive).vertices[index],
      delta,
      1e-9,
    )
  })

  const repairedCandidate = {
    ...duplicated.diagram,
    strata: [bottomSource, ...duplicated.diagram.strata],
  }
  const repaired = synchronizeLinkedCoonsPatches(
    duplicated.diagram,
    repairedCandidate,
  ).diagram

  assert.deepEqual(coonsPatchBoundaryLinkStatus(repaired, 'patch'), {
    kind: 'linkedUpToDate',
  })
  assert.equal(
    findCoonsPatch(repaired, 'patch').primitive.boundarySnapshotState,
    undefined,
  )
  assert.deepEqual(
    findCoonsPatch(repaired, copy.id).primitive,
    copyBeforeRepair,
  )
})

test('frozen symbolic previews translate from stored values and survive save/load without drift', () => {
  const linked = createComplexPatchDiagram(true)
  const symbolic = withFrozenSymbolicBottomControl(linked, 0.2, 9)
  const frozenPatch = findCoonsPatch(symbolic, 'patch')
  const sourceControl = bottomCubicControl1(frozenPatch)

  assert.equal(sourceControl.z, 0.2)
  assert.equal(sourceControl.symbolic?.z.kind, 'symbolic')
  assert.equal(symbolic.variables?.[0]?.previewValue, 9)

  const parsedTranslation = parseTranslationVectorFromInputs(symbolic, {
    dx: '0',
    dy: '0',
    dz: '1',
  })
  assert.equal(parsedTranslation.ok, true)
  if (!parsedTranslation.ok) {
    throw new Error(parsedTranslation.error)
  }
  const result = duplicateAndTranslateCoonsPatch(
    symbolic,
    frozenPatch.id,
    parsedTranslation.translation,
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  const copy = findCoonsPatch(result.diagram, result.duplicatedPatchId)
  const translatedControl = bottomCubicControl1(copy)
  const translatedComponent = translatedControl.symbolic?.z

  assert.equal(copy.primitive.boundarySources, undefined)
  assert.equal(copy.primitive.boundarySnapshotState, 'frozen')
  assert.equal(translatedControl.z, 1.2)
  assert.equal(translatedComponent?.kind, 'symbolic')
  if (translatedComponent?.kind !== 'symbolic') {
    throw new Error('Expected translated symbolic frozen control.')
  }
  assert.equal(translatedComponent.expression, '(R) + 1')
  assert.equal(translatedComponent.previewValue, 1.2)

  const loaded = parseSavedDiagramJson(serializeDiagram(result.diagram))
  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }
  const loadedCopy = findCoonsPatch(loaded.diagram, copy.id)
  assert.equal(loadedCopy.primitive.boundarySources, undefined)
  assert.equal(loadedCopy.primitive.boundarySnapshotState, 'frozen')
  assert.deepEqual(bottomCubicControl1(loadedCopy), translatedControl)

  const fullySynchronized = synchronizeLinkedCoonsPatches(
    null,
    loaded.diagram,
    { mode: 'full' },
  ).diagram
  assert.deepEqual(findCoonsPatch(fullySynchronized, copy.id), loadedCopy)
})

test('frozen work-plane-local snapshots move stored previews and frame origins without changing local data', () => {
  const frame = standardFrame()
  const symbolicOrigin = symbolicVec3FromVec3(point(10, 20, 30))
  symbolicOrigin.x = {
    kind: 'symbolic',
    expression: 'R',
    previewValue: 10,
  }
  frame.origin = { x: 10, y: 20, z: 30, symbolic: symbolicOrigin }
  frame.u = point(1, 0, 0)
  frame.v = point(0, 0, 1)
  frame.normal = point(0, -1, 0)
  const source: WorkPlaneLocalCoordinateSource = {
    kind: 'workPlaneLocal',
    frame,
    local: {
      a: { kind: 'numeric', value: 2.26 },
      b: { kind: 'numeric', value: 0.74 },
    },
  }
  const storedPoint = workPlaneLocalPoint(point(12.26, 20, 30.74), source)
  const patch = createCurvedSheetStratum({
    id: 'frozen-local-patch',
    primitive: {
      kind: 'coonsPatch',
      bottom: constantSnapshot(storedPoint, 'stored-local'),
      right: constantSnapshot(storedPoint, 'stored-local'),
      top: constantSnapshot(storedPoint, 'stored-local'),
      left: constantSnapshot(storedPoint, 'stored-local'),
      boundarySnapshotState: 'frozen',
      sampling: { uSegments: 2, vSegments: 2 },
    },
  })
  const diagram: Diagram = {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    variables: [
      {
        id: 'variable-r',
        name: 'R',
        macroName: 'stzR',
        expression: '99',
        previewValue: 99,
      },
    ],
    strata: [patch],
  }
  assert.equal(validateDiagram(diagram).valid, true)
  const delta = point(1, -2, 3)
  const result = duplicateAndTranslateCoonsPatch(
    diagram,
    patch.id,
    numericTranslation(diagram, delta),
  )
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  const copy = findCoonsPatch(result.diagram, result.duplicatedPatchId)
  const movedPoint = constantBoundary(copy.primitive.bottom).point
  const movedSource = requireWorkPlaneLocalSource(movedPoint)

  assertVec3Translated(storedPoint, movedPoint, delta)
  assertVec3Translated(source.frame.origin, movedSource.frame.origin, delta)
  assert.deepEqual(movedSource.local, source.local)
  assert.deepEqual(movedSource.frame.u, source.frame.u)
  assert.deepEqual(movedSource.frame.v, source.frame.v)
  assert.deepEqual(movedSource.frame.normal, source.frame.normal)
  assert.equal(copy.primitive.boundarySnapshotState, 'frozen')

  const loaded = parseSavedDiagramJson(serializeDiagram(result.diagram))
  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }
  assert.deepEqual(
    constantBoundary(
      findCoonsPatch(loaded.diagram, copy.id).primitive.bottom,
    ).point,
    movedPoint,
  )
})

test('symbolic translation uses the shared grammar and invalid drafts fail atomically', () => {
  const base = createComplexPatchDiagram(false)
  const diagram: Diagram = {
    ...base,
    variables: [
      {
        id: 'variable-d',
        name: 'D',
        macroName: 'stzD',
        expression: '1.5',
        previewValue: 1.5,
      },
    ],
  }
  const parsed = parseTranslationVectorFromInputs(diagram, {
    dx: 'D',
    dy: '.5',
    dz: '-0.25',
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  const result = duplicateAndTranslateCoonsPatch(
    diagram,
    'patch',
    parsed.translation,
  )
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  const copyStart = pathBoundary(
    findCoonsPatch(result.diagram, result.duplicatedPatchId).primitive.bottom,
  ).segments[0]?.start
  assert.equal(copyStart?.x, 1.5)
  assert.equal(copyStart?.symbolic?.x.kind, 'symbolic')
  assert.equal(copyStart?.symbolic?.x.expression, 'D')
  assert.equal(copyStart?.symbolic?.x.previewValue, 1.5)

  let actionCalls = 0
  const fakeAction = () => {
    actionCalls += 1
    return {
      ok: true as const,
      duplicatedPatchId: 'copy',
      message: 'ok',
    }
  }

  for (const input of [
    { dx: '', dy: '0', dz: '0' },
    { dx: '.', dy: '0', dz: '0' },
    { dx: '-', dy: '0', dz: '0' },
    { dx: '1e', dy: '0', dz: '0' },
    { dx: 'Unknown', dy: '0', dz: '0' },
    { dx: '1 / 0', dy: '0', dz: '0' },
    { dx: 'NaN', dy: '0', dz: '0' },
    { dx: 'Infinity', dy: '0', dz: '0' },
    { dx: '0', dy: '0', dz: '0' },
  ]) {
    const submission = submitCoonsPatchDuplicateTranslation(
      diagram,
      'patch',
      input,
      fakeAction,
    )

    assert.equal(submission.ok, false, JSON.stringify(input))
  }
  assert.equal(actionCalls, 0)

  const decimalDraft = submitCoonsPatchDuplicateTranslation(
    diagram,
    'patch',
    { dx: '.5', dy: '0', dz: '0' },
    fakeAction,
  )
  assert.equal(decimalDraft.ok, true)
  assert.equal(actionCalls, 1)
})

test('global ID reservation is deterministic across every top-level namespace', () => {
  const base = createComplexPatchDiagram(true)
  const source = findCoonsPatch(base, 'patch')
  const dangling = structuredClone(source)
  dangling.id = 'reservation-patch'
  if (dangling.primitive.boundarySources === undefined) {
    throw new Error('Expected linked boundary sources.')
  }
  dangling.primitive.boundarySources.bottom = {
    kind: 'path',
    sourcePathId: 'patch-copy-3',
    reversed: false,
  }
  dangling.primitive.boundarySnapshotState = 'frozen'
  const collisionStratum = createPointStratum({
    ambientDimension: 3,
    id: 'patch-copy',
    position: point(20, 20, 20),
  })
  const collisionLabel = createTextLabel({
    ambientDimension: 3,
    id: 'patch-copy-1',
    text: 'reserved',
    position: point(0, 0, 0),
  })
  const collisionAnchor: CoordinateAnchor = {
    id: 'patch-copy-2',
    name: 'Reserved anchor',
    tikzName: 'reservedAnchor',
    position: {
      kind: 'global',
      value: symbolicVec3FromVec3(point(0, 0, 0)),
    },
  }
  const diagram: Diagram = {
    ...base,
    coordinateAnchors: [...(base.coordinateAnchors ?? []), collisionAnchor],
    strata: [...base.strata, collisionStratum, dangling],
    labels: [...base.labels, collisionLabel],
  }
  const translation = numericTranslation(diagram, point(1, 0, 0))
  const first = duplicateAndTranslateCoonsPatch(diagram, 'patch', translation)
  assert.equal(first.ok, true)
  if (!first.ok) {
    throw new Error(first.error)
  }
  assert.equal(first.duplicatedPatchId, 'patch-copy-4')

  const second = duplicateAndTranslateCoonsPatch(
    first.diagram,
    'patch',
    translation,
  )
  assert.equal(second.ok, true)
  if (!second.ok) {
    throw new Error(second.error)
  }
  assert.equal(second.duplicatedPatchId, 'patch-copy-5')
  assert.equal(new Set(second.diagram.strata.map((value) => value.id)).size, second.diagram.strata.length)
})

test('unsupported coordinate-reference snapshots fail without mutation', () => {
  const anchor: CoordinateAnchor = {
    id: 'anchor',
    name: 'Anchor',
    tikzName: 'anchor',
    position: {
      kind: 'global',
      value: symbolicVec3FromVec3(point(3, 4, 5)),
    },
  }
  const referencedPoint = coordinateReferenceVec3ForAnchor(anchor, 3)
  const patch = createCurvedSheetStratum({
    id: 'referenced-patch',
    primitive: {
      kind: 'coonsPatch',
      bottom: constantSnapshot(referencedPoint, 'anchor-point'),
      right: constantSnapshot(referencedPoint, 'anchor-point'),
      top: constantSnapshot(referencedPoint, 'anchor-point'),
      left: constantSnapshot(referencedPoint, 'anchor-point'),
      sampling: { uSegments: 2, vSegments: 2 },
    },
  })
  const diagram: Diagram = {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    coordinateAnchors: [anchor],
    strata: [patch],
  }
  assert.equal(validateDiagram(diagram).valid, false)
  const unsupported = duplicateAndTranslateCoonsPatch(
    diagram,
    patch.id,
    numericTranslation(diagram, point(1, 2, 3)),
  )
  assert.equal(unsupported.ok, false)
  assert.equal(unsupported.diagram, diagram)

  const missingAnchorDiagram: Diagram = { ...diagram, coordinateAnchors: [] }
  const failure = duplicateAndTranslateCoonsPatch(
    missingAnchorDiagram,
    patch.id,
    numericTranslation(missingAnchorDiagram, point(1, 0, 0)),
  )
  assert.equal(failure.ok, false)
  assert.equal(failure.diagram, missingAnchorDiagram)
})

test('production state transition selects the copy and commits exactly one undoable edit', () => {
  const diagram = createComplexPatchDiagram(true)
  const initial = createEditorState(diagram, { kind: 'stratum', id: 'patch' })
  const parsed = parseTranslationVectorFromInputs(diagram, {
    dx: '1',
    dy: '0',
    dz: '2',
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const submission = submitCoonsPatchDuplicateTranslation(
    diagram,
    'patch',
    { dx: '1', dy: '0', dz: '2' },
    (patchId, translation) => {
      const applied = applyDuplicateAndTranslateCoonsPatchToEditorState(
        initial,
        patchId,
        translation,
      )

      return applied.ok
        ? {
            ok: true,
            duplicatedPatchId: applied.duplicatedPatchId,
            message: applied.message,
          }
        : { ok: false, message: applied.message }
    },
  )
  assert.equal(submission.ok, true)

  const applied = applyDuplicateAndTranslateCoonsPatchToEditorState(
    initial,
    'patch',
    parsed.translation,
  )
  assert.equal(applied.ok, true)
  if (!applied.ok) {
    throw new Error(applied.message)
  }
  assert.deepEqual(applied.state.selectedElement, {
    kind: 'stratum',
    id: applied.duplicatedPatchId,
  })
  assert.equal(applied.state.history.past.length, 1)
  assert.equal(applied.state.history.future.length, 0)
  assert.match(
    applied.message,
    /Duplicated and translated Coons patch by \(1, 0, 2\)\./,
  )
  assert.equal(
    findCoonsPatch(applied.state.editableDiagram, applied.duplicatedPatchId)
      .primitive.boundarySources,
    undefined,
  )

  const geometry = structuredClone(
    findCoonsPatch(applied.state.editableDiagram, applied.duplicatedPatchId),
  )
  const undone = undoLastDiagramChange(applied.state)
  assert.equal(
    undone.editableDiagram.strata.some(
      (stratum) => stratum.id === applied.duplicatedPatchId,
    ),
    false,
  )
  assert.equal(undone.selectedElement, null)
  assert.equal(undone.history.future.length, 1)

  const redone = redoLastDiagramChange(undone)
  assert.deepEqual(
    findCoonsPatch(redone.editableDiagram, applied.duplicatedPatchId),
    geometry,
  )
  assert.equal(redone.selectedElement, null)
  const undoneAgain = undoLastDiagramChange(redone)
  const redoneAgain = redoLastDiagramChange(undoneAgain)
  assert.deepEqual(
    findCoonsPatch(redoneAgain.editableDiagram, applied.duplicatedPatchId),
    geometry,
  )
  assert.equal(
    redoneAgain.editableDiagram.strata.filter(
      (stratum) => stratum.id === applied.duplicatedPatchId,
    ).length,
    1,
  )

  const lockedDiagram = {
    ...diagram,
    layers: [{ value: 3, name: 'Locked patch layer', locked: true }],
  }
  const lockedState = createEditorState(lockedDiagram, {
    kind: 'stratum',
    id: 'patch',
  })
  const locked = applyDuplicateAndTranslateCoonsPatchToEditorState(
    lockedState,
    'patch',
    parsed.translation,
  )
  assert.equal(locked.ok, false)
  assert.equal(locked.state, lockedState)
  assert.equal(locked.state.history.past.length, 0)
})

test('save/load, Preview, SVG data, and TikZ use both static translated meshes', () => {
  const sourceDiagram = createComplexPatchDiagram(false)
  const delta = point(2, -1, 0.5)
  const result = duplicateAndTranslateCoonsPatch(
    sourceDiagram,
    'patch',
    numericTranslation(sourceDiagram, delta),
  )
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const loaded = parseSavedDiagramJson(serializeDiagram(result.diagram))
  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }
  const loadedCopy = findCoonsPatch(loaded.diagram, result.duplicatedPatchId)
  assert.equal(loadedCopy.primitive.boundarySources, undefined)

  const fullSync = synchronizeLinkedCoonsPatches(null, loaded.diagram, {
    mode: 'full',
  }).diagram
  assert.deepEqual(findCoonsPatch(fullSync, loadedCopy.id), loadedCopy)

  const preview = prepareSvgSurfaceGeometry(fullSync)
  const sourceVertices = preview.curvedSheetVerticesById.get('patch')
  const copiedVertices = preview.curvedSheetVerticesById.get(loadedCopy.id)
  assert.notEqual(sourceVertices, undefined)
  assert.notEqual(copiedVertices, undefined)
  sourceVertices?.forEach((vertex, index) => {
    assertVec3Translated(vertex, copiedVertices?.[index], delta, 1e-9)
  })

  const standalone = generateTikz(fullSync)
  assert.match(standalone, /Curved sheet "Phase 30 patch" \[patch\]/)
  assert.match(
    standalone,
    new RegExp(`Curved sheet "Phase 30 patch" \\[${loadedCopy.id}\\]`),
  )
  assert.equal((standalone.match(/Primitive: coonsPatch/g) ?? []).length, 2)

  const inline = generateTikz(fullSync, { exportMode: 'inlineMath' })
  assert.doesNotMatch(inline, /\n[ \t]*\n/)
  assert.equal((inline.match(/Primitive: coonsPatch/g) ?? []).length, 2)
  for (const line of inline.split('\n')) {
    const indentation = line.match(/^ */)?.[0].length ?? 0
    assert.equal(indentation % 4, 0, `Unexpected TikZ indentation: ${line}`)
  }
})

test('generic bulk duplicate keeps Phase 29 linked-copy semantics', () => {
  const linked = createComplexPatchDiagram(true)
  const patchOnly = duplicateSelectedElements(linked, {
    kind: 'stratum',
    id: 'patch',
  })
  const patchCopySelection = patchOnly.selectedElement
  assert.equal(patchCopySelection?.kind, 'stratum')
  if (patchCopySelection?.kind !== 'stratum') {
    throw new Error('Expected one bulk-duplicated patch selection.')
  }
  assert.deepEqual(
    findCoonsPatch(patchOnly.diagram, patchCopySelection.id).primitive
      .boundarySources,
    findCoonsPatch(linked, 'patch').primitive.boundarySources,
  )

  const withSources = duplicateSelectedElements(linked, {
    kind: 'multi',
    elements: ['bottom', 'right-corner', 'top', 'left', 'patch'].map((id) => ({
      kind: 'stratum' as const,
      id,
    })),
  })
  const selectedIds = selectedStratumIds(withSources.selectedElement)
  const copiedPatch = withSources.diagram.strata.find(
    (stratum) => selectedIds.has(stratum.id) && isCoonsPatchStratum(stratum),
  )
  assert.notEqual(copiedPatch, undefined)
  if (copiedPatch === undefined || !isCoonsPatchStratum(copiedPatch)) {
    throw new Error('Expected copied patch with copied sources.')
  }
  const sources = copiedPatch.primitive.boundarySources
  assert.notEqual(sources, undefined)
  assert.ok(sources?.bottom.kind === 'path' && selectedIds.has(sources.bottom.sourcePathId))
  assert.ok(sources?.right.kind === 'point' && selectedIds.has(sources.right.sourcePointId))
  assert.ok(sources?.top.kind === 'path' && selectedIds.has(sources.top.sourcePathId))
  assert.ok(sources?.left.kind === 'path' && selectedIds.has(sources.left.sourcePathId))
})

test('production Inspector renders the compact section only for one Coons patch', async () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'stratified-tikz-phase30-'))
  const server = await createServer({
    root: process.cwd(),
    appType: 'custom',
    cacheDir,
    logLevel: 'silent',
    server: { middlewareMode: true },
  })

  try {
    const loaded = (await server.ssrLoadModule(
      '/src/ui/inspector/EditableInspector.tsx',
    )) as { EditableInspector: ComponentType<Record<string, unknown>> }
    const svgModule = (await server.ssrLoadModule(
      '/src/rendering/SvgDiagram.tsx',
    )) as { SvgDiagram: ComponentType<Record<string, unknown>> }
    const diagram = createComplexPatchDiagram(false)
    const coonsMarkup = renderInspector(
      loaded.EditableInspector,
      diagram,
      { kind: 'stratum', id: 'patch' },
    )
    assert.match(coonsMarkup, /Duplicate &amp; translate/)
    assert.match(coonsMarkup, /aria-label="Coons patch translation dx"/)
    assert.match(coonsMarkup, /aria-label="Coons patch translation dy"/)
    assert.match(coonsMarkup, /aria-label="Coons patch translation dz"/)
    assert.match(coonsMarkup, /type="text"/)
    assert.doesNotMatch(coonsMarkup, /snap/i)

    const curveMarkup = renderInspector(
      loaded.EditableInspector,
      diagram,
      { kind: 'stratum', id: 'bottom' },
    )
    assert.doesNotMatch(curveMarkup, /Duplicate &amp; translate/)

    const pointMarkup = renderInspector(
      loaded.EditableInspector,
      diagram,
      { kind: 'stratum', id: 'right-corner' },
    )
    assert.doesNotMatch(pointMarkup, /Duplicate &amp; translate/)

    const multiMarkup = renderInspector(
      loaded.EditableInspector,
      diagram,
      {
        kind: 'multi',
        elements: [
          { kind: 'stratum', id: 'patch' },
          { kind: 'stratum', id: 'bottom' },
        ],
      },
    )
    assert.doesNotMatch(multiMarkup, /Duplicate &amp; translate/)

    const otherKinds = diagramWithOtherSheetKinds(diagram)
    for (const id of ['polygon', 'filled', 'ruled', 'hemisphere', 'saddle']) {
      assert.doesNotMatch(
        renderInspector(
          loaded.EditableInspector,
          otherKinds,
          { kind: 'stratum', id },
        ),
        /Duplicate &amp; translate/,
        id,
      )
    }

    const duplicated = duplicateAndTranslateCoonsPatch(
      diagram,
      'patch',
      numericTranslation(diagram, point(1, 0, 2)),
    )
    assert.equal(duplicated.ok, true)
    if (!duplicated.ok) {
      throw new Error(duplicated.error)
    }
    const svgMarkup = renderToStaticMarkup(
      createElement(svgModule.SvgDiagram, {
        diagram: duplicated.diagram,
        fitToView: true,
        showCoordinateAnchors: false,
      }),
    )
    assert.match(svgMarkup, /^<svg /)
    assert.equal(
      (svgMarkup.match(/data-curved-sheet-primitive="coonsPatch"/g) ?? [])
        .length,
      2,
    )
    assert.equal((svgMarkup.match(/<polygon /g) ?? []).length, 40)
  } finally {
    await server.close()
    rmSync(cacheDir, { recursive: true, force: true })
  }
})

function createComplexPatchDiagram(linked: boolean): Diagram {
  const base = createEmptyDiagram({ ambientDimension: 3 })
  const arc = createArcPathSegmentFromAngles({
    center: point(1.5, 0, 0),
    radius: 0.5,
    startAngleDeg: 180,
    endAngleDeg: 360,
    direction: 'counterclockwise',
    frame: {
      origin: point(9, 9, 0),
      u: point(1, 0, 0),
      v: point(0, 1, 0),
      normal: point(0, 0, 1),
    },
    ambientDimension: 3,
  })
  if (arc === null) {
    throw new Error('Could not build the representative arc.')
  }
  const bottom = concatenated('bottom', [
    { kind: 'line', start: point(0, 0, 0), end: point(0.5, 0, 0) },
    {
      kind: 'cubicBezier',
      start: point(0.5, 0, 0),
      control1: point(0.65, 0.25, 0.2),
      control2: point(0.85, -0.2, -0.1),
      end: point(1, 0, 0),
    },
    arc,
  ])
  const rightCorner = createPointStratum({
    ambientDimension: 3,
    id: 'right-corner',
    name: 'Right constant corner',
    style: defaultPointStyle,
    position: point(2, 0, 0),
    layer: 1,
  })
  const top = concatenated('top', [
    { kind: 'line', start: point(2, 0, 0), end: point(0, 2, 0) },
  ])
  const left = concatenated('left', [
    { kind: 'line', start: point(0, 0, 0), end: point(0, 2, 0) },
  ])
  const withSources: Diagram = {
    ...base,
    externalTikzStyleSources: [
      { id: 'external-styles', name: 'phase30.sty', loadHint: '\\input{phase30.sty}' },
    ],
    importedTikzStyleReferences: [
      {
        id: 'imported-sheet',
        key: 'phase30/sheet',
        sourceId: 'external-styles',
        displayName: 'Phase 30 sheet',
        targets: ['sheet', 'filldraw'],
        options: 'fill=cyan',
      },
    ],
    strata: [bottom, rightCorner, top, left],
  }
  const selections: CoonsPatchBoundaryPathSelections = {
    bottom: 'bottom',
    right: { kind: 'point', sourcePointId: 'right-corner' },
    top: { sourcePathId: 'top', reversed: true },
    left: 'left',
  }
  const created = createCoonsPatchFromBoundaryPaths(
    withSources,
    selections,
    {
      id: 'patch',
      name: 'Phase 30 patch',
      layer: 3,
      sampling: { uSegments: 5, vSegments: 4 },
      style: {
        kind: 'sheetStyle',
        fillColor: '#12ABCD',
        fillOpacity: 0.42,
        strokeColor: '#654321',
        strokeOpacity: 0.73,
      },
      keepLinkedToBoundarySources: linked,
    },
  )
  if (!created.ok) {
    throw new Error(`Could not create Phase 30 fixture: ${created.error}`)
  }

  return {
    ...created.diagram,
    strata: created.diagram.strata.map((stratum) =>
      stratum.id === created.id && isCoonsPatchStratum(stratum)
        ? {
            ...stratum,
            label: '$P$',
            importedTikzStyleReferenceId: 'imported-sheet',
          }
        : stratum,
    ),
  }
}

function withFrozenSymbolicBottomControl(
  linked: Diagram,
  storedPreview: number,
  currentVariablePreview: number,
): Diagram {
  const source = findStratum(linked, 'bottom')
  if (source.geometricKind !== 'curve' || source.kind !== 'concatenatedPath') {
    throw new Error('Expected concatenated bottom source.')
  }
  const symbolicSource = structuredClone(source)
  const cubic = symbolicSource.segments.find(
    (segment) => segment.kind === 'cubicBezier',
  )
  if (cubic?.kind !== 'cubicBezier') {
    throw new Error('Expected cubic bottom segment.')
  }
  const symbolicControl = symbolicVec3FromVec3(cubic.control1)
  symbolicControl.z = {
    kind: 'symbolic',
    expression: 'R',
    previewValue: storedPreview,
  }
  cubic.control1 = {
    ...cubic.control1,
    z: storedPreview,
    symbolic: symbolicControl,
  }

  const variableDiagram: Diagram = {
    ...linked,
    variables: [
      {
        id: 'variable-r',
        name: 'R',
        macroName: 'stzR',
        expression: String(storedPreview),
        previewValue: storedPreview,
      },
    ],
    strata: linked.strata.map((stratum) =>
      stratum.id === source.id ? symbolicSource : stratum,
    ),
  }
  const refreshed = synchronizeLinkedCoonsPatches(
    linked,
    variableDiagram,
  ).diagram
  const staleCandidate: Diagram = {
    ...refreshed,
    variables: [
      {
        id: 'variable-r',
        name: 'R',
        macroName: 'stzR',
        expression: String(currentVariablePreview),
        previewValue: currentVariablePreview,
      },
    ],
    strata: refreshed.strata.filter((stratum) => stratum.id !== source.id),
  }

  return synchronizeLinkedCoonsPatches(refreshed, staleCandidate).diagram
}

function diagramWithOtherSheetKinds(diagram: Diagram): Diagram {
  const frame = standardFrame()
  const polygon: Stratum = {
    id: 'polygon',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'polygonSheet',
    name: 'Polygon',
    style: { ...defaultSheetStyle },
    vertices: [point(0, 0, 0), point(1, 0, 0), point(0, 1, 0)],
    layer: 0,
  }
  const filled: Stratum = {
    id: 'filled',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'workPlaneFilledSheet',
    name: 'Filled',
    style: { ...defaultSheetStyle },
    planeFrame: frame,
    boundaries: [
      {
        id: 'filled-boundary',
        segments: [
          { kind: 'line', start: point(0, 0, 0), end: point(1, 0, 0) },
          { kind: 'line', start: point(1, 0, 0), end: point(0, 1, 0) },
          { kind: 'line', start: point(0, 1, 0), end: point(0, 0, 0) },
        ],
      },
    ],
    fillRule: 'nonzero',
    layer: 0,
  }
  const ruled = createCurvedSheetStratum({
    id: 'ruled',
    primitive: {
      kind: 'ruledSurface',
      boundary0: {
        segments: [
          { kind: 'line', start: point(0, 0, 0), end: point(1, 0, 0) },
        ],
      },
      boundary1: {
        segments: [
          { kind: 'line', start: point(0, 1, 0), end: point(1, 1, 0) },
        ],
      },
      sampling: { segments: 2 },
    },
  })
  const hemisphere = createCurvedSheetStratum({
    id: 'hemisphere',
    primitive: {
      kind: 'hemisphere',
      center: point(0, 0, 0),
      radius: 1,
      frame,
      hemisphereSide: 'positive',
      sampling: { uSegments: 2, vSegments: 2 },
    },
  })
  const saddle = createCurvedSheetStratum({
    id: 'saddle',
    primitive: {
      kind: 'saddle',
      frame,
      width: 1,
      depth: 1,
      height: 1,
      sampling: { uSegments: 2, vSegments: 2 },
    },
  })

  return {
    ...diagram,
    strata: [...diagram.strata, polygon, filled, ruled, hemisphere, saddle],
  }
}

function renderInspector(
  Inspector: ComponentType<Record<string, unknown>>,
  diagram: Diagram,
  selectedElement: SelectedElement,
): string {
  const noOp = () => undefined

  return renderToStaticMarkup(
    createElement(Inspector, {
      diagram,
      selectedElement,
      expanded: true,
      onExpandedChange: noOp,
      onDiagramChange: noOp,
      onBulkLayerChange: noOp,
      onBulkDelete: noOp,
      onBulkDuplicate: noOp,
      styleClipboardSummary: '',
      styleClipboardStatus: '',
      onCopyStyle: noOp,
      onPasteStyle: noOp,
      onBulkTranslate: noOp,
      onCoordinateTranslate: () => '',
      onBulkConcatenatePaths: () => '',
      onSplitPath: () => '',
      onStartPathSplitPick: () => '',
      onDuplicateAndTranslateCoonsPatch: () => ({
        ok: false,
        message: 'not invoked during SSR',
      }),
    }),
  )
}

function createEditorState(
  diagram: Diagram,
  selectedElement: SelectedElement,
): TestEditorState {
  return {
    editableDiagram: diagram,
    selectedElement,
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    layerOperationStatus: '',
    history: createDiagramHistory(diagram),
  }
}

function concatenated(
  id: string,
  segments: ConcatenatedPathStratum['segments'],
): ConcatenatedPathStratum {
  return {
    id,
    codim: 2,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    name: id,
    style: { ...defaultCurveStyle },
    styleSegments: [],
    segments,
    layer: 0,
  }
}

function constantSnapshot(
  value: Vec3,
  sourceId: string,
): Extract<CoonsBoundarySnapshot, { kind: 'constantPoint' }> {
  return {
    kind: 'constantPoint',
    sourceId,
    name: 'Constant point snapshot',
    point: value,
  }
}

function workPlaneLocalPoint(
  value: Vec3,
  source: WorkPlaneLocalCoordinateSource,
): Vec3 {
  return {
    ...value,
    symbolic: {
      x: { kind: 'numeric', value: value.x },
      y: { kind: 'numeric', value: value.y },
      z: { kind: 'numeric', value: value.z },
      source,
    },
  }
}

function requireWorkPlaneLocalSource(
  value: Vec3,
): WorkPlaneLocalCoordinateSource {
  const source = value.symbolic?.source
  if (source?.kind !== 'workPlaneLocal') {
    throw new Error('Expected work-plane-local coordinate source.')
  }
  return source
}

function numericTranslation(
  diagram: Diagram,
  value: Vec3,
): TranslationVector {
  return translationVectorFromNumericVec3(diagram, value, {
    reject2DNonZeroZ: true,
  })
}

function editBottomInteriorControl(stratum: Stratum, z: number): Stratum {
  if (stratum.geometricKind !== 'curve' || stratum.kind !== 'concatenatedPath') {
    throw new Error('Expected concatenated bottom source.')
  }

  return {
    ...stratum,
    segments: stratum.segments.map((segment) =>
      segment.kind === 'cubicBezier'
        ? {
            ...segment,
            control1: { ...segment.control1, z },
          }
        : segment,
    ),
  }
}

function findCoonsPatch(diagram: Diagram, id: string): CoonsPatchStratum {
  const stratum = findStratum(diagram, id)
  if (!isCoonsPatchStratum(stratum)) {
    throw new Error(`Expected Coons patch ${id}.`)
  }
  return stratum
}

function findStratum(diagram: Diagram, id: string): Stratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)
  if (stratum === undefined) {
    throw new Error(`Expected stratum ${id}.`)
  }
  return stratum
}

function pathBoundary(
  boundary: CoonsBoundarySnapshot,
): Exclude<CoonsBoundarySnapshot, { kind: 'constantPoint' }> {
  if ('kind' in boundary && boundary.kind === 'constantPoint') {
    throw new Error('Expected path boundary.')
  }
  return boundary
}

function constantBoundary(
  boundary: CoonsBoundarySnapshot,
): Extract<CoonsBoundarySnapshot, { kind: 'constantPoint' }> {
  if (!('kind' in boundary) || boundary.kind !== 'constantPoint') {
    throw new Error('Expected constant-point boundary.')
  }
  return boundary
}

function bottomCubicControl1(patch: CoonsPatchStratum): Vec3 {
  const cubic = pathBoundary(patch.primitive.bottom).segments.find(
    (segment) => segment.kind === 'cubicBezier',
  )
  if (cubic?.kind !== 'cubicBezier') {
    throw new Error('Expected cubic bottom boundary segment.')
  }
  return cubic.control1
}

function assertBoundaryDeepClone(
  source: CoonsBoundarySnapshot,
  copy: CoonsBoundarySnapshot,
): void {
  assert.notEqual(copy, source)
  if ('kind' in source && source.kind === 'constantPoint') {
    assert.ok('kind' in copy && copy.kind === 'constantPoint')
    if ('kind' in copy && copy.kind === 'constantPoint') {
      assert.notEqual(copy.point, source.point)
    }
    return
  }
  const copiedPath = pathBoundary(copy)
  assert.notEqual(copiedPath.segments, source.segments)
  source.segments.forEach((segment, index) => {
    const copiedSegment = copiedPath.segments[index]
    assert.notEqual(copiedSegment, segment)
    if (copiedSegment === undefined) {
      throw new Error('Expected copied segment.')
    }
    assert.notEqual(copiedSegment.start, segment.start)
    assert.notEqual(copiedSegment.end, segment.end)
    if (segment.kind === 'cubicBezier' && copiedSegment.kind === 'cubicBezier') {
      assert.notEqual(copiedSegment.control1, segment.control1)
      assert.notEqual(copiedSegment.control2, segment.control2)
    }
    if (segment.kind === 'arc' && copiedSegment.kind === 'arc') {
      assert.notEqual(copiedSegment.center, segment.center)
      assert.notEqual(copiedSegment.frame, segment.frame)
      assert.notEqual(copiedSegment.frame?.origin, segment.frame?.origin)
    }
  })
}

function assertBoundaryTranslated(
  source: CoonsBoundarySnapshot,
  copy: CoonsBoundarySnapshot,
  delta: Vec3,
): void {
  if ('kind' in source && source.kind === 'constantPoint') {
    assert.ok('kind' in copy && copy.kind === 'constantPoint')
    if ('kind' in copy && copy.kind === 'constantPoint') {
      assertVec3Translated(source.point, copy.point, delta)
    }
    return
  }
  const copiedPath = pathBoundary(copy)
  source.segments.forEach((segment, index) => {
    const copiedSegment = copiedPath.segments[index]
    if (copiedSegment === undefined || copiedSegment.kind !== segment.kind) {
      throw new Error('Expected matching copied path segment.')
    }
    assertVec3Translated(segment.start, copiedSegment.start, delta)
    assertVec3Translated(segment.end, copiedSegment.end, delta)
    if (segment.kind === 'cubicBezier' && copiedSegment.kind === 'cubicBezier') {
      assertVec3Translated(segment.control1, copiedSegment.control1, delta)
      assertVec3Translated(segment.control2, copiedSegment.control2, delta)
    }
    if (segment.kind === 'arc' && copiedSegment.kind === 'arc') {
      assertVec3Translated(segment.center, copiedSegment.center, delta)
      assertVec3Translated(segment.frame?.origin, copiedSegment.frame?.origin, delta)
    }
  })
}

function assertVec3Translated(
  source: Vec3 | undefined,
  copy: Vec3 | undefined,
  delta: Vec3,
  epsilon = 1e-12,
): void {
  assert.notEqual(source, undefined)
  assert.notEqual(copy, undefined)
  if (source === undefined || copy === undefined) {
    throw new Error('Expected both coordinates.')
  }
  assert.ok(Math.abs(copy.x - (source.x + delta.x)) <= epsilon)
  assert.ok(Math.abs(copy.y - (source.y + delta.y)) <= epsilon)
  assert.ok(Math.abs(copy.z - (source.z + delta.z)) <= epsilon)
}

function selectedStratumIds(selection: SelectedElement): Set<string> {
  if (selection === null) {
    return new Set()
  }
  if (selection.kind === 'multi') {
    return new Set(
      selection.elements.flatMap((element) =>
        element.kind === 'stratum' ? [element.id] : [],
      ),
    )
  }
  return selection.kind === 'stratum' ? new Set([selection.id]) : new Set()
}

function standardFrame(): WorkPlaneFrameSnapshot {
  return {
    origin: point(0, 0, 0),
    u: point(1, 0, 0),
    v: point(0, 1, 0),
    normal: point(0, 0, 1),
  }
}

function point(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}
