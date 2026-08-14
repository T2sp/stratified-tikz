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
import { defaultVisibilityOptions } from '../../src/model/visibility.ts'
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
import {
  createArcPathSegmentFromAngles,
  sampleTemplatePathPoints,
} from '../../src/model/paths.ts'
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
  Diagram,
  Stratum,
  Vec2,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinateSource,
} from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { prepareSvgSurfaceGeometry } from '../../src/rendering/svgSurfaceScene.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { duplicateSelectedElements } from '../../src/ui/bulkEditing.ts'
import {
  applyDuplicateCoonsPatchToEditorState,
  applyTranslateCoonsPatchToEditorState,
  duplicateCoonsPatch,
  isCoonsPatchStratum,
  submitCoonsPatchTranslation,
  translateCoonsPatch,
  type CoonsPatchTranslationInput,
  type CoonsPatchStratum,
  type DuplicateCoonsPatchActionResult,
  type TranslateCoonsPatchActionResult,
} from '../../src/ui/coonsPatchDuplicateTranslation.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import {
  createCoonsPatchFromBoundaryPaths,
  type CoonsPatchBoundaryPathSelections,
} from '../../src/ui/ruledSurface.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  prepareSvgPreviewExportClone,
  type SvgPreviewExportAttributeLike,
  type SvgPreviewExportCloneSourceLike,
  type SvgPreviewExportElementLike,
} from '../../src/ui/svgPreviewExport.ts'
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

type CoonsPatchActionsControlsHarnessProps = {
  diagram: Diagram
  patch: CoonsPatchStratum
  onDuplicate: (patchId: string) => DuplicateCoonsPatchActionResult
  onTranslate: (
    patchId: string,
    translation: TranslationVector,
  ) => TranslateCoonsPatchActionResult
  input: CoonsPatchTranslationInput
  statusState: CoonsPatchActionStatusState
  onInputChange: (
    field: keyof CoonsPatchTranslationInput,
    value: string,
  ) => void
  onStatusStateChange: (
    status: CoonsPatchActionStatusState,
  ) => void
}

type CoonsPatchActionStatusState = {
  patchId: string
  message: string
}

type CoonsPatchActionsControlsHarnessComponent = (
  props: CoonsPatchActionsControlsHarnessProps,
) => unknown

type ProductionReactElement = {
  type: unknown
  props: Record<string, unknown>
}

type SvgCamera3D = Extract<Diagram['camera'], { mode: '3d' }>

test('separate model operations have exact eligibility and atomic failures', () => {
  const diagram = createComplexPatchDiagram(false)
  const patch = findCoonsPatch(diagram, 'patch')
  const delta = numericTranslation(diagram, point(1, 2, 3))

  assert.equal(isCoonsPatchStratum(patch), true)
  for (const stratum of diagram.strata.filter((value) => value.id !== patch.id)) {
    assert.equal(isCoonsPatchStratum(stratum), false, stratum.id)
    const duplicate = duplicateCoonsPatch(diagram, stratum.id)
    assert.equal(duplicate.ok, false)
    assert.equal(duplicate.diagram, diagram)
    const translate = translateCoonsPatch(diagram, stratum.id, delta)
    assert.equal(translate.ok, false)
    assert.equal(translate.diagram, diagram)
  }

  assert.equal(duplicateCoonsPatch(diagram, 'missing-patch').ok, false)
  assert.equal(translateCoonsPatch(diagram, 'missing-patch', delta).ok, false)

  const zero = translateCoonsPatch(
    diagram,
    patch.id,
    numericTranslation(diagram, point(0, 0, 0)),
  )
  assert.equal(zero.ok, false)
  assert.equal(zero.diagram, diagram)
  assert.equal(zero.error, 'Enter a non-zero translation.')

  const nonFinite = translateCoonsPatch(diagram, patch.id, {
    x: { kind: 'numeric', value: Number.POSITIVE_INFINITY },
    y: { kind: 'numeric', value: 0 },
    z: { kind: 'numeric', value: 0 },
  })
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
    duplicateCoonsPatch(malformedDiagram, malformedPatch.id),
  )
  assert.doesNotThrow(() =>
    translateCoonsPatch(malformedDiagram, malformedPatch.id, delta),
  )
  assert.equal(
    duplicateCoonsPatch(malformedDiagram, malformedPatch.id).ok,
    false,
  )
  assert.equal(
    translateCoonsPatch(malformedDiagram, malformedPatch.id, delta).ok,
    false,
  )
})

test('static Duplicate is untranslated and deeply independent; Translate replaces the same ID and covers all boundaries', () => {
  const diagram = createComplexPatchDiagram(false)
  const diagramBefore = structuredClone(diagram)
  const source = findCoonsPatch(diagram, 'patch')
  const sourceMesh = sampleCoonsPatch(source.primitive)
  const duplicated = duplicateCoonsPatch(diagram, source.id)

  assert.equal(duplicated.ok, true)
  if (!duplicated.ok) {
    throw new Error(duplicated.error)
  }

  const copy = findCoonsPatch(duplicated.diagram, duplicated.duplicatedPatchId)
  assert.equal(copy.id, 'patch-copy')
  assert.equal(copy.name, source.name)
  assert.equal(copy.codim, 1)
  assert.equal(copy.geometricKind, 'sheet')
  assert.equal(copy.kind, 'curvedSheet')
  assert.equal(copy.primitive.kind, 'coonsPatch')
  assert.equal(copy.layer, source.layer)
  assert.equal(copy.label, source.label)
  assert.equal(
    copy.importedTikzStyleReferenceId,
    source.importedTikzStyleReferenceId,
  )
  assert.deepEqual(copy.style, source.style)
  assert.deepEqual(copy.primitive, source.primitive)
  assert.deepEqual(sampleCoonsPatch(copy.primitive), sourceMesh)
  assert.deepEqual(diagram, diagramBefore)
  assert.equal(duplicated.diagram.strata.length, diagram.strata.length + 1)
  assert.equal(findCoonsPatch(duplicated.diagram, source.id), source)

  assert.notEqual(copy, source)
  assert.notEqual(copy.style, source.style)
  assert.notEqual(copy.primitive, source.primitive)
  assert.notEqual(copy.primitive.sampling, source.primitive.sampling)
  assertBoundaryDeepClone(source.primitive.bottom, copy.primitive.bottom)
  assertBoundaryDeepClone(source.primitive.right, copy.primitive.right)
  assertBoundaryDeepClone(source.primitive.top, copy.primitive.top)
  assertBoundaryDeepClone(source.primitive.left, copy.primitive.left)

  const delta = point(1.25, -0.5, 2)
  const beforeTranslate = structuredClone(duplicated.diagram)
  const translated = translateCoonsPatch(
    duplicated.diagram,
    copy.id,
    numericTranslation(duplicated.diagram, delta),
  )
  assert.equal(translated.ok, true)
  if (!translated.ok) {
    throw new Error(translated.error)
  }

  assert.equal(translated.patchId, copy.id)
  assert.equal(translated.diagram.strata.length, duplicated.diagram.strata.length)
  assert.deepEqual(
    translated.diagram.strata.map((stratum) => stratum.id),
    duplicated.diagram.strata.map((stratum) => stratum.id),
  )
  assertOtherStrataAndAnchorsUnchanged(
    duplicated.diagram,
    translated.diagram,
    copy.id,
  )

  const moved = findCoonsPatch(translated.diagram, copy.id)
  assert.equal(moved.primitive.boundarySources, undefined)
  assertBoundaryTranslated(copy.primitive.bottom, moved.primitive.bottom, delta)
  assertBoundaryTranslated(copy.primitive.right, moved.primitive.right, delta)
  assertBoundaryTranslated(copy.primitive.top, moved.primitive.top, delta)
  assertBoundaryTranslated(copy.primitive.left, moved.primitive.left, delta)

  const sourceBottom = pathBoundary(copy.primitive.bottom)
  const movedBottom = pathBoundary(moved.primitive.bottom)
  const sourceArc = sourceBottom.segments.find(
    (segment) => segment.kind === 'arc',
  )
  const movedArc = movedBottom.segments.find(
    (segment) => segment.kind === 'arc',
  )
  if (sourceArc?.kind !== 'arc' || movedArc?.kind !== 'arc') {
    throw new Error('Expected the representative arc segment.')
  }
  assertVec3Translated(sourceArc.frame?.origin, movedArc.frame?.origin, delta)
  assert.deepEqual(movedArc.frame?.u, sourceArc.frame?.u)
  assert.deepEqual(movedArc.frame?.v, sourceArc.frame?.v)
  assert.deepEqual(movedArc.frame?.normal, sourceArc.frame?.normal)
  assert.notEqual(movedArc.frame?.u, sourceArc.frame?.u)

  const cornerStatuses = coonsPatchCornerEquationStatusesFromBoundaries({
    bottom: moved.primitive.bottom,
    right: moved.primitive.right,
    top: moved.primitive.top,
    left: moved.primitive.left,
  })
  assert.equal(cornerStatuses.every((status) => status.matches), true)
  assert.equal(validateCurvedSheetPrimitive(moved.primitive).valid, true)

  const movedMesh = sampleCoonsPatch(moved.primitive)
  assert.equal(movedMesh.uSegments, sourceMesh.uSegments)
  assert.equal(movedMesh.vSegments, sourceMesh.vSegments)
  assert.deepEqual(movedMesh.faces, sourceMesh.faces)
  sourceMesh.vertices.forEach((vertex, index) => {
    assertVec3Translated(vertex, movedMesh.vertices[index], delta, 1e-9)
  })

  moved.style.fillOpacity = 0.91
  const movedFirst = pathBoundary(moved.primitive.bottom).segments[0]
  if (movedFirst !== undefined) {
    movedFirst.start.x += 10
  }
  assert.deepEqual(duplicated.diagram, beforeTranslate)
  assert.equal(copy.style.fillOpacity, source.style.fillOpacity)
  assert.deepEqual(copy.primitive, source.primitive)
})

