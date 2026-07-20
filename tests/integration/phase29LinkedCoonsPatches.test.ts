import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { sampleCoonsPatch } from '../../src/geometry/curvedSheets.ts'
import { createInitialCamera3D } from '../../src/model/camera.ts'
import {
  coonsPatchBoundaryLinkStatus,
  detachCoonsPatchBoundaryLinks,
  synchronizeLinkedCoonsPatches,
} from '../../src/model/coonsPatchLinks.ts'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import { coordinateReferenceVec3ForAnchor } from '../../src/model/coordinateReferences.ts'
import { duplicateLayer, translateLayer } from '../../src/model/layers.ts'
import { reverseCurvePathDirection } from '../../src/model/paths.ts'
import {
  parseSavedDiagramJson,
  parseSavedDiagramJsonForImport,
  resolvePendingSymbolicDiagramImport,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { defaultCurveStyle, defaultPointStyle } from '../../src/model/styles.ts'
import { symbolicVec3FromVec3 } from '../../src/model/coordinateAnchors.ts'
import { updateSymbolicVariableInDiagram } from '../../src/model/variables.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type {
  ConcatenatedPathStratum,
  CoordinateAnchor,
  CubicBezierCurveStratum,
  CurvedSheetStratum,
  CurveStratum,
  Diagram,
  PointStratum,
  PolylineCurveStratum,
  Stratum,
  Vec3,
} from '../../src/model/types.ts'
import { curvedSheetToSvgMesh } from '../../src/rendering/curvedSheetMesh.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { duplicateSelectedElements } from '../../src/ui/bulkEditing.ts'
import { moveCoordinateAnchorToPoint } from '../../src/ui/coordinateAnchorEditing.ts'
import {
  addPointStratumWithResult,
  updateStratumById,
} from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import {
  createCoonsPatchFromBoundaryPaths,
  type CoonsPatchBoundaryPathSelections,
} from '../../src/ui/ruledSurface.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  commitDiagramChange,
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
  history: DiagramHistory
}

test('linked creation stores normalized roles and static creation omits links', () => {
  const linked = createLinkedPatch(createPathSourceDiagram(), {
    top: { sourcePathId: 'top', reversed: false },
  })
  const primitive = findCoonsPatch(linked, 'patch').primitive

  assert.deepEqual(primitive.boundarySources, {
    bottom: { kind: 'path', sourcePathId: 'bottom', reversed: false },
    right: { kind: 'path', sourcePathId: 'right', reversed: false },
    top: { kind: 'path', sourcePathId: 'top', reversed: false },
    left: { kind: 'path', sourcePathId: 'left', reversed: false },
  })

  const staticResult = createCoonsPatchFromBoundaryPaths(
    createPathSourceDiagram(),
    defaultSelections(),
    { id: 'static-patch', keepLinkedToBoundarySources: false },
  )

  assert.equal(staticResult.ok, true)
  if (!staticResult.ok) {
    throw new Error(staticResult.error)
  }
  assert.equal(
    findCoonsPatch(staticResult.diagram, 'static-patch').primitive.boundarySources,
    undefined,
  )
  assert.deepEqual(
    coonsPatchBoundaryLinkStatus(staticResult.diagram, 'static-patch'),
    { kind: 'static' },
  )
})

test('polyline, cubic, and concatenated source edits refresh snapshots and mesh', () => {
  const initialDiagram = createLinkedPatch(createPathSourceDiagram())
  const initialPatch = findCoonsPatch(initialDiagram, 'patch')
  const initialMesh = sampleCoonsPatch(initialPatch.primitive)
  let state = createEditorState(initialDiagram)

  state = commitSourceUpdate(state, 'bottom', (source) => {
    if (source.kind !== 'polyline') {
      return source
    }
    return {
      ...source,
      points: source.points.map((value, index) =>
        index === 1 ? { ...value, z: 0.6 } : value,
      ),
    }
  })
  state = commitSourceUpdate(state, 'right', (source) => {
    if (source.kind !== 'cubicBezier') {
      return source
    }
    return {
      ...source,
      points: source.points.map((value, index) =>
        index === 1 ? { ...value, z: 0.8 } : value,
      ),
    }
  })
  state = commitSourceUpdate(state, 'top', (source) => {
    if (source.kind !== 'concatenatedPath') {
      return source
    }
    const midpoint = { x: 0.5, y: 1, z: -0.4 }
    return {
      ...source,
      segments: [
        { ...source.segments[0], end: midpoint },
        { ...source.segments[1], start: midpoint },
      ],
    } as ConcatenatedPathStratum
  })

  const patch = findCoonsPatch(state.editableDiagram, 'patch')
  const mesh = sampleCoonsPatch(patch.primitive)

  assert.notDeepEqual(patch.primitive.bottom, initialPatch.primitive.bottom)
  assert.notDeepEqual(patch.primitive.right, initialPatch.primitive.right)
  assert.notDeepEqual(patch.primitive.top, initialPatch.primitive.top)
  assert.notEqual(patch.primitive.left, initialPatch.primitive.left)
  assert.notDeepEqual(mesh.vertices, initialMesh.vertices)
  assert.deepEqual(coonsPatchBoundaryLinkStatus(state.editableDiagram, 'patch'), {
    kind: 'linkedUpToDate',
  })
})

test('unsupported closed template replacement leaves the linked patch stale', () => {
  const initialDiagram = createLinkedPatch(createPathSourceDiagram())
  const initialPrimitive = structuredClone(
    findCoonsPatch(initialDiagram, 'patch').primitive,
  )
  const state = commitSourceUpdate(
    createEditorState(initialDiagram),
    'bottom',
    (source) => ({
      ...source,
      kind: 'templatePath',
      template: {
        kind: 'circleTemplate',
        center: { x: 0.5, y: 0, z: 0 },
        radius: 0.5,
        frame: standardFrame(),
      },
    }),
  )
  const patch = findCoonsPatch(state.editableDiagram, 'patch')
  const status = coonsPatchBoundaryLinkStatus(state.editableDiagram, 'patch')

  assert.deepEqual(patch.primitive, initialPrimitive)
  assert.equal(status.kind, 'linkedStale')
  if (status.kind === 'linkedStale') {
    assert.match(status.issues[0]?.message ?? '', /closed/)
  }
})

