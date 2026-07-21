import assert from 'node:assert/strict'
import test from 'node:test'
import { sampleCurvedSheetPrimitive } from '../../src/geometry/curvedSheets.ts'
import {
  createCurveStratum,
  createCurvedSheetStratum,
  createEmptyDiagram,
  createPointStratum,
  createTextLabel,
} from '../../src/model/constructors.ts'
import { detachCoonsPatchBoundaryLinks } from '../../src/model/coonsPatchLinks.ts'
import { setLayerVisibility } from '../../src/model/layers.ts'
import type {
  BoundaryPathSnapshot,
  Camera3D,
  CoonsPatchBoundarySources,
  CoonsPatchPrimitive,
  CurvedSheetPrimitive,
  CurvedSheetStratum,
  Diagram,
  Stratum,
  SurfaceSampling,
  Vec3,
  VisibilityOptions,
} from '../../src/model/types.ts'
import {
  defaultVisibilityOptions,
} from '../../src/model/visibility.ts'
import {
  classifyCurveOcclusion,
  type CurveOcclusionResult,
} from '../../src/rendering/curveOcclusion.ts'
import {
  curvedSheetSvgMeshesFromPreparedScene,
  curvedSheetToSvgMesh,
} from '../../src/rendering/curvedSheetMesh.ts'
import {
  classifyAnchorOcclusion,
  type AnchorOcclusionResult,
  type AnchorOcclusionTarget,
} from '../../src/rendering/pointOcclusion.ts'
import {
  projectSurfaceFace3D,
  type ProjectedSurfaceFace,
} from '../../src/rendering/projectedPrimitives.ts'
import {
  createSvgSurfacePreparationCache,
  prepareSvgSurfaceGeometry,
  projectSvgSurfaceScene,
  type CurvedSheetSampler,
  type SampledSurfaceGeometry,
  type SurfaceFaceProjector,
} from '../../src/rendering/svgSurfaceScene.ts'
import {
  sortedPreparedSvgSurfaceFaces,
  sortedSvgSurfaceFaces,
} from '../../src/rendering/svgSurfaceDepthSort.ts'
import {
  prepareSvgVisibility,
  visibleSvgSheetIds,
} from '../../src/rendering/svgVisibilityPreparation.ts'

const viewportHeight = 240

const occlusionCamera: Camera3D = {
  mode: '3d',
  kind: 'orthographic',
  thetaDeg: 90,
  phiDeg: 0,
  zoom: 40,
  pan: { x: 120, y: 120 },
}

const projectionCamera: Camera3D = {
  mode: '3d',
  kind: 'orthographic',
  thetaDeg: 70,
  phiDeg: 110,
  zoom: 32,
  pan: { x: 118, y: 104 },
}

const rotatedCamera: Camera3D = {
  ...projectionCamera,
  thetaDeg: 48,
  phiDeg: 145,
  pan: { x: 126, y: 98 },
}

const automaticVisibility: VisibilityOptions = {
  ...defaultVisibilityOptions,
  enabled: true,
  surfaceDepthSort: true,
  curveOcclusion: true,
  pointVisibility: 'dimHidden',
  labelVisibility: 'autoDim',
  maxSurfaceFacesForSorting: 256,
}