test('healthy linked Duplicate retains links and Translate detaches only the same-ID target before synchronization', () => {
  const linked = createComplexPatchDiagram(true)
  const source = findCoonsPatch(linked, 'patch')
  const linksBefore = structuredClone(source.primitive.boundarySources)
  const duplicated = duplicateCoonsPatch(linked, source.id)

  assert.equal(duplicated.ok, true)
  if (!duplicated.ok) {
    throw new Error(duplicated.error)
  }
  const original = findCoonsPatch(duplicated.diagram, source.id)
  const copy = findCoonsPatch(duplicated.diagram, duplicated.duplicatedPatchId)

  assert.deepEqual(original, source)
  assert.deepEqual(copy.primitive, source.primitive)
  assert.deepEqual(copy.primitive.boundarySources, linksBefore)
  assert.notEqual(copy.primitive.boundarySources, source.primitive.boundarySources)
  assertBoundaryDeepClone(source.primitive.bottom, copy.primitive.bottom)
  assert.deepEqual(coonsPatchBoundaryLinkStatus(duplicated.diagram, original.id), {
    kind: 'linkedUpToDate',
  })
  assert.deepEqual(coonsPatchBoundaryLinkStatus(duplicated.diagram, copy.id), {
    kind: 'linkedUpToDate',
  })

  const editedCandidate = {
    ...duplicated.diagram,
    strata: duplicated.diagram.strata.map((stratum) =>
      stratum.id === 'bottom'
        ? editBottomInteriorControl(stratum, 0.8)
        : stratum,
    ),
  }
  const synchronized = synchronizeLinkedCoonsPatches(
    duplicated.diagram,
    editedCandidate,
  ).diagram
  assert.notDeepEqual(
    findCoonsPatch(synchronized, original.id).primitive.bottom,
    original.primitive.bottom,
  )
  assert.deepEqual(
    findCoonsPatch(synchronized, original.id).primitive.bottom,
    findCoonsPatch(synchronized, copy.id).primitive.bottom,
  )

  const copyBefore = findCoonsPatch(synchronized, copy.id)
  const delta = point(0.5, 1, -0.25)
  const translated = translateCoonsPatch(
    synchronized,
    copy.id,
    numericTranslation(synchronized, delta),
  )
  assert.equal(translated.ok, true)
  if (!translated.ok) {
    throw new Error(translated.error)
  }
  const moved = findCoonsPatch(translated.diagram, copy.id)
  const staticPrimitive = structuredClone(moved.primitive)

  assert.equal(moved.id, copy.id)
  assert.equal(moved.primitive.boundarySources, undefined)
  assert.deepEqual(coonsPatchBoundaryLinkStatus(translated.diagram, moved.id), {
    kind: 'static',
  })
  assertBoundaryTranslated(
    copyBefore.primitive.bottom,
    moved.primitive.bottom,
    delta,
  )
  assertOtherStrataAndAnchorsUnchanged(synchronized, translated.diagram, copy.id)

  const changedSource = synchronizeLinkedCoonsPatches(translated.diagram, {
    ...translated.diagram,
    strata: translated.diagram.strata.map((stratum) =>
      stratum.id === 'bottom'
        ? editBottomInteriorControl(stratum, 1.4)
        : stratum,
    ),
  }).diagram
  assert.deepEqual(findCoonsPatch(changedSource, moved.id).primitive, staticPrimitive)

  const bottomSource = findStratum(changedSource, 'bottom')
  const deleted = synchronizeLinkedCoonsPatches(changedSource, {
    ...changedSource,
    strata: changedSource.strata.filter((stratum) => stratum.id !== 'bottom'),
  }).diagram
  assert.deepEqual(findCoonsPatch(deleted, moved.id).primitive, staticPrimitive)

  const repaired = synchronizeLinkedCoonsPatches(deleted, {
    ...deleted,
    strata: [bottomSource, ...deleted.strata],
  }).diagram
  const fullSync = synchronizeLinkedCoonsPatches(null, repaired, {
    mode: 'full',
  }).diagram
  assert.deepEqual(findCoonsPatch(fullSync, moved.id).primitive, staticPrimitive)

  const loaded = parseSavedDiagramJson(serializeDiagram(fullSync))
  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }
  assert.deepEqual(
    findCoonsPatch(loaded.diagram, moved.id).primitive,
    staticPrimitive,
  )
})

test('stale linked Duplicate preserves exact frozen links and Translate moves the frozen fallback', () => {
  const linked = createComplexPatchDiagram(true)
  const bottomSource = findStratum(linked, 'bottom')
  const sourceMesh = sampleCoonsPatch(findCoonsPatch(linked, 'patch').primitive)
  const stale = synchronizeLinkedCoonsPatches(linked, {
    ...linked,
    strata: linked.strata.filter((stratum) => stratum.id !== bottomSource.id),
  }).diagram
  const stalePatch = findCoonsPatch(stale, 'patch')
  const frozenBefore = structuredClone(stalePatch.primitive)

  assert.equal(coonsPatchBoundaryLinkStatus(stale, stalePatch.id).kind, 'linkedStale')
  assert.equal(stalePatch.primitive.boundarySnapshotState, 'frozen')
  assert.deepEqual(sampleCoonsPatch(stalePatch.primitive), sourceMesh)

  const duplicated = duplicateCoonsPatch(stale, stalePatch.id)
  assert.equal(duplicated.ok, true)
  if (!duplicated.ok) {
    throw new Error(duplicated.error)
  }
  const copy = findCoonsPatch(duplicated.diagram, duplicated.duplicatedPatchId)
  assert.deepEqual(findCoonsPatch(duplicated.diagram, stalePatch.id).primitive, frozenBefore)
  assert.deepEqual(copy.primitive, frozenBefore)
  assert.notEqual(copy.primitive, stalePatch.primitive)
  assert.notEqual(copy.primitive.boundarySources, stalePatch.primitive.boundarySources)
  assert.equal(copy.primitive.boundarySnapshotState, 'frozen')
  assert.equal(coonsPatchBoundaryLinkStatus(duplicated.diagram, copy.id).kind, 'linkedStale')

  const delta = point(-1, 0.25, 0.75)
  const translated = translateCoonsPatch(
    duplicated.diagram,
    copy.id,
    numericTranslation(duplicated.diagram, delta),
  )
  assert.equal(translated.ok, true)
  if (!translated.ok) {
    throw new Error(translated.error)
  }
  const moved = findCoonsPatch(translated.diagram, copy.id)
  const movedBeforeRepair = structuredClone(moved.primitive)

  assert.equal(moved.primitive.boundarySources, undefined)
  assert.equal(moved.primitive.boundarySnapshotState, 'frozen')
  sourceMesh.vertices.forEach((vertex, index) => {
    assertVec3Translated(
      vertex,
      sampleCoonsPatch(moved.primitive).vertices[index],
      delta,
      1e-9,
    )
  })

  const repaired = synchronizeLinkedCoonsPatches(translated.diagram, {
    ...translated.diagram,
    strata: [bottomSource, ...translated.diagram.strata],
  }).diagram
  assert.deepEqual(coonsPatchBoundaryLinkStatus(repaired, stalePatch.id), {
    kind: 'linkedUpToDate',
  })
  assert.deepEqual(findCoonsPatch(repaired, moved.id).primitive, movedBeforeRepair)
})