test('reversed source metadata remains effective after a source edit', () => {
  const diagram = createPathSourceDiagram({ reverseTopSource: true })
  const linked = createLinkedPatch(diagram, {
    top: { sourcePathId: 'top', reversed: true },
  })
  const state = commitSourceUpdate(
    createEditorState(linked),
    'top',
    (source) => {
      if (source.kind !== 'polyline') {
        return source
      }
      return {
        ...source,
        points: source.points.map((value, index) =>
          index === 1 ? { ...value, z: 0.75 } : value,
        ),
      }
    },
  )
  const primitive = findCoonsPatch(state.editableDiagram, 'patch').primitive

  assert.deepEqual(primitive.boundarySources?.top, {
    kind: 'path',
    sourcePathId: 'top',
    reversed: true,
  })
  assert.deepEqual(pathBoundary(primitive.top).segments[0]?.start, point(0, 1, 0))
  assert.deepEqual(pathBoundary(primitive.top).segments[0]?.end, point(0.5, 1, 0.75))
})

test('constant-point sources and coordinate-anchor changes refresh linked geometry', () => {
  const pointLinked = createConstantPointPatch(
    createConstantPointSourceDiagram(false),
  )
  assert.deepEqual(
    findCoonsPatch(pointLinked, 'point-patch').primitive.boundarySources?.bottom,
    { kind: 'point', sourcePointId: 'constant-point' },
  )
  const movedPointState = commitSourceUpdate(
    createEditorState(pointLinked),
    'constant-point',
    (source) =>
      source.geometricKind === 'point'
        ? { ...source, position: point(2, 3, 4) }
        : source,
  )
  const movedPointPatch = findCoonsPatch(
    movedPointState.editableDiagram,
    'point-patch',
  )

  assert.deepEqual(constantBoundary(movedPointPatch.primitive.bottom).point, point(2, 3, 4))
  assert.equal(
    sampleCoonsPatch(movedPointPatch.primitive).vertices.every(
      (vertex) => vertex.x === 2 && vertex.y === 3 && vertex.z === 4,
    ),
    true,
  )

  const anchoredLinked = createConstantPointPatch(
    createConstantPointSourceDiagram(true),
  )
  const anchoredState = createEditorState(anchoredLinked)
  const movedAnchorDiagram = moveCoordinateAnchorToPoint(
    anchoredState.editableDiagram,
    'anchor',
    point(-2, 1, 0.5),
  )
  const committed = commitDiagramChange(anchoredState, {
    ...anchoredState,
    editableDiagram: movedAnchorDiagram,
  })
  const anchoredPatch = findCoonsPatch(committed.editableDiagram, 'point-patch')

  const anchoredBoundaryPoint = constantBoundary(
    anchoredPatch.primitive.bottom,
  ).point

  assert.deepEqual(
    {
      x: anchoredBoundaryPoint.x,
      y: anchoredBoundaryPoint.y,
      z: anchoredBoundaryPoint.z,
    },
    point(-2, 1, 0.5),
  )
  assert.equal(
    anchoredBoundaryPoint.symbolic?.source,
    undefined,
  )
})

test('symbolic stale snapshots survive save/load and recover from current sources', () => {
  const linked = createSymbolicEndpointLinkedPatch()
  const initialPatch = structuredClone(findCoonsPatch(linked, 'patch'))
  const initialMesh = sampleCoonsPatch(initialPatch.primitive)
  const initialSvg = curvedSheetToSvgMesh(
    initialPatch,
    createInitialCamera3D(),
    240,
  )
  const variableUpdate = updateSymbolicVariableInDiagram(
    linked,
    'variable-r',
    { expression: '2' },
  )

  assert.equal(variableUpdate.ok, true)
  if (!variableUpdate.ok) {
    throw new Error(variableUpdate.error)
  }

  const refreshedBottom = findPolyline(variableUpdate.diagram, 'bottom')
  const refreshedPatch = findCoonsPatch(variableUpdate.diagram, 'patch')

  assert.equal(refreshedBottom.points[2]?.x, 2)
  assert.equal(refreshedBottom.points[2]?.symbolic?.x.previewValue, 2)
  assert.equal(pathBoundary(refreshedPatch.primitive.bottom).segments[1]?.end.x, 1)
  assert.equal(
    pathBoundary(refreshedPatch.primitive.bottom).segments[1]?.end.symbolic?.x
      .previewValue,
    1,
  )

  const stale = commitDiagramChange(createEditorState(linked), {
    ...createEditorState(linked),
    editableDiagram: variableUpdate.diagram,
  })
  const stalePatch = findCoonsPatch(stale.editableDiagram, 'patch')
  const staleStatus = coonsPatchBoundaryLinkStatus(
    stale.editableDiagram,
    'patch',
  )

  assert.equal(staleStatus.kind, 'linkedStale')
  assert.equal(pathBoundary(stalePatch.primitive.bottom).segments[1]?.end.x, 1)
  assert.deepEqual(sampleCoonsPatch(stalePatch.primitive), initialMesh)
  assert.equal(validateDiagram(stale.editableDiagram).valid, true)

  const serialized = serializeDiagram(stale.editableDiagram)
  const parsed = parseSavedDiagramJson(serialized)

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const loadedBottom = findPolyline(parsed.diagram, 'bottom')
  const loadedPatch = findCoonsPatch(parsed.diagram, 'patch')
  const loadedStatus = coonsPatchBoundaryLinkStatus(parsed.diagram, 'patch')
  const loadedSvg = curvedSheetToSvgMesh(
    loadedPatch,
    createInitialCamera3D(),
    240,
  )
  const loadedTikz = generateTikz(parsed.diagram)

  assert.equal(loadedBottom.points[2]?.x, 2)
  assert.equal(loadedBottom.points[2]?.symbolic?.x.previewValue, 2)
  assert.equal(pathBoundary(loadedPatch.primitive.bottom).segments[1]?.end.x, 1)
  assert.deepEqual(sampleCoonsPatch(loadedPatch.primitive), initialMesh)
  assert.deepEqual(loadedSvg, initialSvg)
  assert.equal(loadedStatus.kind, 'linkedStale')
  assert.equal(validateDiagram(parsed.diagram).valid, true)
  assert.match(loadedTikz, /Primitive: coonsPatch/)

  const recovered = commitSourceUpdate(
    createEditorState(parsed.diagram),
    'right',
    (source) => {
      if (source.kind !== 'cubicBezier') {
        return source
      }

      return {
        ...source,
        points: source.points.map((value, index) =>
          index === 0 ? point(2, 0, 0) : value,
        ),
      }
    },
  )
  const recoveredPatch = findCoonsPatch(recovered.editableDiagram, 'patch')

  assert.deepEqual(
    coonsPatchBoundaryLinkStatus(recovered.editableDiagram, 'patch'),
    { kind: 'linkedUpToDate' },
  )
  assert.equal(
    pathBoundary(recoveredPatch.primitive.bottom).segments[1]?.end.x,
    2,
  )
  assert.notDeepEqual(sampleCoonsPatch(recoveredPatch.primitive), initialMesh)
})

