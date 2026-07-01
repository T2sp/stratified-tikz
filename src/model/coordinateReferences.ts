import { coordinateAnchorPositionPreview } from './coordinateAnchors.ts'
import type {
  AmbientDimension,
  BoundaryPathSnapshot,
  ClosedPathBoundary,
  CoonsBoundarySnapshot,
  CoordinateAnchor,
  CoordinateReferenceSource,
  CoordinateSource,
  CurvedSheetPrimitive,
  Diagram,
  DiagramValidationIssue,
  PathSegment,
  PathTemplate,
  Stratum,
  Vec3,
} from './types.ts'

// Coordinate refs are resolved for author-entered point-like fields. Generated
// sample data, grid/lattice frames, depth-sort faces, and occlusion split
// segments remain numeric because they are derived geometry rather than user
// coordinate inputs.

export function coordinateReferenceSourceForPoint(
  point: Vec3,
): CoordinateReferenceSource | null {
  const source = point.symbolic?.source

  return isCoordinateReferenceSource(source) ? source : null
}

export function isCoordinateReferenceSource(
  source: unknown,
): source is CoordinateReferenceSource {
  return (
    isRecord(source) &&
    source.kind === 'coordinateRef' &&
    typeof source.coordinateId === 'string' &&
    isFiniteVec3(source.preview)
  )
}

export function cloneCoordinateSource(source: CoordinateSource): CoordinateSource {
  switch (source.kind) {
    case 'workPlaneLocal':
      return {
        kind: 'workPlaneLocal',
        frame: {
          origin: cloneVec3(source.frame.origin),
          u: cloneVec3(source.frame.u),
          v: cloneVec3(source.frame.v),
          normal: cloneVec3(source.frame.normal),
        },
        local: {
          a: cloneScalarInputValue(source.local.a),
          b: cloneScalarInputValue(source.local.b),
        },
      }
    case 'coordinateRef':
      return {
        kind: 'coordinateRef',
        coordinateId: source.coordinateId,
        preview: cloneVec3(source.preview),
      }
  }
}

export function coordinateReferenceVec3ForAnchor(
  anchor: CoordinateAnchor,
  ambientDimension: AmbientDimension,
): Vec3 {
  const preview = coordinateAnchorPositionPreview(anchor.position, ambientDimension)

  return vec3FromCoordinateReference(anchor.id, preview)
}

export function coordinateReferenceVec3ForAnchorId(
  diagram: Diagram,
  coordinateId: string,
): Vec3 | null {
  const anchor = findCoordinateAnchorById(diagram, coordinateId)

  return anchor === undefined
    ? null
    : coordinateReferenceVec3ForAnchor(anchor, diagram.ambientDimension)
}

export function resolveCoordinateReferencePoint(
  diagram: Diagram,
  point: Vec3,
): Vec3 {
  const source = coordinateReferenceSourceForPoint(point)

  if (source === null) {
    return point
  }

  return coordinateReferenceVec3ForAnchorId(diagram, source.coordinateId) ?? point
}

export function resolveDiagramCoordinateRefs(diagram: Diagram): Diagram {
  return {
    ...diagram,
    strata: diagram.strata.map((stratum) =>
      resolveStratumCoordinateRefs(diagram, stratum),
    ),
    labels: diagram.labels.map((label) => ({
      ...label,
      position: resolveCoordinateReferencePoint(diagram, label.position),
    })),
  }
}

export function validateDiagramCoordinateReferences(
  diagram: Diagram,
): DiagramValidationIssue[] {
  const errors: DiagramValidationIssue[] = []

  diagram.strata.forEach((stratum, index) => {
    validateStratumCoordinateReferences(
      diagram,
      stratum,
      `strata[${index}]`,
      errors,
    )
  })

  diagram.labels.forEach((label, index) => {
    validateCoordinateReferencePoint(
      diagram,
      label.position,
      `labels[${index}].position`,
      errors,
    )
  })

  return errors
}