test('frozen symbolic and work-plane-local Translate preserve stored previews and frame policy', () => {
  const linked = createComplexPatchDiagram(true)
  const symbolic = withFrozenSymbolicBottomControl(linked, 0.2, 9)
  const frozenPatch = findCoonsPatch(symbolic, 'patch')
  const sourceControl = bottomCubicControl1(frozenPatch)
  assert.equal(sourceControl.z, 0.2)
  assert.equal(sourceControl.symbolic?.z.kind, 'symbolic')
  assert.equal(symbolic.variables?.[0]?.previewValue, 9)

  const parsed = parseTranslationVectorFromInputs(symbolic, {
    dx: '0',
    dy: '0',
    dz: '1',
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  const translated = translateCoonsPatch(symbolic, frozenPatch.id, parsed.translation)
  assert.equal(translated.ok, true)
  if (!translated.ok) {
    throw new Error(translated.error)
  }
  const moved = findCoonsPatch(translated.diagram, frozenPatch.id)
  const translatedControl = bottomCubicControl1(moved)
  const translatedComponent = translatedControl.symbolic?.z
  assert.equal(moved.primitive.boundarySources, undefined)
  assert.equal(moved.primitive.boundarySnapshotState, 'frozen')
  assert.equal(translatedControl.z, 1.2)
  assert.equal(translatedComponent?.kind, 'symbolic')
  if (translatedComponent?.kind !== 'symbolic') {
    throw new Error('Expected translated symbolic frozen control.')
  }
  assert.equal(translatedComponent.expression, '(R) + 1')
  assert.equal(translatedComponent.previewValue, 1.2)

  const loaded = parseSavedDiagramJson(serializeDiagram(translated.diagram))
  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }
  assert.deepEqual(
    bottomCubicControl1(findCoonsPatch(loaded.diagram, moved.id)),
    translatedControl,
  )

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
  const localPatch = createCurvedSheetStratum({
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
  const localDiagram: Diagram = {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    variables: [{
      id: 'variable-r',
      name: 'R',
      macroName: 'stzR',
      expression: '99',
      previewValue: 99,
    }],
    strata: [localPatch],
  }
  const delta = point(1, -2, 3)
  const localTranslated = translateCoonsPatch(
    localDiagram,
    localPatch.id,
    numericTranslation(localDiagram, delta),
  )
  assert.equal(localTranslated.ok, true)
  if (!localTranslated.ok) {
    throw new Error(localTranslated.error)
  }
  const movedPoint = constantBoundary(
    findCoonsPatch(localTranslated.diagram, localPatch.id).primitive.bottom,
  ).point
  const movedSource = requireWorkPlaneLocalSource(movedPoint)
  assertVec3Translated(storedPoint, movedPoint, delta)
  assertVec3Translated(source.frame.origin, movedSource.frame.origin, delta)
  assert.deepEqual(movedSource.local, source.local)
  assert.deepEqual(movedSource.frame.u, source.frame.u)
  assert.deepEqual(movedSource.frame.v, source.frame.v)
  assert.deepEqual(movedSource.frame.normal, source.frame.normal)
})

test('Translate moves materialized sampled-template snapshot segments once without changing topology', () => {
  const sampledPoints = sampleTemplatePathPoints(
    {
      kind: 'ellipseTemplate',
      center: point(0, 0, 0),
      radiusX: 2,
      radiusY: 1,
      rotationDeg: 17,
      frame: standardFrame(),
    },
    3,
    8,
  ).slice(0, 3)
  const liftedPoints = sampledPoints.map((value) => ({
    ...value,
    z: value.z + 2,
  }))
  const sampledSegments = sampledPoints.slice(0, -1).map((start, index) => ({
    kind: 'line' as const,
    start,
    end: sampledPoints[index + 1] ?? start,
  }))
  const liftedSegments = liftedPoints.slice(0, -1).map((start, index) => ({
    kind: 'line' as const,
    start,
    end: liftedPoints[index + 1] ?? start,
  }))
  const patch = createCurvedSheetStratum({
    id: 'sampled-template-patch',
    primitive: {
      kind: 'coonsPatch',
      bottom: {
        id: 'materialized-ellipse-template',
        name: 'Sampled ellipse template snapshot',
        segments: sampledSegments,
      },
      right: {
        segments: [{
          kind: 'line',
          start: sampledPoints[2] ?? point(0, 0, 0),
          end: liftedPoints[2] ?? point(0, 0, 2),
        }],
      },
      top: {
        segments: liftedSegments,
      },
      left: {
        segments: [{
          kind: 'line',
          start: sampledPoints[0] ?? point(0, 0, 0),
          end: liftedPoints[0] ?? point(0, 0, 2),
        }],
      },
      sampling: { uSegments: 6, vSegments: 5 },
    },
  })
  const diagram: Diagram = {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    strata: [patch],
  }
  assert.equal(validateDiagram(diagram).valid, true)

  const delta = point(-0.75, 1.5, 0.25)
  const translated = translateCoonsPatch(
    diagram,
    patch.id,
    numericTranslation(diagram, delta),
  )
  assert.equal(translated.ok, true)
  if (!translated.ok) {
    throw new Error(translated.error)
  }
  const moved = findCoonsPatch(translated.diagram, patch.id)
  assert.deepEqual(moved.primitive.sampling, patch.primitive.sampling)
  assert.deepEqual(
    pathBoundary(moved.primitive.bottom).segments.map((segment) => segment.kind),
    sampledSegments.map((segment) => segment.kind),
  )
  assertBoundaryTranslated(
    patch.primitive.bottom,
    moved.primitive.bottom,
    delta,
  )
  assertBoundaryTranslated(
    patch.primitive.right,
    moved.primitive.right,
    delta,
  )
  assertBoundaryTranslated(patch.primitive.top, moved.primitive.top, delta)
  assertBoundaryTranslated(patch.primitive.left, moved.primitive.left, delta)
})

test('Translate uses the shared symbolic parser and invalid or zero drafts never invoke mutation', () => {
  const base = createComplexPatchDiagram(false)
  const diagram: Diagram = {
    ...base,
    variables: [{
      id: 'variable-d',
      name: 'D',
      macroName: 'stzD',
      expression: '1.5',
      previewValue: 1.5,
    }],
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
  const result = translateCoonsPatch(diagram, 'patch', parsed.translation)
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  const movedStart = pathBoundary(
    findCoonsPatch(result.diagram, 'patch').primitive.bottom,
  ).segments[0]?.start
  assert.equal(movedStart?.x, 1.5)
  assert.equal(movedStart?.symbolic?.x.kind, 'symbolic')
  assert.equal(movedStart?.symbolic?.x.expression, 'D')
  assert.equal(movedStart?.symbolic?.x.previewValue, 1.5)

  let actionCalls = 0
  const fakeAction = (
    patchId: string,
    translation: TranslationVector,
  ): TranslateCoonsPatchActionResult => {
    actionCalls += 1
    assert.equal(patchId, 'patch')
    assert.ok(translation.x !== undefined)
    return { ok: true, patchId, message: 'ok' }
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
    { dx: '0', dy: '-0', dz: '0.0' },
  ]) {
    const submission = submitCoonsPatchTranslation(
      diagram,
      'patch',
      input,
      fakeAction,
    )
    assert.equal(submission.ok, false, JSON.stringify(input))
  }
  assert.equal(actionCalls, 0)

  const decimalDraft = submitCoonsPatchTranslation(
    diagram,
    'patch',
    { dx: '.5', dy: '0', dz: '0' },
    fakeAction,
  )
  assert.equal(decimalDraft.ok, true)
  assert.equal(actionCalls, 1)
})

test('Duplicate reserves global IDs and repeated Duplicate never translates prior copies', () => {
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

  const first = duplicateCoonsPatch(diagram, 'patch')
  assert.equal(first.ok, true)
  if (!first.ok) {
    throw new Error(first.error)
  }
  assert.equal(first.duplicatedPatchId, 'patch-copy-4')
  assert.deepEqual(
    findCoonsPatch(first.diagram, first.duplicatedPatchId).primitive,
    source.primitive,
  )

  const firstCopyBefore = structuredClone(
    findCoonsPatch(first.diagram, first.duplicatedPatchId),
  )
  const second = duplicateCoonsPatch(first.diagram, 'patch')
  assert.equal(second.ok, true)
  if (!second.ok) {
    throw new Error(second.error)
  }
  assert.equal(second.duplicatedPatchId, 'patch-copy-5')
  assert.deepEqual(
    findCoonsPatch(second.diagram, first.duplicatedPatchId),
    firstCopyBefore,
  )
  assert.deepEqual(
    findCoonsPatch(second.diagram, second.duplicatedPatchId).primitive,
    source.primitive,
  )
  assert.equal(
    new Set(second.diagram.strata.map((value) => value.id)).size,
    second.diagram.strata.length,
  )
})

test('Translate detaches resolvable coordinate references and rejects missing anchors atomically', () => {
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

  const duplicateFailure = duplicateCoonsPatch(diagram, patch.id)
  assert.equal(duplicateFailure.ok, false)
  assert.equal(duplicateFailure.diagram, diagram)

  const translated = translateCoonsPatch(
    diagram,
    patch.id,
    numericTranslation(diagram, point(1, 2, 3)),
  )
  assert.equal(translated.ok, true)
  if (!translated.ok) {
    throw new Error(translated.error)
  }
  assert.deepEqual(diagram.coordinateAnchors, [anchor])
  assert.equal(findCoonsPatch(diagram, patch.id), patch)
  assert.deepEqual(translated.diagram.coordinateAnchors, [anchor])
  const movedPoint = constantBoundary(
    findCoonsPatch(translated.diagram, patch.id).primitive.bottom,
  ).point
  assert.equal(movedPoint.symbolic?.source, undefined)
  assertVec3Translated(referencedPoint, movedPoint, point(1, 2, 3))

  const missingAnchorDiagram: Diagram = { ...diagram, coordinateAnchors: [] }
  const missingAnchor = translateCoonsPatch(
    missingAnchorDiagram,
    patch.id,
    numericTranslation(missingAnchorDiagram, point(1, 0, 0)),
  )
  assert.equal(missingAnchor.ok, false)
  assert.equal(missingAnchor.diagram, missingAnchorDiagram)
})

test('editor actions create separate history entries with exact two-step Undo and Redo ordering', () => {
  const diagram = createComplexPatchDiagram(true)
  const h0 = createEditorState(diagram, { kind: 'stratum', id: 'patch' })
  const duplicate = applyDuplicateCoonsPatchToEditorState(h0, 'patch')

  assert.equal(duplicate.ok, true)
  if (!duplicate.ok) {
    throw new Error(duplicate.message)
  }
  const copyId = duplicate.duplicatedPatchId
  const h1 = duplicate.state
  const unshiftedCopy = structuredClone(findCoonsPatch(h1.editableDiagram, copyId))

  assert.deepEqual(h1.selectedElement, { kind: 'stratum', id: copyId })
  assert.equal(h1.history.past.length, 1)
  assert.equal(h1.history.future.length, 0)
  assert.notEqual(unshiftedCopy.primitive.boundarySources, undefined)
  assert.deepEqual(
    unshiftedCopy.primitive,
    findCoonsPatch(h1.editableDiagram, 'patch').primitive,
  )

  const delta = point(1, 0, 2)
  const translate = applyTranslateCoonsPatchToEditorState(
    h1,
    copyId,
    numericTranslation(h1.editableDiagram, delta),
  )
  assert.equal(translate.ok, true)
  if (!translate.ok) {
    throw new Error(translate.message)
  }
  const h2 = translate.state
  const translatedCopy = structuredClone(findCoonsPatch(h2.editableDiagram, copyId))

  assert.equal(translate.patchId, copyId)
  assert.deepEqual(h2.selectedElement, { kind: 'stratum', id: copyId })
  assert.equal(h2.editableDiagram.strata.length, h1.editableDiagram.strata.length)
  assert.equal(h2.history.past.length, 2)
  assert.equal(translatedCopy.primitive.boundarySources, undefined)
  assertBoundaryTranslated(
    unshiftedCopy.primitive.bottom,
    translatedCopy.primitive.bottom,
    delta,
  )

  const undoTranslate = undoLastDiagramChange(h2)
  assert.deepEqual(
    findCoonsPatch(undoTranslate.editableDiagram, copyId),
    unshiftedCopy,
  )
  assert.deepEqual(undoTranslate.selectedElement, {
    kind: 'stratum',
    id: copyId,
  })
  assert.equal(undoTranslate.history.past.length, 1)
  assert.equal(undoTranslate.history.future.length, 1)

  const undoDuplicate = undoLastDiagramChange(undoTranslate)
  assert.deepEqual(undoDuplicate.editableDiagram, diagram)
  assert.equal(
    undoDuplicate.editableDiagram.strata.some(
      (stratum) => stratum.id === copyId,
    ),
    false,
  )
  assert.equal(undoDuplicate.selectedElement, null)
  assert.equal(undoDuplicate.history.past.length, 0)
  assert.equal(undoDuplicate.history.future.length, 2)

  const redoDuplicate = redoLastDiagramChange(undoDuplicate)
  assert.deepEqual(
    findCoonsPatch(redoDuplicate.editableDiagram, copyId),
    unshiftedCopy,
  )
  assert.equal(redoDuplicate.selectedElement, null)

  const redoTranslate = redoLastDiagramChange(redoDuplicate)
  assert.deepEqual(
    findCoonsPatch(redoTranslate.editableDiagram, copyId),
    translatedCopy,
  )
  assert.equal(redoTranslate.selectedElement, null)
  assert.equal(
    redoTranslate.editableDiagram.strata.filter(
      (stratum) => stratum.id === copyId,
    ).length,
    1,
  )

  const redoTwiceAgain = redoLastDiagramChange(
    redoLastDiagramChange(
      undoLastDiagramChange(undoLastDiagramChange(redoTranslate)),
    ),
  )
  assert.deepEqual(
    findCoonsPatch(redoTwiceAgain.editableDiagram, copyId),
    translatedCopy,
  )
})

test('direct static, healthy-linked, and stale-linked Translate Undo restores the exact same-ID pre-state', () => {
  const linked = createComplexPatchDiagram(true)
  const stale = synchronizeLinkedCoonsPatches(linked, {
    ...linked,
    strata: linked.strata.filter((stratum) => stratum.id !== 'bottom'),
  }).diagram

  for (const [label, diagram] of [
    ['static', createComplexPatchDiagram(false)],
    ['healthy linked', linked],
    ['stale linked', stale],
  ] as const) {
    const beforePatch = structuredClone(findCoonsPatch(diagram, 'patch'))
    const initial = createEditorState(diagram, {
      kind: 'stratum',
      id: 'patch',
    })
    const applied = applyTranslateCoonsPatchToEditorState(
      initial,
      'patch',
      numericTranslation(diagram, point(0.5, -0.25, 1.5)),
    )

    assert.equal(applied.ok, true, label)
    if (!applied.ok) {
      throw new Error(applied.message)
    }
    assert.equal(applied.patchId, 'patch')
    assert.equal(applied.state.editableDiagram.strata.length, diagram.strata.length)
    assert.deepEqual(applied.state.selectedElement, {
      kind: 'stratum',
      id: 'patch',
    })
    assert.equal(applied.state.history.past.length, 1)
    assert.equal(
      findCoonsPatch(applied.state.editableDiagram, 'patch').primitive
        .boundarySources,
      undefined,
    )

    const undone = undoLastDiagramChange(applied.state)
    assert.deepEqual(findCoonsPatch(undone.editableDiagram, 'patch'), beforePatch)
    assert.deepEqual(undone.selectedElement, {
      kind: 'stratum',
      id: 'patch',
    })

    const redone = redoLastDiagramChange(undone)
    assert.deepEqual(
      findCoonsPatch(redone.editableDiagram, 'patch'),
      findCoonsPatch(applied.state.editableDiagram, 'patch'),
    )
  }
})

test('resolvable-but-stale Duplicate remains frozen and linked through the production editor commit', () => {
  const linked = createComplexPatchDiagram(true)
  const stale = structuredClone(linked)
  const stalePatch = findCoonsPatch(stale, 'patch')
  const staleBottom = pathBoundary(stalePatch.primitive.bottom)
  const cubic = staleBottom.segments.find(
    (segment) => segment.kind === 'cubicBezier',
  )
  if (cubic?.kind !== 'cubicBezier') {
    throw new Error('Expected the stale probe cubic boundary segment.')
  }
  cubic.control1.z = 7.25
  stalePatch.primitive.boundarySnapshotState = 'frozen'

  assert.equal(validateDiagram(stale).valid, true)
  assert.equal(stalePatch.primitive.boundarySnapshotState, 'frozen')
  assert.equal(coonsPatchBoundaryLinkStatus(stale, stalePatch.id).kind, 'linkedStale')

  const initial = createEditorState(stale, {
    kind: 'stratum',
    id: stalePatch.id,
  })
  const applied = applyDuplicateCoonsPatchToEditorState(initial, stalePatch.id)
  assert.equal(applied.ok, true)
  if (!applied.ok) {
    throw new Error(applied.message)
  }
  const original = findCoonsPatch(applied.state.editableDiagram, stalePatch.id)
  const copy = findCoonsPatch(
    applied.state.editableDiagram,
    applied.duplicatedPatchId,
  )
  assert.deepEqual(original.primitive, stalePatch.primitive)
  assert.deepEqual(copy.primitive, stalePatch.primitive)
  assert.notEqual(copy.primitive, stalePatch.primitive)
  assert.notEqual(copy.primitive.boundarySources, stalePatch.primitive.boundarySources)
  assert.equal(copy.primitive.boundarySnapshotState, 'frozen')
  assert.notEqual(copy.primitive.boundarySources, undefined)
  assert.equal(
    coonsPatchBoundaryLinkStatus(applied.state.editableDiagram, copy.id).kind,
    'linkedStale',
  )
  assert.equal(applied.state.history.past.length, 1)
})

function assertOtherStrataAndAnchorsUnchanged(
  before: Diagram,
  after: Diagram,
  excludedStratumId: string,
): void {
  assert.deepEqual(
    after.strata.filter((stratum) => stratum.id !== excludedStratumId),
    before.strata.filter((stratum) => stratum.id !== excludedStratumId),
  )
  assert.deepEqual(after.coordinateAnchors, before.coordinateAnchors)
  assert.deepEqual(after.labels, before.labels)
}

test('repeated Duplicate allocates per click while repeated Translate keeps one ID and applies one delta', () => {
  const diagram = createComplexPatchDiagram(false)
  let duplicateState = createEditorState(diagram, {
    kind: 'stratum',
    id: 'patch',
  })
  const copyIds: string[] = []

  for (let index = 0; index < 3; index += 1) {
    const selectedId =
      duplicateState.selectedElement?.kind === 'stratum'
        ? duplicateState.selectedElement.id
        : 'patch'
    const applied = applyDuplicateCoonsPatchToEditorState(
      duplicateState,
      selectedId,
    )
    assert.equal(applied.ok, true)
    if (!applied.ok) {
      throw new Error(applied.message)
    }
    copyIds.push(applied.duplicatedPatchId)
    duplicateState = applied.state
  }
  assert.equal(new Set(copyIds).size, 3)
  assert.equal(duplicateState.history.past.length, 3)
  assert.equal(duplicateState.editableDiagram.strata.length, diagram.strata.length + 3)
  for (const copyId of copyIds) {
    assert.deepEqual(
      sampleCoonsPatch(findCoonsPatch(duplicateState.editableDiagram, copyId).primitive),
      sampleCoonsPatch(findCoonsPatch(diagram, 'patch').primitive),
    )
  }

  let translateState = createEditorState(diagram, {
    kind: 'stratum',
    id: 'patch',
  })
  const initialMesh = sampleCoonsPatch(findCoonsPatch(diagram, 'patch').primitive)
  const delta = point(0.25, -0.5, 0.75)

  for (let index = 1; index <= 3; index += 1) {
    const applied = applyTranslateCoonsPatchToEditorState(
      translateState,
      'patch',
      numericTranslation(translateState.editableDiagram, delta),
    )
    assert.equal(applied.ok, true)
    if (!applied.ok) {
      throw new Error(applied.message)
    }
    translateState = applied.state
    assert.equal(translateState.editableDiagram.strata.length, diagram.strata.length)
    assert.deepEqual(translateState.selectedElement, {
      kind: 'stratum',
      id: 'patch',
    })
    const mesh = sampleCoonsPatch(
      findCoonsPatch(translateState.editableDiagram, 'patch').primitive,
    )
    initialMesh.vertices.forEach((vertex, vertexIndex) => {
      assertVec3Translated(
        vertex,
        mesh.vertices[vertexIndex],
        point(delta.x * index, delta.y * index, delta.z * index),
        1e-9,
      )
    })
  }
  assert.equal(translateState.history.past.length, 3)
  assert.deepEqual(
    translateState.editableDiagram.strata.map((stratum) => stratum.id),
    diagram.strata.map((stratum) => stratum.id),
  )
})

test('editor transitions reject stale, mismatched, multi, hidden, locked, and filtered selections atomically', () => {
  const diagram = createComplexPatchDiagram(false)
  const rejectionStates: TestEditorState[] = [
    createEditorState(diagram, null),
    createEditorState(diagram, { kind: 'stratum', id: 'missing' }),
    createEditorState(diagram, { kind: 'stratum', id: 'bottom' }),
    createEditorState(diagram, {
      kind: 'multi',
      elements: [
        { kind: 'stratum', id: 'patch' },
        { kind: 'stratum', id: 'bottom' },
      ],
    }),
    {
      ...createEditorState(diagram, { kind: 'stratum', id: 'patch' }),
      layerFilter: { kind: 'layer', layer: 0 },
    },
  ]

  const hiddenDiagram: Diagram = {
    ...diagram,
    layers: [{ value: 3, name: 'Hidden patch layer', visible: false }],
  }
  rejectionStates.push(
    createEditorState(hiddenDiagram, { kind: 'stratum', id: 'patch' }),
  )
  const lockedDiagram: Diagram = {
    ...diagram,
    layers: [{ value: 3, name: 'Locked patch layer', locked: true }],
  }
  rejectionStates.push(
    createEditorState(lockedDiagram, { kind: 'stratum', id: 'patch' }),
  )

  for (const state of rejectionStates) {
    const delta = numericTranslation(state.editableDiagram, point(1, 0, 0))
    const duplicate = applyDuplicateCoonsPatchToEditorState(state, 'patch')
    assert.equal(duplicate.ok, false)
    assert.equal(duplicate.state, state)
    assert.equal(duplicate.state.history, state.history)

    const translate = applyTranslateCoonsPatchToEditorState(
      state,
      'patch',
      delta,
    )
    assert.equal(translate.ok, false)
    assert.equal(translate.state, state)
    assert.equal(translate.state.history, state.history)
  }
})

test('generic Phase 29 patch-only and patch-plus-source duplication remain unchanged', () => {
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
  assert.ok(
    sources?.bottom.kind === 'path' &&
      selectedIds.has(sources.bottom.sourcePathId),
  )
  assert.ok(
    sources?.right.kind === 'point' &&
      selectedIds.has(sources.right.sourcePointId),
  )
  assert.ok(
    sources?.top.kind === 'path' &&
      selectedIds.has(sources.top.sourcePathId),
  )
  assert.ok(
    sources?.left.kind === 'path' &&
      selectedIds.has(sources.left.sourcePathId),
  )
})

test('production controls invoke isolated Duplicate click and Translate submit paths with exact arguments', async () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'stratified-tikz-phase30-controls-'))
  const server = await createServer({
    root: process.cwd(),
    appType: 'custom',
    cacheDir,
    logLevel: 'silent',
    server: { middlewareMode: true },
  })

  try {
    const controlsModule = (await server.ssrLoadModule(
      '/src/ui/inspector/CoonsPatchDuplicateTranslateEditor.tsx',
    )) as {
      CoonsPatchActionsControls: CoonsPatchActionsControlsHarnessComponent
    }

    for (const input of [
      { dx: '1e', dy: '-2.5', dz: '3.75' },
      { dx: '0', dy: '-0', dz: '0.0' },
    ]) {
      const diagram = createComplexPatchDiagram(true)
      const patch = findCoonsPatch(diagram, 'patch')
      let current = createEditorState(diagram, {
        kind: 'stratum',
        id: patch.id,
      })
      const duplicateArguments: unknown[][] = []
      let translateCalls = 0
      const harness = createProductionCoonsPatchActionsHarness(
        controlsModule.CoonsPatchActionsControls,
        diagram,
        patch,
        (...args: [string]) => {
          duplicateArguments.push(args)
          const applied = applyDuplicateCoonsPatchToEditorState(current, args[0])
          if (!applied.ok) {
            return { ok: false, message: applied.message }
          }
          current = applied.state
          return {
            ok: true,
            duplicatedPatchId: applied.duplicatedPatchId,
            message: applied.message,
          }
        },
        () => {
          translateCalls += 1
          return { ok: false, message: 'Translate must not run.' }
        },
      )
      harness.change('dx', input.dx)
      harness.change('dy', input.dy)
      harness.change('dz', input.dz)
      assert.equal(harness.duplicateButtonProps().type, 'button')
      assert.notEqual(harness.duplicateButtonProps().disabled, true)
      harness.clickDuplicate()

      assert.deepEqual(duplicateArguments, [[patch.id]])
      assert.equal(translateCalls, 0)
      assert.equal(current.history.past.length, 1)
      assert.equal(current.editableDiagram.strata.length, diagram.strata.length + 1)
      const selection = current.selectedElement
      assert.equal(selection?.kind, 'stratum')
      if (selection?.kind !== 'stratum') {
        throw new Error('Expected the production Duplicate to select its copy.')
      }
      const copy = findCoonsPatch(current.editableDiagram, selection.id)
      assert.deepEqual(copy.primitive, patch.primitive)
      assert.deepEqual(sampleCoonsPatch(copy.primitive), sampleCoonsPatch(patch.primitive))
      assert.deepEqual(harness.status(), {
        patchId: patch.id,
        message: 'Duplicated Coons patch.',
      })
      harness.setTarget(current.editableDiagram, copy)
      assert.doesNotMatch(harness.visibleStatusText(), /Duplicated Coons patch/)

      assert.equal(harness.submit(), 1)
      assert.equal(translateCalls, 0)
      assert.equal(current.history.past.length, 1)
      assert.deepEqual(findCoonsPatch(current.editableDiagram, copy.id), copy)
    }

    const diagram = createComplexPatchDiagram(true)
    const patch = findCoonsPatch(diagram, 'patch')
    let current = createEditorState(diagram, {
      kind: 'stratum',
      id: patch.id,
    })
    let duplicateCalls = 0
    const translateArguments: Array<[string, TranslationVector]> = []
    const harness = createProductionCoonsPatchActionsHarness(
      controlsModule.CoonsPatchActionsControls,
      diagram,
      patch,
      () => {
        duplicateCalls += 1
        return { ok: false, message: 'Duplicate must not run.' }
      },
      (patchId, translation) => {
        translateArguments.push([patchId, translation])
        const candidate = translateCoonsPatch(
          current.editableDiagram,
          patchId,
          translation,
        )
        assert.equal(candidate.ok, true)
        if (!candidate.ok) {
          return { ok: false, message: candidate.error }
        }
        assert.equal(
          findCoonsPatch(candidate.diagram, patchId).primitive.boundarySources,
          undefined,
        )
        const applied = applyTranslateCoonsPatchToEditorState(
          current,
          patchId,
          translation,
        )
        if (!applied.ok) {
          return { ok: false, message: applied.message }
        }
        current = applied.state
        return {
          ok: true,
          patchId: applied.patchId,
          message: applied.message,
        }
      },
    )
    harness.change('dx', '1.25')
    harness.change('dy', '-2.5')
    harness.change('dz', '3.75')
    assert.equal(harness.submit(), 1)

    assert.equal(duplicateCalls, 0)
    assert.equal(translateArguments.length, 1)
    assert.equal(translateArguments[0]?.[0], patch.id)
    assert.deepEqual(translateArguments[0]?.[1], {
      x: { kind: 'numeric', value: 1.25 },
      y: { kind: 'numeric', value: -2.5 },
      z: { kind: 'numeric', value: 3.75 },
    })
    assert.equal(current.editableDiagram.strata.length, diagram.strata.length)
    assert.deepEqual(current.selectedElement, {
      kind: 'stratum',
      id: patch.id,
    })
    assert.equal(current.history.past.length, 1)
    assert.equal(
      findCoonsPatch(current.editableDiagram, patch.id).primitive.boundarySources,
      undefined,
    )

    assertProductionTranslateFormNoOp(
      controlsModule.CoonsPatchActionsControls,
      { dx: '1e', dy: '-2.5', dz: '3.75' },
      /^dx:/,
    )
    assertProductionTranslateFormNoOp(
      controlsModule.CoonsPatchActionsControls,
      { dx: '0', dy: '-0', dz: '0.0' },
      /^Enter a non-zero translation\.$/,
    )
  } finally {
    await server.close()
    rmSync(cacheDir, { recursive: true, force: true })
  }
})

