import { projectVec3 } from '../geometry/projection.ts'
import {
  sampleCurvedSheetPrimitive,
  surfaceBoundaryPolylinesFromMesh,
  type SurfaceSampleMesh,
} from '../geometry/curvedSheets.ts'
import type {
  Camera,
  Camera3D,
  CurvedSheetPrimitive,
  Diagram,
  SheetStratum,
  Vec2,
  Vec3,
} from '../model/types.ts'
import {
  projectSurfaceFace3D,
  surfaceFacesForSheet,
  type ProjectedSurfaceFace,
  type SurfaceFace3D,
  type SurfaceFaceSource,
} from './projectedPrimitives.ts'

export type SampledSurfaceGeometry = {
  sheetId: string
  layer: number
  sheetKind: SheetStratum['kind']
  curvedPrimitiveKind?: CurvedSheetPrimitive['kind']
  faces3D: readonly SurfaceFace3D[]
  curvedMesh?: SurfaceSampleMesh
  boundaryPolylines3D?: readonly (readonly Vec3[])[]
}

export type PreparedSvgSurfaceGeometry = {
  ambientDimension: Diagram['ambientDimension']
  surfaces: readonly SampledSurfaceGeometry[]
  surfacesBySheetId: ReadonlyMap<string, SampledSurfaceGeometry>
  curvedSheetVerticesById: ReadonlyMap<string, readonly Vec3[]>
  faceCount: number
}

export type ProjectedSvgSurfaceScene = {
  surfaceGeometry: PreparedSvgSurfaceGeometry
  projectedFaces: readonly ProjectedSurfaceFace[]
  projectedFacesBySheetId: ReadonlyMap<
    string,
    readonly ProjectedSurfaceFace[]
  >
  projectedBoundaryPolylinesBySheetId: ReadonlyMap<
    string,
    readonly (readonly Vec2[])[]
  >
}

export type CurvedSheetSampler = (
  primitive: CurvedSheetPrimitive,
) => SurfaceSampleMesh

export type SurfaceFaceProjector = (
  camera: Camera3D,
  source: SurfaceFaceSource,
  face: SurfaceFace3D,
  originalIndex: number,
) => ProjectedSurfaceFace | null

export type PrepareSvgSurfaceGeometryOptions = {
  cache?: SvgSurfacePreparationCache
  curveSegmentSamples?: number
  sampleCurvedSheet?: CurvedSheetSampler
}

export type ProjectSvgSurfaceSceneOptions = {
  cache?: SvgSurfacePreparationCache
  sourceIds?: ReadonlySet<string>
  projectSurfaceFace?: SurfaceFaceProjector
}

type CachedCurvedSheetGeometry = {
  sampler: CurvedSheetSampler
  mesh: SurfaceSampleMesh
  faces3D: readonly SurfaceFace3D[]
  boundaryPolylines3D: readonly (readonly Vec3[])[]
}

type SurfaceGeometryInput = {
  sheetId: string
  layer: number
  sheetKind: SheetStratum['kind']
  geometryIdentity: object
}

type CachedSurfaceGeometryPreparation = {
  ambientDimension: Diagram['ambientDimension']
  curveSegmentSamples: number
  sampler: CurvedSheetSampler
  inputs: readonly SurfaceGeometryInput[]
  scene: PreparedSvgSurfaceGeometry
}

type CachedSurfaceProjection = {
  surfaceGeometry: PreparedSvgSurfaceGeometry
  camera: Camera
  sourceIds: readonly string[]
  projector: SurfaceFaceProjector
  scene: ProjectedSvgSurfaceScene
}

export type SvgSurfacePreparationCache = {
  curvedGeometryByPrimitive: WeakMap<
    CurvedSheetPrimitive,
    CachedCurvedSheetGeometry
  >
  lastGeometryPreparation: CachedSurfaceGeometryPreparation | null
  lastProjection: CachedSurfaceProjection | null
}

const defaultCurveSegmentSamples = 24

export function createSvgSurfacePreparationCache(): SvgSurfacePreparationCache {
  return {
    curvedGeometryByPrimitive: new WeakMap(),
    lastGeometryPreparation: null,
    lastProjection: null,
  }
}