test('one prepared surface scene is shared by sorting and every occlusion consumer', () => {
  const fixture = previewFixture()
  const counters = createPreparationCounters()
  const cache = createSvgSurfacePreparationCache()
  const standaloneSorted = sortedSvgSurfaceFaces(
    fixture.diagram,
    occlusionCamera,
    viewportHeight,
    automaticVisibility,
  )
  const standaloneCurves = classifyCurveOcclusion(fixture.diagram, {
    camera: occlusionCamera,
    visibility: automaticVisibility,
    occludingSurfaceIds: new Set([fixture.sheet.id]),
  })
  const standalonePoints = classifyAnchorOcclusion(
    fixture.diagram,
    [fixture.pointTarget],
    {
      camera: occlusionCamera,
      visibility: automaticVisibility,
      occludingSurfaceIds: new Set([fixture.sheet.id]),
      kind: 'point',
    },
  )
  const standaloneLabels = classifyAnchorOcclusion(
    fixture.diagram,
    [fixture.labelTarget],
    {
      camera: occlusionCamera,
      visibility: automaticVisibility,
      occludingSurfaceIds: new Set([fixture.sheet.id]),
      kind: 'label',
    },
  )
  const geometry = prepareSvgSurfaceGeometry(fixture.diagram, {
    cache,
    sampleCurvedSheet: counters.sample,
  })
  const scene = projectSvgSurfaceScene(geometry, occlusionCamera, {
    cache,
    sourceIds: visibleSvgSheetIds(fixture.diagram),
    projectSurfaceFace: counters.project,
  })
  const directSheet = { ...fixture.sheet }

  assert.equal(counters.sampleCount(), 1)
  assert.equal(counters.projectCount(), geometry.faceCount)
  assert.equal(geometry.faceCount, 12)
  assert.equal(scene.projectedFaces.length, 12)

  const faceOrderBefore = projectedFaceSignatures(scene.projectedFaces)
  const sorted = sortedPreparedSvgSurfaceFaces(
    scene.projectedFaces,
    viewportHeight,
    automaticVisibility,
  )

  // If a prepared-data consumer falls back to extracting the sheet again,
  // this accessor makes the regression fail instead of silently doing work.
  installThrowingPrimitiveAccessor(fixture.sheet)
  const visibility = prepareSvgVisibility(
    fixture.diagram,
    occlusionCamera,
    automaticVisibility,
    scene.projectedFaces,
  )

  assert.equal(counters.sampleCount(), 1)
  assert.equal(counters.projectCount(), geometry.faceCount)
  assert.deepEqual(projectedFaceSignatures(scene.projectedFaces), faceOrderBefore)
  assert.deepEqual(
    sorted?.map(({ face, points }) => ({
      sourceId: face.sourceId,
      faceIndex: face.faceIndex,
      points,
    })),
    standaloneSorted?.map(({ face, points }) => ({
      sourceId: face.sourceId,
      faceIndex: face.faceIndex,
      points,
    })),
  )
  assert.deepEqual(
    curveResultSignatures([...visibility.curveOcclusionById.values()]),
    curveResultSignatures(standaloneCurves),
  )
  assert.deepEqual(
    anchorResultSignatures([...visibility.pointOcclusionById.values()]),
    anchorResultSignatures(standalonePoints),
  )
  assert.deepEqual(
    anchorResultSignatures([...visibility.labelOcclusionById.values()]),
    anchorResultSignatures(standaloneLabels),
  )
  assert.equal(
    visibility.curveOcclusionById.get(fixture.curveId)?.segments[0]
      ?.visibility,
    'hidden',
  )
  assert.equal(
    visibility.pointOcclusionById.get(fixture.pointTarget.id)?.visibility,
    'hidden',
  )
  assert.equal(
    visibility.labelOcclusionById.get(fixture.labelTarget.id)?.visibility,
    'hidden',
  )

  const preparedMesh = curvedSheetSvgMeshesFromPreparedScene(
    scene,
    viewportHeight,
  ).get(fixture.sheet.id)
  const directMesh = curvedSheetToSvgMesh(
    directSheet,
    occlusionCamera,
    viewportHeight,
  )

  assert.deepEqual(preparedMesh, directMesh)
})