test('compatible symbolic source updates still refresh linked snapshots', () => {
  const linked = createSymbolicInteriorLinkedPatch()
  const variableUpdate = updateSymbolicVariableInDiagram(
    linked,
    'variable-r',
    { expression: '0.6' },
  )

  assert.equal(variableUpdate.ok, true)
  if (!variableUpdate.ok) {
    throw new Error(variableUpdate.error)
  }

  const updated = commitDiagramChange(createEditorState(linked), {
    ...createEditorState(linked),
    editableDiagram: variableUpdate.diagram,
  })
  const updatedPatch = findCoonsPatch(updated.editableDiagram, 'patch')
  const bottom = pathBoundary(updatedPatch.primitive.bottom)

  assert.deepEqual(
    coonsPatchBoundaryLinkStatus(updated.editableDiagram, 'patch'),
    { kind: 'linkedUpToDate' },
  )
  assert.equal(bottom.segments[0]?.end.z, 0.6)
  assert.equal(bottom.segments[0]?.end.symbolic?.z.previewValue, 0.6)
})

test('symbolic linked import retains the saved fallback when inputs are incompatible', () => {
  const linked = createSymbolicEndpointLinkedPatch()
  const savedPatch = structuredClone(findCoonsPatch(linked, 'patch').primitive)
  const pending = parseSavedDiagramJsonForImport(serializeDiagram(linked))

  assert.equal(pending.ok, true)
  if (!pending.ok || pending.kind !== 'needsVariableResolution') {
    throw new Error('Expected a pending symbolic linked import.')
  }

  const resolved = resolvePendingSymbolicDiagramImport(pending.pendingImport, [
    { name: 'R', expression: '2' },
  ])

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }

  const source = findPolyline(resolved.diagram, 'bottom')
  const patch = findCoonsPatch(resolved.diagram, 'patch')

  assert.equal(source.points[2]?.x, 2)
  assert.equal(pathBoundary(patch.primitive.bottom).segments[1]?.end.x, 1)
  assert.deepEqual(
    sampleCoonsPatch(patch.primitive),
    sampleCoonsPatch(savedPatch),
  )
  assert.equal(
    coonsPatchBoundaryLinkStatus(resolved.diagram, 'patch').kind,
    'linkedStale',
  )
  assert.equal(validateDiagram(resolved.diagram).valid, true)
})

test('same-id replacement load keeps the incoming file fallback snapshots', () => {
  const current = commitSourceUpdate(
    createEditorState(createSymbolicEndpointLinkedPatch()),
    'bottom',
    (source) => {
      if (source.kind !== 'polyline') {
        return source
      }

      return {
        ...source,
        points: source.points.map((value, index) =>
          index === 1 ? { ...value, z: 0.8 } : value,
        ),
      }
    },
  )
  const incomingLinked = createSymbolicEndpointLinkedPatch()
  const variableUpdate = updateSymbolicVariableInDiagram(
    incomingLinked,
    'variable-r',
    { expression: '2' },
  )

  assert.equal(variableUpdate.ok, true)
  if (!variableUpdate.ok) {
    throw new Error(variableUpdate.error)
  }

  const incomingStale = commitDiagramChange(
    createEditorState(incomingLinked),
    {
      ...createEditorState(incomingLinked),
      editableDiagram: variableUpdate.diagram,
    },
  )
  const parsed = parseSavedDiagramJson(
    serializeDiagram(incomingStale.editableDiagram),
  )

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const incomingFallback = structuredClone(
    findCoonsPatch(parsed.diagram, 'patch').primitive,
  )
  const currentFallback = structuredClone(
    findCoonsPatch(current.editableDiagram, 'patch').primitive,
  )
  const replaced = commitDiagramChange(
    current,
    { ...current, editableDiagram: parsed.diagram },
    { replaceDiagram: true },
  )
  const replacedPatch = findCoonsPatch(replaced.editableDiagram, 'patch')

  assert.deepEqual(replacedPatch.primitive, incomingFallback)
  assert.notDeepEqual(replacedPatch.primitive, currentFallback)
  assert.equal(findPolyline(replaced.editableDiagram, 'bottom').points[2]?.x, 2)
  assert.equal(
    coonsPatchBoundaryLinkStatus(replaced.editableDiagram, 'patch').kind,
    'linkedStale',
  )
})

test('corner-invalid updates are atomic, keep fallback snapshots, and recover', () => {
  const linked = createLinkedPatch(createPathSourceDiagram())
  const before = findCoonsPatch(linked, 'patch').primitive
  const invalidState = commitSourceUpdate(
    createEditorState(linked),
    'bottom',
    (source) => {
      if (source.kind !== 'polyline') {
        return source
      }
      return {
        ...source,
        points: source.points.map((value, index) =>
          index === 1
            ? point(0.5, 0, 0.9)
            : index === 2
              ? point(1.25, 0, 0)
              : value,
        ),
      }
    },
  )
  const stalePatch = findCoonsPatch(invalidState.editableDiagram, 'patch')
  const staleStatus = coonsPatchBoundaryLinkStatus(
    invalidState.editableDiagram,
    'patch',
  )

  assert.deepEqual(stalePatch.primitive, before)
  assert.equal(staleStatus.kind, 'linkedStale')
  if (staleStatus.kind === 'linkedStale') {
    assert.equal(
      staleStatus.issues.some(
        (issue) => issue.message === 'Corner mismatch: bottom end = right start',
      ),
      true,
    )
  }

  const repairedState = commitSourceUpdate(
    invalidState,
    'bottom',
    (source) => {
      if (source.kind !== 'polyline') {
        return source
      }
      return {
        ...source,
        points: source.points.map((value, index) =>
          index === 2 ? point(1, 0, 0) : value,
        ),
      }
    },
  )
  const repairedPatch = findCoonsPatch(repairedState.editableDiagram, 'patch')

  assert.notDeepEqual(repairedPatch.primitive.bottom, before.bottom)
  assert.deepEqual(coonsPatchBoundaryLinkStatus(repairedState.editableDiagram, 'patch'), {
    kind: 'linkedUpToDate',
  })
})