function assertProductionTranslateFormNoOp(
  Controls: CoonsPatchActionsControlsHarnessComponent,
  input: CoonsPatchTranslationInput,
  expectedMessage: RegExp,
): void {
  const diagram = createComplexPatchDiagram(true)
  const patch = findCoonsPatch(diagram, 'patch')
  const initial = createEditorState(diagram, {
    kind: 'stratum',
    id: patch.id,
  })
  let current = initial
  let duplicateCalls = 0
  let translateCalls = 0
  const harness = createProductionCoonsPatchActionsHarness(
    Controls,
    diagram,
    patch,
    () => {
      duplicateCalls += 1
      return { ok: false, message: 'Duplicate must not run.' }
    },
    (patchId, translation) => {
      translateCalls += 1
      const applied = applyTranslateCoonsPatchToEditorState(
        current,
        patchId,
        translation,
      )
      if (!applied.ok) {
        return { ok: false, message: applied.message }
      }
      current = applied.state
      return {
        ok: true,
        patchId: applied.patchId,
        message: applied.message,
      }
    },
  )

  harness.change('dx', input.dx)
  harness.change('dy', input.dy)
  harness.change('dz', input.dz)
  assert.equal(harness.submit(), 1)
  assert.equal(duplicateCalls, 0)
  assert.equal(translateCalls, 0)
  assert.equal(current, initial)
  assert.equal(current.editableDiagram, diagram)
  assert.deepEqual(current.selectedElement, initial.selectedElement)
  assert.equal(current.history, initial.history)
  assert.equal(current.history.past.length, 0)
  assert.equal(current.history.future.length, 0)
  assert.notEqual(
    findCoonsPatch(current.editableDiagram, patch.id).primitive.boundarySources,
    undefined,
  )
  assert.match(harness.status().message, expectedMessage)
}