export function prepareSvgSurfaceGeometry(
  diagram: Diagram,
  options: PrepareSvgSurfaceGeometryOptions = {},
): PreparedSvgSurfaceGeometry {
  const cache = options.cache
  const sampler = options.sampleCurvedSheet ?? sampleCurvedSheetPrimitive
  const curveSegmentSamples = normalizedSampleCount(
    options.curveSegmentSamples,
    defaultCurveSegmentSamples,
  )
  const inputs = surfaceGeometryInputs(diagram)
  const previous = cache?.lastGeometryPreparation

  if (
    previous !== null &&
    previous !== undefined &&
    previous.ambientDimension === diagram.ambientDimension &&
    previous.curveSegmentSamples === curveSegmentSamples &&
    previous.sampler === sampler &&
    surfaceGeometryInputsEqual(previous.inputs, inputs)
  ) {
    return previous.scene
  }

  const surfaces =
    diagram.ambientDimension === 3
      ? diagram.strata.flatMap((stratum): SampledSurfaceGeometry[] => {
          if (stratum.geometricKind !== 'sheet' || stratum.codim !== 1) {
            return []
          }

          return [
            sampledSurfaceGeometry(
              stratum,
              diagram,
              curveSegmentSamples,
              sampler,
              cache,
            ),
          ]
        })
      : []
  const surfacesBySheetId = new Map(
    surfaces.map((surface) => [surface.sheetId, surface]),
  )
  const curvedSheetVerticesById = new Map(
    surfaces.flatMap((surface): Array<[string, readonly Vec3[]]> =>
      surface.curvedMesh === undefined
        ? []
        : [[surface.sheetId, surface.curvedMesh.vertices]],
    ),
  )
  const scene: PreparedSvgSurfaceGeometry = {
    ambientDimension: diagram.ambientDimension,
    surfaces,
    surfacesBySheetId,
    curvedSheetVerticesById,
    faceCount: surfaces.reduce(
      (count, surface) => count + surface.faces3D.length,
      0,
    ),
  }

  if (cache !== undefined) {
    cache.lastGeometryPreparation = {
      ambientDimension: diagram.ambientDimension,
      curveSegmentSamples,
      sampler,
      inputs,
      scene,
    }
  }

  return scene
}

export function projectSvgSurfaceScene(
  surfaceGeometry: PreparedSvgSurfaceGeometry,
  camera: Camera,
  options: ProjectSvgSurfaceSceneOptions = {},
): ProjectedSvgSurfaceScene {
  const cache = options.cache
  const projector = options.projectSurfaceFace ?? projectSurfaceFace3D
  const sourceIds = includedSourceIds(surfaceGeometry, options.sourceIds)
  const previous = cache?.lastProjection

  if (
    previous !== null &&
    previous !== undefined &&
    previous.surfaceGeometry === surfaceGeometry &&
    previous.projector === projector &&
    camerasEqual(previous.camera, camera) &&
    stringArraysEqual(previous.sourceIds, sourceIds)
  ) {
    return previous.scene
  }

  const includedIds = new Set(sourceIds)
  const projectedFaces: ProjectedSurfaceFace[] = []
  const projectedFacesBySheetId = new Map<string, ProjectedSurfaceFace[]>()
  const projectedBoundaryPolylinesBySheetId = new Map<
    string,
    readonly (readonly Vec2[])[]
  >()
  let originalIndex = 0

  if (surfaceGeometry.ambientDimension === 3 && camera.mode === '3d') {
    for (const surface of surfaceGeometry.surfaces) {
      const includeSurface = includedIds.has(surface.sheetId)

      for (const face of surface.faces3D) {
        const faceOriginalIndex = originalIndex
        originalIndex += 1

        if (!includeSurface) {
          continue
        }

        const projected = projector(
          camera,
          { id: surface.sheetId, layer: surface.layer },
          face,
          faceOriginalIndex,
        )

        if (projected === null) {
          continue
        }

        projectedFaces.push(projected)
        const sheetFaces = projectedFacesBySheetId.get(surface.sheetId)

        if (sheetFaces === undefined) {
          projectedFacesBySheetId.set(surface.sheetId, [projected])
        } else {
          sheetFaces.push(projected)
        }
      }

      if (includeSurface && surface.boundaryPolylines3D !== undefined) {
        projectedBoundaryPolylinesBySheetId.set(
          surface.sheetId,
          surface.boundaryPolylines3D.map((polyline) =>
            polyline.map((point) => projectVec3(camera, point)),
          ),
        )
      }
    }
  }

  const scene: ProjectedSvgSurfaceScene = {
    surfaceGeometry,
    projectedFaces,
    projectedFacesBySheetId,
    projectedBoundaryPolylinesBySheetId,
  }

  if (cache !== undefined) {
    cache.lastProjection = {
      surfaceGeometry,
      camera: cloneCamera(camera),
      sourceIds,
      projector,
      scene,
    }
  }

  return scene
}

function sampledSurfaceGeometry(
  sheet: SheetStratum,
  diagram: Diagram,
  curveSegmentSamples: number,
  sampler: CurvedSheetSampler,
  cache: SvgSurfacePreparationCache | undefined,
): SampledSurfaceGeometry {
  if (sheet.kind !== 'curvedSheet') {
    return {
      sheetId: sheet.id,
      layer: sheet.layer,
      sheetKind: sheet.kind,
      faces3D: [
        ...surfaceFacesForSheet(
          sheet,
          diagram.ambientDimension,
          curveSegmentSamples,
        ),
      ],
    }
  }

  const cached = cache?.curvedGeometryByPrimitive.get(sheet.primitive)
  const curvedGeometry =
    cached !== undefined && cached.sampler === sampler
      ? cached
      : sampleCurvedSurfaceGeometry(sheet, diagram, curveSegmentSamples, sampler)

  if (cache !== undefined && curvedGeometry !== cached) {
    cache.curvedGeometryByPrimitive.set(sheet.primitive, curvedGeometry)
  }

  return {
    sheetId: sheet.id,
    layer: sheet.layer,
    sheetKind: sheet.kind,
    curvedPrimitiveKind: sheet.primitive.kind,
    faces3D: curvedGeometry.faces3D,
    curvedMesh: curvedGeometry.mesh,
    boundaryPolylines3D: curvedGeometry.boundaryPolylines3D,
  }
}