function resolveStratumCoordinateRefs(
  diagram: Diagram,
  stratum: Stratum,
): Stratum {
  switch (stratum.geometricKind) {
    case 'region':
      return stratum.kind === 'filledRegion'
        ? {
            ...stratum,
            boundaries: resolveClosedPathBoundariesCoordinateRefs(
              diagram,
              stratum.boundaries,
            ),
          }
        : stratum
    case 'sheet':
      switch (stratum.kind) {
        case 'quadSheet':
          return {
            ...stratum,
            corners: stratum.corners.map((corner) =>
              resolveCoordinateReferencePoint(diagram, corner),
            ) as typeof stratum.corners,
          }
        case 'polygonSheet':
          return {
            ...stratum,
            vertices: stratum.vertices.map((vertex) =>
              resolveCoordinateReferencePoint(diagram, vertex),
            ),
          }
        case 'workPlaneFilledSheet':
          return {
            ...stratum,
            boundaries: resolveClosedPathBoundariesCoordinateRefs(
              diagram,
              stratum.boundaries,
            ),
          }
        case 'curvedSheet':
          return {
            ...stratum,
            primitive: resolveCurvedSheetPrimitiveCoordinateRefs(
              diagram,
              stratum.primitive,
            ),
          }
      }
    case 'curve':
      switch (stratum.kind) {
        case 'polyline':
        case 'cubicBezier':
          return {
            ...stratum,
            points: stratum.points.map((point) =>
              resolveCoordinateReferencePoint(diagram, point),
            ),
          }
        case 'concatenatedPath':
          return {
            ...stratum,
            segments: stratum.segments.map((segment) =>
              resolvePathSegmentCoordinateRefs(diagram, segment),
            ),
          }
        case 'templatePath':
          return {
            ...stratum,
            template: resolvePathTemplateCoordinateRefs(diagram, stratum.template),
          }
        case 'grid':
          return stratum
      }
    case 'point':
      return {
        ...stratum,
        position: resolveCoordinateReferencePoint(diagram, stratum.position),
      }
  }
}

function resolveCurvedSheetPrimitiveCoordinateRefs(
  diagram: Diagram,
  primitive: CurvedSheetPrimitive,
): CurvedSheetPrimitive {
  switch (primitive.kind) {
    case 'hemisphere':
      return {
        ...primitive,
        center: resolveCoordinateReferencePoint(diagram, primitive.center),
      }
    case 'saddle':
      return primitive
    case 'ruledSurface':
      return {
        ...primitive,
        boundary0: resolveBoundarySnapshotCoordinateRefs(
          diagram,
          primitive.boundary0,
        ),
        boundary1: resolveBoundarySnapshotCoordinateRefs(
          diagram,
          primitive.boundary1,
        ),
      }
    case 'coonsPatch':
      return {
        ...primitive,
        bottom: resolveCoonsBoundarySnapshotCoordinateRefs(
          diagram,
          primitive.bottom,
        ),
        right: resolveCoonsBoundarySnapshotCoordinateRefs(diagram, primitive.right),
        top: resolveCoonsBoundarySnapshotCoordinateRefs(diagram, primitive.top),
        left: resolveCoonsBoundarySnapshotCoordinateRefs(diagram, primitive.left),
      }
  }
}

function resolvePathTemplateCoordinateRefs(
  diagram: Diagram,
  template: PathTemplate,
): PathTemplate {
  return {
    ...template,
    center: resolveCoordinateReferencePoint(diagram, template.center),
  }
}

function resolveClosedPathBoundariesCoordinateRefs(
  diagram: Diagram,
  boundaries: readonly ClosedPathBoundary[],
): ClosedPathBoundary[] {
  return boundaries.map((boundary) => ({
    ...boundary,
    segments: boundary.segments.map((segment) =>
      resolvePathSegmentCoordinateRefs(diagram, segment),
    ),
  }))
}

function resolveBoundarySnapshotCoordinateRefs(
  diagram: Diagram,
  snapshot: BoundaryPathSnapshot,
): BoundaryPathSnapshot {
  return {
    ...snapshot,
    segments: snapshot.segments.map((segment) =>
      resolvePathSegmentCoordinateRefs(diagram, segment),
    ),
  }
}

function resolveCoonsBoundarySnapshotCoordinateRefs(
  diagram: Diagram,
  snapshot: CoonsBoundarySnapshot,
): CoonsBoundarySnapshot {
  if ('kind' in snapshot) {
    return {
      ...snapshot,
      point: resolveCoordinateReferencePoint(diagram, snapshot.point),
    }
  }

  return resolveBoundarySnapshotCoordinateRefs(diagram, snapshot)
}