test('partial layer translation preserves last-valid snapshots through repeated stale edits and recovery', () => {
  const linked = createLinkedPatch(createPathSourceDiagram())
  const splitAcrossLayers = {
    ...linked,
    strata: linked.strata.map((stratum) =>
      stratum.id === 'right' || stratum.id === 'top' || stratum.id === 'left'
        ? { ...stratum, layer: 1 }
        : stratum,
    ),
  }
  const initialState = createEditorState(splitAcrossLayers)
  const initialPatch = structuredClone(
    findCoonsPatch(splitAcrossLayers, 'patch'),
  )
  const initialMesh = sampleCoonsPatch(initialPatch.primitive)
  const translatedDiagram = updateStratumById(
    translateLayer(splitAcrossLayers, 0, point(1, 0, 0)),
    'patch',
    (stratum) => ({
      ...stratum,
      name: 'Patch after partial translation',
      style:
        stratum.geometricKind === 'sheet'
          ? { ...stratum.style, fillOpacity: 0.6 }
          : stratum.style,
    }),
  )
  const translatedPatch = findCoonsPatch(translatedDiagram, 'patch')
  const firstStale = commitDiagramChange(initialState, {
    ...initialState,
    editableDiagram: translatedDiagram,
  })
  const firstStalePatch = findCoonsPatch(firstStale.editableDiagram, 'patch')
  const firstStatus = coonsPatchBoundaryLinkStatus(
    firstStale.editableDiagram,
    'patch',
  )
  const movedBottom = firstStale.editableDiagram.strata.find(
    (stratum) => stratum.id === 'bottom',
  )

  assert.equal(movedBottom?.geometricKind, 'curve')
  if (movedBottom?.geometricKind !== 'curve' || movedBottom.kind !== 'polyline') {
    throw new Error('Expected the translated bottom polyline source.')
  }
  assert.equal(movedBottom.points[0]?.x, 1)
  assert.equal(firstStatus.kind, 'linkedStale')
  if (firstStatus.kind === 'linkedStale') {
    assert.equal(
      firstStatus.issues.some((issue) => issue.kind === 'cornerMismatch'),
      true,
    )
  }

  for (const role of ['bottom', 'right', 'top', 'left'] as const) {
    assert.deepEqual(
      firstStalePatch.primitive[role],
      initialPatch.primitive[role],
    )
    assert.notDeepEqual(
      firstStalePatch.primitive[role],
      translatedPatch.primitive[role],
    )
  }
  assert.deepEqual(sampleCoonsPatch(firstStalePatch.primitive), initialMesh)
  assert.equal(firstStalePatch.name, translatedPatch.name)
  assert.deepEqual(firstStalePatch.style, translatedPatch.style)
  assert.deepEqual(
    firstStalePatch.primitive.boundarySources,
    translatedPatch.primitive.boundarySources,
  )

  const secondTranslatedDiagram = translateLayer(
    firstStale.editableDiagram,
    0,
    point(1, 0, 0),
  )
  const secondStale = commitDiagramChange(firstStale, {
    ...firstStale,
    editableDiagram: secondTranslatedDiagram,
  })
  const secondStalePatch = findCoonsPatch(secondStale.editableDiagram, 'patch')

  for (const role of ['bottom', 'right', 'top', 'left'] as const) {
    assert.deepEqual(
      secondStalePatch.primitive[role],
      initialPatch.primitive[role],
    )
  }

  const repairedDiagram = translateLayer(
    secondStale.editableDiagram,
    1,
    point(2, 0, 0),
  )
  const repaired = commitDiagramChange(secondStale, {
    ...secondStale,
    editableDiagram: repairedDiagram,
  })
  const repairedPatch = findCoonsPatch(repaired.editableDiagram, 'patch')
  const repairedMesh = sampleCoonsPatch(repairedPatch.primitive)

  assert.deepEqual(coonsPatchBoundaryLinkStatus(repaired.editableDiagram, 'patch'), {
    kind: 'linkedUpToDate',
  })
  assert.equal(repairedMesh.vertices.length, initialMesh.vertices.length)
  repairedMesh.vertices.forEach((vertex, index) => {
    const initialVertex = initialMesh.vertices[index]

    assert.notEqual(initialVertex, undefined)
    if (initialVertex === undefined) {
      return
    }
    assert.ok(Math.abs(vertex.x - (initialVertex.x + 2)) <= 1e-12)
    assert.ok(Math.abs(vertex.y - initialVertex.y) <= 1e-12)
    assert.ok(Math.abs(vertex.z - initialVertex.z) <= 1e-12)
  })

  const undoneRepair = undoLastDiagramChange(repaired)
  const redoneRepair = redoLastDiagramChange(undoneRepair)

  assert.equal(
    coonsPatchBoundaryLinkStatus(undoneRepair.editableDiagram, 'patch').kind,
    'linkedStale',
  )
  assert.deepEqual(
    findCoonsPatch(undoneRepair.editableDiagram, 'patch').primitive,
    secondStalePatch.primitive,
  )
  assert.deepEqual(
    findCoonsPatch(redoneRepair.editableDiagram, 'patch').primitive,
    repairedPatch.primitive,
  )
})

test('source deletion keeps fallback geometry and Undo restores an up-to-date link', () => {
  const linked = createLinkedPatch(createPathSourceDiagram())
  const initialState = createEditorState(linked)
  const fallback = structuredClone(findCoonsPatch(linked, 'patch').primitive)
  const deletedDiagram = {
    ...linked,
    strata: linked.strata.filter((stratum) => stratum.id !== 'right'),
  }
  const deleted = commitDiagramChange(initialState, {
    ...initialState,
    editableDiagram: deletedDiagram,
  })
  const status = coonsPatchBoundaryLinkStatus(deleted.editableDiagram, 'patch')

  assert.deepEqual(findCoonsPatch(deleted.editableDiagram, 'patch').primitive, fallback)
  assert.equal(status.kind, 'linkedStale')
  if (status.kind === 'linkedStale') {
    assert.equal(status.issues[0]?.role, 'right')
    assert.match(status.issues[0]?.message ?? '', /missing/)
  }

  const undone = undoLastDiagramChange(deleted)

  assert.notEqual(
    undone.editableDiagram.strata.find((stratum) => stratum.id === 'right'),
    undefined,
  )
  assert.deepEqual(coonsPatchBoundaryLinkStatus(undone.editableDiagram, 'patch'), {
    kind: 'linkedUpToDate',
  })
})