function sampleCurvedSurfaceGeometry(
  sheet: Extract<SheetStratum, { kind: 'curvedSheet' }>,
  diagram: Diagram,
  curveSegmentSamples: number,
  sampler: CurvedSheetSampler,
): CachedCurvedSheetGeometry {
  const mesh = sampler(sheet.primitive)

  return {
    sampler,
    mesh,
    faces3D: [
      ...surfaceFacesForSheet(
        sheet,
        diagram.ambientDimension,
        curveSegmentSamples,
        { sampledCurvedSheetMesh: mesh },
      ),
    ],
    boundaryPolylines3D: surfaceBoundaryPolylinesFromMesh(
      sheet.primitive,
      mesh,
    ),
  }
}

function surfaceGeometryInputs(diagram: Diagram): SurfaceGeometryInput[] {
  if (diagram.ambientDimension !== 3) {
    return []
  }

  // Editor geometry updates replace the affected coordinate arrays or curved
  // primitive. Style, selection, and unrelated edits preserve these identities,
  // so they are safe cache keys without serializing the complete diagram.
  return diagram.strata.flatMap((stratum): SurfaceGeometryInput[] => {
    if (stratum.geometricKind !== 'sheet' || stratum.codim !== 1) {
      return []
    }

    return [
      {
        sheetId: stratum.id,
        layer: stratum.layer,
        sheetKind: stratum.kind,
        geometryIdentity: sheetGeometryIdentity(stratum),
      },
    ]
  })
}

function sheetGeometryIdentity(sheet: SheetStratum): object {
  switch (sheet.kind) {
    case 'quadSheet':
      return sheet.corners
    case 'polygonSheet':
      return sheet.vertices
    case 'workPlaneFilledSheet':
      return sheet.boundaries
    case 'curvedSheet':
      return sheet.primitive
  }
}

function surfaceGeometryInputsEqual(
  left: readonly SurfaceGeometryInput[],
  right: readonly SurfaceGeometryInput[],
): boolean {
  return (
    left.length === right.length &&
    left.every((input, index) => {
      const candidate = right[index]

      return (
        candidate !== undefined &&
        input.sheetId === candidate.sheetId &&
        input.layer === candidate.layer &&
        input.sheetKind === candidate.sheetKind &&
        input.geometryIdentity === candidate.geometryIdentity
      )
    })
  )
}

function includedSourceIds(
  geometry: PreparedSvgSurfaceGeometry,
  sourceIds: ReadonlySet<string> | undefined,
): string[] {
  return geometry.surfaces.flatMap((surface) =>
    sourceIds === undefined || sourceIds.has(surface.sheetId)
      ? [surface.sheetId]
      : [],
  )
}

function normalizedSampleCount(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(1, Math.floor(value))
}

function camerasEqual(left: Camera, right: Camera): boolean {
  if (left.mode !== right.mode) {
    return false
  }

  if (left.mode === '2d' && right.mode === '2d') {
    return (
      left.scale === right.scale &&
      left.origin.x === right.origin.x &&
      left.origin.y === right.origin.y
    )
  }

  if (left.mode !== '3d' || right.mode !== '3d' || left.kind !== right.kind) {
    return false
  }

  if (
    left.thetaDeg !== right.thetaDeg ||
    left.phiDeg !== right.phiDeg ||
    left.zoom !== right.zoom ||
    left.pan.x !== right.pan.x ||
    left.pan.y !== right.pan.y
  ) {
    return false
  }

  return left.kind === 'orthographic' && right.kind === 'orthographic'
    ? true
    : left.kind === 'perspective' && right.kind === 'perspective'
      ? left.target.x === right.target.x &&
        left.target.y === right.target.y &&
        left.target.z === right.target.z &&
        left.distance === right.distance &&
        left.fieldOfViewDeg === right.fieldOfViewDeg
      : false
}

function cloneCamera(camera: Camera): Camera {
  if (camera.mode === '2d') {
    return {
      ...camera,
      origin: { ...camera.origin },
    }
  }

  return camera.kind === 'orthographic'
    ? {
        ...camera,
        pan: { ...camera.pan },
      }
    : {
        ...camera,
        pan: { ...camera.pan },
        target: { ...camera.target },
      }
}

function stringArraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}