test('selection-equivalent and unrelated non-surface rerenders hit both caches', () => {
  const fixture = previewFixture()
  const counters = createPreparationCounters()
  const cache = createSvgSurfacePreparationCache()
  const firstGeometry = prepareSvgSurfaceGeometry(fixture.diagram, {
    cache,
    sampleCurvedSheet: counters.sample,
  })
  const firstProjection = projectSvgSurfaceScene(
    firstGeometry,
    projectionCamera,
    {
      cache,
      sourceIds: new Set([fixture.sheet.id]),
      projectSurfaceFace: counters.project,
    },
  )
  const diagramWithUiOnlyChange = {
    ...fixture.diagram,
    labels: [...fixture.diagram.labels],
  }
  const equalCameraWithNewIdentity: Camera3D = {
    ...projectionCamera,
    pan: { ...projectionCamera.pan },
  }
  const secondGeometry = prepareSvgSurfaceGeometry(diagramWithUiOnlyChange, {
    cache,
    sampleCurvedSheet: counters.sample,
  })
  const secondProjection = projectSvgSurfaceScene(
    secondGeometry,
    equalCameraWithNewIdentity,
    {
      cache,
      sourceIds: new Set([fixture.sheet.id]),
      projectSurfaceFace: counters.project,
    },
  )

  assert.equal(secondGeometry, firstGeometry)
  assert.equal(secondProjection, firstProjection)
  assert.equal(counters.sampleCount(), 1)
  assert.equal(counters.projectCount(), firstGeometry.faceCount)
})

test('camera-only changes reuse world geometry and refresh every projected face', () => {
  const fixture = previewFixture()
  const counters = createPreparationCounters()
  const cache = createSvgSurfacePreparationCache()
  const geometry = prepareSvgSurfaceGeometry(fixture.diagram, {
    cache,
    sampleCurvedSheet: counters.sample,
  })
  const first = projectSvgSurfaceScene(geometry, projectionCamera, {
    cache,
    projectSurfaceFace: counters.project,
  })
  const second = projectSvgSurfaceScene(geometry, rotatedCamera, {
    cache,
    projectSurfaceFace: counters.project,
  })

  assert.equal(second.surfaceGeometry, first.surfaceGeometry)
  assert.notEqual(second, first)
  assert.equal(counters.sampleCount(), 1)
  assert.equal(counters.projectCount(), geometry.faceCount * 2)
  assert.notDeepEqual(
    second.projectedFaces.map((face) => face.projectedPolygon),
    first.projectedFaces.map((face) => face.projectedPolygon),
  )
  assert.notDeepEqual(
    second.projectedFaces.map((face) => face.depth),
    first.projectedFaces.map((face) => face.depth),
  )
})

test('changing one of two Coons patches resamples only the changed primitive', () => {
  const firstSheet = coonsSheet('patch-a', coonsPrimitive(0, undefined, 0))
  const secondSheet = coonsSheet('patch-b', coonsPrimitive(3, undefined, 0))
  const diagram = diagramWithSheets([firstSheet, secondSheet], projectionCamera)
  const counters = createPreparationCounters()
  const cache = createSvgSurfacePreparationCache()
  const firstGeometry = prepareSvgSurfaceGeometry(diagram, {
    cache,
    sampleCurvedSheet: counters.sample,
  })
  const firstProjection = projectSvgSurfaceScene(
    firstGeometry,
    projectionCamera,
    {
      cache,
      projectSurfaceFace: counters.project,
    },
  )
  const changedPrimitive = coonsPrimitive(0, undefined, 0.45)
  const changedSheet: CurvedSheetStratum = {
    ...firstSheet,
    primitive: changedPrimitive,
  }
  const changedDiagram = {
    ...diagram,
    strata: diagram.strata.map((stratum) =>
      stratum.id === firstSheet.id ? changedSheet : stratum,
    ),
  }
  const secondGeometry = prepareSvgSurfaceGeometry(changedDiagram, {
    cache,
    sampleCurvedSheet: counters.sample,
  })
  const secondProjection = projectSvgSurfaceScene(
    secondGeometry,
    projectionCamera,
    {
      cache,
      projectSurfaceFace: counters.project,
    },
  )

  assert.equal(counters.sampleCount(), 3)
  assert.equal(
    counters.samples().filter((primitive) => primitive === secondSheet.primitive)
      .length,
    1,
  )
  assert.equal(
    secondGeometry.surfacesBySheetId.get(secondSheet.id)?.curvedMesh,
    firstGeometry.surfacesBySheetId.get(secondSheet.id)?.curvedMesh,
  )
  assert.notEqual(
    secondGeometry.surfacesBySheetId.get(firstSheet.id)?.curvedMesh,
    firstGeometry.surfacesBySheetId.get(firstSheet.id)?.curvedMesh,
  )
  assert.notDeepEqual(
    secondProjection.projectedFacesBySheetId.get(firstSheet.id),
    firstProjection.projectedFacesBySheetId.get(firstSheet.id),
  )
  assert.deepEqual(
    secondProjection.projectedFacesBySheetId.get(secondSheet.id),
    firstProjection.projectedFacesBySheetId.get(secondSheet.id),
  )
})