function resolvePathSegmentCoordinateRefs(
  diagram: Diagram,
  segment: PathSegment,
): PathSegment {
  switch (segment.kind) {
    case 'line':
      return {
        ...segment,
        start: resolveCoordinateReferencePoint(diagram, segment.start),
        end: resolveCoordinateReferencePoint(diagram, segment.end),
      }
    case 'cubicBezier':
      return {
        ...segment,
        start: resolveCoordinateReferencePoint(diagram, segment.start),
        control1: resolveCoordinateReferencePoint(diagram, segment.control1),
        control2: resolveCoordinateReferencePoint(diagram, segment.control2),
        end: resolveCoordinateReferencePoint(diagram, segment.end),
      }
    case 'arc':
      return {
        ...segment,
        start: resolveCoordinateReferencePoint(diagram, segment.start),
        end: resolveCoordinateReferencePoint(diagram, segment.end),
        center: resolveCoordinateReferencePoint(diagram, segment.center),
      }
  }
}

function validateStratumCoordinateReferences(
  diagram: Diagram,
  stratum: Stratum,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  switch (stratum.geometricKind) {
    case 'region':
      if (stratum.kind === 'filledRegion') {
        validateClosedPathBoundariesCoordinateReferences(
          diagram,
          stratum.boundaries,
          `${path}.boundaries`,
          errors,
        )
      }
      return
    case 'sheet':
      switch (stratum.kind) {
        case 'quadSheet':
          stratum.corners.forEach((corner, index) =>
            validateCoordinateReferencePoint(
              diagram,
              corner,
              `${path}.corners[${index}]`,
              errors,
            ),
          )
          return
        case 'polygonSheet':
          stratum.vertices.forEach((vertex, index) =>
            validateCoordinateReferencePoint(
              diagram,
              vertex,
              `${path}.vertices[${index}]`,
              errors,
            ),
          )
          return
        case 'workPlaneFilledSheet':
          validateClosedPathBoundariesCoordinateReferences(
            diagram,
            stratum.boundaries,
            `${path}.boundaries`,
            errors,
          )
          return
        case 'curvedSheet':
          validateCurvedSheetPrimitiveCoordinateReferences(
            diagram,
            stratum.primitive,
            `${path}.primitive`,
            errors,
          )
          return
      }
    case 'curve':
      switch (stratum.kind) {
        case 'polyline':
        case 'cubicBezier':
          stratum.points.forEach((point, index) =>
            validateCoordinateReferencePoint(
              diagram,
              point,
              `${path}.points[${index}]`,
              errors,
            ),
          )
          return
        case 'concatenatedPath':
          validatePathSegmentsCoordinateReferences(
            diagram,
            stratum.segments,
            `${path}.segments`,
            errors,
          )
          return
        case 'templatePath':
          validateCoordinateReferencePoint(
            diagram,
            stratum.template.center,
            `${path}.template.center`,
            errors,
          )
          return
        case 'grid':
          return
      }
    case 'point':
      validateCoordinateReferencePoint(
        diagram,
        stratum.position,
        `${path}.position`,
        errors,
      )
      return
  }
}

function validateCurvedSheetPrimitiveCoordinateReferences(
  diagram: Diagram,
  primitive: CurvedSheetPrimitive,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  switch (primitive.kind) {
    case 'hemisphere':
      validateCoordinateReferencePoint(
        diagram,
        primitive.center,
        `${path}.center`,
        errors,
      )
      return
    case 'saddle':
      return
    case 'ruledSurface':
      validateBoundarySnapshotCoordinateReferences(
        diagram,
        primitive.boundary0,
        `${path}.boundary0`,
        errors,
      )
      validateBoundarySnapshotCoordinateReferences(
        diagram,
        primitive.boundary1,
        `${path}.boundary1`,
        errors,
      )
      return
    case 'coonsPatch':
      validateCoonsBoundarySnapshotCoordinateReferences(
        diagram,
        primitive.bottom,
        `${path}.bottom`,
        errors,
      )
      validateCoonsBoundarySnapshotCoordinateReferences(
        diagram,
        primitive.right,
        `${path}.right`,
        errors,
      )
      validateCoonsBoundarySnapshotCoordinateReferences(
        diagram,
        primitive.top,
        `${path}.top`,
        errors,
      )
      validateCoonsBoundarySnapshotCoordinateReferences(
        diagram,
        primitive.left,
        `${path}.left`,
        errors,
      )
      return
  }
}

function validateClosedPathBoundariesCoordinateReferences(
  diagram: Diagram,
  boundaries: readonly ClosedPathBoundary[],
  path: string,
  errors: DiagramValidationIssue[],
): void {
  boundaries.forEach((boundary, index) =>
    validatePathSegmentsCoordinateReferences(
      diagram,
      boundary.segments,
      `${path}[${index}].segments`,
      errors,
    ),
  )
}

