import type { QuadSheetStratum, SheetStratum, Vec3 } from './types.ts'

export function sheetVertices(sheet: SheetStratum): readonly Vec3[] {
  return sheet.kind === 'quadSheet' ? sheet.corners : sheet.vertices
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

  return {
    ...sheet,
    vertices: sheet.vertices.map((vertex, index) =>
      index === vertexIndex ? updater(vertex) : vertex,
    ),
  }
}