test('sampling-setting changes invalidate the mesh and update face count', () => {
  const fixture = previewFixture()
  const counters = createPreparationCounters()
  const cache = createSvgSurfacePreparationCache()
  const first = prepareSvgSurfaceGeometry(fixture.diagram, {
    cache,
    sampleCurvedSheet: counters.sample,
  })
  const changedSheet: CurvedSheetStratum = {
    ...fixture.sheet,
    primitive: {
      ...fixture.sheet.primitive,
      sampling: { uSegments: 2, vSegments: 5 },
    },
  }
  const changedDiagram = {
    ...fixture.diagram,
    strata: fixture.diagram.strata.map((stratum) =>
      stratum.id === fixture.sheet.id ? changedSheet : stratum,
    ),
  }
  const second = prepareSvgSurfaceGeometry(changedDiagram, {
    cache,
    sampleCurvedSheet: counters.sample,
  })

  assert.equal(counters.sampleCount(), 2)
  assert.equal(first.faceCount, 12)
  assert.equal(second.faceCount, 10)
  assert.notEqual(
    first.surfacesBySheetId.get(fixture.sheet.id)?.curvedMesh,
    second.surfacesBySheetId.get(fixture.sheet.id)?.curvedMesh,
  )
})

test('linked and detached Coons patches have equal preparation cost and output', () => {
  const linkedSheet = coonsSheet(
    'patch',
    {
      ...coonsPrimitive(),
      boundarySources: linkedBoundarySources(),
    },
  )
  const linkedDiagram = diagramWithSheets(
    [linkedSheet],
    projectionCamera,
    linkedSourceCurves(),
  )
  const detachedDiagram = detachCoonsPatchBoundaryLinks(linkedDiagram, 'patch')
  const linkedCounters = createPreparationCounters()
  const detachedCounters = createPreparationCounters()
  const linkedGeometry = prepareSvgSurfaceGeometry(linkedDiagram, {
    cache: createSvgSurfacePreparationCache(),
    sampleCurvedSheet: linkedCounters.sample,
  })
  const detachedGeometry = prepareSvgSurfaceGeometry(detachedDiagram, {
    cache: createSvgSurfacePreparationCache(),
    sampleCurvedSheet: detachedCounters.sample,
  })
  const linkedProjection = projectSvgSurfaceScene(
    linkedGeometry,
    projectionCamera,
    { projectSurfaceFace: linkedCounters.project },
  )
  const detachedProjection = projectSvgSurfaceScene(
    detachedGeometry,
    projectionCamera,
    { projectSurfaceFace: detachedCounters.project },
  )

  assert.equal(linkedCounters.sampleCount(), 1)
  assert.equal(detachedCounters.sampleCount(), 1)
  assert.equal(linkedCounters.projectCount(), linkedGeometry.faceCount)
  assert.equal(detachedCounters.projectCount(), detachedGeometry.faceCount)
  assert.deepEqual(
    surfaceGeometrySignature(linkedGeometry.surfacesBySheetId.get('patch')),
    surfaceGeometrySignature(detachedGeometry.surfacesBySheetId.get('patch')),
  )
  assert.deepEqual(
    projectedFaceSignatures(linkedProjection.projectedFaces),
    projectedFaceSignatures(detachedProjection.projectedFaces),
  )
})