function validateBoundarySnapshotCoordinateReferences(
  diagram: Diagram,
  snapshot: BoundaryPathSnapshot,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validatePathSegmentsCoordinateReferences(
    diagram,
    snapshot.segments,
    `${path}.segments`,
    errors,
  )
}

function validateCoonsBoundarySnapshotCoordinateReferences(
  diagram: Diagram,
  snapshot: CoonsBoundarySnapshot,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if ('kind' in snapshot) {
    validateCoordinateReferencePoint(diagram, snapshot.point, `${path}.point`, errors)
    return
  }

  validateBoundarySnapshotCoordinateReferences(diagram, snapshot, path, errors)
}

function validatePathSegmentsCoordinateReferences(
  diagram: Diagram,
  segments: readonly PathSegment[],
  path: string,
  errors: DiagramValidationIssue[],
): void {
  segments.forEach((segment, index) =>
    validatePathSegmentCoordinateReferences(
      diagram,
      segment,
      `${path}[${index}]`,
      errors,
    ),
  )
}

function validatePathSegmentCoordinateReferences(
  diagram: Diagram,
  segment: PathSegment,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  switch (segment.kind) {
    case 'line':
      validateCoordinateReferencePoint(diagram, segment.start, `${path}.start`, errors)
      validateCoordinateReferencePoint(diagram, segment.end, `${path}.end`, errors)
      return
    case 'cubicBezier':
      validateCoordinateReferencePoint(diagram, segment.start, `${path}.start`, errors)
      validateCoordinateReferencePoint(
        diagram,
        segment.control1,
        `${path}.control1`,
        errors,
      )
      validateCoordinateReferencePoint(
        diagram,
        segment.control2,
        `${path}.control2`,
        errors,
      )
      validateCoordinateReferencePoint(diagram, segment.end, `${path}.end`, errors)
      return
    case 'arc':
      validateCoordinateReferencePoint(diagram, segment.start, `${path}.start`, errors)
      validateCoordinateReferencePoint(diagram, segment.end, `${path}.end`, errors)
      validateCoordinateReferencePoint(
        diagram,
        segment.center,
        `${path}.center`,
        errors,
      )
      return
  }
}

function validateCoordinateReferencePoint(
  diagram: Diagram,
  point: Vec3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  const source = point.symbolic?.source

  if (source?.kind !== 'coordinateRef') {
    return
  }

  if (
    typeof source.coordinateId !== 'string' ||
    source.coordinateId.trim().length === 0
  ) {
    pushError(errors, `${path}.symbolic.source.coordinateId`, 'Coordinate reference id must be non-empty.')
    return
  }

  if (findCoordinateAnchorById(diagram, source.coordinateId) === undefined) {
    pushError(
      errors,
      `${path}.symbolic.source.coordinateId`,
      'Coordinate reference must point to an existing coordinate anchor.',
    )
    return
  }

  if (!isFiniteVec3(source.preview)) {
    pushError(
      errors,
      `${path}.symbolic.source.preview`,
      'Coordinate reference preview must contain finite coordinates.',
    )
    return
  }
}

function vec3FromCoordinateReference(
  coordinateId: string,
  preview: Vec3,
): Vec3 {
  const normalizedPreview = cloneVec3(preview)

  return {
    ...normalizedPreview,
    symbolic: {
      x: { kind: 'numeric', value: normalizedPreview.x },
      y: { kind: 'numeric', value: normalizedPreview.y },
      z: { kind: 'numeric', value: normalizedPreview.z },
      source: {
        kind: 'coordinateRef',
        coordinateId,
        preview: cloneVec3(normalizedPreview),
      },
    },
  }
}

function findCoordinateAnchorById(
  diagram: Diagram,
  coordinateId: string,
): CoordinateAnchor | undefined {
  return (diagram.coordinateAnchors ?? []).find(
    (anchor) => anchor.id === coordinateId,
  )
}

function cloneVec3(point: Vec3): Vec3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
  }
}

function isFiniteVec3(point: unknown): point is Vec3 {
  return (
    isRecord(point) &&
    typeof point.x === 'number' &&
    Number.isFinite(point.x) &&
    typeof point.y === 'number' &&
    Number.isFinite(point.y) &&
    typeof point.z === 'number' &&
    Number.isFinite(point.z)
  )
}

function cloneScalarInputValue<T extends { kind: string }>(value: T): T {
  return { ...value }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pushError(
  errors: DiagramValidationIssue[],
  path: string,
  message: string,
): void {
  errors.push({ path, message })
}
