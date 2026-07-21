import type {
  BoundaryPathSnapshot,
  CoonsBoundarySnapshot,
  CoonsConstantPointBoundarySnapshot,
  CoonsPatchBoundarySources,
  CurvedSheetPrimitive,
  PathSegment,
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
    case 'ruledSurface':
      return {
        kind: 'ruledSurface',
        boundary0: cloneBoundaryPathSnapshot(primitive.boundary0),
        boundary1: cloneBoundaryPathSnapshot(primitive.boundary1),
        sampling: { ...primitive.sampling },
      }
    case 'coonsPatch':
      return {
        kind: 'coonsPatch',
        bottom: cloneCoonsBoundarySnapshot(primitive.bottom),
        right: cloneCoonsBoundarySnapshot(primitive.right),
        top: cloneCoonsBoundarySnapshot(primitive.top),
        left: cloneCoonsBoundarySnapshot(primitive.left),
        ...(primitive.boundarySnapshotState === undefined
          ? {}
          : { boundarySnapshotState: primitive.boundarySnapshotState }),
        ...(primitive.boundarySources === undefined
          ? {}
          : {
              boundarySources: cloneCoonsPatchBoundarySources(
                primitive.boundarySources,
              ),
            }),
        sampling: cloneSurfaceSampling(primitive.sampling),
      }
  }
}

function cloneCoonsPatchBoundarySources(
  sources: CoonsPatchBoundarySources,
): CoonsPatchBoundarySources {
  return {
    bottom: { ...sources.bottom },
    right: { ...sources.right },
    top: { ...sources.top },
    left: { ...sources.left },
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

function cloneBoundaryPathSnapshot(
  snapshot: BoundaryPathSnapshot,
): BoundaryPathSnapshot {
  return {
    ...(snapshot.id === undefined ? {} : { id: snapshot.id }),
    ...(snapshot.name === undefined ? {} : { name: snapshot.name }),
    segments: snapshot.segments.map(clonePathSegment),
  }
}

function cloneCoonsBoundarySnapshot(
  snapshot: CoonsBoundarySnapshot,
): CoonsBoundarySnapshot {
  if (snapshotIsCoonsConstantPointBoundary(snapshot)) {
    return {
      kind: 'constantPoint',
      ...(snapshot.sourceId === undefined ? {} : { sourceId: snapshot.sourceId }),
      ...(snapshot.name === undefined ? {} : { name: snapshot.name }),
      point: cloneVec3(snapshot.point),
    }
  }

  return cloneBoundaryPathSnapshot(snapshot)
}

function snapshotIsCoonsConstantPointBoundary(
  snapshot: CoonsBoundarySnapshot,
): snapshot is CoonsConstantPointBoundarySnapshot {
  return 'kind' in snapshot && snapshot.kind === 'constantPoint'
}

function clonePathSegment(segment: PathSegment): PathSegment {
  switch (segment.kind) {
    case 'line':
      return {
        kind: 'line',
        start: cloneVec3(segment.start),
        end: cloneVec3(segment.end),
        ...(segment.styleOverride === undefined
          ? {}
          : { styleOverride: { ...segment.styleOverride } }),
      }
    case 'cubicBezier':
      return {
        kind: 'cubicBezier',
        start: cloneVec3(segment.start),
        control1: cloneVec3(segment.control1),
        control2: cloneVec3(segment.control2),
        end: cloneVec3(segment.end),
        ...(segment.controlMode === undefined
          ? {}
          : { controlMode: structuredClone(segment.controlMode) }),
        ...(segment.styleOverride === undefined
          ? {}
          : { styleOverride: { ...segment.styleOverride } }),
      }
    case 'arc':
      return {
        kind: 'arc',
        start: cloneVec3(segment.start),
        end: cloneVec3(segment.end),
        center: cloneVec3(segment.center),
        radius: segment.radius,
        startAngleDeg: segment.startAngleDeg,
        endAngleDeg: segment.endAngleDeg,
        direction: segment.direction,
        ...(segment.frame === undefined
          ? {}
          : { frame: cloneSurfaceFrame(segment.frame) }),
        ...(segment.styleOverride === undefined
          ? {}
          : { styleOverride: { ...segment.styleOverride } }),
      }
  }
}

function cloneVec3(point: Vec3): Vec3 {
  return { ...point }
}