test('disabled visibility skips classifiers while retaining visible curved rendering', () => {
  const fixture = previewFixture()
  const counters = createPreparationCounters()
  const geometry = prepareSvgSurfaceGeometry(fixture.diagram, {
    cache: createSvgSurfacePreparationCache(),
    sampleCurvedSheet: counters.sample,
  })
  const scene = projectSvgSurfaceScene(geometry, projectionCamera, {
    projectSurfaceFace: counters.project,
  })
  let curveClassifierCalls = 0
  let anchorClassifierCalls = 0
  const disabledVisibility: VisibilityOptions = {
    ...automaticVisibility,
    enabled: false,
  }
  const visibility = prepareSvgVisibility(
    fixture.diagram,
    projectionCamera,
    disabledVisibility,
    scene.projectedFaces,
    {
      classifyCurves: () => {
        curveClassifierCalls += 1
        return []
      },
      classifyAnchors: () => {
        anchorClassifierCalls += 1
        return []
      },
    },
  )
  const meshes = curvedSheetSvgMeshesFromPreparedScene(scene, viewportHeight)

  assert.equal(curveClassifierCalls, 0)
  assert.equal(anchorClassifierCalls, 0)
  assert.equal(sortedPreparedSvgSurfaceFaces(
    scene.projectedFaces,
    viewportHeight,
    disabledVisibility,
  ), null)
  assert.equal(counters.sampleCount(), 1)
  assert.equal(counters.projectCount(), geometry.faceCount)
  assert.equal(meshes.get(fixture.sheet.id)?.faces.length, geometry.faceCount)
  assert.deepEqual(visibility.curveOcclusionById, new Map())
  assert.deepEqual(visibility.pointOcclusionById, new Map())
  assert.deepEqual(visibility.labelOcclusionById, new Map())
})

test('stale snapshots render without source lookup and recovery invalidates immediately', () => {
  const lastValid = coonsPrimitive(0, undefined, 0)
  const staleSheet = coonsSheet('patch', {
    ...lastValid,
    boundarySources: linkedBoundarySources(),
    boundarySnapshotState: 'frozen',
  })
  const throwingSource = createThrowingBoundarySource('source-bottom')
  const staleDiagram = diagramWithSheets(
    [staleSheet],
    projectionCamera,
    [throwingSource],
  )
  const counters = createPreparationCounters()
  const cache = createSvgSurfacePreparationCache()
  const staleGeometry = prepareSvgSurfaceGeometry(staleDiagram, {
    cache,
    sampleCurvedSheet: counters.sample,
  })
  const staleProjection = projectSvgSurfaceScene(
    staleGeometry,
    projectionCamera,
    {
      cache,
      projectSurfaceFace: counters.project,
    },
  )
  const expectedStaleMesh = sampleCurvedSheetPrimitive(lastValid)

  assert.deepEqual(
    staleGeometry.surfacesBySheetId.get('patch')?.curvedMesh,
    expectedStaleMesh,
  )
  assert.equal(counters.samples()[0], staleSheet.primitive)

  const recoveredSheet = coonsSheet('patch', {
    ...coonsPrimitive(0, undefined, 0.55),
    boundarySources: linkedBoundarySources(),
  })
  const recoveredDiagram = {
    ...staleDiagram,
    strata: staleDiagram.strata.map((stratum) =>
      stratum.id === 'patch' ? recoveredSheet : stratum,
    ),
  }
  const recoveredGeometry = prepareSvgSurfaceGeometry(recoveredDiagram, {
    cache,
    sampleCurvedSheet: counters.sample,
  })
  const recoveredProjection = projectSvgSurfaceScene(
    recoveredGeometry,
    projectionCamera,
    {
      cache,
      projectSurfaceFace: counters.project,
    },
  )

  assert.equal(counters.sampleCount(), 2)
  assert.notDeepEqual(
    recoveredGeometry.surfacesBySheetId.get('patch')?.curvedMesh?.vertices,
    staleGeometry.surfacesBySheetId.get('patch')?.curvedMesh?.vertices,
  )
  assert.notDeepEqual(
    recoveredProjection.projectedFaces,
    staleProjection.projectedFaces,
  )
})