test('dangling point source ids stay reserved through creation and Undo recovery', () => {
  const linked = createConstantPointPatch(
    createConstantPointSourceDiagram(false, 'point-1'),
    'point-1',
  )
  const initialState = createEditorState(linked)
  const fallback = structuredClone(
    findCoonsPatch(linked, 'point-patch').primitive,
  )
  const deleted = commitDiagramChange(initialState, {
    ...initialState,
    editableDiagram: {
      ...linked,
      strata: linked.strata.filter((stratum) => stratum.id !== 'point-1'),
    },
  })
  const createdPoint = addPointStratumWithResult(
    deleted.editableDiagram,
    point(9, 9, 9),
  )

  assert.notEqual(createdPoint.id, 'point-1')

  const created = commitDiagramChange(deleted, {
    ...deleted,
    editableDiagram: createdPoint.diagram,
  })
  const stalePatch = findCoonsPatch(created.editableDiagram, 'point-patch')

  assert.deepEqual(stalePatch.primitive.boundarySources?.bottom, {
    kind: 'point',
    sourcePointId: 'point-1',
  })
  assert.equal(
    coonsPatchBoundaryLinkStatus(created.editableDiagram, 'point-patch').kind,
    'linkedStale',
  )
  assert.deepEqual(stalePatch.primitive, fallback)

  const withoutCreatedPoint = undoLastDiagramChange(created)
  const restoredSource = undoLastDiagramChange(withoutCreatedPoint)

  assert.notEqual(
    restoredSource.editableDiagram.strata.find(
      (stratum) => stratum.id === 'point-1',
    ),
    undefined,
  )
  assert.deepEqual(
    coonsPatchBoundaryLinkStatus(
      restoredSource.editableDiagram,
      'point-patch',
    ),
    { kind: 'linkedUpToDate' },
  )
})

test('loaded dangling point source ids remain reserved for new elements', () => {
  const linked = createConstantPointPatch(
    createConstantPointSourceDiagram(false, 'point-1'),
    'point-1',
  )
  const dangling = {
    ...linked,
    strata: linked.strata.filter((stratum) => stratum.id !== 'point-1'),
  }
  const parsed = parseSavedDiagramJson(serializeDiagram(dangling))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const created = addPointStratumWithResult(parsed.diagram, point(4, 5, 6))

  assert.notEqual(created.id, 'point-1')
  assert.deepEqual(
    findCoonsPatch(created.diagram, 'point-patch').primitive.boundarySources
      ?.bottom,
    { kind: 'point', sourcePointId: 'point-1' },
  )
  assert.equal(
    coonsPatchBoundaryLinkStatus(created.diagram, 'point-patch').kind,
    'linkedStale',
  )
})

test('source refresh and snapshots are one stable undo/redo transaction', () => {
  const linked = createLinkedPatch(createPathSourceDiagram())
  const initialState = createEditorState(linked)
  const initialPrimitive = structuredClone(findCoonsPatch(linked, 'patch').primitive)
  const edited = commitSourceUpdate(initialState, 'bottom', (source) => {
    if (source.kind !== 'polyline') {
      return source
    }
    return {
      ...source,
      points: source.points.map((value, index) =>
        index === 1 ? point(0.5, 0, 0.55) : value,
      ),
    }
  })
  const editedPrimitive = structuredClone(
    findCoonsPatch(edited.editableDiagram, 'patch').primitive,
  )

  assert.equal(edited.history.past.length, 1)
  assert.notDeepEqual(editedPrimitive, initialPrimitive)

  const undone = undoLastDiagramChange(edited)
  const redone = redoLastDiagramChange(undone)
  const undoneAgain = undoLastDiagramChange(redone)
  const redoneAgain = redoLastDiagramChange(undoneAgain)

  assert.deepEqual(findCoonsPatch(undone.editableDiagram, 'patch').primitive, initialPrimitive)
  assert.deepEqual(findCoonsPatch(redone.editableDiagram, 'patch').primitive, editedPrimitive)
  assert.deepEqual(findCoonsPatch(redoneAgain.editableDiagram, 'patch').primitive, editedPrimitive)
})

test('unrelated edits and patch sampling do not rematerialize boundaries', () => {
  const linked = createLinkedPatch(createPathSourceDiagram())
  const state = createEditorState(linked)
  const before = findCoonsPatch(linked, 'patch').primitive
  const withUnrelated = {
    ...linked,
    strata: [...linked.strata, pointStratum('unrelated', point(9, 9, 9), 3)],
  }
  const unrelated = commitDiagramChange(state, {
    ...state,
    editableDiagram: withUnrelated,
  })
  const afterUnrelated = findCoonsPatch(unrelated.editableDiagram, 'patch').primitive

  assert.equal(afterUnrelated, before)
  assert.equal(unrelated.history.past.length, 1)

  const samplingDiagram = updateStratumById(
    unrelated.editableDiagram,
    'patch',
    (stratum) =>
      stratum.geometricKind === 'sheet' &&
      stratum.kind === 'curvedSheet' &&
      stratum.primitive.kind === 'coonsPatch'
        ? {
            ...stratum,
            primitive: {
              ...stratum.primitive,
              sampling: { uSegments: 3, vSegments: 4 },
            },
          }
        : stratum,
  )
  const sampled = commitDiagramChange(unrelated, {
    ...unrelated,
    editableDiagram: samplingDiagram,
  })
  const afterSampling = findCoonsPatch(sampled.editableDiagram, 'patch').primitive

  assert.equal(afterSampling.bottom, afterUnrelated.bottom)
  assert.deepEqual(afterSampling.sampling, { uSegments: 3, vSegments: 4 })
  assert.equal(sampled.history.past.length, 2)
})

test('detach is undoable and later source edits no longer affect snapshots', () => {
  const linked = createLinkedPatch(createPathSourceDiagram())
  const state = createEditorState(linked)
  const detached = commitDiagramChange(state, {
    ...state,
    editableDiagram: detachCoonsPatchBoundaryLinks(linked, 'patch'),
  })

  assert.equal(findCoonsPatch(detached.editableDiagram, 'patch').primitive.boundarySources, undefined)
  assert.notEqual(
    findCoonsPatch(undoLastDiagramChange(detached).editableDiagram, 'patch').primitive
      .boundarySources,
    undefined,
  )

  const detachedPrimitive = structuredClone(
    findCoonsPatch(detached.editableDiagram, 'patch').primitive,
  )
  const edited = commitSourceUpdate(detached, 'bottom', (source) => {
    if (source.kind !== 'polyline') {
      return source
    }
    return {
      ...source,
      points: source.points.map((value, index) =>
        index === 1 ? point(0.5, 0, 1.2) : value,
      ),
    }
  })

  assert.deepEqual(findCoonsPatch(edited.editableDiagram, 'patch').primitive, detachedPrimitive)
})

