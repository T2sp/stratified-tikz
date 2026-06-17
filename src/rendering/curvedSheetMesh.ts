import {
  sampleCurvedSheetPrimitive,
  surfaceBoundaryPolylines,
} from '../geometry/curvedSheets.ts'
import type {
  Camera,
  CurvedSheetStratum,
  Vec2,
} from '../model/types.ts'
import { polylineToSvgPath, svgPointList } from './svgPath.ts'
import { projectToSvgPoint } from './svgProjection.ts'

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

export function curvedSheetToSvgMesh(
  sheet: CurvedSheetStratum,
  camera: Camera,
  viewportHeight: number,
): SvgCurvedSheetMesh {
  const mesh = sampleCurvedSheetPrimitive(sheet.primitive)
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
  const boundaryPathData = surfaceBoundaryPolylines(sheet.primitive)
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

function isFiniteVec2(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}
