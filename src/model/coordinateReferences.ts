import {
  coordinateAnchorPositionPreview,
  coordinateAnchorPositionToVec3,
} from './coordinateAnchors.ts'
import type {
  AmbientDimension,
  BoundaryPathSnapshot,
  ClosedPathBoundary,
  CoordinateComponent,
  CoonsBoundarySnapshot,
  CoordinateAnchor,
  CoordinateReferenceSource,
  CoordinateSource,
  CubicBezierControlMode,
  CurvedSheetPrimitive,
  Diagram,
  DiagramValidationIssue,
  PathSegment,
  PathTemplate,
  Stratum,
  TextLabel,
  Vec3,
  WorkPlaneFrameSnapshot,
} from './types.ts'

export type CoordinateRefLocationKind =
  | 'pathCoordinate'
  | 'pathTemplateCenter'
  | 'arcCenter'
  | 'labelPosition'
  | 'pointPosition'
  | 'simpleSheetVertex'
  | 'workPlaneFrameField'
  | 'curvedSheetPrimitive'
  | 'derivedCoordinate'

const supportedCoordinateRefLocations: ReadonlySet<CoordinateRefLocationKind> =
  new Set([
    'pathCoordinate',
    'labelPosition',
    'pointPosition',
    'simpleSheetVertex',
  ])

const workPlaneFrameFields = ['origin', 'u', 'v', 'normal'] as const

