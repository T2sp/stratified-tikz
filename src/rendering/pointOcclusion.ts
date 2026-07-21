import { projectVec3 } from '../geometry/projection.ts'
import {
  labelAutoVisibilityEnabled,
  normalizeVisibilityMaxSurfaceFacesForSorting,
  pointAutoVisibilityEnabled,
  resolveVisibilityOptions,
} from '../model/visibility.ts'
import type {
  Camera,
  Camera3D,
  Diagram,
  Vec2,
  Vec3,
  VisibilityOptions,
} from '../model/types.ts'
import {
  estimateProjectedFaceDepthAtPoint,
  projectedPointInPolygon,
  surfaceLayerCanOccludeTarget,
} from './curveOcclusion.ts'
import {
  extractProjectedRenderPrimitives,
  projectedDepth,
  type ProjectedSurfaceFace,
} from './projectedPrimitives.ts'
import { compareProjectedSurfaceFaces } from './surfaceDepthSort.ts'

export type AnchorVisibility = 'visible' | 'hidden'

export type AnchorOcclusionTarget = {
  id: string
  layer: number
  position: Vec3
}

export type AnchorOcclusionResult = {
  id: string
  layer: number
  visibility: AnchorVisibility
  position: Vec3
  projectedPosition: Vec2
  depth: number
  occludingFace?: ProjectedSurfaceFace
}

export type AnchorOcclusionOptions = {
  camera?: Camera
  visibility?: VisibilityOptions
  occludingSurfaceIds?: ReadonlySet<string>
  targetIds?: ReadonlySet<string>
  kind?: 'point' | 'label'
  projectedSurfaceFaces?: readonly ProjectedSurfaceFace[]
}

export function classifyAnchorOcclusion(
  diagram: Diagram,
  targets: readonly AnchorOcclusionTarget[],
  options: AnchorOcclusionOptions = {},
): AnchorOcclusionResult[] {
  const visibility = resolveVisibilityOptions(diagram, options.visibility)
  const camera = resolveOcclusionCamera(diagram, options.camera)

  if (
    diagram.ambientDimension !== 3 ||
    camera.mode !== '3d' ||
    !anchorAutoVisibilityEnabled(visibility, options.kind)
  ) {
    return []
  }

  const faces = projectedSurfaceFacesForDiagram(
    diagram,
    camera,
    visibility,
    options.occludingSurfaceIds,
    options.projectedSurfaceFaces,
  )

  if (faces.length === 0) {
    return []
  }

  return targets.flatMap((target): AnchorOcclusionResult[] => {
    if (options.targetIds !== undefined && !options.targetIds.has(target.id)) {
      return []
    }

    const projectedPosition = projectVec3(camera, target.position)

    if (!isFiniteVec2(projectedPosition) || !isFiniteVec3(target.position)) {
      return []
    }

    const depth = projectedDepth(camera, target.position)
    const occludingFace = faces.find((face) =>
      faceOccludesAnchor(
        face,
        target.layer,
        projectedPosition,
        depth,
        camera,
        visibility,
      ),
    )

    return [
      {
        id: target.id,
        layer: target.layer,
        visibility: occludingFace === undefined ? 'visible' : 'hidden',
        position: cloneVec3(target.position),
        projectedPosition: cloneVec2(projectedPosition),
        depth,
        ...(occludingFace === undefined ? {} : { occludingFace }),
      },
    ]
  })
}

function anchorAutoVisibilityEnabled(
  visibility: VisibilityOptions,
  kind: AnchorOcclusionOptions['kind'],
): boolean {
  if (kind === 'label') {
    return labelAutoVisibilityEnabled(visibility)
  }

  return pointAutoVisibilityEnabled(visibility)
}

function projectedSurfaceFacesForDiagram(
  diagram: Diagram,
  camera: Camera3D,
  visibility: VisibilityOptions,
  occludingSurfaceIds: ReadonlySet<string> | undefined,
  projectedSurfaceFaces: readonly ProjectedSurfaceFace[] | undefined,
): ProjectedSurfaceFace[] {
  const faces = (
    projectedSurfaceFaces ??
    extractProjectedRenderPrimitives(diagram, { camera }).filter(
      (primitive): primitive is ProjectedSurfaceFace =>
        primitive.kind === 'surfaceFace',
    )
  ).filter(
    (face) =>
      occludingSurfaceIds === undefined ||
      occludingSurfaceIds.has(face.sourceId),
  )

  if (
    faces.length >
    normalizeVisibilityMaxSurfaceFacesForSorting(
      visibility.maxSurfaceFacesForSorting,
    )
  ) {
    return []
  }

  return [...faces]
    .sort((left, right) =>
      compareProjectedSurfaceFaces(left, right, visibility),
    )
}

function faceOccludesAnchor(
  face: ProjectedSurfaceFace,
  targetLayer: number,
  projectedPosition: Vec2,
  targetDepth: number,
  camera: Camera3D,
  visibility: VisibilityOptions,
): boolean {
  if (
    !surfaceLayerCanOccludeTarget(
      face.layer,
      targetLayer,
      visibility.sortMode,
    ) ||
    !projectedPointInPolygon(projectedPosition, face.projectedPolygon)
  ) {
    return false
  }

  const faceDepth = estimateProjectedFaceDepthAtPoint(
    face,
    projectedPosition,
    camera,
  )

  return targetDepth - faceDepth > visibility.depthEpsilon
}

function resolveOcclusionCamera(
  diagram: Diagram,
  camera: Camera | undefined,
): Camera {
  return (
    camera ??
    (diagram.camera.mode === '3d'
      ? diagram.camera
      : diagram.view?.camera3d ?? diagram.camera)
  )
}

function cloneVec2(point: Vec2): Vec2 {
  return {
    x: point.x,
    y: point.y,
  }
}

function cloneVec3(point: Vec3): Vec3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
  }
}

function isFiniteVec2(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}
