import type {
  PolygonSheetStratum,
  QuadSheetStratum,
  SheetStratum,
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

  return {
    ...sheet,
    vertices: sheet.vertices.map((vertex, index) =>
      index === vertexIndex ? updater(vertex) : vertex,
    ),
  }
}
