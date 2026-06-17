import type {
  CurvedSheetPrimitive,
  PolygonSheetStratum,
  QuadSheetStratum,
  SurfaceFrame,
  SheetStratum,
  SurfaceSampling,
  Vec3,
} from './types.ts'

export type VertexSheetStratum = QuadSheetStratum | PolygonSheetStratum

export function sheetVertices(sheet: SheetStratum): readonly Vec3[] {
  switch (sheet.kind) {
    case 'quadSheet':
      return sheet.corners
    case 'polygonSheet':
      return sheet.vertices
    case 'workPlaneFilledSheet':
      return []
    case 'curvedSheet':
      return []
  }
}

export function updateSheetVertex(
  sheet: SheetStratum,
  vertexIndex: number,
  updater: (vertex: Vec3) => Vec3,
): SheetStratum {
  if (sheet.kind === 'quadSheet') {
    return {
      ...sheet,
      corners: sheet.corners.map((corner, index) =>
        index === vertexIndex ? updater(corner) : corner,
      ) as QuadSheetStratum['corners'],
    }
  }

  if (sheet.kind === 'workPlaneFilledSheet') {
    return sheet
  }

  if (sheet.kind === 'curvedSheet') {
    return sheet
  }

  return {
    ...sheet,
    vertices: sheet.vertices.map((vertex, index) =>
      index === vertexIndex ? updater(vertex) : vertex,
    ),
  }
}

export function cloneCurvedSheetPrimitive(
  primitive: CurvedSheetPrimitive,
): CurvedSheetPrimitive {
  switch (primitive.kind) {
    case 'hemisphere':
      return {
        kind: 'hemisphere',
        center: cloneVec3(primitive.center),
        radius: primitive.radius,
        frame: cloneSurfaceFrame(primitive.frame),
        hemisphereSide: primitive.hemisphereSide,
        sampling: cloneSurfaceSampling(primitive.sampling),
      }
    case 'saddle':
      return {
        kind: 'saddle',
        frame: cloneSurfaceFrame(primitive.frame),
        width: primitive.width,
        depth: primitive.depth,
        height: primitive.height,
        sampling: cloneSurfaceSampling(primitive.sampling),
      }
  }
}

export function cloneSurfaceFrame(frame: SurfaceFrame): SurfaceFrame {
  return {
    origin: cloneVec3(frame.origin),
    u: cloneVec3(frame.u),
    v: cloneVec3(frame.v),
    normal: cloneVec3(frame.normal),
  }
}

function cloneSurfaceSampling(sampling: SurfaceSampling): SurfaceSampling {
  return { ...sampling }
}

function cloneVec3(point: Vec3): Vec3 {
  return { ...point }
}
