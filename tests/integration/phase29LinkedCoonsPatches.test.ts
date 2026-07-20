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
import { duplicateLayer } from '../../src/model/layers.ts'
import { reverseCurvePathDirection } from '../../src/model/paths.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { defaultCurveStyle, defaultPointStyle } from '../../src/model/styles.ts'
import { symbolicVec3FromVec3 } from '../../src/model/coordinateAnchors.ts'
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
import { updateStratumById } from '../../src/ui/diagramUpdates.ts'
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

function createConstantPointSourceDiagram(withAnchor: boolean): Diagram {
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
    strata: [pointStratum('constant-point', position, 3)],
  }
}

function createConstantPointPatch(diagram: Diagram): Diagram {
  const pointSource = { kind: 'point' as const, sourcePointId: 'constant-point' }
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
