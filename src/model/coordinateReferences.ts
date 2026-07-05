import {
  coordinateAnchorPositionPreview,
  coordinateAnchorPositionToVec3,
} from './coordinateAnchors.ts'
import { evaluateWorkPlaneLocalCoordinate } from './workPlaneLocalCoordinates.ts'
import type {
  AmbientDimension,
  BoundaryPathSnapshot,
  ClosedPathBoundary,
  CoordinateComponent,
  CoonsBoundarySnapshot,
  CoordinateAnchor,
  CoordinateAnchorPosition,
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
  WorkPlaneLocalCoordinateSource,
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

export type CoordinateReferenceLocationOwner =
  | {
      kind: 'stratum'
      id: string
    }
  | {
      kind: 'label'
      id: string
    }
  | {
      kind: 'coordinateAnchor'
      id: string
    }

export type CoordinateReferenceLocation = {
  coordinateId: string
  path: string
  location: CoordinateRefLocationKind
  owner: CoordinateReferenceLocationOwner
  exportPreserved: boolean
}

const supportedCoordinateRefLocations: ReadonlySet<CoordinateRefLocationKind> =
  new Set([
    'pathCoordinate',
    'arcCenter',
    'labelPosition',
    'pointPosition',
    'simpleSheetVertex',
  ])

const workPlaneFrameFields = ['origin', 'u', 'v', 'normal'] as const

type CoordinateReferenceDetachPolicy = {
  preserveGlobalSymbolic: boolean
  preserveWorkPlaneLocal: boolean
}

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

export type DetachSampledCurvedSheetPrimitiveCoordinateReferencesResult =
  | {
      ok: true
      value: {
        primitive: CurvedSheetPrimitive
        detachedCount: number
      }
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachCoordinateReferenceContext = {
  anchorsById: ReadonlyMap<string, CoordinateAnchor>
  replacementAnchorsById: ReadonlyMap<string, CoordinateAnchor>
  ambientDimension: AmbientDimension
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

type DetachWorkPlaneFrameResult =
  | {
      ok: true
      frame: WorkPlaneFrameSnapshot
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachCurvedSheetPrimitiveResult =
  | {
      ok: true
      primitive: CurvedSheetPrimitive
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachBoundaryPathSnapshotResult =
  | {
      ok: true
      snapshot: BoundaryPathSnapshot
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachCoonsBoundarySnapshotResult =
  | {
      ok: true
      snapshot: CoonsBoundarySnapshot
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachCubicBezierControlModeResult =
  | {
      ok: true
      controlMode: CubicBezierControlMode | undefined
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachCoordinateAnchorPositionResult =
  | {
      ok: true
      position: CoordinateAnchorPosition
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type RecomputeWorkPlaneLocalPreviewResult =
  | {
      ok: true
      preview: Vec3
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
  return findCoordinateAnchorReferences(diagram, coordinateId).length
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

export function findCoordinateAnchorReferences(
  diagram: Diagram,
  coordinateId: string,
): CoordinateReferenceLocation[] {
  const locations: CoordinateReferenceLocation[] = []

  diagram.strata.forEach((stratum, index) => {
    collectStratumCoordinateReferences(
      stratum,
      coordinateId,
      `strata[${index}]`,
      {
        kind: 'stratum',
        id: stratum.id,
      },
      locations,
    )
  })

  diagram.labels.forEach((label, index) => {
    collectCoordinateReferencePoint(
      label.position,
      coordinateId,
      `labels[${index}].position`,
      'labelPosition',
      {
        kind: 'label',
        id: label.id,
      },
      locations,
    )
  })

  const coordinateAnchors = diagram.coordinateAnchors ?? []

  coordinateAnchors.forEach((anchor, index) => {
    collectCoordinateAnchorPositionReferences(
      anchor.position,
      coordinateId,
      `coordinateAnchors[${index}].position`,
      {
        kind: 'coordinateAnchor',
        id: anchor.id,
      },
      locations,
    )
  })

  return locations
}

function collectStratumCoordinateReferences(
  stratum: Stratum,
  coordinateId: string,
  path: string,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  switch (stratum.geometricKind) {
    case 'region':
      if (stratum.kind === 'filledRegion') {
        collectClosedPathBoundariesCoordinateReferences(
          stratum.boundaries,
          coordinateId,
          `${path}.boundaries`,
          owner,
          locations,
        )
      }
      return
    case 'sheet':
      switch (stratum.kind) {
        case 'quadSheet':
          collectVec3ArrayCoordinateReferences(
            stratum.corners,
            coordinateId,
            `${path}.corners`,
            'simpleSheetVertex',
            owner,
            locations,
          )
          return
        case 'polygonSheet':
          collectVec3ArrayCoordinateReferences(
            stratum.vertices,
            coordinateId,
            `${path}.vertices`,
            'simpleSheetVertex',
            owner,
            locations,
          )
          return
        case 'workPlaneFilledSheet':
          collectWorkPlaneFrameCoordinateReferences(
            stratum.planeFrame,
            coordinateId,
            `${path}.planeFrame`,
            'workPlaneFrameField',
            owner,
            locations,
          )
          collectClosedPathBoundariesCoordinateReferences(
            stratum.boundaries,
            coordinateId,
            `${path}.boundaries`,
            owner,
            locations,
          )
          return
        case 'curvedSheet':
          collectCurvedSheetPrimitiveCoordinateReferences(
            stratum.primitive,
            coordinateId,
            `${path}.primitive`,
            owner,
            locations,
          )
          return
      }
    case 'curve':
      switch (stratum.kind) {
        case 'polyline':
          collectVec3ArrayCoordinateReferences(
            stratum.points,
            coordinateId,
            `${path}.points`,
            'pathCoordinate',
            owner,
            locations,
          )
          return
        case 'cubicBezier':
          collectVec3ArrayCoordinateReferences(
            stratum.points,
            coordinateId,
            `${path}.points`,
            'pathCoordinate',
            owner,
            locations,
          )
          collectCubicBezierControlModeCoordinateReferences(
            stratum.bezierControls,
            coordinateId,
            `${path}.bezierControls`,
            'workPlaneFrameField',
            owner,
            locations,
          )
          return
        case 'concatenatedPath':
          collectPathSegmentsCoordinateReferences(
            stratum.segments,
            coordinateId,
            `${path}.segments`,
            'pathCoordinate',
            owner,
            locations,
          )
          return
        case 'templatePath':
          collectPathTemplateCoordinateReferences(
            stratum.template,
            coordinateId,
            `${path}.template`,
            owner,
            locations,
          )
          return
        case 'grid':
          collectWorkPlaneFrameCoordinateReferences(
            stratum.frame.frame,
            coordinateId,
            `${path}.frame.frame`,
            'workPlaneFrameField',
            owner,
            locations,
          )
          return
      }
    case 'point':
      collectCoordinateReferencePoint(
        stratum.position,
        coordinateId,
        `${path}.position`,
        'pointPosition',
        owner,
        locations,
      )
      return
  }
}

function collectCoordinateAnchorPositionReferences(
  position: CoordinateAnchorPosition,
  coordinateId: string,
  path: string,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  if (position.kind !== 'workPlaneLocal') {
    return
  }

  collectWorkPlaneFrameCoordinateReferences(
    position.frame,
    coordinateId,
    `${path}.frame`,
    'workPlaneFrameField',
    owner,
    locations,
  )
  collectCoordinateReferencePoint(
    position.preview,
    coordinateId,
    `${path}.preview`,
    'derivedCoordinate',
    owner,
    locations,
  )
}

function collectPathTemplateCoordinateReferences(
  template: PathTemplate,
  coordinateId: string,
  path: string,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  collectCoordinateReferencePoint(
    template.center,
    coordinateId,
    `${path}.center`,
    'pathTemplateCenter',
    owner,
    locations,
  )

  if (template.frame !== undefined) {
    collectWorkPlaneFrameCoordinateReferences(
      template.frame,
      coordinateId,
      `${path}.frame`,
      'workPlaneFrameField',
      owner,
      locations,
    )
  }
}

function collectClosedPathBoundariesCoordinateReferences(
  boundaries: readonly ClosedPathBoundary[],
  coordinateId: string,
  path: string,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  boundaries.forEach((boundary, index) => {
    collectPathSegmentsCoordinateReferences(
      boundary.segments,
      coordinateId,
      `${path}[${index}].segments`,
      'pathCoordinate',
      owner,
      locations,
    )
  })
}

function collectPathSegmentsCoordinateReferences(
  segments: readonly PathSegment[],
  coordinateId: string,
  path: string,
  location: CoordinateRefLocationKind,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  segments.forEach((segment, index) => {
    collectPathSegmentCoordinateReferences(
      segment,
      coordinateId,
      `${path}[${index}]`,
      location,
      owner,
      locations,
    )
  })
}

function collectPathSegmentCoordinateReferences(
  segment: PathSegment,
  coordinateId: string,
  path: string,
  location: CoordinateRefLocationKind,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  switch (segment.kind) {
    case 'line':
      collectCoordinateReferencePoint(
        segment.start,
        coordinateId,
        `${path}.start`,
        location,
        owner,
        locations,
      )
      collectCoordinateReferencePoint(
        segment.end,
        coordinateId,
        `${path}.end`,
        location,
        owner,
        locations,
      )
      return
    case 'cubicBezier':
      collectCoordinateReferencePoint(
        segment.start,
        coordinateId,
        `${path}.start`,
        location,
        owner,
        locations,
      )
      collectCoordinateReferencePoint(
        segment.control1,
        coordinateId,
        `${path}.control1`,
        location,
        owner,
        locations,
      )
      collectCoordinateReferencePoint(
        segment.control2,
        coordinateId,
        `${path}.control2`,
        location,
        owner,
        locations,
      )
      collectCoordinateReferencePoint(
        segment.end,
        coordinateId,
        `${path}.end`,
        location,
        owner,
        locations,
      )
      collectCubicBezierControlModeCoordinateReferences(
        segment.controlMode,
        coordinateId,
        `${path}.controlMode`,
        pathFrameLocationForPathLocation(location),
        owner,
        locations,
      )
      return
    case 'arc':
      collectCoordinateReferencePoint(
        segment.start,
        coordinateId,
        `${path}.start`,
        location,
        owner,
        locations,
      )
      collectCoordinateReferencePoint(
        segment.end,
        coordinateId,
        `${path}.end`,
        location,
        owner,
        locations,
      )
      collectCoordinateReferencePoint(
        segment.center,
        coordinateId,
        `${path}.center`,
        arcCenterLocationForPathLocation(location),
        owner,
        locations,
      )
      if (segment.frame !== undefined) {
        collectWorkPlaneFrameCoordinateReferences(
          segment.frame,
          coordinateId,
          `${path}.frame`,
          pathFrameLocationForPathLocation(location),
          owner,
          locations,
        )
      }
      return
  }
}

function collectCubicBezierControlModeCoordinateReferences(
  controlMode: CubicBezierControlMode | undefined,
  coordinateId: string,
  path: string,
  location: CoordinateRefLocationKind,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  if (
    controlMode?.kind !== 'workPlaneRelativeCartesian' &&
    controlMode?.kind !== 'workPlaneRelativePolar'
  ) {
    return
  }

  collectWorkPlaneFrameCoordinateReferences(
    controlMode.frame,
    coordinateId,
    `${path}.frame`,
    location,
    owner,
    locations,
  )
}

function collectCurvedSheetPrimitiveCoordinateReferences(
  primitive: CurvedSheetPrimitive,
  coordinateId: string,
  path: string,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  switch (primitive.kind) {
    case 'hemisphere':
      collectCoordinateReferencePoint(
        primitive.center,
        coordinateId,
        `${path}.center`,
        'curvedSheetPrimitive',
        owner,
        locations,
      )
      collectWorkPlaneFrameCoordinateReferences(
        primitive.frame,
        coordinateId,
        `${path}.frame`,
        'curvedSheetPrimitive',
        owner,
        locations,
      )
      return
    case 'saddle':
      collectWorkPlaneFrameCoordinateReferences(
        primitive.frame,
        coordinateId,
        `${path}.frame`,
        'curvedSheetPrimitive',
        owner,
        locations,
      )
      return
    case 'ruledSurface':
      collectBoundaryPathSnapshotCoordinateReferences(
        primitive.boundary0,
        coordinateId,
        `${path}.boundary0`,
        'curvedSheetPrimitive',
        owner,
        locations,
      )
      collectBoundaryPathSnapshotCoordinateReferences(
        primitive.boundary1,
        coordinateId,
        `${path}.boundary1`,
        'curvedSheetPrimitive',
        owner,
        locations,
      )
      return
    case 'coonsPatch':
      collectCoonsBoundarySnapshotCoordinateReferences(
        primitive.bottom,
        coordinateId,
        `${path}.bottom`,
        'curvedSheetPrimitive',
        owner,
        locations,
      )
      collectCoonsBoundarySnapshotCoordinateReferences(
        primitive.right,
        coordinateId,
        `${path}.right`,
        'curvedSheetPrimitive',
        owner,
        locations,
      )
      collectCoonsBoundarySnapshotCoordinateReferences(
        primitive.top,
        coordinateId,
        `${path}.top`,
        'curvedSheetPrimitive',
        owner,
        locations,
      )
      collectCoonsBoundarySnapshotCoordinateReferences(
        primitive.left,
        coordinateId,
        `${path}.left`,
        'curvedSheetPrimitive',
        owner,
        locations,
      )
      return
  }
}

function collectBoundaryPathSnapshotCoordinateReferences(
  snapshot: BoundaryPathSnapshot,
  coordinateId: string,
  path: string,
  location: CoordinateRefLocationKind,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  collectPathSegmentsCoordinateReferences(
    snapshot.segments,
    coordinateId,
    `${path}.segments`,
    location,
    owner,
    locations,
  )
}

function collectCoonsBoundarySnapshotCoordinateReferences(
  snapshot: CoonsBoundarySnapshot,
  coordinateId: string,
  path: string,
  location: CoordinateRefLocationKind,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  if ('kind' in snapshot) {
    collectCoordinateReferencePoint(
      snapshot.point,
      coordinateId,
      `${path}.point`,
      location,
      owner,
      locations,
    )
    return
  }

  collectBoundaryPathSnapshotCoordinateReferences(
    snapshot,
    coordinateId,
    path,
    location,
    owner,
    locations,
  )
}

function collectWorkPlaneFrameCoordinateReferences(
  frame: WorkPlaneFrameSnapshot,
  coordinateId: string,
  path: string,
  location: CoordinateRefLocationKind,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  workPlaneFrameFields.forEach((field) => {
    collectCoordinateReferencePoint(
      frame[field],
      coordinateId,
      `${path}.${field}`,
      location,
      owner,
      locations,
    )
  })
}

function collectVec3ArrayCoordinateReferences(
  points: readonly Vec3[],
  coordinateId: string,
  path: string,
  location: CoordinateRefLocationKind,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  points.forEach((point, index) => {
    collectCoordinateReferencePoint(
      point,
      coordinateId,
      `${path}[${index}]`,
      location,
      owner,
      locations,
    )
  })
}

function collectCoordinateReferencePoint(
  point: Vec3,
  coordinateId: string,
  path: string,
  location: CoordinateRefLocationKind,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  const source = coordinateReferenceSourceForPoint(point)

  if (source?.coordinateId === coordinateId) {
    locations.push({
      coordinateId,
      path,
      location,
      owner,
      exportPreserved: isCoordinateRefSupportedAtLocation(location),
    })
  }

  collectCoordinateReferencePointSourceFrame(
    point,
    coordinateId,
    path,
    owner,
    locations,
  )
}

function collectCoordinateReferencePointSourceFrame(
  point: Vec3,
  coordinateId: string,
  path: string,
  owner: CoordinateReferenceLocationOwner,
  locations: CoordinateReferenceLocation[],
): void {
  const source = point.symbolic?.source

  if (source?.kind !== 'workPlaneLocal') {
    return
  }

  collectWorkPlaneFrameCoordinateReferences(
    source.frame,
    coordinateId,
    `${path}.symbolic.source.frame`,
    'workPlaneFrameField',
    owner,
    locations,
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

  const replacements = coordinateReferenceAnchorMapForAnchorIds(
    diagram,
    uniqueCoordinateIds,
  )

  if (!replacements.ok) {
    return replacements
  }

  const replacementAnchors = coordinateReferenceAnchorMapForExistingAnchors(
    diagram,
  )

  if (!replacementAnchors.ok) {
    return replacementAnchors
  }

  const context: DetachCoordinateReferenceContext = {
    anchorsById: replacements.anchorsById,
    replacementAnchorsById: replacementAnchors.anchorsById,
    ambientDimension: diagram.ambientDimension,
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
      'labelPosition',
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

  const coordinateAnchors = detachCoordinateAnchorReferencesInAnchors(
    diagram.coordinateAnchors ?? [],
    context,
  )

  if (!coordinateAnchors.ok) {
    return coordinateAnchors
  }

  const nextDiagram = {
    ...diagram,
    coordinateAnchors: coordinateAnchors.anchors,
    strata,
    labels,
  }
  const remainingReference = firstRemainingDetachedCoordinateReference(
    nextDiagram,
    uniqueCoordinateIds,
  )

  if (remainingReference !== null) {
    return {
      ok: false,
      error: {
        path: remainingReference.path,
        message: `Could not detach coordinate "${remainingReference.coordinateId}": replacement source still references a coordinate being detached.`,
      },
    }
  }

  return {
    ok: true,
    value: {
      diagram: nextDiagram,
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

  const replacements = coordinateReferenceAnchorMapForExistingAnchors(diagram)

  if (!replacements.ok) {
    return replacements
  }

  const context: DetachCoordinateReferenceContext = {
    anchorsById: replacements.anchorsById,
    replacementAnchorsById: replacements.anchorsById,
    ambientDimension: diagram.ambientDimension,
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
      'labelPosition',
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

export function detachSampledCurvedSheetPrimitiveCoordinateReferences(
  diagram: Diagram,
  primitive: CurvedSheetPrimitive,
  path: string,
): DetachSampledCurvedSheetPrimitiveCoordinateReferencesResult {
  const replacements = coordinateReferenceAnchorMapForExistingAnchors(diagram)

  if (!replacements.ok) {
    return replacements
  }

  const context: DetachCoordinateReferenceContext = {
    anchorsById: replacements.anchorsById,
    replacementAnchorsById: replacements.anchorsById,
    ambientDimension: diagram.ambientDimension,
    requireReplacement: true,
    detachedCount: 0,
  }
  const detached = detachSampledCurvedSheetPrimitiveBoundaryCoordinateReferences(
    primitive,
    context,
    path,
  )

  if (!detached.ok) {
    return detached
  }

  return {
    ok: true,
    value: {
      primitive: detached.primitive,
      detachedCount: context.detachedCount,
    },
  }
}

export function detachSampledCurvedSheetCoordinateReferences(
  diagram: Diagram,
): DetachCoordinateAnchorReferencesResult {
  const replacements = coordinateReferenceAnchorMapForExistingAnchors(diagram)

  if (!replacements.ok) {
    return replacements
  }

  const context: DetachCoordinateReferenceContext = {
    anchorsById: replacements.anchorsById,
    replacementAnchorsById: replacements.anchorsById,
    ambientDimension: diagram.ambientDimension,
    requireReplacement: true,
    detachedCount: 0,
  }
  const strata: Stratum[] = []

  for (const [index, stratum] of diagram.strata.entries()) {
    if (stratum.geometricKind !== 'sheet' || stratum.kind !== 'curvedSheet') {
      strata.push(stratum)
      continue
    }

    const beforeDetachedCount = context.detachedCount
    let detached: DetachCurvedSheetPrimitiveResult

    try {
      detached = detachSampledCurvedSheetPrimitiveBoundaryCoordinateReferences(
        stratum.primitive,
        context,
        `strata[${index}].primitive`,
      )
    } catch {
      context.detachedCount = beforeDetachedCount
      strata.push(stratum)
      continue
    }

    if (!detached.ok) {
      return detached
    }

    strata.push(
      context.detachedCount === beforeDetachedCount
        ? stratum
        : {
            ...stratum,
            primitive: detached.primitive,
          },
    )
  }

  return {
    ok: true,
    value: {
      diagram:
        context.detachedCount === 0
          ? diagram
          : {
              ...diagram,
              strata,
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
      return refreshResolvedArcCoordinateReferences(diagram, segment, {
        ...segment,
        start: resolveCoordinateReferencePoint(diagram, segment.start),
        end: resolveCoordinateReferencePoint(diagram, segment.end),
        center: resolveCoordinateReferencePoint(diagram, segment.center),
      })
  }
}

function refreshResolvedArcCoordinateReferences(
  diagram: Diagram,
  originalSegment: Extract<PathSegment, { kind: 'arc' }>,
  resolvedSegment: Extract<PathSegment, { kind: 'arc' }>,
): Extract<PathSegment, { kind: 'arc' }> {
  if (
    !arcSegmentHasCoordinateReference(originalSegment)
  ) {
    return resolvedSegment
  }

  if (diagram.ambientDimension === 2) {
    const radius = distance2d(resolvedSegment.start, resolvedSegment.center)
    const startAngleDeg = angleDegrees2d(
      resolvedSegment.start,
      resolvedSegment.center,
    )
    const endAngleDeg = angleDegrees2d(
      resolvedSegment.end,
      resolvedSegment.center,
    )

    return Number.isFinite(radius) &&
      radius > 0 &&
      Number.isFinite(startAngleDeg) &&
      Number.isFinite(endAngleDeg)
      ? {
          ...resolvedSegment,
          radius,
          startAngleDeg,
          endAngleDeg,
        }
      : resolvedSegment
  }

  if (resolvedSegment.frame === undefined) {
    return resolvedSegment
  }

  const frame = {
    ...resolvedSegment.frame,
    origin: concreteVec3(resolvedSegment.center),
  }
  const startPolar = localPolarCoordinateForFrame(
    resolvedSegment.start,
    resolvedSegment.center,
    frame,
  )
  const endPolar = localPolarCoordinateForFrame(
    resolvedSegment.end,
    resolvedSegment.center,
    frame,
  )

  return startPolar !== null &&
    endPolar !== null &&
    startPolar.radius > 0
    ? {
        ...resolvedSegment,
        radius: startPolar.radius,
        startAngleDeg: startPolar.angleDeg,
        endAngleDeg: endPolar.angleDeg,
        frame,
      }
    : resolvedSegment
}

function arcSegmentHasCoordinateReference(
  segment: Extract<PathSegment, { kind: 'arc' }>,
): boolean {
  return (
    coordinateReferenceSourceForPoint(segment.start) !== null ||
    coordinateReferenceSourceForPoint(segment.center) !== null ||
    coordinateReferenceSourceForPoint(segment.end) !== null
  )
}

function distance2d(first: Vec3, second: Vec3): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function angleDegrees2d(point: Vec3, center: Vec3): number {
  return (
    (Math.atan2(point.y - center.y, point.x - center.x) * 180) /
    Math.PI
  )
}

function localPolarCoordinateForFrame(
  point: Vec3,
  center: Vec3,
  frame: WorkPlaneFrameSnapshot,
): { radius: number; angleDeg: number } | null {
  const delta = {
    x: point.x - center.x,
    y: point.y - center.y,
    z: point.z - center.z,
  }
  const localX = dotVec3(delta, frame.u)
  const localY = dotVec3(delta, frame.v)
  const radius = Math.hypot(localX, localY)
  const angleDeg = (Math.atan2(localY, localX) * 180) / Math.PI

  return Number.isFinite(radius) && Number.isFinite(angleDeg)
    ? { radius, angleDeg }
    : null
}

function dotVec3(first: Vec3, second: Vec3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z
}

function detachedCoordinatePointForAnchor(
  anchor: CoordinateAnchor,
  ambientDimension: AmbientDimension,
  path: string,
  location: CoordinateRefLocationKind,
): DetachPointResult {
  const policy = coordinateReferenceDetachPolicy(location)
  let point: Vec3

  try {
    if (
      anchor.position.kind === 'global' &&
      policy.preserveGlobalSymbolic
    ) {
      point = coordinateAnchorPositionToVec3(anchor.position, ambientDimension)
    } else if (
      anchor.position.kind === 'workPlaneLocal' &&
      ambientDimension === 3 &&
      policy.preserveWorkPlaneLocal
    ) {
      point = coordinateAnchorPositionToVec3(anchor.position, ambientDimension)
    } else {
      point = concreteVec3(
        coordinateAnchorPositionPreview(anchor.position, ambientDimension),
      )
    }
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

function coordinateReferenceDetachPolicy(
  location: CoordinateRefLocationKind,
): CoordinateReferenceDetachPolicy {
  switch (location) {
    case 'workPlaneFrameField':
    case 'derivedCoordinate':
      return {
        preserveGlobalSymbolic: false,
        preserveWorkPlaneLocal: false,
      }
    case 'pathCoordinate':
    case 'pathTemplateCenter':
    case 'arcCenter':
    case 'labelPosition':
    case 'pointPosition':
    case 'simpleSheetVertex':
    case 'curvedSheetPrimitive':
      return {
        preserveGlobalSymbolic: true,
        preserveWorkPlaneLocal: true,
      }
  }
}

function coordinateReferenceAnchorMapForAnchorIds(
  diagram: Diagram,
  coordinateIds: readonly string[],
):
  | {
      ok: true
      anchorsById: Map<string, CoordinateAnchor>
    }
  | {
      ok: false
      error: DiagramValidationIssue
    } {
  const anchorsById = new Map<string, CoordinateAnchor>()

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

    anchorsById.set(coordinateId, anchor)
  }

  return {
    ok: true,
    anchorsById,
  }
}

function coordinateReferenceAnchorMapForExistingAnchors(
  diagram: Diagram,
):
  | {
      ok: true
      anchorsById: Map<string, CoordinateAnchor>
    }
  | {
      ok: false
      error: DiagramValidationIssue
    } {
  return coordinateReferenceAnchorMapForAnchorIds(
    diagram,
    (diagram.coordinateAnchors ?? []).map((anchor) => anchor.id),
  )
}

function firstRemainingDetachedCoordinateReference(
  diagram: Diagram,
  coordinateIds: readonly string[],
): CoordinateReferenceLocation | null {
  for (const coordinateId of coordinateIds) {
    const reference = findCoordinateAnchorReferences(diagram, coordinateId)[0]

    if (reference !== undefined) {
      return reference
    }
  }

  return null
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
            'simpleSheetVertex',
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
            'simpleSheetVertex',
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
        case 'workPlaneFilledSheet': {
          const planeFrame = detachWorkPlaneFrameCoordinateReferences(
            stratum.planeFrame,
            context,
            `${path}.planeFrame`,
          )
          const boundaries = detachClosedPathBoundariesCoordinateReferences(
            stratum.boundaries,
            context,
            `${path}.boundaries`,
          )

          if (!planeFrame.ok) {
            return planeFrame
          }

          if (!boundaries.ok) {
            return boundaries
          }

          return {
            ok: true,
            stratum: {
              ...stratum,
              planeFrame: planeFrame.frame,
              boundaries: boundaries.boundaries,
            },
          }
        }
        case 'curvedSheet': {
          const primitive = detachCurvedSheetPrimitiveCoordinateReferences(
            stratum.primitive,
            context,
            `${path}.primitive`,
          )

          if (!primitive.ok) {
            return primitive
          }

          return {
            ok: true,
            stratum: {
              ...stratum,
              primitive: primitive.primitive,
            },
          }
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
          const bezierControls =
            stratum.kind === 'cubicBezier'
              ? detachCubicBezierControlModeCoordinateReferences(
                  stratum.bezierControls,
                  context,
                  `${path}.bezierControls`,
                  'workPlaneFrameField',
                )
              : null

          if (!points.ok) {
            return points
          }

          if (bezierControls !== null && !bezierControls.ok) {
            return bezierControls
          }

          return {
            ok: true,
            stratum: {
              ...stratum,
              points: points.points,
              ...(bezierControls === null
                ? {}
                : { bezierControls: bezierControls.controlMode }),
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
        {
          const frame = detachWorkPlaneFrameCoordinateReferences(
            stratum.frame.frame,
            context,
            `${path}.frame.frame`,
          )

          if (!frame.ok) {
            return frame
          }

          return {
            ok: true,
            stratum: {
              ...stratum,
              frame: {
                ...stratum.frame,
                frame: frame.frame,
              },
            },
          }
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
        'pointPosition',
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
    'pathTemplateCenter',
  )
  const frame =
    template.frame === undefined
      ? null
      : detachWorkPlaneFrameCoordinateReferences(
          template.frame,
          context,
          `${path}.frame`,
        )

  if (!center.ok) {
    return center
  }

  if (frame !== null && !frame.ok) {
    return frame
  }

  return {
    ok: true,
    template: {
      ...template,
      center: center.point,
      ...(frame === null ? {} : { frame: frame.frame }),
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
  location: CoordinateRefLocationKind = 'pathCoordinate',
): DetachPathSegmentsResult {
  const detachedSegments: PathSegment[] = []

  for (const [index, segment] of segments.entries()) {
    const detached = detachPathSegmentCoordinateReferences(
      segment,
      context,
      `${path}[${index}]`,
      location,
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
  location: CoordinateRefLocationKind,
): DetachPathSegmentResult {
  switch (segment.kind) {
    case 'line': {
      const start = detachCoordinateReferencePoint(
        segment.start,
        context,
        `${path}.start`,
        location,
      )
      const end = detachCoordinateReferencePoint(
        segment.end,
        context,
        `${path}.end`,
        location,
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
        location,
      )
      const control1 = detachCoordinateReferencePoint(
        segment.control1,
        context,
        `${path}.control1`,
        location,
      )
      const control2 = detachCoordinateReferencePoint(
        segment.control2,
        context,
        `${path}.control2`,
        location,
      )
      const end = detachCoordinateReferencePoint(
        segment.end,
        context,
        `${path}.end`,
        location,
      )
      const controlMode = detachCubicBezierControlModeCoordinateReferences(
        segment.controlMode,
        context,
        `${path}.controlMode`,
        pathFrameLocationForPathLocation(location),
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

      if (!controlMode.ok) {
        return controlMode
      }

      return {
        ok: true,
        segment: {
          ...segment,
          start: start.point,
          control1: control1.point,
          control2: control2.point,
          end: end.point,
          ...(controlMode.controlMode === undefined
            ? {}
            : { controlMode: controlMode.controlMode }),
        },
      }
    }
    case 'arc': {
      const start = detachCoordinateReferencePoint(
        segment.start,
        context,
        `${path}.start`,
        location,
      )
      const end = detachCoordinateReferencePoint(
        segment.end,
        context,
        `${path}.end`,
        location,
      )
      const center = detachCoordinateReferencePoint(
        segment.center,
        context,
        `${path}.center`,
        arcCenterLocationForPathLocation(location),
      )
      const frame =
        segment.frame === undefined
          ? null
          : detachWorkPlaneFrameCoordinateReferences(
              segment.frame,
              context,
              `${path}.frame`,
              pathFrameLocationForPathLocation(location),
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

      if (frame !== null && !frame.ok) {
        return frame
      }

      return {
        ok: true,
        segment: {
          ...segment,
          start: start.point,
          end: end.point,
          center: center.point,
          ...(frame === null ? {} : { frame: frame.frame }),
        },
      }
    }
  }
}

function detachVec3ArrayCoordinateReferences(
  points: readonly Vec3[],
  context: DetachCoordinateReferenceContext,
  path: string,
  location: CoordinateRefLocationKind = 'pathCoordinate',
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
      location,
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
  location: CoordinateRefLocationKind,
): DetachPointResult {
  const source = coordinateReferenceSourceForPoint(point)

  if (source !== null) {
    const anchor = context.anchorsById.get(source.coordinateId)

    if (anchor === undefined) {
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

    const replacement = detachedCoordinatePointForAnchor(
      anchor,
      context.ambientDimension,
      path,
      location,
    )

    if (!replacement.ok) {
      return replacement
    }

    const sanitizedReplacement = sanitizeDetachedCoordinateReplacement(
      replacement.point,
      anchor,
      context,
      path,
    )

    if (!sanitizedReplacement.ok) {
      return sanitizedReplacement
    }

    context.detachedCount += 1

    return {
      ok: true,
      point: cloneVec3(sanitizedReplacement.point),
    }
  }

  const symbolic = point.symbolic

  if (symbolic === undefined || symbolic.source?.kind !== 'workPlaneLocal') {
    return {
      ok: true,
      point,
    }
  }

  const workPlaneLocalSource = symbolic.source

  // Coordinate references inside work-plane-local source frames are detached as
  // frame-field fallback locations, not as ordinary TikZ-preserved references.
  const frame = detachWorkPlaneFrameCoordinateReferences(
    workPlaneLocalSource.frame,
    context,
    `${path}.symbolic.source.frame`,
    'workPlaneFrameField',
  )

  if (!frame.ok) {
    return frame
  }

  if (frame.frame === workPlaneLocalSource.frame) {
    return {
      ok: true,
      point,
    }
  }

  const refreshedSource = {
    ...workPlaneLocalSource,
    frame: frame.frame,
  }
  const preview = recomputeWorkPlaneLocalPreview(
    refreshedSource,
    `${path}.symbolic.source`,
  )

  if (!preview.ok) {
    return preview
  }

  return {
    ok: true,
    point: {
      ...preview.preview,
      symbolic: {
        x: numericCoordinateComponent(preview.preview.x),
        y: numericCoordinateComponent(preview.preview.y),
        z: numericCoordinateComponent(preview.preview.z),
        source: refreshedSource,
      },
    },
  }
}

function sanitizeDetachedCoordinateReplacement(
  point: Vec3,
  anchor: CoordinateAnchor,
  context: DetachCoordinateReferenceContext,
  path: string,
): DetachPointResult {
  const source = point.symbolic?.source

  if (source?.kind !== 'workPlaneLocal') {
    return {
      ok: true,
      point,
    }
  }

  const referencesReplacementAnchor = workPlaneFrameContainsCoordinateRef(
    source.frame,
    anchor.id,
  )
  const frameContext = replacementFrameDetachContext(context)
  const frame = detachWorkPlaneFrameCoordinateReferences(
    source.frame,
    frameContext,
    `${path}.symbolic.source.frame`,
    'workPlaneFrameField',
  )
  context.detachedCount = frameContext.detachedCount

  if (!frame.ok) {
    return frame
  }

  if (referencesReplacementAnchor) {
    const concretePoint = concreteVec3(point)

    if (!isFiniteVec3(concretePoint)) {
      return {
        ok: false,
        error: {
          path,
          message: `Could not detach coordinate "${anchor.name}": cyclic replacement preview is not finite.`,
        },
      }
    }

    return {
      ok: true,
      point: concretePoint,
    }
  }

  if (frame.frame === source.frame) {
    return {
      ok: true,
      point,
    }
  }

  const refreshedSource = {
    ...source,
    frame: frame.frame,
  }
  const preview = recomputeWorkPlaneLocalPreview(
    refreshedSource,
    `${path}.symbolic.source`,
  )

  if (!preview.ok) {
    return preview
  }

  return {
    ok: true,
    point: {
      ...preview.preview,
      symbolic: {
        x: numericCoordinateComponent(preview.preview.x),
        y: numericCoordinateComponent(preview.preview.y),
        z: numericCoordinateComponent(preview.preview.z),
        source: refreshedSource,
      },
    },
  }
}

function replacementFrameDetachContext(
  context: DetachCoordinateReferenceContext,
): DetachCoordinateReferenceContext {
  return {
    ...context,
    anchorsById: context.replacementAnchorsById,
    requireReplacement: true,
  }
}

function workPlaneFrameContainsCoordinateRef(
  frame: WorkPlaneFrameSnapshot,
  coordinateId: string,
): boolean {
  const seen = new WeakSet<object>()

  return workPlaneFrameFields.some((field) =>
    pointContainsCoordinateRef(frame[field], coordinateId, seen),
  )
}

function pointContainsCoordinateRef(
  point: Vec3,
  coordinateId: string,
  seen: WeakSet<object>,
): boolean {
  if (seen.has(point)) {
    return false
  }

  seen.add(point)

  const source = point.symbolic?.source

  if (source?.kind === 'coordinateRef') {
    return source.coordinateId === coordinateId
  }

  if (source?.kind !== 'workPlaneLocal') {
    return false
  }

  return workPlaneFrameFields.some((field) =>
    pointContainsCoordinateRef(source.frame[field], coordinateId, seen),
  )
}

function detachCoordinateAnchorReferencesInAnchors(
  anchors: readonly CoordinateAnchor[],
  context: DetachCoordinateReferenceContext,
):
  | {
      ok: true
      anchors: CoordinateAnchor[]
    }
  | {
      ok: false
      error: DiagramValidationIssue
    } {
  const detachedAnchors: CoordinateAnchor[] = []

  for (const [index, anchor] of anchors.entries()) {
    const position = detachCoordinateAnchorPositionCoordinateReferences(
      anchor.position,
      context,
      `coordinateAnchors[${index}].position`,
    )

    if (!position.ok) {
      return position
    }

    detachedAnchors.push(
      position.position === anchor.position
        ? anchor
        : {
            ...anchor,
            position: position.position,
          },
    )
  }

  return {
    ok: true,
    anchors: detachedAnchors,
  }
}

function detachCoordinateAnchorPositionCoordinateReferences(
  position: CoordinateAnchorPosition,
  context: DetachCoordinateReferenceContext,
  path: string,
): DetachCoordinateAnchorPositionResult {
  if (position.kind !== 'workPlaneLocal') {
    return {
      ok: true,
      position,
    }
  }

  const frame = detachWorkPlaneFrameCoordinateReferences(
    position.frame,
    context,
    `${path}.frame`,
  )

  if (!frame.ok) {
    return frame
  }

  const preview = detachCoordinateReferencePoint(
    position.preview,
    context,
    `${path}.preview`,
    'derivedCoordinate',
  )

  if (!preview.ok) {
    return preview
  }

  if (frame.frame !== position.frame) {
    const recomputed = recomputeWorkPlaneLocalPreview(
      {
        kind: 'workPlaneLocal',
        frame: frame.frame,
        local: position.local,
      },
      path,
    )

    if (!recomputed.ok) {
      return recomputed
    }

    return {
      ok: true,
      position: {
        ...position,
        frame: frame.frame,
        preview: recomputed.preview,
      },
    }
  }

  return {
    ok: true,
    position: {
      ...position,
      frame: frame.frame,
      preview: preview.point,
    },
  }
}

function detachWorkPlaneFrameCoordinateReferences(
  frame: WorkPlaneFrameSnapshot,
  context: DetachCoordinateReferenceContext,
  path: string,
  location: CoordinateRefLocationKind = 'workPlaneFrameField',
): DetachWorkPlaneFrameResult {
  const origin = detachCoordinateReferencePoint(
    frame.origin,
    context,
    `${path}.origin`,
    location,
  )
  const u = detachCoordinateReferencePoint(
    frame.u,
    context,
    `${path}.u`,
    location,
  )
  const v = detachCoordinateReferencePoint(
    frame.v,
    context,
    `${path}.v`,
    location,
  )
  const normal = detachCoordinateReferencePoint(
    frame.normal,
    context,
    `${path}.normal`,
    location,
  )

  if (!origin.ok) {
    return origin
  }

  if (!u.ok) {
    return u
  }

  if (!v.ok) {
    return v
  }

  if (!normal.ok) {
    return normal
  }

  return {
    ok: true,
    frame:
      origin.point === frame.origin &&
      u.point === frame.u &&
      v.point === frame.v &&
      normal.point === frame.normal
        ? frame
        : {
            origin: origin.point,
            u: u.point,
            v: v.point,
            normal: normal.point,
          },
  }
}

function detachCurvedSheetPrimitiveCoordinateReferences(
  primitive: CurvedSheetPrimitive,
  context: DetachCoordinateReferenceContext,
  path: string,
): DetachCurvedSheetPrimitiveResult {
  switch (primitive.kind) {
    case 'hemisphere': {
      const center = detachCoordinateReferencePoint(
        primitive.center,
        context,
        `${path}.center`,
        'curvedSheetPrimitive',
      )
      const frame = detachWorkPlaneFrameCoordinateReferences(
        primitive.frame,
        context,
        `${path}.frame`,
        'curvedSheetPrimitive',
      )

      if (!center.ok) {
        return center
      }

      if (!frame.ok) {
        return frame
      }

      return {
        ok: true,
        primitive: {
          ...primitive,
          center: center.point,
          frame: frame.frame,
        },
      }
    }
    case 'saddle': {
      const frame = detachWorkPlaneFrameCoordinateReferences(
        primitive.frame,
        context,
        `${path}.frame`,
        'curvedSheetPrimitive',
      )

      if (!frame.ok) {
        return frame
      }

      return {
        ok: true,
        primitive: {
          ...primitive,
          frame: frame.frame,
        },
      }
    }
    case 'ruledSurface': {
      const boundary0 = detachBoundaryPathSnapshotCoordinateReferences(
        primitive.boundary0,
        context,
        `${path}.boundary0`,
        'curvedSheetPrimitive',
      )
      const boundary1 = detachBoundaryPathSnapshotCoordinateReferences(
        primitive.boundary1,
        context,
        `${path}.boundary1`,
        'curvedSheetPrimitive',
      )

      if (!boundary0.ok) {
        return boundary0
      }

      if (!boundary1.ok) {
        return boundary1
      }

      return {
        ok: true,
        primitive: {
          ...primitive,
          boundary0: boundary0.snapshot,
          boundary1: boundary1.snapshot,
        },
      }
    }
    case 'coonsPatch': {
      const bottom = detachCoonsBoundarySnapshotCoordinateReferences(
        primitive.bottom,
        context,
        `${path}.bottom`,
        'curvedSheetPrimitive',
      )
      const right = detachCoonsBoundarySnapshotCoordinateReferences(
        primitive.right,
        context,
        `${path}.right`,
        'curvedSheetPrimitive',
      )
      const top = detachCoonsBoundarySnapshotCoordinateReferences(
        primitive.top,
        context,
        `${path}.top`,
        'curvedSheetPrimitive',
      )
      const left = detachCoonsBoundarySnapshotCoordinateReferences(
        primitive.left,
        context,
        `${path}.left`,
        'curvedSheetPrimitive',
      )

      if (!bottom.ok) {
        return bottom
      }

      if (!right.ok) {
        return right
      }

      if (!top.ok) {
        return top
      }

      if (!left.ok) {
        return left
      }

      return {
        ok: true,
        primitive: {
          ...primitive,
          bottom: bottom.snapshot,
          right: right.snapshot,
          top: top.snapshot,
          left: left.snapshot,
        },
      }
    }
  }
}

function detachSampledCurvedSheetPrimitiveBoundaryCoordinateReferences(
  primitive: CurvedSheetPrimitive,
  context: DetachCoordinateReferenceContext,
  path: string,
): DetachCurvedSheetPrimitiveResult {
  switch (primitive.kind) {
    case 'ruledSurface': {
      const boundary0 = detachBoundaryPathSnapshotCoordinateReferences(
        primitive.boundary0,
        context,
        `${path}.boundary0`,
        'curvedSheetPrimitive',
      )
      const boundary1 = detachBoundaryPathSnapshotCoordinateReferences(
        primitive.boundary1,
        context,
        `${path}.boundary1`,
        'curvedSheetPrimitive',
      )

      if (!boundary0.ok) {
        return boundary0
      }

      if (!boundary1.ok) {
        return boundary1
      }

      return {
        ok: true,
        primitive: {
          ...primitive,
          boundary0: boundary0.snapshot,
          boundary1: boundary1.snapshot,
        },
      }
    }
    case 'coonsPatch': {
      const bottom = detachCoonsBoundarySnapshotCoordinateReferences(
        primitive.bottom,
        context,
        `${path}.bottom`,
        'curvedSheetPrimitive',
      )
      const right = detachCoonsBoundarySnapshotCoordinateReferences(
        primitive.right,
        context,
        `${path}.right`,
        'curvedSheetPrimitive',
      )
      const top = detachCoonsBoundarySnapshotCoordinateReferences(
        primitive.top,
        context,
        `${path}.top`,
        'curvedSheetPrimitive',
      )
      const left = detachCoonsBoundarySnapshotCoordinateReferences(
        primitive.left,
        context,
        `${path}.left`,
        'curvedSheetPrimitive',
      )

      if (!bottom.ok) {
        return bottom
      }

      if (!right.ok) {
        return right
      }

      if (!top.ok) {
        return top
      }

      if (!left.ok) {
        return left
      }

      return {
        ok: true,
        primitive: {
          ...primitive,
          bottom: bottom.snapshot,
          right: right.snapshot,
          top: top.snapshot,
          left: left.snapshot,
        },
      }
    }
    case 'hemisphere':
    case 'saddle':
      return {
        ok: true,
        primitive,
      }
  }
}

function detachBoundaryPathSnapshotCoordinateReferences(
  snapshot: BoundaryPathSnapshot,
  context: DetachCoordinateReferenceContext,
  path: string,
  location: CoordinateRefLocationKind,
): DetachBoundaryPathSnapshotResult {
  const segments = detachPathSegmentsCoordinateReferences(
    snapshot.segments,
    context,
    `${path}.segments`,
    location,
  )

  if (!segments.ok) {
    return segments
  }

  return {
    ok: true,
    snapshot: {
      ...snapshot,
      segments: segments.segments,
    },
  }
}

function detachCoonsBoundarySnapshotCoordinateReferences(
  snapshot: CoonsBoundarySnapshot,
  context: DetachCoordinateReferenceContext,
  path: string,
  location: CoordinateRefLocationKind,
): DetachCoonsBoundarySnapshotResult {
  if ('kind' in snapshot) {
    const point = detachCoordinateReferencePoint(
      snapshot.point,
      context,
      `${path}.point`,
      location,
    )

    if (!point.ok) {
      return point
    }

    return {
      ok: true,
      snapshot: {
        ...snapshot,
        point: point.point,
      },
    }
  }

  return detachBoundaryPathSnapshotCoordinateReferences(
    snapshot,
    context,
    path,
    location,
  )
}

function detachCubicBezierControlModeCoordinateReferences(
  controlMode: CubicBezierControlMode | undefined,
  context: DetachCoordinateReferenceContext,
  path: string,
  location: CoordinateRefLocationKind,
): DetachCubicBezierControlModeResult {
  if (
    controlMode?.kind !== 'workPlaneRelativeCartesian' &&
    controlMode?.kind !== 'workPlaneRelativePolar'
  ) {
    return {
      ok: true,
      controlMode,
    }
  }

  const frame = detachWorkPlaneFrameCoordinateReferences(
    controlMode.frame,
    context,
    `${path}.frame`,
    location,
  )

  if (!frame.ok) {
    return frame
  }

  return {
    ok: true,
    controlMode: {
      ...controlMode,
      frame: frame.frame,
    },
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

function pathFrameLocationForPathLocation(
  location: CoordinateRefLocationKind,
): CoordinateRefLocationKind {
  return location === 'pathCoordinate' ? 'workPlaneFrameField' : location
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

function recomputeWorkPlaneLocalPreview(
  source: WorkPlaneLocalCoordinateSource,
  path: string,
): RecomputeWorkPlaneLocalPreviewResult {
  const evaluated = evaluateWorkPlaneLocalCoordinate(source, undefined, path)

  if (!evaluated.ok) {
    const firstError = evaluated.errors[0]

    return {
      ok: false,
      error: {
        path: firstError?.path ?? path,
        message:
          firstError === undefined
            ? 'Could not detach coordinate reference in work-plane-local frame: failed to recompute work-plane-local preview after detach.'
            : `Could not detach coordinate reference in work-plane-local frame: failed to recompute work-plane-local preview after detach. ${firstError.message}`,
      },
    }
  }

  if (!isFiniteVec3(evaluated.point)) {
    return {
      ok: false,
      error: {
        path,
        message:
          'Could not detach coordinate reference in work-plane-local frame: recomputed preview is non-finite.',
      },
    }
  }

  return {
    ok: true,
    preview: {
      x: evaluated.point.x,
      y: evaluated.point.y,
      z: evaluated.point.z,
    },
  }
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

function concreteVec3(point: Vec3): Vec3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
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

function numericCoordinateComponent(value: number): CoordinateComponent {
  return {
    kind: 'numeric',
    value,
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