export type DetachCoordinateAnchorReferencesResult =
  | {
      ok: true
      value: {
        diagram: Diagram
        detachedCount: number
      }
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachCoordinateReferenceContext = {
  replacements: ReadonlyMap<string, Vec3>
  requireReplacement: boolean
  detachedCount: number
}

type DetachPointResult =
  | {
      ok: true
      point: Vec3
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachPathSegmentResult =
  | {
      ok: true
      segment: PathSegment
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachPathTemplateResult =
  | {
      ok: true
      template: PathTemplate
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachStratumResult =
  | {
      ok: true
      stratum: Stratum
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachClosedPathBoundariesResult =
  | {
      ok: true
      boundaries: ClosedPathBoundary[]
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachPathSegmentsResult =
  | {
      ok: true
      segments: PathSegment[]
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

// CoordinateRef support is narrower than symbolic coordinate support because
// TikZ export must preserve `(name)` references. Frame fields, derived previews,
// and sampled curved sheets are rejected until reference-preserving export exists.
export function isCoordinateRefSupportedAtLocation(
  location: CoordinateRefLocationKind,
): boolean {
  return supportedCoordinateRefLocations.has(location)
}

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

export function coordinateAnchorReferenceCount(
  diagram: Diagram,
  coordinateId: string,
): number {
  return countCoordinateReferenceSources(diagram, coordinateId, new WeakSet())
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

function countCoordinateReferenceSources(
  value: unknown,
  coordinateId: string,
  seen: WeakSet<object>,
): number {
  if (!isRecord(value)) {
    if (Array.isArray(value)) {
      return value.reduce(
        (count, item) =>
          count + countCoordinateReferenceSources(item, coordinateId, seen),
        0,
      )
    }

    return 0
  }

  if (seen.has(value)) {
    return 0
  }

  seen.add(value)

  const ownCount =
    isCoordinateReferenceSource(value) && value.coordinateId === coordinateId
      ? 1
      : 0

  return (
    ownCount +
    Object.values(value as Record<string, unknown>).reduce<number>(
      (count, item) =>
        count + countCoordinateReferenceSources(item, coordinateId, seen),
      0,
    )
  )
}

export function detachCoordinateAnchorReferences(
  diagram: Diagram,
  coordinateId: string,
): DetachCoordinateAnchorReferencesResult {
  return detachCoordinateAnchorReferencesMany(diagram, [coordinateId])
}

export function detachCoordinateAnchorReferencesMany(
  diagram: Diagram,
  coordinateIds: readonly string[],
): DetachCoordinateAnchorReferencesResult {
  const uniqueCoordinateIds = [...new Set(coordinateIds)]

  if (uniqueCoordinateIds.length === 0) {
    return {
      ok: true,
      value: {
        diagram,
        detachedCount: 0,
      },
    }
  }

  const replacements = coordinateReferenceReplacementMapForAnchorIds(
    diagram,
    uniqueCoordinateIds,
  )

  if (!replacements.ok) {
    return replacements
  }

  const context: DetachCoordinateReferenceContext = {
    replacements: replacements.replacements,
    requireReplacement: false,
    detachedCount: 0,
  }
  const strata: Stratum[] = []

  for (const [index, stratum] of diagram.strata.entries()) {
    const detached = detachStratumCoordinateReferences(
      stratum,
      context,
      `strata[${index}]`,
    )

    if (!detached.ok) {
      return detached
    }

    strata.push(detached.stratum)
  }

  const labels: TextLabel[] = []

  for (const [index, label] of diagram.labels.entries()) {
    const detached = detachCoordinateReferencePoint(
      label.position,
      context,
      `labels[${index}].position`,
    )

    if (!detached.ok) {
      return detached
    }

    labels.push(
      detached.point === label.position
        ? label
        : {
            ...label,
            position: detached.point,
          },
    )
  }

  return {
    ok: true,
    value: {
      diagram: {
        ...diagram,
        strata,
        labels,
      },
      detachedCount: context.detachedCount,
    },
  }
}

export function detachCoordinateReferencesInElements(
  diagram: Diagram,
  elements: readonly (
    | { kind: 'stratum'; id: string }
    | { kind: 'label'; id: string }
  )[],
): DetachCoordinateAnchorReferencesResult {
  const selectedKeys = new Set(
    elements.map((element) => `${element.kind}:${element.id}`),
  )

  if (selectedKeys.size === 0) {
    return {
      ok: true,
      value: {
        diagram,
        detachedCount: 0,
      },
    }
  }

  const replacements = coordinateReferenceReplacementMapForExistingAnchors(diagram)

  if (!replacements.ok) {
    return replacements
  }

  const context: DetachCoordinateReferenceContext = {
    replacements: replacements.replacements,
    requireReplacement: true,
    detachedCount: 0,
  }
  const strata: Stratum[] = []

  for (const [index, stratum] of diagram.strata.entries()) {
    if (!selectedKeys.has(`stratum:${stratum.id}`)) {
      strata.push(stratum)
      continue
    }

    const detached = detachStratumCoordinateReferences(
      stratum,
      context,
      `strata[${index}]`,
    )

    if (!detached.ok) {
      return detached
    }

    strata.push(detached.stratum)
  }

  const labels: TextLabel[] = []

  for (const [index, label] of diagram.labels.entries()) {
    if (!selectedKeys.has(`label:${label.id}`)) {
      labels.push(label)
      continue
    }

    const detached = detachCoordinateReferencePoint(
      label.position,
      context,
      `labels[${index}].position`,
    )

    if (!detached.ok) {
      return detached
    }

    labels.push(
      detached.point === label.position
        ? label
        : {
            ...label,
            position: detached.point,
          },
    )
  }

  return {
    ok: true,
    value: {
      diagram: {
        ...diagram,
        strata,
        labels,
      },
      detachedCount: context.detachedCount,
    },
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

  return (
    coordinateReferenceVec3ForAnchorId(diagram, source.coordinateId) ??
    unresolvedCoordinateReferenceVec3(source)
  )
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
      'labelPosition',
    )
  })

  diagram.coordinateAnchors?.forEach((anchor, index) => {
    if (anchor.position.kind !== 'workPlaneLocal') {
      return
    }

    validateWorkPlaneFrameCoordinateReferences(
      anchor.position.frame,
      `coordinateAnchors[${index}].position.frame`,
      errors,
    )
    validateCoordinateReferencePointAtLocation(
      anchor.position.preview,
      `coordinateAnchors[${index}].position.preview`,
      errors,
      'derivedCoordinate',
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
          return stratum
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

function detachedCoordinatePointForAnchor(
  anchor: CoordinateAnchor,
  ambientDimension: AmbientDimension,
  path: string,
): DetachPointResult {
  let point: Vec3

  try {
    point =
      anchor.position.kind === 'workPlaneLocal' && ambientDimension !== 3
        ? coordinateAnchorPositionPreview(anchor.position, ambientDimension)
        : coordinateAnchorPositionToVec3(anchor.position, ambientDimension)
  } catch {
    return {
      ok: false,
      error: {
        path,
        message: `Could not detach coordinate "${anchor.name}" because its position is malformed.`,
      },
    }
  }

  if (!isFiniteVec3(point)) {
    return {
      ok: false,
      error: {
        path,
        message: `Could not detach coordinate "${anchor.name}" because its position is not finite.`,
      },
    }
  }

  return {
    ok: true,
    point,
  }
}

function coordinateReferenceReplacementMapForAnchorIds(
  diagram: Diagram,
  coordinateIds: readonly string[],
):
  | {
      ok: true
      replacements: Map<string, Vec3>
    }
  | {
      ok: false
      error: DiagramValidationIssue
    } {
  const replacements = new Map<string, Vec3>()

  for (const coordinateId of coordinateIds) {
    const anchorIndex = (diagram.coordinateAnchors ?? []).findIndex(
      (anchor) => anchor.id === coordinateId,
    )

    if (anchorIndex < 0) {
      return {
        ok: false,
        error: {
          path: 'coordinateAnchors',
          message: `Coordinate anchor "${coordinateId}" does not exist.`,
        },
      }
    }

    const anchor = diagram.coordinateAnchors?.[anchorIndex]

    if (anchor === undefined) {
      return {
        ok: false,
        error: {
          path: `coordinateAnchors[${anchorIndex}]`,
          message: `Coordinate anchor "${coordinateId}" does not exist.`,
        },
      }
    }

    const detachedPoint = detachedCoordinatePointForAnchor(
      anchor,
      diagram.ambientDimension,
      `coordinateAnchors[${anchorIndex}].position`,
    )

    if (!detachedPoint.ok) {
      return detachedPoint
    }

    replacements.set(coordinateId, detachedPoint.point)
  }

  return {
    ok: true,
    replacements,
  }
}

function coordinateReferenceReplacementMapForExistingAnchors(
  diagram: Diagram,
):
  | {
      ok: true
      replacements: Map<string, Vec3>
    }
  | {
      ok: false
      error: DiagramValidationIssue
    } {
  return coordinateReferenceReplacementMapForAnchorIds(
    diagram,
    (diagram.coordinateAnchors ?? []).map((anchor) => anchor.id),
  )
}

function detachStratumCoordinateReferences(
  stratum: Stratum,
  context: DetachCoordinateReferenceContext,
  path: string,
): DetachStratumResult {
  switch (stratum.geometricKind) {
    case 'region':
      if (stratum.kind !== 'filledRegion') {
        return {
          ok: true,
          stratum,
        }
      }

      const boundaries = detachClosedPathBoundariesCoordinateReferences(
        stratum.boundaries,
        context,
        `${path}.boundaries`,
      )

      if (!boundaries.ok) {
        return boundaries
      }

      return {
        ok: true,
        stratum: {
          ...stratum,
          boundaries: boundaries.boundaries,
        },
      }
    case 'sheet':
      switch (stratum.kind) {
        case 'quadSheet': {
          const corners = detachVec3ArrayCoordinateReferences(
            stratum.corners,
            context,
            `${path}.corners`,
          )

          if (!corners.ok) {
            return corners
          }

          return {
            ok: true,
            stratum: {
              ...stratum,
              corners: corners.points as typeof stratum.corners,
            },
          }
        }
        case 'polygonSheet': {
          const vertices = detachVec3ArrayCoordinateReferences(
            stratum.vertices,
            context,
            `${path}.vertices`,
          )

          if (!vertices.ok) {
            return vertices
          }

          return {
            ok: true,
            stratum: {
              ...stratum,
              vertices: vertices.points,
            },
          }
        }
        case 'workPlaneFilledSheet':
        {
          const boundaries = detachClosedPathBoundariesCoordinateReferences(
            stratum.boundaries,
            context,
            `${path}.boundaries`,
          )

          if (!boundaries.ok) {
            return boundaries
          }

          return {
            ok: true,
            stratum: {
              ...stratum,
              boundaries: boundaries.boundaries,
            },
          }
        }
        case 'curvedSheet':
          return {
            ok: true,
            stratum,
          }
        default:
          return {
            ok: true,
            stratum,
          }
      }
    case 'curve':
      switch (stratum.kind) {
        case 'polyline':
        case 'cubicBezier': {
          const points = detachVec3ArrayCoordinateReferences(
            stratum.points,
            context,
            `${path}.points`,
          )

          if (!points.ok) {
            return points
          }

          return {
            ok: true,
            stratum: {
              ...stratum,
              points: points.points,
            },
          }
        }
        case 'concatenatedPath': {
          const segments = detachPathSegmentsCoordinateReferences(
            stratum.segments,
            context,
            `${path}.segments`,
          )

          if (!segments.ok) {
            return segments
          }

          return {
            ok: true,
            stratum: {
              ...stratum,
              segments: segments.segments,
            },
          }
        }
        case 'templatePath': {
          const template = detachPathTemplateCoordinateReferences(
            stratum.template,
            context,
            `${path}.template`,
          )

          if (!template.ok) {
            return template
          }

          return {
            ok: true,
            stratum: {
              ...stratum,
              template: template.template,
            },
          }
        }
        case 'grid':
          return {
            ok: true,
            stratum,
          }
        default:
          return {
            ok: true,
            stratum,
          }
      }
    case 'point': {
      const position = detachCoordinateReferencePoint(
        stratum.position,
        context,
        `${path}.position`,
      )

      if (!position.ok) {
        return position
      }

      return {
        ok: true,
        stratum: {
          ...stratum,
          position: position.point,
        },
      }
    }
  }
}

function detachPathTemplateCoordinateReferences(
  template: PathTemplate,
  context: DetachCoordinateReferenceContext,
  path: string,
): DetachPathTemplateResult {
  const center = detachCoordinateReferencePoint(
    template.center,
    context,
    `${path}.center`,
  )

  if (!center.ok) {
    return center
  }

  return {
    ok: true,
    template: {
      ...template,
      center: center.point,
    },
  }
}

function detachClosedPathBoundariesCoordinateReferences(
  boundaries: readonly ClosedPathBoundary[],
  context: DetachCoordinateReferenceContext,
  path: string,
): DetachClosedPathBoundariesResult {
  const detachedBoundaries: ClosedPathBoundary[] = []

  for (const [index, boundary] of boundaries.entries()) {
    const segments = detachPathSegmentsCoordinateReferences(
      boundary.segments,
      context,
      `${path}[${index}].segments`,
    )

    if (!segments.ok) {
      return segments
    }

    detachedBoundaries.push({
      ...boundary,
      segments: segments.segments,
    })
  }

  return {
    ok: true,
    boundaries: detachedBoundaries,
  }
}

function detachPathSegmentsCoordinateReferences(
  segments: readonly PathSegment[],
  context: DetachCoordinateReferenceContext,
  path: string,
): DetachPathSegmentsResult {
  const detachedSegments: PathSegment[] = []

  for (const [index, segment] of segments.entries()) {
    const detached = detachPathSegmentCoordinateReferences(
      segment,
      context,
      `${path}[${index}]`,
    )

    if (!detached.ok) {
      return detached
    }

    detachedSegments.push(detached.segment)
  }

  return {
    ok: true,
    segments: detachedSegments,
  }
}

function detachPathSegmentCoordinateReferences(
  segment: PathSegment,
  context: DetachCoordinateReferenceContext,
  path: string,
): DetachPathSegmentResult {
  switch (segment.kind) {
    case 'line': {
      const start = detachCoordinateReferencePoint(
        segment.start,
        context,
        `${path}.start`,
      )
      const end = detachCoordinateReferencePoint(
        segment.end,
        context,
        `${path}.end`,
      )

      if (!start.ok) {
        return start
      }

      if (!end.ok) {
        return end
      }

      return {
        ok: true,
        segment: {
          ...segment,
          start: start.point,
          end: end.point,
        },
      }
    }
    case 'cubicBezier': {
      const start = detachCoordinateReferencePoint(
        segment.start,
        context,
        `${path}.start`,
      )
      const control1 = detachCoordinateReferencePoint(
        segment.control1,
        context,
        `${path}.control1`,
      )
      const control2 = detachCoordinateReferencePoint(
        segment.control2,
        context,
        `${path}.control2`,
      )
      const end = detachCoordinateReferencePoint(
        segment.end,
        context,
        `${path}.end`,
      )

      if (!start.ok) {
        return start
      }

      if (!control1.ok) {
        return control1
      }

      if (!control2.ok) {
        return control2
      }

      if (!end.ok) {
        return end
      }

      return {
        ok: true,
        segment: {
          ...segment,
          start: start.point,
          control1: control1.point,
          control2: control2.point,
          end: end.point,
        },
      }
    }
    case 'arc': {
      const start = detachCoordinateReferencePoint(
        segment.start,
        context,
        `${path}.start`,
      )
      const end = detachCoordinateReferencePoint(
        segment.end,
        context,
        `${path}.end`,
      )
      const center = detachCoordinateReferencePoint(
        segment.center,
        context,
        `${path}.center`,
      )

      if (!start.ok) {
        return start
      }

      if (!end.ok) {
        return end
      }

      if (!center.ok) {
        return center
      }

      return {
        ok: true,
        segment: {
          ...segment,
          start: start.point,
          end: end.point,
          center: center.point,
        },
      }
    }
  }
}

function detachVec3ArrayCoordinateReferences(
  points: readonly Vec3[],
  context: DetachCoordinateReferenceContext,
  path: string,
):
  | {
      ok: true
      points: Vec3[]
    }
  | {
      ok: false
      error: DiagramValidationIssue
    } {
  const detachedPoints: Vec3[] = []

  for (const [index, point] of points.entries()) {
    const detached = detachCoordinateReferencePoint(
      point,
      context,
      `${path}[${index}]`,
    )

    if (!detached.ok) {
      return detached
    }

    detachedPoints.push(detached.point)
  }

  return {
    ok: true,
    points: detachedPoints,
  }
}

function detachCoordinateReferencePoint(
  point: Vec3,
  context: DetachCoordinateReferenceContext,
  path: string,
): DetachPointResult {
  const source = coordinateReferenceSourceForPoint(point)

  if (source === null) {
    return {
      ok: true,
      point,
    }
  }

  const replacement = context.replacements.get(source.coordinateId)

  if (replacement === undefined) {
    if (context.requireReplacement) {
      return {
        ok: false,
        error: {
          path,
          message: `Could not detach coordinate reference "${source.coordinateId}" because its coordinate anchor does not exist.`,
        },
      }
    }

    return {
      ok: true,
      point,
    }
  }

  if (!isFiniteVec3(replacement)) {
    return {
      ok: false,
      error: {
        path,
        message: `Could not detach coordinate reference "${source.coordinateId}" because its replacement point is not finite.`,
      },
    }
  }

  context.detachedCount += 1

  return {
    ok: true,
    point: cloneVec3(replacement),
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
              'simpleSheetVertex',
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
              'simpleSheetVertex',
            ),
          )
          return
        case 'workPlaneFilledSheet':
          validateWorkPlaneFrameCoordinateReferences(
            stratum.planeFrame,
            `${path}.planeFrame`,
            errors,
          )
          validateClosedPathBoundariesCoordinateReferences(
            diagram,
            stratum.boundaries,
            `${path}.boundaries`,
            errors,
          )
          return
        case 'curvedSheet':
          validateUnsupportedCurvedSheetPrimitiveCoordinateReferences(
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
              'pathCoordinate',
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
            'pathTemplateCenter',
          )
          validatePathTemplateFrameCoordinateReferences(
            stratum.template,
            `${path}.template`,
            errors,
          )
          return
        case 'grid':
          validateWorkPlaneFrameCoordinateReferences(
            stratum.frame.frame,
            `${path}.frame.frame`,
            errors,
          )
          return
      }
    case 'point':
      validateCoordinateReferencePoint(
        diagram,
        stratum.position,
        `${path}.position`,
        errors,
        'pointPosition',
      )
      return
  }
}

function validateUnsupportedCurvedSheetPrimitiveCoordinateReferences(
  primitive: CurvedSheetPrimitive,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  switch (primitive.kind) {
    case 'hemisphere':
      validateCoordinateReferencePointAtLocation(
        primitive.center,
        `${path}.center`,
        errors,
        'curvedSheetPrimitive',
      )
      validateWorkPlaneFrameCoordinateReferencesAtLocation(
        primitive.frame,
        `${path}.frame`,
        errors,
        'curvedSheetPrimitive',
      )
      return
    case 'saddle':
      validateWorkPlaneFrameCoordinateReferencesAtLocation(
        primitive.frame,
        `${path}.frame`,
        errors,
        'curvedSheetPrimitive',
      )
      return
    case 'ruledSurface':
      validateBoundarySnapshotCoordinateReferencesAtLocation(
        primitive.boundary0,
        `${path}.boundary0`,
        errors,
        'curvedSheetPrimitive',
      )
      validateBoundarySnapshotCoordinateReferencesAtLocation(
        primitive.boundary1,
        `${path}.boundary1`,
        errors,
        'curvedSheetPrimitive',
      )
      return
    case 'coonsPatch':
      validateCoonsBoundarySnapshotCoordinateReferencesAtLocation(
        primitive.bottom,
        `${path}.bottom`,
        errors,
        'curvedSheetPrimitive',
      )
      validateCoonsBoundarySnapshotCoordinateReferencesAtLocation(
        primitive.right,
        `${path}.right`,
        errors,
        'curvedSheetPrimitive',
      )
      validateCoonsBoundarySnapshotCoordinateReferencesAtLocation(
        primitive.top,
        `${path}.top`,
        errors,
        'curvedSheetPrimitive',
      )
      validateCoonsBoundarySnapshotCoordinateReferencesAtLocation(
        primitive.left,
        `${path}.left`,
        errors,
        'curvedSheetPrimitive',
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

function validateBoundarySnapshotCoordinateReferencesAtLocation(
  snapshot: BoundaryPathSnapshot,
  path: string,
  errors: DiagramValidationIssue[],
  location: CoordinateRefLocationKind,
): void {
  validatePathSegmentsCoordinateReferencesAtLocation(
    snapshot.segments,
    path,
    errors,
    location,
  )
}

function validateCoonsBoundarySnapshotCoordinateReferencesAtLocation(
  snapshot: CoonsBoundarySnapshot,
  path: string,
  errors: DiagramValidationIssue[],
  location: CoordinateRefLocationKind,
): void {
  if ('kind' in snapshot) {
    validateCoordinateReferencePointAtLocation(
      snapshot.point,
      `${path}.point`,
      errors,
      location,
    )
    return
  }

  validateBoundarySnapshotCoordinateReferencesAtLocation(
    snapshot,
    path,
    errors,
    location,
  )
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

function validatePathSegmentsCoordinateReferencesAtLocation(
  segments: readonly PathSegment[],
  path: string,
  errors: DiagramValidationIssue[],
  location: CoordinateRefLocationKind,
): void {
  segments.forEach((segment, index) =>
    validatePathSegmentCoordinateReferencesAtLocation(
      segment,
      `${path}.segments[${index}]`,
      errors,
      location,
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
      validateCoordinateReferencePoint(
        diagram,
        segment.start,
        `${path}.start`,
        errors,
        'pathCoordinate',
      )
      validateCoordinateReferencePoint(
        diagram,
        segment.end,
        `${path}.end`,
        errors,
        'pathCoordinate',
      )
      return
    case 'cubicBezier':
      validateCoordinateReferencePoint(
        diagram,
        segment.start,
        `${path}.start`,
        errors,
        'pathCoordinate',
      )
      validateCoordinateReferencePoint(
        diagram,
        segment.control1,
        `${path}.control1`,
        errors,
        'pathCoordinate',
      )
      validateCoordinateReferencePoint(
        diagram,
        segment.control2,
        `${path}.control2`,
        errors,
        'pathCoordinate',
      )
      validateCoordinateReferencePoint(
        diagram,
        segment.end,
        `${path}.end`,
        errors,
        'pathCoordinate',
      )
      validateCubicBezierControlModeCoordinateReferences(
        segment.controlMode,
        `${path}.controlMode`,
        errors,
      )
      return
    case 'arc':
      validateCoordinateReferencePoint(
        diagram,
        segment.start,
        `${path}.start`,
        errors,
        'pathCoordinate',
      )
      validateCoordinateReferencePoint(
        diagram,
        segment.end,
        `${path}.end`,
        errors,
        'pathCoordinate',
      )
      validateCoordinateReferencePoint(
        diagram,
        segment.center,
        `${path}.center`,
        errors,
        'arcCenter',
      )
      if (segment.frame !== undefined) {
        validateWorkPlaneFrameCoordinateReferences(
          segment.frame,
          `${path}.frame`,
          errors,
        )
      }
      return
  }
}

function validatePathSegmentCoordinateReferencesAtLocation(
  segment: PathSegment,
  path: string,
  errors: DiagramValidationIssue[],
  location: CoordinateRefLocationKind,
): void {
  switch (segment.kind) {
    case 'line':
      validateCoordinateReferencePointAtLocation(
        segment.start,
        `${path}.start`,
        errors,
        location,
      )
      validateCoordinateReferencePointAtLocation(
        segment.end,
        `${path}.end`,
        errors,
        location,
      )
      return
    case 'cubicBezier':
      validateCoordinateReferencePointAtLocation(
        segment.start,
        `${path}.start`,
        errors,
        location,
      )
      validateCoordinateReferencePointAtLocation(
        segment.control1,
        `${path}.control1`,
        errors,
        location,
      )
      validateCoordinateReferencePointAtLocation(
        segment.control2,
        `${path}.control2`,
        errors,
        location,
      )
      validateCoordinateReferencePointAtLocation(
        segment.end,
        `${path}.end`,
        errors,
        location,
      )
      validateCubicBezierControlModeCoordinateReferencesAtLocation(
        segment.controlMode,
        `${path}.controlMode`,
        errors,
        location,
      )
      return
    case 'arc':
      validateCoordinateReferencePointAtLocation(
        segment.start,
        `${path}.start`,
        errors,
        location,
      )
      validateCoordinateReferencePointAtLocation(
        segment.end,
        `${path}.end`,
        errors,
        location,
      )
      validateCoordinateReferencePointAtLocation(
        segment.center,
        `${path}.center`,
        errors,
        arcCenterLocationForPathLocation(location),
      )
      if (segment.frame !== undefined) {
        validateWorkPlaneFrameCoordinateReferencesAtLocation(
          segment.frame,
          `${path}.frame`,
          errors,
          location,
        )
      }
      return
  }
}

function validateCoordinateReferencePoint(
  diagram: Diagram,
  point: Vec3,
  path: string,
  errors: DiagramValidationIssue[],
  location: CoordinateRefLocationKind,
): void {
  const source = point.symbolic?.source

  if (source?.kind !== 'coordinateRef') {
    validateCoordinateReferencePointSourceFrame(point, path, errors)
    return
  }

  if (!isCoordinateRefSupportedAtLocation(location)) {
    pushError(
      errors,
      `${path}.symbolic.source`,
      unsupportedCoordinateReferenceMessage(location, path),
    )
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

function validateCoordinateReferencePointAtLocation(
  point: Vec3,
  path: string,
  errors: DiagramValidationIssue[],
  location: CoordinateRefLocationKind,
): void {
  const source = point.symbolic?.source

  if (source?.kind === 'coordinateRef') {
    pushError(
      errors,
      `${path}.symbolic.source`,
      unsupportedCoordinateReferenceMessage(location, path),
    )
    return
  }

  validateCoordinateReferencePointSourceFrame(point, path, errors)
}

function validateCoordinateReferencePointSourceFrame(
  point: Vec3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  const source = point.symbolic?.source

  if (source?.kind !== 'workPlaneLocal') {
    return
  }

  validateWorkPlaneFrameCoordinateReferences(
    source.frame,
    `${path}.symbolic.source.frame`,
    errors,
  )
}

function validatePathTemplateFrameCoordinateReferences(
  template: PathTemplate,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (template.frame === undefined) {
    return
  }

  validateWorkPlaneFrameCoordinateReferences(
    template.frame,
    `${path}.frame`,
    errors,
  )
}

function validateCubicBezierControlModeCoordinateReferences(
  controlMode: CubicBezierControlMode | undefined,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateCubicBezierControlModeCoordinateReferencesAtLocation(
    controlMode,
    path,
    errors,
    'workPlaneFrameField',
  )
}

function validateCubicBezierControlModeCoordinateReferencesAtLocation(
  controlMode: CubicBezierControlMode | undefined,
  path: string,
  errors: DiagramValidationIssue[],
  location: CoordinateRefLocationKind,
): void {
  if (
    controlMode?.kind !== 'workPlaneRelativeCartesian' &&
    controlMode?.kind !== 'workPlaneRelativePolar'
  ) {
    return
  }

  validateWorkPlaneFrameCoordinateReferencesAtLocation(
    controlMode.frame,
    `${path}.frame`,
    errors,
    location,
  )
}

function validateWorkPlaneFrameCoordinateReferences(
  frame: WorkPlaneFrameSnapshot,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateWorkPlaneFrameCoordinateReferencesAtLocation(
    frame,
    path,
    errors,
    'workPlaneFrameField',
  )
}

function validateWorkPlaneFrameCoordinateReferencesAtLocation(
  frame: WorkPlaneFrameSnapshot,
  path: string,
  errors: DiagramValidationIssue[],
  location: CoordinateRefLocationKind,
): void {
  workPlaneFrameFields.forEach((field) => {
    validateCoordinateReferencePointAtLocation(
      frame[field],
      `${path}.${field}`,
      errors,
      location,
    )
  })
}

function unsupportedCoordinateReferenceMessage(
  location: CoordinateRefLocationKind,
  path: string,
): string {
  if (location === 'curvedSheetPrimitive') {
    return 'Coordinate references are not currently supported inside curved sheet primitives because TikZ export samples them to numeric mesh coordinates.'
  }

  if (location === 'pathTemplateCenter') {
    return 'Coordinate references are not currently supported for path template centers because 3D template export cannot preserve the anchor reference.'
  }

  if (location === 'arcCenter') {
    return 'Coordinate references are not currently supported for arc centers because arc export does not preserve center references.'
  }

  if (location === 'workPlaneFrameField') {
    return `coordinateRef is not supported at ${path}; use a concrete coordinate value instead.`
  }

  if (location === 'derivedCoordinate') {
    return `coordinateRef is not supported at ${path}; derived coordinates must use concrete preview values.`
  }

  return `coordinateRef is not supported at ${path}.`
}

function arcCenterLocationForPathLocation(
  location: CoordinateRefLocationKind,
): CoordinateRefLocationKind {
  return location === 'pathCoordinate' ? 'arcCenter' : location
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

function unresolvedCoordinateReferenceVec3(
  source: CoordinateReferenceSource,
): Vec3 {
  const preview = cloneVec3(source.preview)

  return {
    x: Number.NaN,
    y: Number.NaN,
    z: Number.NaN,
    symbolic: {
      x: { kind: 'numeric', value: preview.x },
      y: { kind: 'numeric', value: preview.y },
      z: { kind: 'numeric', value: preview.z },
      source: {
        kind: 'coordinateRef',
        coordinateId: source.coordinateId,
        preview,
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
  const cloned = {
    x: point.x,
    y: point.y,
    z: point.z,
  }

  return point.symbolic === undefined
    ? cloned
    : {
        ...cloned,
        symbolic: {
          x: cloneCoordinateComponent(point.symbolic.x),
          y: cloneCoordinateComponent(point.symbolic.y),
          z: cloneCoordinateComponent(point.symbolic.z),
          ...(point.symbolic.source === undefined
            ? {}
            : { source: cloneCoordinateSource(point.symbolic.source) }),
        },
      }
}

function cloneCoordinateComponent(
  component: CoordinateComponent,
): CoordinateComponent {
  return component.kind === 'numeric'
    ? {
        kind: 'numeric',
        value: component.value,
      }
    : {
        kind: 'symbolic',
        expression: component.expression,
        previewValue: component.previewValue,
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