function createProductionCoonsPatchActionsHarness(
  Controls: CoonsPatchActionsControlsHarnessComponent,
  initialDiagram: Diagram,
  initialPatch: CoonsPatchStratum,
  duplicateAction: CoonsPatchActionsControlsHarnessProps['onDuplicate'],
  translateAction: CoonsPatchActionsControlsHarnessProps['onTranslate'],
) {
  let diagram = initialDiagram
  let patch = initialPatch
  let input: CoonsPatchTranslationInput = {
    dx: '0',
    dy: '0',
    dz: '0',
  }
  let statusState: CoonsPatchActionStatusState = {
    patchId: '',
    message: '',
  }

  function render(): unknown {
    return Controls({
      diagram,
      patch,
      onDuplicate: duplicateAction,
      onTranslate: translateAction,
      input,
      statusState,
      onInputChange: (field, value) => {
        input = { ...input, [field]: value }
        statusState = { patchId: '', message: '' }
      },
      onStatusStateChange: (status) => {
        statusState = status
      },
    })
  }

  function findOne(
    predicate: (element: ProductionReactElement) => boolean,
    description: string,
  ): ProductionReactElement {
    const matching = productionNativeElements(render()).filter(predicate)
    assert.equal(matching.length, 1, 'Expected one production ' + description + '.')
    const element = matching[0]
    if (element === undefined) {
      throw new Error('Expected production ' + description + '.')
    }
    return element
  }

  return {
    setTarget(nextDiagram: Diagram, nextPatch: CoonsPatchStratum): void {
      diagram = nextDiagram
      patch = nextPatch
    },
    change(field: keyof CoonsPatchTranslationInput, value: string): void {
      const label = 'Coons patch translation ' + field
      const element = findOne(
        (candidate) =>
          candidate.type === 'input' &&
          candidate.props['aria-label'] === label,
        'input ' + label,
      )
      const onChange = element.props.onChange
      assert.equal(typeof onChange, 'function')
      if (typeof onChange !== 'function') {
        throw new Error('Expected an onChange handler for ' + label + '.')
      }
      ;(onChange as (event: { currentTarget: { value: string } }) => void)({
        currentTarget: { value },
      })
      assert.equal(input[field], value)
    },
    duplicateButtonProps(): Record<string, unknown> {
      return findOne(
        (candidate) =>
          candidate.type === 'button' &&
          candidate.props['aria-label'] === 'Duplicate selected Coons patch',
        'Duplicate button',
      ).props
    },
    clickDuplicate(): void {
      const onClick = this.duplicateButtonProps().onClick
      assert.equal(typeof onClick, 'function')
      if (typeof onClick !== 'function') {
        throw new Error('Expected the production Duplicate onClick handler.')
      }
      ;(onClick as () => void)()
    },
    submit(): number {
      const form = findOne(
        (candidate) => candidate.type === 'form',
        'Translate form',
      )
      const onSubmit = form.props.onSubmit
      assert.equal(typeof onSubmit, 'function')
      if (typeof onSubmit !== 'function') {
        throw new Error('Expected the production Translate onSubmit handler.')
      }
      let preventDefaultCount = 0
      ;(onSubmit as (event: { preventDefault: () => void }) => void)({
        preventDefault: () => {
          preventDefaultCount += 1
        },
      })
      return preventDefaultCount
    },
    status(): CoonsPatchActionStatusState {
      return statusState
    },
    visibleStatusText(): string {
      const status = productionNativeElements(render()).find(
        (element) => element.props.role === 'status',
      )
      return typeof status?.props.children === 'string'
        ? status.props.children
        : ''
    },
  }
}

