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
import {
  collectTopLevelDiagramIds,
  nextVariableId,
} from '../../src/model/diagramIds.ts'
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
import { createCoordinateComponentFromInput } from '../../src/model/symbolicCoordinates.ts'
import {
  addSymbolicVariableToDiagram,
  updateSymbolicVariableInDiagram,
} from '../../src/model/variables.ts'
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
  updateVec3Coordinate,
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

type CoonsPatchPrimitive = Extract<
  CurvedSheetStratum['primitive'],
  { kind: 'coonsPatch' }
>

type CoonsPatchStratum = CurvedSheetStratum & {
  primitive: CoonsPatchPrimitive
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

  assert.deepEqual(
    coonsBoundarySnapshots(patch),
    coonsPrimitiveBoundarySnapshots(initialPrimitive),
  )
  assert.deepEqual(patch.primitive.boundarySources, initialPrimitive.boundarySources)
  assert.deepEqual(patch.primitive.sampling, initialPrimitive.sampling)
  assert.equal(patch.primitive.boundarySnapshotState, 'frozen')
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
  const initialSnapshots = coonsBoundarySnapshots(initialPatch)
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
  assert.deepEqual(coonsBoundarySnapshots(stalePatch), initialSnapshots)
  assert.equal(stalePatch.primitive.boundarySnapshotState, 'frozen')
  assert.equal(pathBoundary(stalePatch.primitive.bottom).segments[1]?.end.x, 1)
  assert.deepEqual(
    pathBoundary(stalePatch.primitive.bottom).segments[1]?.end.symbolic?.x,
    { kind: 'symbolic', expression: 'R', previewValue: 1 },
  )
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
  assert.deepEqual(coonsBoundarySnapshots(loadedPatch), initialSnapshots)
  assert.equal(loadedPatch.primitive.boundarySnapshotState, 'frozen')
  assert.equal(pathBoundary(loadedPatch.primitive.bottom).segments[1]?.end.x, 1)
  assert.deepEqual(
    pathBoundary(loadedPatch.primitive.bottom).segments[1]?.end.symbolic?.x,
    { kind: 'symbolic', expression: 'R', previewValue: 1 },
  )
  assert.deepEqual(sampleCoonsPatch(loadedPatch.primitive), initialMesh)
  assert.deepEqual(loadedSvg, initialSvg)
  assert.equal(loadedStatus.kind, 'linkedStale')
  assert.equal(validateDiagram(parsed.diagram).valid, true)
  assert.match(loadedTikz, /Primitive: coonsPatch/)

  const detachedDivergentDiagram = detachCoonsPatchBoundaryLinks(
    parsed.diagram,
    'patch',
  )
  const detachedDivergentPatch = findCoonsPatch(
    detachedDivergentDiagram,
    'patch',
  )

  assert.deepEqual(
    coonsPatchBoundaryLinkStatus(detachedDivergentDiagram, 'patch'),
    { kind: 'static' },
  )
  assert.equal(
    detachedDivergentPatch.primitive.boundarySnapshotState,
    'frozen',
  )
  assert.deepEqual(
    coonsBoundarySnapshots(detachedDivergentPatch),
    initialSnapshots,
  )
  assert.equal(validateDiagram(detachedDivergentDiagram).valid, true)

  const parsedDetachedDivergent = parseSavedDiagramJson(
    serializeDiagram(detachedDivergentDiagram),
  )

  assert.equal(parsedDetachedDivergent.ok, true)
  if (!parsedDetachedDivergent.ok) {
    throw new Error(parsedDetachedDivergent.error)
  }
  assert.deepEqual(
    coonsBoundarySnapshots(
      findCoonsPatch(parsedDetachedDivergent.diagram, 'patch'),
    ),
    initialSnapshots,
  )

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
  assert.equal(recoveredPatch.primitive.boundarySnapshotState, undefined)
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

test('equal-valued symbolic provenance synchronizes atomically and survives unused-variable edits', () => {
  const linked = createEqualValuedSymbolicInteriorLinkedPatch()
  const initialState = createEditorState(linked)
  const initialMesh = sampleCoonsPatch(findCoonsPatch(linked, 'patch').primitive)
  const initialSourcePoint = findPolyline(linked, 'bottom').points[1]

  assertLinkedSymbolicInteriorState(linked, {
    expression: 'R',
    rValue: 0.1,
    sValue: 0.1,
  })

  const sComponent = coordinateComponentForDiagram(linked, 'S')
  const expressionDiagram = updateStratumById(linked, 'bottom', (stratum) => {
    if (stratum.geometricKind !== 'curve' || stratum.kind !== 'polyline') {
      return stratum
    }

    return {
      ...stratum,
      points: stratum.points.map((value, index) =>
        index === 1
          ? updateVec3Coordinate(value, 'z', sComponent, 3)
          : value,
      ),
    }
  })
  const expressionSynchronization = synchronizeLinkedCoonsPatches(
    linked,
    expressionDiagram,
  )

  assert.deepEqual(expressionSynchronization.updatedPatchIds, ['patch'])

  const edited = commitDiagramChange(initialState, {
    ...initialState,
    editableDiagram: expressionDiagram,
  })
  const editedSourcePoint = findPolyline(
    edited.editableDiagram,
    'bottom',
  ).points[1]

  assert.equal(editedSourcePoint?.z, initialSourcePoint?.z)
  assert.equal(edited.history.past.length, 1)
  assert.deepEqual(edited.history.present, edited.editableDiagram)
  assertLinkedSymbolicInteriorState(edited.editableDiagram, {
    expression: 'S',
    rValue: 0.1,
    sValue: 0.1,
  })
  assert.deepEqual(
    sampleCoonsPatch(findCoonsPatch(edited.editableDiagram, 'patch').primitive),
    initialMesh,
  )

  const semanticallyObsolete = updateStratumById(
    edited.editableDiagram,
    'patch',
    (stratum) => {
      if (
        stratum.geometricKind !== 'sheet' ||
        stratum.kind !== 'curvedSheet' ||
        stratum.primitive.kind !== 'coonsPatch'
      ) {
        return stratum
      }

      const bottom = pathBoundary(stratum.primitive.bottom)
      const first = bottom.segments[0]

      if (first === undefined) {
        return stratum
      }

      return {
        ...stratum,
        primitive: {
          ...stratum.primitive,
          bottom: {
            ...bottom,
            segments: [
              {
                ...first,
                end: updateVec3Coordinate(
                  first.end,
                  'z',
                  coordinateComponentForDiagram(edited.editableDiagram, 'R'),
                  3,
                ),
              },
              ...bottom.segments.slice(1),
            ],
          },
        },
      }
    },
  )

  assert.equal(validateDiagram(semanticallyObsolete).valid, true)
  const obsoleteSource = findPolyline(semanticallyObsolete, 'bottom').points[1]
  const obsoleteSnapshot = pathBoundary(
    findCoonsPatch(semanticallyObsolete, 'patch').primitive.bottom,
  ).segments[0]?.end

  assert.equal(obsoleteSource?.z, obsoleteSnapshot?.z)
  assert.equal(obsoleteSource?.symbolic?.z.kind, 'symbolic')
  assert.equal(obsoleteSnapshot?.symbolic?.z.kind, 'symbolic')
  if (
    obsoleteSource?.symbolic?.z.kind !== 'symbolic' ||
    obsoleteSnapshot?.symbolic?.z.kind !== 'symbolic'
  ) {
    throw new Error('Expected the source and obsolete snapshot to stay symbolic.')
  }
  assert.equal(obsoleteSource.symbolic.z.expression, 'S')
  assert.equal(obsoleteSnapshot.symbolic.z.expression, 'R')
  assert.equal(obsoleteSource.symbolic.z.previewValue, 0.1)
  assert.equal(obsoleteSnapshot.symbolic.z.previewValue, 0.1)

  const obsoleteStatus = coonsPatchBoundaryLinkStatus(
    semanticallyObsolete,
    'patch',
  )

  assert.equal(obsoleteStatus.kind, 'linkedStale')
  if (obsoleteStatus.kind === 'linkedStale') {
    assert.equal(
      obsoleteStatus.issues.some((issue) => issue.kind === 'snapshotOutOfDate'),
      true,
    )
  }

  const undoneExpression = undoLastDiagramChange(edited)
  assertLinkedSymbolicInteriorState(undoneExpression.editableDiagram, {
    expression: 'R',
    rValue: 0.1,
    sValue: 0.1,
  })
  const redoneExpression = redoLastDiagramChange(undoneExpression)
  assertLinkedSymbolicInteriorState(redoneExpression.editableDiagram, {
    expression: 'S',
    rValue: 0.1,
    sValue: 0.1,
  })

  const beforeUnusedVariableEdit = structuredClone(
    findCoonsPatch(redoneExpression.editableDiagram, 'patch').primitive,
  )
  const unusedVariableUpdate = updateSymbolicVariableInDiagram(
    redoneExpression.editableDiagram,
    'variable-r',
    { expression: '0.7' },
  )

  assert.equal(unusedVariableUpdate.ok, true)
  if (!unusedVariableUpdate.ok) {
    throw new Error(unusedVariableUpdate.error)
  }

  const unusedVariableSynchronization = synchronizeLinkedCoonsPatches(
    redoneExpression.editableDiagram,
    unusedVariableUpdate.diagram,
  )

  assert.equal(unusedVariableSynchronization.diagram, unusedVariableUpdate.diagram)
  assert.deepEqual(unusedVariableSynchronization.updatedPatchIds, [])

  const unusedVariableEdited = commitDiagramChange(redoneExpression, {
    ...redoneExpression,
    editableDiagram: unusedVariableUpdate.diagram,
  })

  assert.equal(unusedVariableEdited.history.past.length, 2)
  assert.deepEqual(unusedVariableEdited.history.present, unusedVariableEdited.editableDiagram)
  assert.deepEqual(
    findCoonsPatch(unusedVariableEdited.editableDiagram, 'patch').primitive,
    beforeUnusedVariableEdit,
  )
  assertLinkedSymbolicInteriorState(unusedVariableEdited.editableDiagram, {
    expression: 'S',
    rValue: 0.7,
    sValue: 0.1,
  })
  assert.deepEqual(
    sampleCoonsPatch(
      findCoonsPatch(unusedVariableEdited.editableDiagram, 'patch').primitive,
    ),
    initialMesh,
  )

  const parsed = parseSavedDiagramJson(
    serializeDiagram(unusedVariableEdited.editableDiagram),
  )

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  assertLinkedSymbolicInteriorState(parsed.diagram, {
    expression: 'S',
    rValue: 0.7,
    sValue: 0.1,
  })

  const undoneUnusedVariable = undoLastDiagramChange(unusedVariableEdited)
  assertLinkedSymbolicInteriorState(undoneUnusedVariable.editableDiagram, {
    expression: 'S',
    rValue: 0.1,
    sValue: 0.1,
  })
  assert.deepEqual(
    findCoonsPatch(undoneUnusedVariable.editableDiagram, 'patch').primitive,
    beforeUnusedVariableEdit,
  )

  const undoneBoth = undoLastDiagramChange(undoneUnusedVariable)
  assertLinkedSymbolicInteriorState(undoneBoth.editableDiagram, {
    expression: 'R',
    rValue: 0.1,
    sValue: 0.1,
  })

  const redoneSource = redoLastDiagramChange(undoneBoth)
  assertLinkedSymbolicInteriorState(redoneSource.editableDiagram, {
    expression: 'S',
    rValue: 0.1,
    sValue: 0.1,
  })
  const redoneBoth = redoLastDiagramChange(redoneSource)
  assertLinkedSymbolicInteriorState(redoneBoth.editableDiagram, {
    expression: 'S',
    rValue: 0.7,
    sValue: 0.1,
  })

  const repeatedUndo = undoLastDiagramChange(redoneBoth)
  const repeatedRedo = redoLastDiagramChange(repeatedUndo)

  assertLinkedSymbolicInteriorState(repeatedUndo.editableDiagram, {
    expression: 'S',
    rValue: 0.1,
    sValue: 0.1,
  })
  assertLinkedSymbolicInteriorState(repeatedRedo.editableDiagram, {
    expression: 'S',
    rValue: 0.7,
    sValue: 0.1,
  })
  assert.deepEqual(repeatedRedo.editableDiagram, redoneBoth.editableDiagram)
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
  const linked = createSymbolicInteriorLinkedPatch()
  const beforePatch = findCoonsPatch(linked, 'patch')
  const before = structuredClone(beforePatch.primitive)
  const beforeSnapshots = coonsBoundarySnapshots(beforePatch)
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

  assert.deepEqual(coonsBoundarySnapshots(stalePatch), beforeSnapshots)
  assert.equal(stalePatch.primitive.boundarySnapshotState, 'frozen')
  assert.deepEqual(stalePatch.primitive.boundarySources, before.boundarySources)
  assert.deepEqual(
    pathBoundary(stalePatch.primitive.bottom).segments[0]?.end.symbolic?.z,
    { kind: 'symbolic', expression: 'R', previewValue: 0.1 },
  )
  assert.deepEqual(findCoonsPatch(linked, 'patch').primitive, before)
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
  assert.equal(repairedPatch.primitive.boundarySnapshotState, undefined)
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

  const stalePatch = findCoonsPatch(deleted.editableDiagram, 'patch')

  assert.deepEqual(
    coonsBoundarySnapshots(stalePatch),
    coonsPrimitiveBoundarySnapshots(fallback),
  )
  assert.deepEqual(stalePatch.primitive.boundarySources, fallback.boundarySources)
  assert.equal(stalePatch.primitive.boundarySnapshotState, 'frozen')
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

test('missing symbolic source preserves exact snapshots through load, detach, and history', () => {
  const linked = createSymbolicInteriorLinkedPatch()
  const previousPatch = findCoonsPatch(linked, 'patch')
  const previousSnapshots = coonsBoundarySnapshots(previousPatch)
  const previousPrimitive = structuredClone(previousPatch.primitive)
  const nextSampling = { uSegments: 5, vSegments: 6 }
  const editedPatchDiagram = updateStratumById(linked, 'patch', (stratum) =>
    stratum.geometricKind === 'sheet' &&
    stratum.kind === 'curvedSheet' &&
    stratum.primitive.kind === 'coonsPatch'
      ? {
          ...stratum,
          primitive: { ...stratum.primitive, sampling: nextSampling },
        }
      : stratum,
  )
  const deletedDiagram = {
    ...editedPatchDiagram,
    strata: editedPatchDiagram.strata.filter(
      (stratum) => stratum.id !== 'bottom',
    ),
  }
  const deleted = commitDiagramChange(createEditorState(linked), {
    ...createEditorState(linked),
    editableDiagram: deletedDiagram,
  })
  const stalePatch = findCoonsPatch(deleted.editableDiagram, 'patch')

  assert.equal(deleted.history.past.length, 1)
  assert.equal(
    deleted.editableDiagram.strata.some((stratum) => stratum.id === 'bottom'),
    false,
  )
  assert.equal(
    coonsPatchBoundaryLinkStatus(deleted.editableDiagram, 'patch').kind,
    'linkedStale',
  )
  assert.deepEqual(coonsBoundarySnapshots(stalePatch), previousSnapshots)
  assert.deepEqual(
    stalePatch.primitive.boundarySources,
    previousPrimitive.boundarySources,
  )
  assert.deepEqual(stalePatch.primitive.sampling, nextSampling)
  assert.equal(stalePatch.primitive.boundarySnapshotState, 'frozen')
  for (const role of ['bottom', 'right', 'top', 'left'] as const) {
    const previousBoundary = pathBoundary(previousPatch.primitive[role])
    const staleBoundary = pathBoundary(stalePatch.primitive[role])

    assert.notEqual(staleBoundary, previousBoundary)
    assert.notEqual(staleBoundary.segments[0], previousBoundary.segments[0])
  }
  assert.deepEqual(
    pathBoundary(stalePatch.primitive.bottom).segments[0]?.end.symbolic?.z,
    { kind: 'symbolic', expression: 'R', previewValue: 0.1 },
  )
  assert.doesNotThrow(() => sampleCoonsPatch(stalePatch.primitive))

  // Synchronization must not mutate or replace the previous diagram's
  // committed snapshots while cloning them into the stale next state.
  for (const role of ['bottom', 'right', 'top', 'left'] as const) {
    assert.equal(
      findCoonsPatch(linked, 'patch').primitive[role],
      previousPatch.primitive[role],
    )
  }
  assert.deepEqual(findCoonsPatch(linked, 'patch').primitive, previousPrimitive)

  const undone = undoLastDiagramChange(deleted)
  const redone = redoLastDiagramChange(undone)
  const undoneAgain = undoLastDiagramChange(redone)
  const redoneAgain = redoLastDiagramChange(undoneAgain)

  assert.notEqual(
    undone.editableDiagram.strata.find((stratum) => stratum.id === 'bottom'),
    undefined,
  )
  assert.deepEqual(
    coonsPatchBoundaryLinkStatus(undone.editableDiagram, 'patch'),
    { kind: 'linkedUpToDate' },
  )
  for (const state of [redone, redoneAgain]) {
    const patch = findCoonsPatch(state.editableDiagram, 'patch')

    assert.equal(
      coonsPatchBoundaryLinkStatus(state.editableDiagram, 'patch').kind,
      'linkedStale',
    )
    assert.deepEqual(coonsBoundarySnapshots(patch), previousSnapshots)
    assert.deepEqual(patch.primitive.sampling, nextSampling)
    assert.deepEqual(
      pathBoundary(patch.primitive.bottom).segments[0]?.end.symbolic?.z,
      { kind: 'symbolic', expression: 'R', previewValue: 0.1 },
    )
  }

  const parsed = parseSavedDiagramJson(serializeDiagram(redoneAgain.editableDiagram))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const loadedPatch = findCoonsPatch(parsed.diagram, 'patch')
  assert.deepEqual(coonsBoundarySnapshots(loadedPatch), previousSnapshots)
  assert.deepEqual(loadedPatch.primitive.sampling, nextSampling)
  assert.deepEqual(
    pathBoundary(loadedPatch.primitive.bottom).segments[0]?.end.symbolic?.z,
    { kind: 'symbolic', expression: 'R', previewValue: 0.1 },
  )
  assert.equal(coonsPatchBoundaryLinkStatus(parsed.diagram, 'patch').kind, 'linkedStale')
  assert.equal(validateDiagram(parsed.diagram).valid, true)
  assert.doesNotThrow(() => sampleCoonsPatch(loadedPatch.primitive))
  assert.doesNotThrow(() =>
    curvedSheetToSvgMesh(loadedPatch, createInitialCamera3D(), 240),
  )
  assert.doesNotThrow(() => generateTikz(parsed.diagram))

  const loadedState = createEditorState(parsed.diagram)
  const detached = commitDiagramChange(loadedState, {
    ...loadedState,
    editableDiagram: detachCoonsPatchBoundaryLinks(parsed.diagram, 'patch'),
  })
  const detachedPatch = findCoonsPatch(detached.editableDiagram, 'patch')
  const {
    boundarySources: loadedBoundarySources,
    ...loadedPrimitiveWithoutLinks
  } = loadedPatch.primitive
  const {
    boundarySources: detachedBoundarySources,
    ...detachedPrimitiveWithoutLinks
  } = detachedPatch.primitive

  assert.equal(detached.history.past.length, 1)
  assert.notEqual(loadedBoundarySources, undefined)
  assert.equal(detachedBoundarySources, undefined)
  assert.deepEqual(detachedPrimitiveWithoutLinks, loadedPrimitiveWithoutLinks)
  assert.deepEqual(
    coonsPatchBoundaryLinkStatus(detached.editableDiagram, 'patch'),
    { kind: 'static' },
  )
  assert.equal(detachedPatch.primitive.boundarySnapshotState, 'frozen')
  assert.deepEqual(coonsBoundarySnapshots(detachedPatch), previousSnapshots)
  assert.deepEqual(
    pathBoundary(detachedPatch.primitive.bottom).segments[0]?.end.symbolic?.z,
    { kind: 'symbolic', expression: 'R', previewValue: 0.1 },
  )
  assert.equal(validateDiagram(detached.editableDiagram).valid, true)

  const parsedDetached = parseSavedDiagramJson(
    serializeDiagram(detached.editableDiagram),
  )

  assert.equal(parsedDetached.ok, true)
  if (!parsedDetached.ok) {
    throw new Error(parsedDetached.error)
  }
  assert.deepEqual(
    coonsBoundarySnapshots(findCoonsPatch(parsedDetached.diagram, 'patch')),
    previousSnapshots,
  )

  const editedFormerSource = commitSourceUpdate(
    detached,
    'right',
    (source) =>
      source.geometricKind === 'curve' && source.kind === 'cubicBezier'
        ? {
            ...source,
            points: source.points.map((value, index) =>
              index === 1 ? { ...value, z: value.z + 1 } : value,
            ),
          }
        : source,
  )

  assert.deepEqual(
    coonsBoundarySnapshots(findCoonsPatch(editedFormerSource.editableDiagram, 'patch')),
    previousSnapshots,
  )

  const restoredLinks = undoLastDiagramChange(detached)
  const restoredPatch = findCoonsPatch(restoredLinks.editableDiagram, 'patch')

  assert.deepEqual(restoredPatch.primitive.boundarySources, previousPrimitive.boundarySources)
  assert.deepEqual(coonsBoundarySnapshots(restoredPatch), previousSnapshots)
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
  assert.deepEqual(
    coonsBoundarySnapshots(stalePatch),
    coonsPrimitiveBoundarySnapshots(fallback),
  )
  assert.deepEqual(stalePatch.primitive.boundarySources, fallback.boundarySources)
  assert.equal(stalePatch.primitive.boundarySnapshotState, 'frozen')

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

test('loaded dangling Coons source ids stay reserved for variable allocation', () => {
  const linked = createConstantPointPatch(
    createConstantPointSourceDiagram(false, 'variable-1'),
    'variable-1',
  )
  const dangling = {
    ...linked,
    strata: linked.strata.filter((stratum) => stratum.id !== 'variable-1'),
  }
  const parsed = parseSavedDiagramJson(serializeDiagram(dangling))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const fallback = structuredClone(
    findCoonsPatch(parsed.diagram, 'point-patch').primitive,
  )
  const reservedIds = collectTopLevelDiagramIds(parsed.diagram)
  const variableId = nextVariableId(parsed.diagram)

  assert.equal(reservedIds.has('variable-1'), true)
  assert.notEqual(variableId, 'variable-1')
  assert.equal(variableId, 'variable-2')

  const added = addSymbolicVariableToDiagram(parsed.diagram, {
    id: variableId,
    name: 'R',
    expression: '1',
  })

  assert.equal(added.ok, true)
  if (!added.ok) {
    throw new Error(added.error)
  }

  const patch = findCoonsPatch(added.diagram, 'point-patch')

  assert.equal(added.diagram.variables?.[0]?.id, 'variable-2')
  assert.deepEqual(patch.primitive.boundarySources?.bottom, {
    kind: 'point',
    sourcePointId: 'variable-1',
  })
  assert.equal(
    coonsPatchBoundaryLinkStatus(added.diagram, 'point-patch').kind,
    'linkedStale',
  )
  assert.deepEqual(patch.primitive, fallback)
  assert.equal(validateDiagram(added.diagram).valid, true)
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
  const beforeBoundaries = structuredClone({
    bottom: before.bottom,
    right: before.right,
    top: before.top,
    left: before.left,
  })
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
  assert.deepEqual(
    {
      bottom: afterUnrelated.bottom,
      right: afterUnrelated.right,
      top: afterUnrelated.top,
      left: afterUnrelated.left,
    },
    beforeBoundaries,
  )
  assert.equal(unrelated.history.past.length, 1)

  const cosmeticSourceDiagram = updateStratumById(
    unrelated.editableDiagram,
    'bottom',
    (stratum) =>
      stratum.geometricKind === 'curve'
        ? {
            ...stratum,
            name: 'Cosmetically renamed bottom source',
            style: { ...stratum.style, strokeColor: '#c026d3' },
          }
        : stratum,
  )
  const cosmeticSynchronization = synchronizeLinkedCoonsPatches(
    unrelated.editableDiagram,
    cosmeticSourceDiagram,
  )

  assert.equal(cosmeticSynchronization.diagram, cosmeticSourceDiagram)
  assert.deepEqual(cosmeticSynchronization.updatedPatchIds, [])

  const cosmetic = commitDiagramChange(unrelated, {
    ...unrelated,
    editableDiagram: cosmeticSourceDiagram,
  })
  const afterCosmetic = findCoonsPatch(
    cosmetic.editableDiagram,
    'patch',
  ).primitive

  assert.equal(cosmetic.history.past.length, 2)
  assert.deepEqual(
    {
      bottom: afterCosmetic.bottom,
      right: afterCosmetic.right,
      top: afterCosmetic.top,
      left: afterCosmetic.left,
    },
    beforeBoundaries,
  )
  assert.equal(
    pathBoundary(afterCosmetic.bottom).name,
    pathBoundary(before.bottom).name,
  )

  const samplingDiagram = updateStratumById(
    cosmetic.editableDiagram,
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
  const sampled = commitDiagramChange(cosmetic, {
    ...cosmetic,
    editableDiagram: samplingDiagram,
  })
  const afterSampling = findCoonsPatch(sampled.editableDiagram, 'patch').primitive

  assert.equal(afterSampling.bottom, afterUnrelated.bottom)
  assert.deepEqual(afterSampling.sampling, { uSegments: 3, vSegments: 4 })
  assert.equal(sampled.history.past.length, 3)
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

test('malformed frozen snapshot state is rejected cleanly on load', () => {
  const saved = JSON.parse(
    serializeDiagram(createLinkedPatch(createPathSourceDiagram())),
  ) as {
    diagram: {
      strata: Array<{
        id?: unknown
        primitive?: {
          boundarySnapshotState?: unknown
          boundarySources?: unknown
        }
      }>
    }
  }
  const patch = saved.diagram.strata.find((stratum) => stratum.id === 'patch')

  if (patch?.primitive === undefined) {
    throw new Error('Expected a saved Coons patch primitive.')
  }

  delete patch.primitive.boundarySources
  patch.primitive.boundarySnapshotState = 'thawed'

  let parsed: ReturnType<typeof parseSavedDiagramJson> | undefined

  assert.doesNotThrow(() => {
    parsed = parseSavedDiagramJson(JSON.stringify(saved))
  })
  assert.equal(parsed?.ok, false)
  if (parsed?.ok === false) {
    assert.match(parsed.error, /snapshot state|frozen|invalid/i)
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
  const linked = createLinkedPatch(
    createPathSourceDiagram({ reverseTopSource: true }),
    { top: { sourcePathId: 'top', reversed: true } },
  )
  const originalPatch = findCoonsPatch(linked, 'patch')
  const originalSources = structuredClone(originalPatch.primitive.boundarySources)

  assert.deepEqual(coonsPatchBoundaryLinkStatus(linked, 'patch'), {
    kind: 'linkedUpToDate',
  })
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
  const copiedSources = copiedPatch.primitive.boundarySources

  assert.notEqual(copiedSources, undefined)
  if (copiedSources === undefined) {
    throw new Error('Expected copied linked boundary sources.')
  }
  assert.deepEqual(Object.keys(copiedSources).sort(), [
    'bottom',
    'left',
    'right',
    'top',
  ])
  assert.deepEqual(copiedSources.bottom, {
    kind: 'path',
    sourcePathId: idMap.get('bottom'),
    reversed: false,
  })
  assert.deepEqual(copiedSources.right, {
    kind: 'path',
    sourcePathId: idMap.get('right'),
    reversed: false,
  })
  assert.deepEqual(copiedSources.top, {
    kind: 'path',
    sourcePathId: idMap.get('top'),
    reversed: true,
  })
  assert.deepEqual(copiedSources.left, {
    kind: 'path',
    sourcePathId: idMap.get('left'),
    reversed: false,
  })
  assert.deepEqual(
    findCoonsPatch(duplicatedLayer.diagram, 'patch').primitive.boundarySources,
    originalSources,
  )
  assert.equal(validateDiagram(duplicatedLayer.diagram).valid, true)
  assert.deepEqual(
    coonsPatchBoundaryLinkStatus(duplicatedLayer.diagram, copiedPatch.id),
    { kind: 'linkedUpToDate' },
  )

  for (const role of ['bottom', 'right', 'top', 'left'] as const) {
    const copiedBoundary = pathBoundary(copiedPatch.primitive[role])
    const originalBoundary = pathBoundary(originalPatch.primitive[role])

    assert.notEqual(copiedBoundary, originalBoundary)
    assert.deepEqual(copiedBoundary, originalBoundary)
    assert.notEqual(copiedBoundary.segments, originalBoundary.segments)
    assert.notEqual(copiedBoundary.segments[0], originalBoundary.segments[0])
    assert.notEqual(
      copiedBoundary.segments[0]?.start,
      originalBoundary.segments[0]?.start,
    )
  }

  const patchOnly = duplicateSelectedElements(linked, {
    kind: 'stratum',
    id: 'patch',
  })
  const patchCopyId = patchOnly.idChanges.find(
    (change) => change.sourceId === 'patch',
  )?.copiedId
  const patchCopy = findCoonsPatch(patchOnly.diagram, patchCopyId ?? 'missing')

  assert.deepEqual(patchCopy.primitive.boundarySources, originalSources)
  assert.deepEqual(
    findCoonsPatch(patchOnly.diagram, 'patch').primitive.boundarySources,
    originalSources,
  )
  assert.deepEqual(coonsPatchBoundaryLinkStatus(patchOnly.diagram, patchCopy.id), {
    kind: 'linkedUpToDate',
  })
  for (const role of ['bottom', 'right', 'top', 'left'] as const) {
    const copiedBoundary = pathBoundary(patchCopy.primitive[role])
    const originalBoundary = pathBoundary(originalPatch.primitive[role])

    assert.notEqual(copiedBoundary, originalBoundary)
    assert.deepEqual(copiedBoundary, originalBoundary)
    assert.notEqual(copiedBoundary.segments[0], originalBoundary.segments[0])
    assert.notEqual(
      copiedBoundary.segments[0]?.start,
      originalBoundary.segments[0]?.start,
    )
  }

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
  const bulkSources = bulkPatch.primitive.boundarySources

  assert.notEqual(bulkSources, undefined)
  if (bulkSources === undefined) {
    throw new Error('Expected bulk-copied linked boundary sources.')
  }
  assert.deepEqual(Object.keys(bulkSources).sort(), [
    'bottom',
    'left',
    'right',
    'top',
  ])
  assert.deepEqual(bulkSources.bottom, {
    kind: 'path',
    sourcePathId: bulkIdMap.get('bottom'),
    reversed: false,
  })
  assert.deepEqual(bulkSources.right, {
    kind: 'path',
    sourcePathId: bulkIdMap.get('right'),
    reversed: false,
  })
  assert.deepEqual(bulkSources.top, {
    kind: 'path',
    sourcePathId: bulkIdMap.get('top'),
    reversed: true,
  })
  assert.deepEqual(bulkSources.left, {
    kind: 'path',
    sourcePathId: bulkIdMap.get('left'),
    reversed: false,
  })
  assert.deepEqual(
    findCoonsPatch(bulkTogether.diagram, 'patch').primitive.boundarySources,
    originalSources,
  )
  assert.equal(validateDiagram(bulkTogether.diagram).valid, true)
  assert.deepEqual(
    coonsPatchBoundaryLinkStatus(bulkTogether.diagram, bulkPatch.id),
    { kind: 'linkedUpToDate' },
  )
  for (const role of ['bottom', 'right', 'top', 'left'] as const) {
    const copiedBoundary = pathBoundary(bulkPatch.primitive[role])
    const originalBoundary = pathBoundary(originalPatch.primitive[role])

    assert.notEqual(copiedBoundary, originalBoundary)
    assert.deepEqual(copiedBoundary, originalBoundary)
    assert.notEqual(copiedBoundary.segments, originalBoundary.segments)
    assert.notEqual(copiedBoundary.segments[0], originalBoundary.segments[0])
    assert.notEqual(
      copiedBoundary.segments[0]?.start,
      originalBoundary.segments[0]?.start,
    )
  }
  assert.deepEqual(coonsPatchBoundaryLinkStatus(bulkTogether.diagram, 'patch'), {
    kind: 'linkedUpToDate',
  })
})

test('SVG and TikZ consume refreshed snapshots and no-op synchronization preserves identity', () => {
  const linked = updateStratumById(
    createLinkedPatch(createPathSourceDiagram()),
    'patch',
    (stratum) => ({ ...stratum, name: 'Unique linked Coons regression' }),
  )
  const beforePatch = findCoonsPatch(linked, 'patch')
  const beforeSvg = curvedSheetToSvgMesh(beforePatch, createInitialCamera3D(), 240)
  const beforeTikz = generateTikz(linked)
  const beforeCoonsBlock = extractCoonsPatchTikzBlock(beforeTikz, 'patch')
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
  const afterCoonsBlock = extractCoonsPatchTikzBlock(afterTikz, 'patch')

  assert.notDeepEqual(afterSvg.faces, beforeSvg.faces)
  assert.notEqual(afterCoonsBlock, beforeCoonsBlock)
  assert.match(
    beforeCoonsBlock,
    /\\coordinate \([^)]*p2\) at \(0\.5,0,0\.1\);/,
  )
  assert.match(
    afterCoonsBlock,
    /\\coordinate \([^)]*p2\) at \(0\.5,0,0\.7\);/,
  )
  assert.doesNotMatch(
    afterCoonsBlock,
    /\\coordinate \([^)]*p2\) at \(0\.5,0,0\.1\);/,
  )

  const noOp = synchronizeLinkedCoonsPatches(edited, edited)
  assert.equal(noOp.diagram, edited)
  assert.deepEqual(noOp.updatedPatchIds, [])

  const stale = commitSourceUpdate(
    createEditorState(edited),
    'bottom',
    (source) => {
      if (source.kind !== 'polyline') {
        return source
      }

      return {
        ...source,
        points: source.points.map((value, index) =>
          index === 2 ? point(1.25, 0, 0) : value,
        ),
      }
    },
  ).editableDiagram
  const staleTikz = generateTikz(stale)
  const staleCoonsBlock = extractCoonsPatchTikzBlock(staleTikz, 'patch')

  assert.equal(coonsPatchBoundaryLinkStatus(stale, 'patch').kind, 'linkedStale')
  assert.match(
    staleTikz,
    /\\coordinate \(curvePolybottom0p2\) at \(1\.25,0,0\);/,
  )
  assert.doesNotMatch(
    afterTikz,
    /\\coordinate \(curvePolybottom0p2\) at \(1\.25,0,0\);/,
  )
  assert.equal(staleCoonsBlock, afterCoonsBlock)
  assert.match(
    staleCoonsBlock,
    /\\coordinate \([^)]*p4\) at \(1,0,0\);/,
  )
  assert.doesNotMatch(staleCoonsBlock, /\(1\.25,0,0\)/)

  const inlineTikz = generateTikz(stale, { exportMode: 'inlineMath' })
  const inlineCoonsBlock = extractCoonsPatchTikzBlock(inlineTikz, 'patch')

  assert.match(inlineTikz, /^\\begin\{tikzpicture\}\[baseline=/)
  assert.match(inlineTikz, /\\end\{tikzpicture\}$/)
  assert.doesNotMatch(inlineTikz, /\n[ \t]*\n/)
  assert.match(
    inlineCoonsBlock,
    /\\coordinate \([^)]*p2\) at \(0\.5,0,0\.7\);/,
  )
  assert.match(
    inlineCoonsBlock,
    /\\coordinate \([^)]*p4\) at \(1,0,0\);/,
  )
  assert.doesNotMatch(inlineCoonsBlock, /\(1\.25,0,0\)/)
  assert.doesNotMatch(
    inlineCoonsBlock,
    /boundarySources|sourcePathId|sourcePointId|reversed|linkedUpToDate|linkedStale/,
  )
  assert.match(inlineCoonsBlock, /^ {8}\\coordinate /m)
  assert.match(inlineCoonsBlock, /^ {12}% Curved sheet /m)
  assert.match(inlineCoonsBlock, /^ {12}\\begin\{scope\}\[/m)
  assert.match(inlineCoonsBlock, /^ {16}\\filldraw /m)

  for (const line of inlineCoonsBlock.split('\n')) {
    const indentation = line.match(/^ */)?.[0].length ?? 0

    assert.equal(indentation % 4, 0, `Unexpected TikZ indentation: ${line}`)
  }
})

test('source direction reversal is detected and keeps the last valid patch', () => {
  const linked = createLinkedPatch(createPathSourceDiagram())
  const state = commitSourceUpdate(createEditorState(linked), 'bottom', (source) =>
    source.geometricKind === 'curve'
      ? reverseCurvePathDirection(source) ?? source
      : source,
  )

  assert.equal(coonsPatchBoundaryLinkStatus(state.editableDiagram, 'patch').kind, 'linkedStale')
  const stalePatch = findCoonsPatch(state.editableDiagram, 'patch')
  const originalPatch = findCoonsPatch(linked, 'patch')

  assert.deepEqual(
    coonsBoundarySnapshots(stalePatch),
    coonsBoundarySnapshots(originalPatch),
  )
  assert.deepEqual(
    stalePatch.primitive.boundarySources,
    originalPatch.primitive.boundarySources,
  )
  assert.equal(stalePatch.primitive.boundarySnapshotState, 'frozen')
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

function extractCoonsPatchTikzBlock(tikz: string, patchId: string): string {
  const marker = new RegExp(
    `^[ \\t]*% Curved sheet "[^"\\r\\n]*" \\[${escapeRegExp(patchId)}\\] sampled mesh export\\.$`,
    'm',
  ).exec(tikz)

  assert.notEqual(marker, null)
  if (marker === null || marker.index === undefined) {
    throw new Error(`Expected a TikZ marker for Coons patch ${patchId}.`)
  }

  const scopeStart = tikz.indexOf('\\begin{scope}[', marker.index)
  const scopeEndToken = '\\end{scope}'
  const scopeEnd = tikz.indexOf(scopeEndToken, scopeStart)

  assert.notEqual(scopeStart, -1)
  assert.notEqual(scopeEnd, -1)
  if (scopeStart === -1 || scopeEnd === -1) {
    throw new Error(`Expected a sampled TikZ scope for Coons patch ${patchId}.`)
  }

  const drawingBlock = tikz.slice(
    marker.index,
    scopeEnd + scopeEndToken.length,
  )

  assert.match(drawingBlock, /Primitive: coonsPatch/)

  const allCoordinateDefinitions = [
    ...tikz.matchAll(
      /^[ \\t]*\\coordinate \(([^)]+)\) at [^\r\n]+;$/gm,
    ),
  ]
  const definedCoordinateNames = new Set(
    allCoordinateDefinitions.map((match) => match[1] ?? ''),
  )
  const referencedCoordinates = new Set(
    [...drawingBlock.matchAll(/\(([A-Za-z][A-Za-z0-9]*)\)/g)]
      .map((match) => match[1] ?? '')
      .filter((name) => definedCoordinateNames.has(name)),
  )
  const coordinateDefinitions = allCoordinateDefinitions
    .filter((match) => referencedCoordinates.has(match[1] ?? ''))
    .map((match) => match[0])

  assert.ok(referencedCoordinates.size > 0)
  assert.equal(coordinateDefinitions.length, referencedCoordinates.size)

  return [...coordinateDefinitions, drawingBlock].join('\n')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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

function createEqualValuedSymbolicInteriorLinkedPatch(): Diagram {
  const diagram = createPathSourceDiagram()
  const bottom = findPolyline(diagram, 'bottom')

  diagram.variables = [
    symbolicVariableR(0.1),
    {
      id: 'variable-s',
      name: 'S',
      macroName: 'stzS',
      expression: '0.1',
      previewValue: 0.1,
    },
  ]
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

function coordinateComponentForDiagram(diagram: Diagram, expression: string) {
  const variables = diagram.variables ?? []
  const result = createCoordinateComponentFromInput(expression, {
    variableNames: variables.map((variable) => variable.name),
    previewValues: new Map(
      variables.map((variable) => [variable.name, variable.previewValue]),
    ),
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.component
}

function assertLinkedSymbolicInteriorState(
  diagram: Diagram,
  expected: {
    expression: 'R' | 'S'
    rValue: number
    sValue: number
  },
): void {
  const sourcePoint = findPolyline(diagram, 'bottom').points[1]
  const bottom = pathBoundary(findCoonsPatch(diagram, 'patch').primitive.bottom)
  const firstSnapshotPoint = bottom.segments[0]?.end
  const secondSnapshotPoint = bottom.segments[1]?.start

  assert.notEqual(sourcePoint, undefined)
  assert.notEqual(firstSnapshotPoint, undefined)
  assert.notEqual(secondSnapshotPoint, undefined)
  if (
    sourcePoint === undefined ||
    firstSnapshotPoint === undefined ||
    secondSnapshotPoint === undefined
  ) {
    throw new Error('Expected the symbolic bottom midpoint in source and snapshot.')
  }

  for (const value of [sourcePoint, firstSnapshotPoint, secondSnapshotPoint]) {
    const component = value.symbolic?.z

    assert.equal(value.z, 0.1)
    assert.equal(component?.kind, 'symbolic')
    if (component?.kind !== 'symbolic') {
      throw new Error('Expected a symbolic z component.')
    }
    assert.equal(component.expression, expected.expression)
    assert.equal(component.previewValue, 0.1)
  }

  const r = diagram.variables?.find((variable) => variable.name === 'R')
  const s = diagram.variables?.find((variable) => variable.name === 'S')

  assert.equal(r?.expression, `${expected.rValue}`)
  assert.equal(r?.previewValue, expected.rValue)
  assert.equal(s?.expression, `${expected.sValue}`)
  assert.equal(s?.previewValue, expected.sValue)
  assert.deepEqual(coonsPatchBoundaryLinkStatus(diagram, 'patch'), {
    kind: 'linkedUpToDate',
  })

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, true, JSON.stringify(validation.errors))
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

function coonsBoundarySnapshots(patch: CoonsPatchStratum) {
  return coonsPrimitiveBoundarySnapshots(patch.primitive)
}

function coonsPrimitiveBoundarySnapshots(primitive: CoonsPatchPrimitive) {
  return structuredClone({
    bottom: primitive.bottom,
    right: primitive.right,
    top: primitive.top,
    left: primitive.left,
  })
}

function findCoonsPatch(diagram: Diagram, id: string): CoonsPatchStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (
    stratum?.geometricKind !== 'sheet' ||
    stratum.kind !== 'curvedSheet' ||
    stratum.primitive.kind !== 'coonsPatch'
  ) {
    throw new Error(`Expected Coons patch ${id}.`)
  }

  return stratum as CoonsPatchStratum
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