test('caps and surface filters preserve fallback rules without mutating shared faces', () => {
  const firstSheet = coonsSheet('visible-patch', coonsPrimitive())
  const hiddenSheet = {
    ...coonsSheet('hidden-patch', coonsPrimitive(3), 1),
    layer: 1,
  }
  const allVisibleDiagram = diagramWithSheets(
    [firstSheet, hiddenSheet],
    occlusionCamera,
  )
  const diagram = setLayerVisibility(allVisibleDiagram, 1, false)
  const counters = createPreparationCounters()
  const geometry = prepareSvgSurfaceGeometry(diagram, {
    cache: createSvgSurfacePreparationCache(),
    sampleCurvedSheet: counters.sample,
  })
  const scene = projectSvgSurfaceScene(geometry, occlusionCamera, {
    projectSurfaceFace: counters.project,
  })
  const frozenFaces = Object.freeze([...scene.projectedFaces])
  const orderBefore = projectedFaceSignatures(frozenFaces)
  const overCapVisibility: VisibilityOptions = {
    ...automaticVisibility,
    maxSurfaceFacesForSorting: 1,
  }
  const capped = prepareSvgVisibility(
    diagram,
    occlusionCamera,
    overCapVisibility,
    frozenFaces,
  )

  assert.equal(
    sortedPreparedSvgSurfaceFaces(
      frozenFaces,
      viewportHeight,
      overCapVisibility,
    ),
    null,
  )
  assert.equal(capped.curveOcclusionById.get('preview-curve')?.capped, true)
  assert.equal(
    capped.curveOcclusionById.get('preview-curve')?.fallbackReason,
    'surfaceFaceCapExceeded',
  )
  assert.equal(capped.pointOcclusionById.size, 0)
  assert.equal(capped.labelOcclusionById.size, 0)
  assert.deepEqual(projectedFaceSignatures(frozenFaces), orderBefore)
  assert.equal(counters.sampleCount(), 2)
  assert.equal(counters.projectCount(), geometry.faceCount)

  // The hidden patch contributes another 12 prepared faces. Filtering by the
  // visible sheet must happen before the cap is enforced by occlusion.
  const filteredVisibility: VisibilityOptions = {
    ...automaticVisibility,
    maxSurfaceFacesForSorting: 12,
  }
  const filtered = prepareSvgVisibility(
    diagram,
    occlusionCamera,
    filteredVisibility,
    frozenFaces,
  )

  assert.equal(filtered.curveOcclusionById.get('preview-curve')?.capped, false)
  assert.equal(
    filtered.pointOcclusionById.get('preview-point')?.visibility,
    'hidden',
  )
  assert.equal(
    filtered.labelOcclusionById.get('preview-label')?.visibility,
    'hidden',
  )
  assert.deepEqual(projectedFaceSignatures(frozenFaces), orderBefore)
})

type PreviewFixture = {
  diagram: Diagram
  sheet: CurvedSheetStratum
  curveId: string
  pointTarget: AnchorOcclusionTarget
  labelTarget: AnchorOcclusionTarget
}

function previewFixture(): PreviewFixture {
  const primitive = coonsPrimitive()
  const sheet = coonsSheet('preview-patch', primitive)
  const diagram = diagramWithSheets([sheet], occlusionCamera)
  const point = diagram.strata.find(
    (stratum) => stratum.id === 'preview-point',
  )
  const label = diagram.labels.find(
    (candidate) => candidate.id === 'preview-label',
  )

  assert.equal(point?.geometricKind, 'point')
  assert.notEqual(label, undefined)
  if (point?.geometricKind !== 'point' || label === undefined) {
    throw new Error('Expected Preview point and label fixtures.')
  }

  return {
    diagram,
    sheet,
    curveId: 'preview-curve',
    pointTarget: {
      id: point.id,
      layer: point.layer,
      position: point.position,
    },
    labelTarget: {
      id: label.id,
      layer: label.layer,
      position: label.position,
    },
  }
}