test('linked JSON refreshes on load, legacy static JSON stays static, and dangling links load', () => {
  const linked = createLinkedPatch(createPathSourceDiagram())
  const staleSavedSnapshots = updateStratumById(linked, 'patch', (stratum) => {
    if (
      stratum.geometricKind !== 'sheet' ||
      stratum.kind !== 'curvedSheet' ||
      stratum.primitive.kind !== 'coonsPatch'
    ) {
      return stratum
    }

    const bottom = pathBoundary(stratum.primitive.bottom)
    const staleMiddle = point(0.5, 0, 9)

    return {
      ...stratum,
      primitive: {
        ...stratum.primitive,
        bottom: {
          ...bottom,
          segments: bottom.segments.map((segment, index) =>
            index === 0
              ? { ...segment, end: staleMiddle }
              : index === 1
                ? { ...segment, start: staleMiddle }
                : segment,
          ),
        },
      },
    }
  })
  const parsed = parseSavedDiagramJson(serializeDiagram(staleSavedSnapshots))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  assert.deepEqual(
    findCoonsPatch(parsed.diagram, 'patch').primitive.boundarySources,
    findCoonsPatch(linked, 'patch').primitive.boundarySources,
  )
  assert.deepEqual(
    findCoonsPatch(parsed.diagram, 'patch').primitive.bottom,
    findCoonsPatch(linked, 'patch').primitive.bottom,
  )

  const staticDiagram = createCoonsPatchFromBoundaryPaths(
    createPathSourceDiagram(),
    defaultSelections(),
    { id: 'static', keepLinkedToBoundarySources: false },
  )
  assert.equal(staticDiagram.ok, true)
  if (!staticDiagram.ok) {
    throw new Error(staticDiagram.error)
  }
  const parsedStatic = parseSavedDiagramJson(serializeDiagram(staticDiagram.diagram))
  assert.equal(parsedStatic.ok, true)
  if (!parsedStatic.ok) {
    throw new Error(parsedStatic.error)
  }
  assert.deepEqual(coonsPatchBoundaryLinkStatus(parsedStatic.diagram, 'static'), {
    kind: 'static',
  })

  const dangling = {
    ...linked,
    strata: linked.strata.filter((stratum) => stratum.id !== 'left'),
  }
  const parsedDangling = parseSavedDiagramJson(serializeDiagram(dangling))
  assert.equal(parsedDangling.ok, true)
  if (!parsedDangling.ok) {
    throw new Error(parsedDangling.error)
  }
  assert.equal(coonsPatchBoundaryLinkStatus(parsedDangling.diagram, 'patch').kind, 'linkedStale')
  assert.deepEqual(
    findCoonsPatch(parsedDangling.diagram, 'patch').primitive.bottom,
    findCoonsPatch(linked, 'patch').primitive.bottom,
  )
})

test('malformed linked JSON returns validation failures without throwing', () => {
  const linked = createLinkedPatch(createPathSourceDiagram())
  const validSources = findCoonsPatch(linked, 'patch').primitive.boundarySources

  if (validSources === undefined) {
    throw new Error('Expected linked boundary sources.')
  }

  const malformedSources: Array<{ name: string; value: unknown }> = [
    { name: 'empty metadata', value: {} },
    {
      name: 'missing role',
      value: {
        bottom: validSources.bottom,
        right: validSources.right,
        top: validSources.top,
      },
    },
    {
      name: 'path without reversed',
      value: {
        ...validSources,
        bottom: { kind: 'path', sourcePathId: 'bottom' },
      },
    },
    {
      name: 'null role',
      value: { ...validSources, left: null },
    },
    {
      name: 'unknown kind',
      value: { ...validSources, right: { kind: 'curve', sourcePathId: 'right' } },
    },
  ]

  for (const malformed of malformedSources) {
    let parsed: ReturnType<typeof parseSavedDiagramJson> | undefined

    assert.doesNotThrow(() => {
      parsed = parseSavedDiagramJson(
        savedLinkedDiagramWithBoundarySources(linked, malformed.value),
      )
    }, malformed.name)
    assert.equal(parsed?.ok, false, malformed.name)
    if (parsed?.ok === false) {
      assert.match(parsed.error, /invalid|malformed/i, malformed.name)
    }
  }
})

test('symbolic import rejects malformed linked metadata before pending resolution', () => {
  const linked = createLinkedPatch(createPathSourceDiagram())
  const symbolicLinked: Diagram = {
    ...linked,
    variables: [
      {
        id: 'variable-r',
        name: 'R',
        macroName: 'stzR',
        expression: '1',
        previewValue: 1,
      },
    ],
  }
  const malformedJson = savedLinkedDiagramWithBoundarySources(
    symbolicLinked,
    {},
  )
  let parsed: ReturnType<typeof parseSavedDiagramJsonForImport> | undefined

  assert.doesNotThrow(() => {
    parsed = parseSavedDiagramJsonForImport(malformedJson)
  })
  assert.equal(parsed?.ok, false)
  if (parsed?.ok === false) {
    assert.match(parsed.error, /invalid|malformed/i)
  }

  const pending = parseSavedDiagramJsonForImport(serializeDiagram(symbolicLinked))

  assert.equal(pending.ok, true)
  if (!pending.ok || pending.kind !== 'needsVariableResolution') {
    throw new Error('Expected a pending symbolic linked import.')
  }

  ;(
    findCoonsPatch(pending.pendingImport.diagram, 'patch')
      .primitive as unknown as { boundarySources: unknown }
  ).boundarySources = {}

  let resolved:
    | ReturnType<typeof resolvePendingSymbolicDiagramImport>
    | undefined

  assert.doesNotThrow(() => {
    resolved = resolvePendingSymbolicDiagramImport(pending.pendingImport, [
      { name: 'R', expression: '1' },
    ])
  })
  assert.equal(resolved?.ok, false)
  if (resolved?.ok === false) {
    assert.match(resolved.error, /invalid|malformed|boundarySources/i)
  }
})

