import {
  sampleCurvedSheetPrimitive,
  surfaceBoundaryPolylinesFromMesh,
} from '../geometry/curvedSheets.ts'
import type { SurfaceSampleMesh } from '../geometry/curvedSheets.ts'
import type {
  Camera,
  CurvedSheetPrimitive,
  CurvedSheetStratum,
  Vec2,
} from '../model/types.ts'
import { polylineToSvgPath, svgPointList } from './svgPath.ts'
import { projectToSvgPoint, viewToSvgPoint } from './svgProjection.ts'
import type { ProjectedSvgSurfaceScene } from './svgSurfaceScene.ts'

export type SvgCurvedSheetFace = {
  key: string
  points: string
}

export type SvgCurvedSheetMesh = {
  primitiveKind: CurvedSheetStratum['primitive']['kind']
  uSegments: number
  vSegments: number
  faces: SvgCurvedSheetFace[]
  boundaryPathData: string[]
}

export type CurvedSheetPrimitiveSampler = (
  primitive: CurvedSheetPrimitive,
) => SurfaceSampleMesh

export type CurvedSheetToSvgMeshOptions = {
  samplePrimitive?: CurvedSheetPrimitiveSampler
}

export function curvedSheetToSvgMesh(
  sheet: CurvedSheetStratum,
  camera: Camera,
  viewportHeight: number,
  options: CurvedSheetToSvgMeshOptions = {},
): SvgCurvedSheetMesh {
  const mesh = (options.samplePrimitive ?? sampleCurvedSheetPrimitive)(
    sheet.primitive,
  )
  const projectedVertices = mesh.vertices.map((vertex) =>
    projectToSvgPoint(camera, vertex, viewportHeight),
  )
  const faces = mesh.faces
    .map((face, index) => {
      const points = face.map((vertexIndex) => projectedVertices[vertexIndex])

      if (!points.every(isFiniteVec2)) {
        return null
      }

      return {
        key: `${sheet.id}-curved-face-${index}`,
        points: svgPointList(points),
      }
    })
    .filter((face): face is SvgCurvedSheetFace => face !== null)
  const boundaryPathData = surfaceBoundaryPolylinesFromMesh(
    sheet.primitive,
    mesh,
  )
    .map((boundary) =>
      boundary.map((point) => projectToSvgPoint(camera, point, viewportHeight)),
    )
    .filter((boundary) => boundary.every(isFiniteVec2))
    .map(polylineToSvgPath)
    .filter((pathData) => pathData.length > 0)

  return {
    primitiveKind: sheet.primitive.kind,
    uSegments: mesh.uSegments,
    vSegments: mesh.vSegments,
    faces,
    boundaryPathData,
  }
}

export function curvedSheetSvgMeshesFromPreparedScene(
  scene: ProjectedSvgSurfaceScene,
  viewportHeight: number,
): ReadonlyMap<string, SvgCurvedSheetMesh> {
  const meshes = new Map<string, SvgCurvedSheetMesh>()

  for (const surface of scene.surfaceGeometry.surfaces) {
    if (
      surface.curvedMesh === undefined ||
      surface.curvedPrimitiveKind === undefined
    ) {
      continue
    }

    const faces = (scene.projectedFacesBySheetId.get(surface.sheetId) ?? [])
      .flatMap((face): SvgCurvedSheetFace[] => {
        const points = face.projectedPolygon.map((point) =>
          viewToSvgPoint(point, viewportHeight),
        )

        return points.every(isFiniteVec2)
          ? [
              {
                key: `${surface.sheetId}-curved-face-${face.faceIndex}`,
                points: svgPointList(points),
              },
            ]
          : []
      })
    const boundaryPathData = (
      scene.projectedBoundaryPolylinesBySheetId.get(surface.sheetId) ?? []
    )
      .map((boundary) =>
        boundary.map((point) => viewToSvgPoint(point, viewportHeight)),
      )
      .filter((boundary) => boundary.every(isFiniteVec2))
      .map(polylineToSvgPath)
      .filter((pathData) => pathData.length > 0)

    meshes.set(surface.sheetId, {
      primitiveKind: surface.curvedPrimitiveKind,
      uSegments: surface.curvedMesh.uSegments,
      vSegments: surface.curvedMesh.vSegments,
      faces,
      boundaryPathData,
    })
  }

  return meshes
}

function isFiniteVec2(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}