function productionNativeElements(node: unknown): ProductionReactElement[] {
  const elements: ProductionReactElement[] = []

  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!isProductionReactElement(value)) {
      return
    }
    if (typeof value.type === 'function') {
      const Component = value.type as (
        props: Record<string, unknown>,
      ) => unknown
      visit(Component(value.props))
      return
    }
    elements.push(value)
    visit(value.props.children)
  }

  visit(node)
  return elements
}

function isProductionReactElement(
  value: unknown,
): value is ProductionReactElement {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'props' in value &&
    typeof value.props === 'object' &&
    value.props !== null
  )
}

test('production Inspector exposes separate controls only for one editable selected Coons patch', async () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'stratified-tikz-phase30-inspector-'))
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
    )) as {
      EditableInspector: ComponentType<Record<string, unknown>>
    }
    const diagram = createComplexPatchDiagram(false)
    const coonsMarkup = renderInspector(
      loaded.EditableInspector,
      diagram,
      { kind: 'stratum', id: 'patch' },
    )
    assert.match(coonsMarkup, /Coons patch actions/)
    assert.match(coonsMarkup, /aria-label="Duplicate selected Coons patch"/)
    assert.match(coonsMarkup, /aria-label="Translate selected Coons patch"/)
    assert.match(coonsMarkup, /aria-label="Coons patch translation dx"/)
    assert.match(coonsMarkup, /aria-label="Coons patch translation dy"/)
    assert.match(coonsMarkup, /aria-label="Coons patch translation dz"/)
    assert.match(coonsMarkup, /Translating a linked patch detaches only that patch/)
    assert.doesNotMatch(coonsMarkup, /Duplicate &amp; translate/i)
    assert.doesNotMatch(coonsMarkup, /snap/i)

    for (const selection of [
      null,
      { kind: 'stratum', id: 'missing' },
      { kind: 'stratum', id: 'bottom' },
      { kind: 'stratum', id: 'right-corner' },
      {
        kind: 'multi',
        elements: [
          { kind: 'stratum', id: 'patch' },
          { kind: 'stratum', id: 'bottom' },
        ],
      },
    ] satisfies SelectedElement[]) {
      assertNoCoonsPatchActions(
        renderInspector(loaded.EditableInspector, diagram, selection),
      )
    }

    const label = createTextLabel({
      ambientDimension: 3,
      id: 'free-label',
      text: '$L$',
      position: point(1, 1, 1),
    })
    const anchor: CoordinateAnchor = {
      id: 'coordinate-anchor',
      name: 'Anchor',
      tikzName: 'anchor',
      position: {
        kind: 'global',
        value: symbolicVec3FromVec3(point(1, 1, 1)),
      },
    }
    const withNonStrata: Diagram = {
      ...diagram,
      labels: [...diagram.labels, label],
      coordinateAnchors: [...(diagram.coordinateAnchors ?? []), anchor],
    }
    assertNoCoonsPatchActions(
      renderInspector(loaded.EditableInspector, withNonStrata, {
        kind: 'label',
        id: label.id,
      }),
    )
    assertNoCoonsPatchActions(
      renderInspector(loaded.EditableInspector, withNonStrata, {
        kind: 'coordinate',
        id: anchor.id,
      }),
    )

    const otherKinds = diagramWithOtherSheetKinds(diagram)
    for (const id of ['polygon', 'filled', 'ruled', 'hemisphere', 'saddle']) {
      assertNoCoonsPatchActions(
        renderInspector(
          loaded.EditableInspector,
          otherKinds,
          { kind: 'stratum', id },
        ),
        id,
      )
    }

    const hiddenDiagram: Diagram = {
      ...diagram,
      layers: [{ value: 3, name: 'Hidden', visible: false }],
    }
    assertNoCoonsPatchActions(
      renderInspector(
        loaded.EditableInspector,
        hiddenDiagram,
        { kind: 'stratum', id: 'patch' },
      ),
      'hidden',
    )
    const lockedDiagram: Diagram = {
      ...diagram,
      layers: [{ value: 3, name: 'Locked', locked: true }],
    }
    assertNoCoonsPatchActions(
      renderInspector(
        loaded.EditableInspector,
        lockedDiagram,
        { kind: 'stratum', id: 'patch' },
      ),
      'locked',
    )
    assertNoCoonsPatchActions(
      renderInspector(
        loaded.EditableInspector,
        diagram,
        { kind: 'stratum', id: 'patch' },
        { kind: 'layer', layer: 0 },
      ),
      'filtered',
    )
  } finally {
    await server.close()
    rmSync(cacheDir, { recursive: true, force: true })
  }
})