test('layer duplication remaps copied sources while patch-only duplication keeps originals', () => {
  const linked = createLinkedPatch(createPathSourceDiagram())
  const duplicatedLayer = duplicateLayer(linked, 0, { targetLayerValue: 1 })
  const idMap = new Map(
    duplicatedLayer.idChanges.map(({ sourceId, copiedId }) => [sourceId, copiedId]),
  )
  const copiedPatchId = idMap.get('patch')

  assert.notEqual(copiedPatchId, undefined)
  const copiedPatch = findCoonsPatch(
    duplicatedLayer.diagram,
    copiedPatchId ?? 'missing',
  )
  assert.equal(copiedPatch.primitive.boundarySources?.bottom.sourcePathId, idMap.get('bottom'))
  assert.equal(copiedPatch.primitive.boundarySources?.right.sourcePathId, idMap.get('right'))

  const patchOnly = duplicateSelectedElements(linked, {
    kind: 'stratum',
    id: 'patch',
  })
  const patchCopyId = patchOnly.idChanges.find(
    (change) => change.sourceId === 'patch',
  )?.copiedId
  const patchCopy = findCoonsPatch(patchOnly.diagram, patchCopyId ?? 'missing')

  assert.equal(patchCopy.primitive.boundarySources?.bottom.sourcePathId, 'bottom')
  assert.notEqual(patchCopy.primitive.bottom, findCoonsPatch(linked, 'patch').primitive.bottom)

  const bulkTogether = duplicateSelectedElements(linked, {
    kind: 'multi',
    elements: ['bottom', 'right', 'top', 'left', 'patch'].map((id) => ({
      kind: 'stratum' as const,
      id,
    })),
  })
  const bulkIdMap = new Map(
    bulkTogether.idChanges.map(({ sourceId, copiedId }) => [sourceId, copiedId]),
  )
  const bulkPatch = findCoonsPatch(
    bulkTogether.diagram,
    bulkIdMap.get('patch') ?? 'missing',
  )

  assert.equal(
    bulkPatch.primitive.boundarySources?.bottom.sourcePathId,
    bulkIdMap.get('bottom'),
  )
  assert.equal(
    bulkPatch.primitive.boundarySources?.left.sourcePathId,
    bulkIdMap.get('left'),
  )
})

test('SVG and TikZ consume refreshed snapshots and no-op synchronization preserves identity', () => {
  const linked = createLinkedPatch(createPathSourceDiagram())
  const beforePatch = findCoonsPatch(linked, 'patch')
  const beforeSvg = curvedSheetToSvgMesh(beforePatch, createInitialCamera3D(), 240)
  const beforeTikz = generateTikz(linked)
  const edited = commitSourceUpdate(createEditorState(linked), 'bottom', (source) => {
    if (source.kind !== 'polyline') {
      return source
    }
    return {
      ...source,
      points: source.points.map((value, index) =>
        index === 1 ? point(0.5, 0, 0.7) : value,
      ),
    }
  }).editableDiagram
  const afterPatch = findCoonsPatch(edited, 'patch')
  const afterSvg = curvedSheetToSvgMesh(afterPatch, createInitialCamera3D(), 240)
  const afterTikz = generateTikz(edited)

  assert.notDeepEqual(afterSvg.faces, beforeSvg.faces)
  assert.notEqual(afterTikz, beforeTikz)
  assert.match(afterTikz, /Primitive: coonsPatch/)

  const noOp = synchronizeLinkedCoonsPatches(edited, edited)
  assert.equal(noOp.diagram, edited)
  assert.deepEqual(noOp.updatedPatchIds, [])
})

test('source direction reversal is detected and keeps the last valid patch', () => {
  const linked = createLinkedPatch(createPathSourceDiagram())
  const state = commitSourceUpdate(createEditorState(linked), 'bottom', (source) =>
    source.geometricKind === 'curve'
      ? reverseCurvePathDirection(source) ?? source
      : source,
  )

  assert.equal(coonsPatchBoundaryLinkStatus(state.editableDiagram, 'patch').kind, 'linkedStale')
  assert.deepEqual(
    findCoonsPatch(state.editableDiagram, 'patch').primitive,
    findCoonsPatch(linked, 'patch').primitive,
  )
})

test('creation and Inspector expose linked controls and detach action', () => {
  const appSource = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8')
  const inspectorSource = readFileSync(
    new URL('../../src/ui/inspector/CurvedSheetGeometryEditor.tsx', import.meta.url),
    'utf8',
  )

  assert.match(appSource, /Keep linked to boundary sources/)
  assert.match(appSource, /keepLinkedToBoundarySources: coonsPatchKeepLinked/)
  assert.match(inspectorSource, /Linked — up to date/)
  assert.match(inspectorSource, /The last valid patch geometry is being displayed\./)
  assert.match(inspectorSource, /Detach boundary links/)
})

function createPathSourceDiagram(
  options: { reverseTopSource?: boolean } = {},
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const top = options.reverseTopSource
    ? polyline('top', [point(1, 1, 0), point(0.5, 1, 0.15), point(0, 1, 0)])
    : concatenated('top', [
        { kind: 'line', start: point(0, 1, 0), end: point(0.5, 1, 0.15) },
        { kind: 'line', start: point(0.5, 1, 0.15), end: point(1, 1, 0) },
      ])

  return {
    ...diagram,
    strata: [
      polyline('bottom', [point(0, 0, 0), point(0.5, 0, 0.1), point(1, 0, 0)]),
      cubic('right', [
        point(1, 0, 0),
        point(1.15, 0.3, 0.2),
        point(0.85, 0.7, -0.2),
        point(1, 1, 0),
      ]),
      top,
      polyline('left', [point(0, 0, 0), point(-0.1, 0.5, 0.2), point(0, 1, 0)]),
    ],
  }
}

function createLinkedPatch(
  diagram: Diagram,
  overrides: CoonsPatchBoundaryPathSelections = {},
): Diagram {
  const result = createCoonsPatchFromBoundaryPaths(
    diagram,
    { ...defaultSelections(), ...overrides },
    { id: 'patch', layer: 0, sampling: { uSegments: 4, vSegments: 3 } },
  )

  if (!result.ok) {
    throw new Error(`Could not create linked patch: ${result.error}`)
  }

  return result.diagram
}

function createSymbolicEndpointLinkedPatch(): Diagram {
  const diagram = createPathSourceDiagram()
  const bottom = findPolyline(diagram, 'bottom')

  diagram.variables = [symbolicVariableR(1)]
  diagram.strata = diagram.strata.map((stratum) =>
    stratum.id === bottom.id
      ? {
          ...bottom,
          points: bottom.points.map((value, index) =>
            index === 2
              ? symbolicCoordinatePoint(value, 'x', 'R')
              : value,
          ),
        }
      : stratum,
  )

  return createLinkedPatch(diagram)
}