function diagramWithSheets(
  sheets: readonly CurvedSheetStratum[],
  camera: Camera3D,
  additionalStrata: readonly Stratum[] = [],
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.camera = camera
  diagram.view = { camera3d: camera }
  diagram.strata = [
    ...sheets,
    ...additionalStrata,
    createCurveStratum({
      ambientDimension: 3,
      id: 'preview-curve',
      name: 'Preview curve',
      points: [
        { x: -0.6, y: -1, z: 0 },
        { x: 0.6, y: -1, z: 0 },
      ],
      layer: 0,
    }),
    createPointStratum({
      ambientDimension: 3,
      id: 'preview-point',
      name: 'Preview point',
      position: { x: 0, y: -1, z: 0 },
      layer: 0,
    }),
  ]
  diagram.labels = [
    createTextLabel({
      ambientDimension: 3,
      id: 'preview-label',
      name: 'Preview label',
      text: '$L$',
      position: { x: 0.25, y: -1, z: 0.25 },
      layer: 0,
    }),
  ]

  return diagram
}

function coonsSheet(
  id: string,
  primitive: CoonsPatchPrimitive,
  layer = 0,
): CurvedSheetStratum {
  return createCurvedSheetStratum({
    id,
    name: id,
    primitive,
    layer,
  })
}

function coonsPrimitive(
  xOffset = 0,
  sampling: SurfaceSampling = { uSegments: 4, vSegments: 3 },
  bottomBulge = 0,
): CoonsPatchPrimitive {
  return {
    kind: 'coonsPatch',
    bottom: cubicBoundary(
      'coons-bottom',
      point(-1 + xOffset, 0, -1),
      point(-0.4 + xOffset, bottomBulge, -1),
      point(0.4 + xOffset, bottomBulge, -1),
      point(1 + xOffset, 0, -1),
    ),
    right: lineBoundary(
      'coons-right',
      point(1 + xOffset, 0, -1),
      point(1 + xOffset, 0, 1),
    ),
    top: lineBoundary(
      'coons-top',
      point(-1 + xOffset, 0, 1),
      point(1 + xOffset, 0, 1),
    ),
    left: lineBoundary(
      'coons-left',
      point(-1 + xOffset, 0, -1),
      point(-1 + xOffset, 0, 1),
    ),
    sampling: { ...sampling },
  }
}

function lineBoundary(
  id: string,
  start: Vec3,
  end: Vec3,
): BoundaryPathSnapshot {
  return {
    id,
    segments: [{ kind: 'line', start, end }],
  }
}

function cubicBoundary(
  id: string,
  start: Vec3,
  control1: Vec3,
  control2: Vec3,
  end: Vec3,
): BoundaryPathSnapshot {
  return {
    id,
    segments: [
      {
        kind: 'cubicBezier',
        start,
        control1,
        control2,
        end,
      },
    ],
  }
}

function linkedBoundarySources(): CoonsPatchBoundarySources {
  return {
    bottom: {
      kind: 'path',
      sourcePathId: 'source-bottom',
      reversed: false,
    },
    right: {
      kind: 'path',
      sourcePathId: 'source-right',
      reversed: false,
    },
    top: {
      kind: 'path',
      sourcePathId: 'source-top',
      reversed: false,
    },
    left: {
      kind: 'path',
      sourcePathId: 'source-left',
      reversed: false,
    },
  }
}