function assertNoCoonsPatchActions(markup: string, context = ''): void {
  assert.doesNotMatch(markup, /Coons patch actions/, context)
  assert.doesNotMatch(markup, /Duplicate selected Coons patch/, context)
  assert.doesNotMatch(markup, /Translate selected Coons patch/, context)
}

test('save/load, Preview, rendered/exported SVG, and both TikZ modes distinguish Duplicate then Translate', async () => {
  const sourceDiagram = createComplexPatchDiagram(false)
  const duplicated = duplicateCoonsPatch(sourceDiagram, 'patch')
  assert.equal(duplicated.ok, true)
  if (!duplicated.ok) {
    throw new Error(duplicated.error)
  }
  const copyBefore = findCoonsPatch(
    duplicated.diagram,
    duplicated.duplicatedPatchId,
  )
  const sourceMesh = sampleCoonsPatch(
    findCoonsPatch(duplicated.diagram, 'patch').primitive,
  )
  assert.deepEqual(sampleCoonsPatch(copyBefore.primitive), sourceMesh)

  const delta = point(2, -1, 0.5)
  const translated = translateCoonsPatch(
    duplicated.diagram,
    copyBefore.id,
    numericTranslation(duplicated.diagram, delta),
  )
  assert.equal(translated.ok, true)
  if (!translated.ok) {
    throw new Error(translated.error)
  }
  const translatedMesh = sampleCoonsPatch(
    findCoonsPatch(translated.diagram, copyBefore.id).primitive,
  )
  sourceMesh.vertices.forEach((vertex, index) => {
    assertVec3Translated(vertex, translatedMesh.vertices[index], delta, 1e-9)
  })

  const saved = serializeDiagram(translated.diagram)
  assert.doesNotMatch(saved, /selectedElement|translationDraft|statusState/)
  const loaded = parseSavedDiagramJson(saved)
  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }
  const loadedCopy = findCoonsPatch(loaded.diagram, copyBefore.id)
  assert.equal(loadedCopy.primitive.boundarySources, undefined)
  assert.deepEqual(loadedCopy.style, findCoonsPatch(sourceDiagram, 'patch').style)
  assert.deepEqual(
    loadedCopy.primitive.sampling,
    findCoonsPatch(sourceDiagram, 'patch').primitive.sampling,
  )
  assert.equal(loadedCopy.layer, 3)

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
    new RegExp('Curved sheet "Phase 30 patch" \\[' + escapeRegExp(loadedCopy.id) + '\\]'),
  )
  assert.equal((standalone.match(/Primitive: coonsPatch/g) ?? []).length, 2)
  assert.match(standalone, /fill opacity=0\.42/)
  assert.match(standalone, /draw opacity=0\.73/)
  assertTikzCoonsPatchCoordinates(
    standalone,
    'patch',
    loadedCopy.id,
    sourceMesh,
    delta,
  )
  assertTikzIndentation(standalone)

  const inline = generateTikz(fullSync, { exportMode: 'inlineMath' })
  assert.doesNotMatch(inline, /\n[ \t]*\n/)
  assert.equal((inline.match(/Primitive: coonsPatch/g) ?? []).length, 2)
  assertTikzCoonsPatchCoordinates(
    inline,
    'patch',
    loadedCopy.id,
    sourceMesh,
    delta,
  )
  assertTikzIndentation(inline)

  const cacheDir = mkdtempSync(join(tmpdir(), 'stratified-tikz-phase30-svg-'))
  const server = await createServer({
    root: process.cwd(),
    appType: 'custom',
    cacheDir,
    logLevel: 'silent',
    server: { middlewareMode: true },
  })

  try {
    const svgModule = (await server.ssrLoadModule(
      '/src/rendering/SvgDiagram.tsx',
    )) as { SvgDiagram: ComponentType<Record<string, unknown>> }
    const width = 520
    const height = 360
    const camera: SvgCamera3D = {
      mode: '3d',
      kind: 'orthographic',
      thetaDeg: 31,
      phiDeg: -19,
      zoom: 64,
      pan: { x: 160, y: 140 },
    }
    const svgMarkup = renderToStaticMarkup(
      createElement(svgModule.SvgDiagram, {
        diagram: fullSync,
        width,
        height,
        fitToView: false,
        cameraOverride: camera,
        selectedElement: null,
        showCoordinateAnchors: false,
        visibilityOptions: {
          ...defaultVisibilityOptions,
          enabled: true,
          surfaceDepthSort: true,
        },
      }),
    )
    assert.match(svgMarkup, /^<svg /)
    assert.equal(
      (svgMarkup.match(/data-surface-source-id=/g) ?? []).length,
      sourceMesh.faces.length * 2,
    )

    const liveSvg = parseSsrSvgMarkup(svgMarkup)
    const expectedCopyVertices = sourceMesh.vertices.map((vertex) => ({
      x: vertex.x + delta.x,
      y: vertex.y + delta.y,
      z: vertex.z + delta.z,
    }))
    const sourceFacePoints = assertRenderedSvgMeshCoordinates(
      liveSvg,
      'patch',
      sourceMesh.vertices,
      sourceMesh.faces,
      camera,
      height,
    )
    const copyFacePoints = assertRenderedSvgMeshCoordinates(
      liveSvg,
      loadedCopy.id,
      expectedCopyVertices,
      sourceMesh.faces,
      camera,
      height,
    )
    assert.notDeepEqual(copyFacePoints, sourceFacePoints)
    const sourceFacePointSet = new Set(sourceFacePoints)
    for (const points of copyFacePoints) {
      assert.equal(
        sourceFacePointSet.has(points),
        false,
        'Translated copy face unexpectedly equals a source face: ' + points,
      )
    }

    const exportedSvg = prepareSvgPreviewExportClone(liveSvg, {
      backgroundMode: 'transparent',
    })
    assert.notEqual(exportedSvg, null)
    if (exportedSvg === null) {
      throw new Error('Expected production SVG export preparation to succeed.')
    }
    const exportedPolygonPoints = svgDescendantElements(exportedSvg)
      .filter((element) => element.tagName.toLowerCase() === 'polygon')
      .map((element) => element.getAttribute('points'))
      .filter((points): points is string => points !== null)
      .sort()
    assert.deepEqual(
      exportedPolygonPoints,
      [...sourceFacePoints, ...copyFacePoints].sort(),
    )
    assert.equal(
      svgDescendantElements(exportedSvg).some(
        (element) => element.getAttribute('data-surface-source-id') !== null,
      ),
      false,
    )
  } finally {
    await server.close()
    rmSync(cacheDir, { recursive: true, force: true })
  }
})

function assertTikzCoonsPatchCoordinates(
  tikz: string,
  sourcePatchId: string,
  copiedPatchId: string,
  sourceMesh: ReturnType<typeof sampleCoonsPatch>,
  delta: Vec3,
): void {
  const definitions = parseTikzCoordinateDefinitions(tikz)
  const sourceFaces = parseTikzCoonsPatchFaces(
    tikz,
    sourcePatchId,
    definitions,
  )
  const copiedFaces = parseTikzCoonsPatchFaces(
    tikz,
    copiedPatchId,
    definitions,
  )
  assert.equal(sourceFaces.length, sourceMesh.faces.length)
  assert.equal(copiedFaces.length, sourceMesh.faces.length)

  sourceMesh.faces.forEach((face, faceIndex) => {
    const sourceFace = sourceFaces[faceIndex]
    const copiedFace = copiedFaces[faceIndex]
    assert.notEqual(sourceFace, undefined)
    assert.notEqual(copiedFace, undefined)
    if (sourceFace === undefined || copiedFace === undefined) {
      throw new Error(`Expected TikZ face ${faceIndex}.`)
    }
    assert.equal(sourceFace.length, face.length)
    assert.equal(copiedFace.length, face.length)

    face.forEach((vertexIndex, faceVertexIndex) => {
      const expectedSource = sourceMesh.vertices[vertexIndex]
      const emittedSource = sourceFace[faceVertexIndex]
      const emittedCopy = copiedFace[faceVertexIndex]
      assert.notEqual(expectedSource, undefined)
      assert.notEqual(emittedSource, undefined)
      assert.notEqual(emittedCopy, undefined)
      if (
        expectedSource === undefined ||
        emittedSource === undefined ||
        emittedCopy === undefined
      ) {
        throw new Error(`Expected TikZ face ${faceIndex} vertex ${faceVertexIndex}.`)
      }
      assertVec3Close(emittedSource, expectedSource, 1e-6)
      assertVec3Translated(emittedSource, emittedCopy, delta, 1e-6)
    })
  })
}