function createSymbolicInteriorLinkedPatch(): Diagram {
  const diagram = createPathSourceDiagram()
  const bottom = findPolyline(diagram, 'bottom')

  diagram.variables = [symbolicVariableR(0.1)]
  diagram.strata = diagram.strata.map((stratum) =>
    stratum.id === bottom.id
      ? {
          ...bottom,
          points: bottom.points.map((value, index) =>
            index === 1
              ? symbolicCoordinatePoint(value, 'z', 'R')
              : value,
          ),
        }
      : stratum,
  )

  return createLinkedPatch(diagram)
}

function symbolicVariableR(value: number) {
  return {
    id: 'variable-r',
    name: 'R',
    macroName: 'stzR',
    expression: `${value}`,
    previewValue: value,
  }
}

function symbolicCoordinatePoint(
  value: Vec3,
  axis: 'x' | 'y' | 'z',
  expression: string,
): Vec3 {
  const symbolic = symbolicVec3FromVec3(value)

  symbolic[axis] = {
    kind: 'symbolic',
    expression,
    previewValue: value[axis],
  }

  return { ...value, symbolic }
}

function createConstantPointSourceDiagram(
  withAnchor: boolean,
  sourcePointId = 'constant-point',
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  let position = point(0, 0, 0)
  let coordinateAnchors: CoordinateAnchor[] = []

  if (withAnchor) {
    const anchor: CoordinateAnchor = {
      id: 'anchor',
      name: 'Anchor',
      tikzName: 'anchor',
      position: {
        kind: 'global',
        value: symbolicVec3FromVec3(position),
      },
    }
    coordinateAnchors = [anchor]
    position = coordinateReferenceVec3ForAnchor(anchor, 3)
  }

  return {
    ...diagram,
    coordinateAnchors,
    strata: [pointStratum(sourcePointId, position, 3)],
  }
}

function createConstantPointPatch(
  diagram: Diagram,
  sourcePointId = 'constant-point',
): Diagram {
  const pointSource = { kind: 'point' as const, sourcePointId }
  const result = createCoonsPatchFromBoundaryPaths(
    diagram,
    {
      bottom: pointSource,
      right: pointSource,
      top: pointSource,
      left: pointSource,
    },
    { id: 'point-patch', sampling: { uSegments: 2, vSegments: 2 } },
  )

  if (!result.ok) {
    throw new Error(`Could not create point patch: ${result.error}`)
  }

  return result.diagram
}

function defaultSelections(): CoonsPatchBoundaryPathSelections {
  return {
    bottom: 'bottom',
    right: 'right',
    top: 'top',
    left: 'left',
  }
}

function createEditorState(diagram: Diagram): TestEditorState {
  return {
    editableDiagram: diagram,
    selectedElement: null,
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: createDiagramHistory(diagram),
  }
}

function commitSourceUpdate(
  state: TestEditorState,
  sourceId: string,
  updater: (source: Stratum) => Stratum,
): TestEditorState {
  const nextDiagram = updateStratumById(
    state.editableDiagram,
    sourceId,
    updater,
  )

  return commitDiagramChange(state, { ...state, editableDiagram: nextDiagram })
}

function savedLinkedDiagramWithBoundarySources(
  diagram: Diagram,
  boundarySources: unknown,
): string {
  const saved = JSON.parse(serializeDiagram(diagram)) as {
    diagram: {
      strata: Array<{
        id?: unknown
        primitive?: { boundarySources?: unknown }
      }>
    }
  }
  const patch = saved.diagram.strata.find((stratum) => stratum.id === 'patch')

  if (patch?.primitive === undefined) {
    throw new Error('Expected a saved Coons patch primitive.')
  }

  patch.primitive.boundarySources = boundarySources
  return JSON.stringify(saved)
}

function findCoonsPatch(diagram: Diagram, id: string): CurvedSheetStratum & {
  primitive: Extract<CurvedSheetStratum['primitive'], { kind: 'coonsPatch' }>
} {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (
    stratum?.geometricKind !== 'sheet' ||
    stratum.kind !== 'curvedSheet' ||
    stratum.primitive.kind !== 'coonsPatch'
  ) {
    throw new Error(`Expected Coons patch ${id}.`)
  }

  return stratum as CurvedSheetStratum & {
    primitive: Extract<CurvedSheetStratum['primitive'], { kind: 'coonsPatch' }>
  }
}

function findPolyline(diagram: Diagram, id: string): PolylineCurveStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'curve' || stratum.kind !== 'polyline') {
    throw new Error(`Expected polyline ${id}.`)
  }

  return stratum
}

function pathBoundary(
  boundary: ReturnType<typeof findCoonsPatch>['primitive']['bottom'],
) {
  if ('kind' in boundary && boundary.kind === 'constantPoint') {
    throw new Error('Expected path boundary.')
  }
  return boundary
}

function constantBoundary(
  boundary: ReturnType<typeof findCoonsPatch>['primitive']['bottom'],
) {
  if (!('kind' in boundary) || boundary.kind !== 'constantPoint') {
    throw new Error('Expected constant boundary.')
  }
  return boundary
}

function curveBase(id: string): Omit<CurveStratum, 'kind'> {
  return {
    id,
    codim: 2,
    geometricKind: 'curve',
    name: id,
    style: { ...defaultCurveStyle },
    styleSegments: [],
    layer: 0,
  }
}

function polyline(id: string, points: Vec3[]): PolylineCurveStratum {
  return { ...curveBase(id), kind: 'polyline', points }
}

function cubic(id: string, points: Vec3[]): CubicBezierCurveStratum {
  return { ...curveBase(id), kind: 'cubicBezier', points }
}

function concatenated(
  id: string,
  segments: ConcatenatedPathStratum['segments'],
): ConcatenatedPathStratum {
  return { ...curveBase(id), kind: 'concatenatedPath', segments }
}

function pointStratum(id: string, position: Vec3, layer: number): PointStratum {
  return {
    id,
    codim: 3,
    geometricKind: 'point',
    name: id,
    style: { ...defaultPointStyle },
    position,
    layer,
  }
}

function point(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

function standardFrame() {
  return {
    origin: point(0, 0, 0),
    u: point(1, 0, 0),
    v: point(0, 1, 0),
    normal: point(0, 0, 1),
  }
}