function linkedSourceCurves(): Stratum[] {
  const primitive = coonsPrimitive()

  return [
    ['source-bottom', primitive.bottom],
    ['source-right', primitive.right],
    ['source-top', primitive.top],
    ['source-left', primitive.left],
  ].map(([id, boundary]) => {
    if (
      typeof id !== 'string' ||
      boundary === undefined ||
      'kind' in boundary
    ) {
      throw new Error('Expected a path boundary source fixture.')
    }

    const segment = boundary.segments[0]

    if (segment === undefined) {
      throw new Error('Expected a boundary source segment.')
    }

    return createCurveStratum({
      ambientDimension: 3,
      id,
      name: id,
      points: [segment.start, segment.end],
      layer: 0,
    })
  })
}

function createThrowingBoundarySource(id: string): Stratum {
  const source = createCurveStratum({
    ambientDimension: 3,
    id,
    name: id,
    points: [point(-1, 0, -1), point(1, 0, -1)],
    layer: 0,
  })

  Object.defineProperty(source, 'points', {
    configurable: true,
    get() {
      throw new Error('SVG surface preparation must not resolve linked sources.')
    },
  })

  return source
}

function createPreparationCounters(): {
  sample: CurvedSheetSampler
  project: SurfaceFaceProjector
  sampleCount: () => number
  projectCount: () => number
  samples: () => readonly CurvedSheetPrimitive[]
} {
  const sampledPrimitives: CurvedSheetPrimitive[] = []
  let projectedFaceCount = 0
  const sample: CurvedSheetSampler = (primitive) => {
    sampledPrimitives.push(primitive)
    return sampleCurvedSheetPrimitive(primitive)
  }
  const project: SurfaceFaceProjector = (camera, source, face, originalIndex) => {
    projectedFaceCount += 1
    return projectSurfaceFace3D(camera, source, face, originalIndex)
  }

  return {
    sample,
    project,
    sampleCount: () => sampledPrimitives.length,
    projectCount: () => projectedFaceCount,
    samples: () => sampledPrimitives,
  }
}

function installThrowingPrimitiveAccessor(sheet: CurvedSheetStratum): void {
  Object.defineProperty(sheet, 'primitive', {
    configurable: true,
    get() {
      throw new Error('Prepared surface consumers must not resample sheets.')
    },
  })
}

function surfaceGeometrySignature(
  surface: SampledSurfaceGeometry | undefined,
): unknown {
  return surface === undefined
    ? undefined
    : {
        sheetKind: surface.sheetKind,
        curvedPrimitiveKind: surface.curvedPrimitiveKind,
        faces3D: surface.faces3D,
        curvedMesh: surface.curvedMesh,
        boundaryPolylines3D: surface.boundaryPolylines3D,
      }
}

function projectedFaceSignatures(
  faces: readonly ProjectedSurfaceFace[],
): unknown[] {
  return faces.map((face) => ({
    sourceId: face.sourceId,
    layer: face.layer,
    faceIndex: face.faceIndex,
    originalIndex: face.originalIndex,
    vertices3D: face.vertices3D,
    projectedPolygon: face.projectedPolygon,
    depth: face.depth,
  }))
}

function curveResultSignatures(
  results: readonly CurveOcclusionResult[],
): unknown[] {
  return results.map((result) => ({
    curveId: result.curveId,
    sampledSegmentCount: result.sampledSegmentCount,
    capped: result.capped,
    fallbackReason: result.fallbackReason,
    segments: result.segments.map((segment) => ({
      visibility: segment.visibility,
      start: segment.start,
      end: segment.end,
      projectedStart: segment.projectedStart,
      projectedEnd: segment.projectedEnd,
      curveDepth: segment.curveDepth,
      occludingSourceId: segment.occludingFace?.sourceId,
      occludingFaceIndex: segment.occludingFace?.faceIndex,
    })),
  }))
}

function anchorResultSignatures(
  results: readonly AnchorOcclusionResult[],
): unknown[] {
  return results.map((result) => ({
    id: result.id,
    visibility: result.visibility,
    position: result.position,
    projectedPosition: result.projectedPosition,
    depth: result.depth,
    occludingSourceId: result.occludingFace?.sourceId,
    occludingFaceIndex: result.occludingFace?.faceIndex,
  }))
}

function point(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}