function parseTikzCoordinateDefinitions(tikz: string): ReadonlyMap<string, Vec3> {
  const definitions = new Map<string, Vec3>()

  for (const match of tikz.matchAll(
    /^[ \t]*\\coordinate \(([^)]+)\) at \(([^,]+),([^,]+),([^)]+)\);$/gm,
  )) {
    const name = match[1]
    const x = Number(match[2])
    const y = Number(match[3])
    const z = Number(match[4])
    assert.notEqual(name, undefined)
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))
    if (name !== undefined) {
      definitions.set(name, { x, y, z })
    }
  }

  assert.ok(definitions.size > 0)
  return definitions
}

function parseTikzCoonsPatchFaces(
  tikz: string,
  patchId: string,
  definitions: ReadonlyMap<string, Vec3>,
): Vec3[][] {
  const marker = new RegExp(
    `^[ \\t]*% Curved sheet "[^"\\r\\n]*" \\[${escapeRegExp(patchId)}\\] sampled mesh export\\.$`,
    'm',
  ).exec(tikz)
  assert.notEqual(marker, null)
  if (marker === null || marker.index === undefined) {
    throw new Error(`Expected a TikZ marker for Coons patch ${patchId}.`)
  }

  const scopeStart = tikz.indexOf('\\begin{scope}[', marker.index)
  const scopeEnd = tikz.indexOf('\\end{scope}', scopeStart)
  assert.notEqual(scopeStart, -1)
  assert.notEqual(scopeEnd, -1)
  if (scopeStart === -1 || scopeEnd === -1) {
    throw new Error(`Expected a sampled TikZ scope for Coons patch ${patchId}.`)
  }
  const block = tikz.slice(marker.index, scopeEnd)
  assert.match(block, /Primitive: coonsPatch/)

  return [...block.matchAll(/^[ \t]*\\filldraw (.+) -- cycle;$/gm)].map(
    (faceMatch, faceIndex) => {
      const coordinateNames = [
        ...(faceMatch[1] ?? '').matchAll(/\(([^)]+)\)/g),
      ].map((coordinateMatch) => coordinateMatch[1] ?? '')
      assert.ok(coordinateNames.length >= 3)

      return coordinateNames.map((name) => {
        const coordinate = definitions.get(name)
        assert.notEqual(
          coordinate,
          undefined,
          `Missing TikZ coordinate ${name} for ${patchId} face ${faceIndex}.`,
        )
        if (coordinate === undefined) {
          throw new Error(`Expected TikZ coordinate ${name}.`)
        }
        return coordinate
      })
    },
  )
}

function assertTikzIndentation(tikz: string): void {
  for (const line of tikz.split('\n')) {
    const indentation = line.match(/^ */)?.[0].length ?? 0
    assert.equal(indentation % 4, 0, `Unexpected TikZ indentation: ${line}`)
  }
}

function assertRenderedSvgMeshCoordinates(
  root: SvgPreviewExportElementLike,
  sheetId: string,
  vertices: readonly Vec3[],
  faces: readonly (readonly number[])[],
  camera: SvgCamera3D,
  viewportHeight: number,
): string[] {
  const groups = svgDescendantElements(root).filter(
    (element) => element.getAttribute('data-surface-source-id') === sheetId,
  )
  assert.equal(groups.length, faces.length)
  const groupsByFaceIndex = new Map<number, SvgPreviewExportElementLike>()
  for (const group of groups) {
    assert.equal(group.getAttribute('data-surface-depth-sorted'), 'true')
    const faceIndex = Number(group.getAttribute('data-surface-face-index'))
    assert.ok(Number.isInteger(faceIndex))
    assert.equal(groupsByFaceIndex.has(faceIndex), false)
    groupsByFaceIndex.set(faceIndex, group)
  }

  return faces.map((face, faceIndex) => {
    const group = groupsByFaceIndex.get(faceIndex)
    assert.notEqual(group, undefined)
    if (group === undefined) {
      throw new Error(`Expected rendered SVG face ${sheetId}:${faceIndex}.`)
    }
    const polygons = svgDescendantElements(group).filter(
      (element) => element.tagName.toLowerCase() === 'polygon',
    )
    assert.equal(polygons.length, 1)
    const pointsText = polygons[0]?.getAttribute('points')
    assert.notEqual(pointsText, null)
    assert.notEqual(pointsText, undefined)
    if (pointsText === null || pointsText === undefined) {
      throw new Error(`Expected SVG polygon points for ${sheetId}:${faceIndex}.`)
    }
    const emitted = parseSvgPointList(pointsText)
    const expected = face.map((vertexIndex) => {
      const vertex = vertices[vertexIndex]
      assert.notEqual(vertex, undefined)
      if (vertex === undefined) {
        throw new Error(`Expected mesh vertex ${vertexIndex}.`)
      }
      return projectToSvgPoint(camera, vertex, viewportHeight)
    })
    assert.equal(emitted.length, expected.length)
    emitted.forEach((point, vertexIndex) => {
      const expectedPoint = expected[vertexIndex]
      assert.notEqual(expectedPoint, undefined)
      if (expectedPoint === undefined) {
        throw new Error(`Expected projected vertex ${vertexIndex}.`)
      }
      assert.ok(Math.abs(point.x - expectedPoint.x) <= 0.000500001)
      assert.ok(Math.abs(point.y - expectedPoint.y) <= 0.000500001)
    })
    return pointsText
  })
}

function parseSvgPointList(points: string): Vec2[] {
  return points.trim().split(/\s+/).map((token) => {
    const components = token.split(',')
    assert.equal(components.length, 2)
    const x = Number(components[0])
    const y = Number(components[1])
    assert.ok(Number.isFinite(x) && Number.isFinite(y))
    return { x, y }
  })
}

function svgDescendantElements(
  root: SvgPreviewExportElementLike,
): SvgPreviewExportElementLike[] {
  const descendants = [root]

  for (const child of Array.from(root.children)) {
    descendants.push(...svgDescendantElements(child))
  }

  return descendants
}

class TestSvgElement
  implements SvgPreviewExportElementLike, SvgPreviewExportCloneSourceLike
{
  readonly tagName: string
  private readonly attributeMap: Map<string, string>
  private readonly childElements: TestSvgElement[] = []
  private parent: TestSvgElement | null = null

  constructor(tagName: string, attributes: ReadonlyMap<string, string>) {
    this.tagName = tagName
    this.attributeMap = new Map(attributes)
  }

  get attributes(): SvgPreviewExportAttributeLike[] {
    return [...this.attributeMap].map(([name, value]) => ({ name, value }))
  }

  get children(): TestSvgElement[] {
    return this.childElements
  }

  append(child: TestSvgElement): void {
    child.parent = this
    this.childElements.push(child)
  }

  cloneNode(deep = false): TestSvgElement {
    const clone = new TestSvgElement(this.tagName, this.attributeMap)
    if (deep) {
      this.childElements.forEach((child) => clone.append(child.cloneNode(true)))
    }
    return clone
  }

  getAttribute(name: string): string | null {
    return this.attributeMap.get(name) ?? null
  }

  setAttribute(name: string, value: string): void {
    this.attributeMap.set(name, value)
  }

  removeAttribute(name: string): void {
    this.attributeMap.delete(name)
  }

  remove(): void {
    if (this.parent === null) {
      return
    }
    const index = this.parent.childElements.indexOf(this)
    if (index >= 0) {
      this.parent.childElements.splice(index, 1)
    }
    this.parent = null
  }
}

function parseSsrSvgMarkup(markup: string): TestSvgElement {
  const stack: TestSvgElement[] = []
  let root: TestSvgElement | null = null

  for (const match of markup.matchAll(
    /<(\/)?([A-Za-z][A-Za-z0-9:.-]*)([^<>]*?)(\/?)>/g,
  )) {
    const closing = match[1] === '/'
    const tagName = match[2]
    if (tagName === undefined) {
      continue
    }

    if (closing) {
      const closed = stack.pop()
      assert.equal(closed?.tagName, tagName)
      continue
    }

    const attributes = new Map<string, string>()
    for (const attribute of (match[3] ?? '').matchAll(
      /([^\s=/>]+)="([^"]*)"/g,
    )) {
      const name = attribute[1]
      const value = attribute[2]
      if (name !== undefined && value !== undefined) {
        attributes.set(name, decodeSsrAttribute(value))
      }
    }
    const element = new TestSvgElement(tagName, attributes)
    const parent = stack[stack.length - 1]
    if (parent === undefined) {
      assert.equal(root, null)
      root = element
    } else {
      parent.append(element)
    }

    if (match[4] !== '/') {
      stack.push(element)
    }
  }

  assert.equal(stack.length, 0)
  assert.notEqual(root, null)
  assert.equal(root?.tagName.toLowerCase(), 'svg')
  if (root === null) {
    throw new Error('Expected SSR markup to contain an SVG root.')
  }
  return root
}

function decodeSsrAttribute(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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
  layerFilter = allLayersFilter,
): string {
  const noOp = () => undefined

  return renderToStaticMarkup(
    createElement(Inspector, {
      diagram,
      selectedElement,
      layerFilter,
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
      onDuplicateCoonsPatch: () => ({
        ok: false,
        message: 'not invoked during SSR',
      }),
      onTranslateCoonsPatch: () => ({
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

function assertVec3Close(
  actual: Vec3,
  expected: Vec3,
  epsilon: number,
): void {
  assert.ok(Math.abs(actual.x - expected.x) <= epsilon)
  assert.ok(Math.abs(actual.y - expected.y) <= epsilon)
  assert.ok(Math.abs(actual.z - expected.z) <= epsilon)
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
