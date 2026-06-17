import {
  absoluteCubicBezierPointsFromControlMode,
  isFiniteVec3,
  isValidWorkPlaneFrameSnapshot,
  pointFromWorkPlaneLocalCoordinate,
} from '../geometry/bezierControls.ts'
import { validateCurvedSheetPrimitive } from '../geometry/curvedSheets.ts'
import { validateCamera3D } from '../geometry/projection.ts'
import {
  closedPathBoundaryCoordinates,
  isFillRule,
  isPointOnWorkPlaneFrame,
  workPlaneLocalCoordinatesForBoundary,
} from './filledBoundaries.ts'
import {
  isHexColor,
  isLabelAnchor,
  isLineStyle,
  isOpacity,
  isPointFill,
  isPointShape,
  isPositiveFiniteNumber,
} from './styles.ts'
import { sheetVertices } from './sheets.ts'
import {
  arcSegmentExpectedEnd,
  arcSegmentExpectedStart,
  pathSegmentEnd,
  pathSegmentStart,
  pathEndpointEpsilon,
  pathEndpoints,
  templatePathCoordinates,
  templatePathFrame,
} from './paths.ts'
import type {
  ArcPathSegment,
  Camera,
  ClosedPathBoundary,
  CurvedSheetStratum,
  CubicBezierCurveStratum,
  DiagramViewOptions,
  CubicBezierControlMode,
  CurveStratum,
  CurveStyle,
  CurveStyleSegment,
  Diagram,
  DiagramValidationIssue,
  DiagramValidationResult,
  FilledRegion2DStratum,
  LabelStyle,
  PartialCurveStyle,
  PathSegment,
  PathTemplate,
  PointStratum,
  PointStyle,
  RegionStratum,
  RegionStyle,
  SheetStratum,
  SheetStyle,
  Stratum,
  TextLabel,
  Vec2,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneFilledSheet3DStratum,
  WorkPlaneLocalCoordinate,
  WorkPlaneLocalOffset,
} from './types'

export function validateDiagram(diagram: Diagram): DiagramValidationResult {
  const errors: DiagramValidationIssue[] = []

  if (diagram.version !== 1) {
    pushError(errors, 'version', 'Diagram version must be 1.')
  }

  if (diagram.ambientDimension !== 2 && diagram.ambientDimension !== 3) {
    pushError(
      errors,
      'ambientDimension',
      'Ambient dimension must be either 2 or 3.',
    )
  }

  validateCamera(diagram.camera, diagram.ambientDimension, 'camera', errors)
  validateDiagramView(diagram.view, diagram.ambientDimension, 'view', errors)
  validateUniqueIds(diagram, errors)

  diagram.strata.forEach((stratum, index) => {
    validateStratum(
      stratum,
      diagram.ambientDimension,
      `strata[${index}]`,
      errors,
    )
  })

  diagram.labels.forEach((label, index) => {
    validateTextLabel(
      label,
      diagram.ambientDimension,
      `labels[${index}]`,
      errors,
    )
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

function validateDiagramView(
  view: DiagramViewOptions | undefined,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (view === undefined) {
    return
  }

  if (
    typeof view.showCoordinateAxesInTikz !== 'boolean' &&
    view.showCoordinateAxesInTikz !== undefined
  ) {
    pushError(
      errors,
      `${path}.showCoordinateAxesInTikz`,
      'Coordinate axes TikZ export option must be a boolean.',
    )
  }

  if (view.camera3d === undefined) {
    return
  }

  if (ambientDimension !== 3) {
    pushError(
      errors,
      `${path}.camera3d`,
      '3D camera view metadata is valid only in 3D diagrams.',
    )
    return
  }

  validateCamera3D(view.camera3d).errors.forEach((issue) => {
    pushError(
      errors,
      issue.path.length === 0
        ? `${path}.camera3d`
        : `${path}.camera3d.${issue.path}`,
      issue.message,
    )
  })
}

function validateCamera(
  camera: Camera,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (ambientDimension === 2 && camera.mode !== '2d') {
    pushError(errors, `${path}.mode`, '2D diagrams must use a 2D camera.')
  }

  if (ambientDimension === 3 && camera.mode !== '3d') {
    pushError(errors, `${path}.mode`, '3D diagrams must use a 3D camera.')
  }

  if (camera.mode === '2d') {
    validatePositiveFinite(camera.scale, `${path}.scale`, errors)
    validateVec2(camera.origin, `${path}.origin`, errors)
  }

  if (camera.mode === '3d') {
    validateCamera3D(camera).errors.forEach((issue) => {
      pushError(
        errors,
        issue.path.length === 0 ? path : `${path}.${issue.path}`,
        issue.message,
      )
    })
  }
}

function validateStratum(
  stratum: Stratum,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateId(stratum.id, `${path}.id`, errors)
  validateName(stratum.name, `${path}.name`, errors)
  validateLayer(stratum.layer, `${path}.layer`, errors)

  if (stratum.codim < 0 || stratum.codim > ambientDimension) {
    pushError(
      errors,
      `${path}.codim`,
      'Codimension must be between 0 and the ambient dimension.',
    )
  }

  switch (stratum.geometricKind) {
    case 'region':
      validateRegionStratum(stratum, ambientDimension, path, errors)
      break
    case 'sheet':
      validateSheetStratum(stratum, ambientDimension, path, errors)
      break
    case 'curve':
      validateCurveStratum(stratum, ambientDimension, path, errors)
      break
    case 'point':
      validatePointStratum(stratum, ambientDimension, path, errors)
      break
  }
}

function validateRegionStratum(
  stratum: RegionStratum,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (stratum.codim !== 0) {
    pushError(errors, `${path}.codim`, 'Regions must have codimension 0.')
  }

  validateRegionStyle(stratum.style, `${path}.style`, errors)

  const regionKind = regionStratumKind(stratum)

  if (regionKind === undefined || regionKind === 'ambientRegion') {
    return
  }

  if (!isFilledRegion2DStratum(stratum)) {
    pushError(
      errors,
      `${path}.kind`,
      'Region kind must be ambientRegion or filledRegion when present.',
    )
    return
  }

  validateFilledRegion2DStratum(stratum, ambientDimension, path, errors)
}

function validateFilledRegion2DStratum(
  stratum: FilledRegion2DStratum,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (ambientDimension !== 2) {
    pushError(errors, path, 'Filled region strata are valid only in 2D diagrams.')
  }

  if (stratum.codim !== 0) {
    pushError(
      errors,
      `${path}.codim`,
      'Filled regions must have codimension 0.',
    )
  }

  validateFillRule(stratum.fillRule, `${path}.fillRule`, errors)
  validateClosedPathBoundaries(
    stratum.boundaries,
    ambientDimension,
    `${path}.boundaries`,
    errors,
  )
}

function validateSheetStratum(
  stratum: SheetStratum,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (ambientDimension !== 3) {
    pushError(errors, path, 'Sheet strata are valid only in 3D diagrams.')
  }

  if (stratum.codim !== 1) {
    pushError(errors, `${path}.codim`, 'Sheets must have codimension 1.')
  }

  if (stratum.kind !== 'quadSheet' && stratum.kind !== 'polygonSheet') {
    if (
      stratum.kind !== 'workPlaneFilledSheet' &&
      stratum.kind !== 'curvedSheet'
    ) {
      pushError(
        errors,
        `${path}.kind`,
        'Sheet kind must be quadSheet, polygonSheet, workPlaneFilledSheet, or curvedSheet.',
      )
    }
  }

  if (stratum.kind === 'quadSheet' && stratum.corners.length !== 4) {
    pushError(errors, `${path}.corners`, 'Quad sheets must have exactly four corners.')
  }

  if (stratum.kind === 'polygonSheet' && stratum.vertices.length < 3) {
    pushError(
      errors,
      `${path}.vertices`,
      'Polygon sheets must have at least three vertices.',
    )
  }

  if (stratum.kind === 'polygonSheet') {
    validateOptionalPathLabel(stratum.pathLabel, `${path}.pathLabel`, errors)
  }

  validateSheetStyle(stratum.style, `${path}.style`, errors)

  if (stratum.kind === 'workPlaneFilledSheet') {
    validateWorkPlaneFilledSheet3DStratum(stratum, ambientDimension, path, errors)
    return
  }

  if (stratum.kind === 'curvedSheet') {
    validateCurvedSheetStratum(stratum, ambientDimension, path, errors)
    return
  }

  sheetVertices(stratum).forEach((vertex, index) => {
    validateVec3ForAmbient(
      vertex,
      ambientDimension,
      `${path}.${stratum.kind === 'quadSheet' ? 'corners' : 'vertices'}[${index}]`,
      errors,
    )
  })
}

function validateCurvedSheetStratum(
  stratum: CurvedSheetStratum,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (ambientDimension !== 3) {
    pushError(errors, path, 'Curved sheet strata are valid only in 3D diagrams.')
  }

  if (stratum.codim !== 1) {
    pushError(errors, `${path}.codim`, 'Curved sheets must have codimension 1.')
  }

  validateCurvedSheetPrimitive(stratum.primitive, `${path}.primitive`).errors.forEach(
    (issue) => {
      pushError(errors, issue.path, issue.message)
    },
  )
}

function validateWorkPlaneFilledSheet3DStratum(
  stratum: WorkPlaneFilledSheet3DStratum,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (ambientDimension !== 3) {
    pushError(
      errors,
      path,
      'Work-plane filled sheet strata are valid only in 3D diagrams.',
    )
  }

  if (stratum.codim !== 1) {
    pushError(
      errors,
      `${path}.codim`,
      'Work-plane filled sheets must have codimension 1.',
    )
  }

  validateWorkPlaneFrameSnapshot(
    stratum.planeFrame,
    `${path}.planeFrame`,
    errors,
  )
  validateFillRule(stratum.fillRule, `${path}.fillRule`, errors)
  validateClosedPathBoundaries(
    stratum.boundaries,
    ambientDimension,
    `${path}.boundaries`,
    errors,
  )
  validateClosedPathBoundariesOnPlane(
    stratum.boundaries,
    stratum.planeFrame,
    `${path}.boundaries`,
    errors,
  )
}

function validateCurveStratum(
  stratum: CurveStratum,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  const expectedCodim = ambientDimension === 2 ? 1 : 2

  if (stratum.codim !== expectedCodim) {
    pushError(
      errors,
      `${path}.codim`,
      `Curves must have codimension ${expectedCodim} in ${ambientDimension}D diagrams.`,
    )
  }

  if (
    stratum.kind !== 'polyline' &&
    stratum.kind !== 'cubicBezier' &&
    stratum.kind !== 'concatenatedPath' &&
    stratum.kind !== 'templatePath'
  ) {
    pushError(
      errors,
      `${path}.kind`,
      'Curve kind must be polyline, cubicBezier, concatenatedPath, or templatePath.',
    )
  }

  validateCurveStyle(stratum.style, `${path}.style`, errors)
  validateOptionalPathLabel(stratum.pathLabel, `${path}.pathLabel`, errors)
  validateCurveStyleSegments(stratum.styleSegments, `${path}.styleSegments`, errors)

  switch (stratum.kind) {
    case 'polyline':
      validatePolylineCurve(stratum, ambientDimension, path, errors)
      return
    case 'cubicBezier':
      validateCubicBezierCurve(stratum, ambientDimension, path, errors)
      return
    case 'concatenatedPath':
      validateConcatenatedPathCurve(stratum, ambientDimension, path, errors)
      return
    case 'templatePath':
      validateTemplatePathCurve(stratum, ambientDimension, path, errors)
      return
  }
}

function validatePolylineCurve(
  stratum: CurveStratum,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (stratum.kind !== 'polyline') {
    return
  }

  if (stratum.points.length < 2) {
    pushError(
      errors,
      `${path}.points`,
      'Polyline curves must have at least two points.',
    )
  }

  stratum.points.forEach((point, index) => {
    validateVec3ForAmbient(
      point,
      ambientDimension,
      `${path}.points[${index}]`,
      errors,
    )
  })
}

function validateCubicBezierCurve(
  stratum: CubicBezierCurveStratum,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (stratum.points.length !== 4) {
    pushError(
      errors,
      `${path}.points`,
      'Cubic Bezier curves must have exactly four points.',
    )
  }

  stratum.points.forEach((point, index) => {
    validateVec3ForAmbient(
      point,
      ambientDimension,
      `${path}.points[${index}]`,
      errors,
    )
  })

  validateCubicBezierControlMode(
    stratum.points,
    stratum.bezierControls,
    ambientDimension,
    `${path}.bezierControls`,
    errors,
  )
}

function validateConcatenatedPathCurve(
  stratum: CurveStratum,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (stratum.kind !== 'concatenatedPath') {
    return
  }

  if (stratum.segments.length < 1) {
    pushError(
      errors,
      `${path}.segments`,
      'Concatenated paths must have at least one segment.',
    )
  }

  stratum.segments.forEach((segment, index) => {
    validatePathSegment(
      segment,
      ambientDimension,
      `${path}.segments[${index}]`,
      errors,
    )
  })

  validateAdjacentPathSegmentEndpoints(stratum.segments, `${path}.segments`, errors)
}

function validateTemplatePathCurve(
  stratum: CurveStratum,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (stratum.kind !== 'templatePath') {
    return
  }

  validatePathTemplate(stratum.template, ambientDimension, `${path}.template`, errors)
}

function validateClosedPathBoundaries(
  boundaries: ClosedPathBoundary[],
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!Array.isArray(boundaries)) {
    pushError(errors, path, 'Closed path boundaries must be an array.')
    return
  }

  if (boundaries.length < 1) {
    pushError(errors, path, 'Filled strata must have at least one boundary.')
  }

  boundaries.forEach((boundary, index) => {
    validateClosedPathBoundary(
      boundary,
      ambientDimension,
      `${path}[${index}]`,
      errors,
    )
  })
}

function validateClosedPathBoundary(
  boundary: ClosedPathBoundary,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateId(boundary.id, `${path}.id`, errors)
  validateOptionalName(boundary.name, `${path}.name`, errors)

  if (!Array.isArray(boundary.segments)) {
    pushError(errors, `${path}.segments`, 'Boundary segments must be an array.')
    return
  }

  if (boundary.segments.length < 1) {
    pushError(
      errors,
      `${path}.segments`,
      'Closed path boundaries must have at least one segment.',
    )
    return
  }

  boundary.segments.forEach((segment, index) => {
    validatePathSegment(
      segment,
      ambientDimension,
      `${path}.segments[${index}]`,
      errors,
    )
  })

  validateAdjacentPathSegmentEndpoints(
    boundary.segments,
    `${path}.segments`,
    errors,
  )
  validateClosedPathEndpoint(boundary, `${path}.segments`, errors)
}

function validateClosedPathEndpoint(
  boundary: ClosedPathBoundary,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  const endpoints = pathEndpoints(boundary.segments)

  if (endpoints === null) {
    return
  }

  if (
    !pointsApproximatelyEqual(
      endpoints.start,
      endpoints.end,
      pathEndpointEpsilon,
    )
  ) {
    pushError(
      errors,
      path,
      'Closed path boundary final endpoint must match its initial endpoint.',
    )
  }
}

function validateClosedPathBoundariesOnPlane(
  boundaries: ClosedPathBoundary[],
  frame: WorkPlaneFrameSnapshot,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!Array.isArray(boundaries) || !isValidWorkPlaneFrameSnapshot(frame)) {
    return
  }

  boundaries.forEach((boundary, boundaryIndex) => {
    if (!Array.isArray(boundary.segments)) {
      return
    }

    closedPathBoundaryCoordinates(boundary).forEach((point, pointIndex) => {
      if (!isFiniteVec3(point)) {
        return
      }

      if (!isPointOnWorkPlaneFrame(point, frame, pathEndpointEpsilon)) {
        pushError(
          errors,
          `${path}[${boundaryIndex}].points[${pointIndex}]`,
          'Work-plane filled sheet boundary points must lie on the stored plane.',
        )
        return
      }
    })

    if (
      workPlaneLocalCoordinatesForBoundary(
        boundary,
        frame,
        pathEndpointEpsilon,
      ) === null
    ) {
      pushError(
        errors,
        `${path}[${boundaryIndex}]`,
        'Work-plane filled sheet boundary points must have finite local plane coordinates.',
      )
    }
  })
}

function validateFillRule(
  fillRule: unknown,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!isFillRule(fillRule)) {
    pushError(errors, path, 'Fill rule must be nonzero or evenOdd.')
  }
}

function validatePathSegment(
  segment: PathSegment,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validatePathSegmentStyleOverride(
    segment.styleOverride,
    `${path}.styleOverride`,
    errors,
  )

  switch (segment.kind) {
    case 'line':
      validateVec3ForAmbient(segment.start, ambientDimension, `${path}.start`, errors)
      validateVec3ForAmbient(segment.end, ambientDimension, `${path}.end`, errors)
      return
    case 'cubicBezier':
      validateVec3ForAmbient(segment.start, ambientDimension, `${path}.start`, errors)
      validateVec3ForAmbient(
        segment.control1,
        ambientDimension,
        `${path}.control1`,
        errors,
      )
      validateVec3ForAmbient(
        segment.control2,
        ambientDimension,
        `${path}.control2`,
        errors,
      )
      validateVec3ForAmbient(segment.end, ambientDimension, `${path}.end`, errors)
      validateCubicBezierControlMode(
        [segment.start, segment.control1, segment.control2, segment.end],
        segment.controlMode,
        ambientDimension,
        `${path}.controlMode`,
        errors,
      )
      return
    case 'arc':
      validateArcPathSegment(segment, ambientDimension, path, errors)
      return
    default:
      pushError(
        errors,
        `${path}.kind`,
        'Path segment kind must be line, cubicBezier, or arc.',
      )
  }
}

function validateArcPathSegment(
  segment: ArcPathSegment,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateVec3ForAmbient(segment.start, ambientDimension, `${path}.start`, errors)
  validateVec3ForAmbient(segment.end, ambientDimension, `${path}.end`, errors)
  validateVec3ForAmbient(segment.center, ambientDimension, `${path}.center`, errors)
  validateFinite(segment.radius, `${path}.radius`, errors)
  validateFinite(segment.startAngleDeg, `${path}.startAngleDeg`, errors)
  validateFinite(segment.endAngleDeg, `${path}.endAngleDeg`, errors)

  if (Number.isFinite(segment.radius) && segment.radius <= 0) {
    pushError(errors, `${path}.radius`, 'Arc radius must be positive.')
  }

  if (
    segment.direction !== 'counterclockwise' &&
    segment.direction !== 'clockwise'
  ) {
    pushError(
      errors,
      `${path}.direction`,
      'Arc direction must be counterclockwise or clockwise.',
    )
  }

  if (ambientDimension === 3) {
    if (segment.frame === undefined) {
      pushError(errors, `${path}.frame`, '3D arc segments must store a work-plane frame.')
    } else {
      validateWorkPlaneFrameSnapshot(segment.frame, `${path}.frame`, errors)
      validatePointOnFrame(segment.center, segment.frame, `${path}.center`, errors)
      validatePointOnFrame(segment.start, segment.frame, `${path}.start`, errors)
      validatePointOnFrame(segment.end, segment.frame, `${path}.end`, errors)
    }
  } else if (segment.frame !== undefined) {
    validateWorkPlaneFrameSnapshot(segment.frame, `${path}.frame`, errors)
  }

  if (
    isFiniteVec3(segment.start) &&
    isFiniteVec3(segment.end) &&
    isFiniteVec3(segment.center) &&
    Number.isFinite(segment.radius) &&
    Number.isFinite(segment.startAngleDeg) &&
    Number.isFinite(segment.endAngleDeg) &&
    segment.radius > 0
  ) {
    const expectedStart = arcSegmentExpectedStart(segment, ambientDimension)
    const expectedEnd = arcSegmentExpectedEnd(segment, ambientDimension)

    if (!pointsApproximatelyEqual(segment.start, expectedStart, pathEndpointEpsilon)) {
      pushError(
        errors,
        `${path}.start`,
        'Arc start must match center, radius, and start angle.',
      )
    }

    if (!pointsApproximatelyEqual(segment.end, expectedEnd, pathEndpointEpsilon)) {
      pushError(
        errors,
        `${path}.end`,
        'Arc end must match center, radius, and end angle.',
      )
    }
  }
}

function validatePathTemplate(
  template: PathTemplate,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  switch (template.kind) {
    case 'circleTemplate':
      validateVec3ForAmbient(
        template.center,
        ambientDimension,
        `${path}.center`,
        errors,
      )
      validateFinite(template.radius, `${path}.radius`, errors)

      if (Number.isFinite(template.radius) && template.radius <= 0) {
        pushError(errors, `${path}.radius`, 'Circle radius must be positive.')
      }

      validateTemplateFrame(template, ambientDimension, path, errors)
      return
    case 'ellipseTemplate':
      validateVec3ForAmbient(
        template.center,
        ambientDimension,
        `${path}.center`,
        errors,
      )
      validateFinite(template.radiusX, `${path}.radiusX`, errors)
      validateFinite(template.radiusY, `${path}.radiusY`, errors)

      if (Number.isFinite(template.radiusX) && template.radiusX <= 0) {
        pushError(errors, `${path}.radiusX`, 'Ellipse radiusX must be positive.')
      }

      if (Number.isFinite(template.radiusY) && template.radiusY <= 0) {
        pushError(errors, `${path}.radiusY`, 'Ellipse radiusY must be positive.')
      }

      if (template.rotationDeg !== undefined) {
        validateFinite(template.rotationDeg, `${path}.rotationDeg`, errors)
      }

      validateTemplateFrame(template, ambientDimension, path, errors)
      return
    default:
      pushError(
        errors,
        `${path}.kind`,
        'Template path kind must be circleTemplate or ellipseTemplate.',
      )
  }
}

function validateTemplateFrame(
  template: PathTemplate,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (ambientDimension === 3 && template.frame === undefined) {
    pushError(
      errors,
      `${path}.frame`,
      '3D template paths must store a work-plane frame.',
    )
    return
  }

  if (template.frame === undefined) {
    return
  }

  validateWorkPlaneFrameSnapshot(template.frame, `${path}.frame`, errors)
  templatePathCoordinates(template).forEach((point, index) => {
    validatePointOnFrame(point, templatePathFrame(template), `${path}.points[${index}]`, errors)
  })
}

function validatePointOnFrame(
  point: Vec3,
  frame: WorkPlaneFrameSnapshot,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (
    isFiniteVec3(point) &&
    isValidWorkPlaneFrameSnapshot(frame) &&
    !isPointOnWorkPlaneFrame(point, frame, pathEndpointEpsilon)
  ) {
    pushError(errors, path, 'Point must lie on the stored work-plane frame.')
  }
}

function validatePathSegmentStyleOverride(
  style: PartialCurveStyle | undefined,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (style === undefined) {
    return
  }

  if (typeof style !== 'object' || style === null || Array.isArray(style)) {
    pushError(errors, path, 'Path segment style override must be an object.')
    return
  }

  validatePartialCurveStyle(style, path, errors)
}

function validateAdjacentPathSegmentEndpoints(
  segments: PathSegment[],
  path: string,
  errors: DiagramValidationIssue[],
): void {
  for (let index = 1; index < segments.length; index += 1) {
    if (
      !pointsApproximatelyEqual(
        pathSegmentEnd(segments[index - 1]),
        pathSegmentStart(segments[index]),
        pathEndpointEpsilon,
      )
    ) {
      pushError(
        errors,
        `${path}[${index}].start`,
        `Path segment start must match ${path}[${index - 1}].end.`,
      )
    }
  }
}

function validateCubicBezierControlMode(
  points: readonly Vec3[],
  controlMode: CubicBezierControlMode | undefined,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (controlMode === undefined) {
    return
  }

  switch (controlMode.kind) {
    case 'absolute':
      return
    case 'relativeCartesian':
      validateRelativeCartesianControlMode(controlMode, ambientDimension, path, errors)
      validateRelativeControlModeMatchesPoints(
        points,
        ambientDimension,
        controlMode,
        path,
        errors,
      )
      return
    case 'relativePolar':
      validateRelativePolarControlMode(controlMode, ambientDimension, path, errors)
      validateRelativeControlModeMatchesPoints(
        points,
        ambientDimension,
        controlMode,
        path,
        errors,
      )
      return
    case 'workPlaneRelativeCartesian':
      validateWorkPlaneRelativeCartesianControlMode(
        controlMode,
        ambientDimension,
        path,
        errors,
      )
      validateWorkPlaneRelativeControlModeMatchesEndpoints(
        points,
        controlMode.frame,
        controlMode.localStart,
        controlMode.localEnd,
        path,
        errors,
      )
      validateRelativeControlModeMatchesPoints(
        points,
        ambientDimension,
        controlMode,
        path,
        errors,
      )
      return
    case 'workPlaneRelativePolar':
      validateWorkPlaneRelativePolarControlMode(
        controlMode,
        ambientDimension,
        path,
        errors,
      )
      validateWorkPlaneRelativeControlModeMatchesEndpoints(
        points,
        controlMode.frame,
        controlMode.localStart,
        controlMode.localEnd,
        path,
        errors,
      )
      validateRelativeControlModeMatchesPoints(
        points,
        ambientDimension,
        controlMode,
        path,
        errors,
      )
      return
    default:
      pushError(errors, `${path}.kind`, 'Bezier control mode is not supported.')
  }
}

function validateRelativeCartesianControlMode(
  controlMode: Extract<CubicBezierControlMode, { kind: 'relativeCartesian' }>,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (controlMode.secondOffsetReference !== 'end') {
    pushError(
      errors,
      `${path}.secondOffsetReference`,
      'Second relative Bezier control offset must be relative to the end point.',
    )
  }

  validateVec3ForAmbient(
    controlMode.firstControlOffset,
    ambientDimension,
    `${path}.firstControlOffset`,
    errors,
  )
  validateVec3ForAmbient(
    controlMode.secondControlOffset,
    ambientDimension,
    `${path}.secondControlOffset`,
    errors,
  )
}

function validateRelativePolarControlMode(
  controlMode: Extract<CubicBezierControlMode, { kind: 'relativePolar' }>,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (ambientDimension !== 2) {
    pushError(
      errors,
      path,
      'Relative polar Bezier controls are supported only in 2D diagrams.',
    )
  }

  if (controlMode.secondOffsetReference !== 'end') {
    pushError(
      errors,
      `${path}.secondOffsetReference`,
      'Second relative Bezier polar control must be relative to the end point.',
    )
  }

  validatePolarControl(controlMode.firstControl, `${path}.firstControl`, errors)
  validatePolarControl(controlMode.secondControl, `${path}.secondControl`, errors)
}

function validateWorkPlaneRelativeCartesianControlMode(
  controlMode: Extract<
    CubicBezierControlMode,
    { kind: 'workPlaneRelativeCartesian' }
  >,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (ambientDimension !== 3) {
    pushError(
      errors,
      path,
      'Work-plane-local relative Cartesian Bezier controls are supported only in 3D diagrams.',
    )
  }

  validateWorkPlaneFrameSnapshot(controlMode.frame, `${path}.frame`, errors)
  validateWorkPlaneLocalCoordinate(
    controlMode.localStart,
    `${path}.localStart`,
    errors,
  )
  validateWorkPlaneLocalCoordinate(
    controlMode.localEnd,
    `${path}.localEnd`,
    errors,
  )
  validateWorkPlaneLocalOffset(
    controlMode.firstControlOffset,
    `${path}.firstControlOffset`,
    errors,
  )
  validateWorkPlaneLocalOffset(
    controlMode.secondControlOffset,
    `${path}.secondControlOffset`,
    errors,
  )

  if (controlMode.secondOffsetReference !== 'end') {
    pushError(
      errors,
      `${path}.secondOffsetReference`,
      'Second work-plane-local Bezier control offset must be relative to the end point.',
    )
  }
}

function validateWorkPlaneRelativePolarControlMode(
  controlMode: Extract<CubicBezierControlMode, { kind: 'workPlaneRelativePolar' }>,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (ambientDimension !== 3) {
    pushError(
      errors,
      path,
      'Work-plane-local relative polar Bezier controls are supported only in 3D diagrams.',
    )
  }

  validateWorkPlaneFrameSnapshot(controlMode.frame, `${path}.frame`, errors)
  validateWorkPlaneLocalCoordinate(
    controlMode.localStart,
    `${path}.localStart`,
    errors,
  )
  validateWorkPlaneLocalCoordinate(
    controlMode.localEnd,
    `${path}.localEnd`,
    errors,
  )
  validatePolarControl(controlMode.firstControl, `${path}.firstControl`, errors)
  validatePolarControl(controlMode.secondControl, `${path}.secondControl`, errors)

  if (controlMode.secondOffsetReference !== 'end') {
    pushError(
      errors,
      `${path}.secondOffsetReference`,
      'Second work-plane-local Bezier polar control must be relative to the end point.',
    )
  }
}

function validateWorkPlaneFrameSnapshot(
  frame: WorkPlaneFrameSnapshot,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateVec3ForAmbient(frame.origin, 3, `${path}.origin`, errors)
  validateVec3ForAmbient(frame.u, 3, `${path}.u`, errors)
  validateVec3ForAmbient(frame.v, 3, `${path}.v`, errors)
  validateVec3ForAmbient(frame.normal, 3, `${path}.normal`, errors)

  if (
    isFiniteVec3(frame.origin) &&
    isFiniteVec3(frame.u) &&
    isFiniteVec3(frame.v) &&
    isFiniteVec3(frame.normal) &&
    !isValidWorkPlaneFrameSnapshot(frame)
  ) {
    pushError(
      errors,
      path,
      'Work-plane-local Bezier frame must be an orthonormal right-handed frame.',
    )
  }
}

function validateWorkPlaneLocalCoordinate(
  coordinate: WorkPlaneLocalCoordinate,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateFinite(coordinate.a, `${path}.a`, errors)
  validateFinite(coordinate.b, `${path}.b`, errors)
}

function validateWorkPlaneLocalOffset(
  offset: WorkPlaneLocalOffset,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateFinite(offset.dx, `${path}.dx`, errors)
  validateFinite(offset.dy, `${path}.dy`, errors)
}

function validatePolarControl(
  control: { angleDegrees: number; radius: number },
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateFinite(control.angleDegrees, `${path}.angleDegrees`, errors)
  validateFinite(control.radius, `${path}.radius`, errors)

  if (Number.isFinite(control.radius) && control.radius < 0) {
    pushError(errors, `${path}.radius`, 'Bezier polar control radius must be non-negative.')
  }
}

function validateWorkPlaneRelativeControlModeMatchesEndpoints(
  points: readonly Vec3[],
  frame: WorkPlaneFrameSnapshot,
  localStart: WorkPlaneLocalCoordinate,
  localEnd: WorkPlaneLocalCoordinate,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (
    points.length !== 4 ||
    !isValidWorkPlaneFrameSnapshot(frame) ||
    !Number.isFinite(localStart.a) ||
    !Number.isFinite(localStart.b) ||
    !Number.isFinite(localEnd.a) ||
    !Number.isFinite(localEnd.b)
  ) {
    return
  }

  if (
    !pointsApproximatelyEqual(
      points[0],
      pointFromWorkPlaneLocalCoordinate(frame, localStart),
    )
  ) {
    pushError(
      errors,
      `${path}.localStart`,
      'Bezier local start coordinates must match the stored absolute start point.',
    )
  }

  if (
    !pointsApproximatelyEqual(
      points[3],
      pointFromWorkPlaneLocalCoordinate(frame, localEnd),
    )
  ) {
    pushError(
      errors,
      `${path}.localEnd`,
      'Bezier local end coordinates must match the stored absolute end point.',
    )
  }
}

function validateRelativeControlModeMatchesPoints(
  points: readonly Vec3[],
  ambientDimension: 2 | 3,
  controlMode: CubicBezierControlMode,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (points.length !== 4) {
    return
  }

  const expectedPoints = absoluteCubicBezierPointsFromControlMode(
    ambientDimension,
    points[0],
    points[3],
    controlMode,
  )

  if (expectedPoints === null) {
    return
  }

  if (!pointsApproximatelyEqual(points[1], expectedPoints[1])) {
    pushError(
      errors,
      `${path}.firstControl`,
      'Bezier relative first control metadata must match the stored absolute control point.',
    )
  }

  if (!pointsApproximatelyEqual(points[2], expectedPoints[2])) {
    pushError(
      errors,
      `${path}.secondControl`,
      'Bezier relative second control metadata must match the stored absolute control point.',
    )
  }
}

function validatePointStratum(
  stratum: PointStratum,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  const expectedCodim = ambientDimension === 2 ? 2 : 3

  if (stratum.codim !== expectedCodim) {
    pushError(
      errors,
      `${path}.codim`,
      `Points must have codimension ${expectedCodim} in ${ambientDimension}D diagrams.`,
    )
  }

  validatePointStyle(stratum.style, `${path}.style`, errors)
  validateVec3ForAmbient(
    stratum.position,
    ambientDimension,
    `${path}.position`,
    errors,
  )
}

function validateTextLabel(
  label: TextLabel,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateId(label.id, `${path}.id`, errors)
  validateName(label.name, `${path}.name`, errors)
  validateLayer(label.layer, `${path}.layer`, errors)
  validateVec3ForAmbient(label.position, ambientDimension, `${path}.position`, errors)
  validateLabelStyle(label.style, `${path}.style`, errors)
}

function validateRegionStyle(
  style: RegionStyle,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (style.kind !== 'regionStyle') {
    pushError(errors, `${path}.kind`, 'Region style kind must be regionStyle.')
  }

  validateColor(style.fillColor, `${path}.fillColor`, errors)
  validateOpacity(style.fillOpacity, `${path}.fillOpacity`, errors)
  validateColor(style.strokeColor, `${path}.strokeColor`, errors)
  validateOpacity(style.strokeOpacity, `${path}.strokeOpacity`, errors)
}

function validateSheetStyle(
  style: SheetStyle,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (style.kind !== 'sheetStyle') {
    pushError(errors, `${path}.kind`, 'Sheet style kind must be sheetStyle.')
  }

  validateColor(style.fillColor, `${path}.fillColor`, errors)
  validateOpacity(style.fillOpacity, `${path}.fillOpacity`, errors)
  validateColor(style.strokeColor, `${path}.strokeColor`, errors)
  validateOpacity(style.strokeOpacity, `${path}.strokeOpacity`, errors)
}

function validateCurveStyle(
  style: CurveStyle,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (style.kind !== 'curveStyle') {
    pushError(errors, `${path}.kind`, 'Curve style kind must be curveStyle.')
  }

  validateColor(style.strokeColor, `${path}.strokeColor`, errors)
  validateOpacity(style.strokeOpacity, `${path}.strokeOpacity`, errors)
  validatePositiveFinite(style.lineWidth, `${path}.lineWidth`, errors)

  if (!isLineStyle(style.lineStyle)) {
    pushError(
      errors,
      `${path}.lineStyle`,
      'Curve line style must be solid, dashed, dotted, or denselyDotted.',
    )
  }
}

function validatePartialCurveStyle(
  style: PartialCurveStyle,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (style.kind !== undefined && style.kind !== 'curveStyle') {
    pushError(errors, `${path}.kind`, 'Curve style kind must be curveStyle.')
  }

  if (style.strokeColor !== undefined) {
    validateColor(style.strokeColor, `${path}.strokeColor`, errors)
  }

  if (style.strokeOpacity !== undefined) {
    validateOpacity(style.strokeOpacity, `${path}.strokeOpacity`, errors)
  }

  if (style.lineWidth !== undefined) {
    validatePositiveFinite(style.lineWidth, `${path}.lineWidth`, errors)
  }

  if (style.lineStyle !== undefined && !isLineStyle(style.lineStyle)) {
    pushError(
      errors,
      `${path}.lineStyle`,
      'Curve line style must be solid, dashed, dotted, or denselyDotted.',
    )
  }
}

function validatePointStyle(
  style: PointStyle,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (style.kind !== 'pointStyle') {
    pushError(errors, `${path}.kind`, 'Point style kind must be pointStyle.')
  }

  validateColor(style.color, `${path}.color`, errors)
  validateOpacity(style.opacity, `${path}.opacity`, errors)

  if (!isPointShape(style.shape)) {
    pushError(
      errors,
      `${path}.shape`,
      'Point shape must be circle, square, triangle, or star.',
    )
  }

  if (!isPointFill(style.fill)) {
    pushError(errors, `${path}.fill`, 'Point fill must be filled or hollow.')
  }

  validatePositiveFinite(style.size, `${path}.size`, errors)
}

function validateLabelStyle(
  style: LabelStyle,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (style.kind !== 'labelStyle') {
    pushError(errors, `${path}.kind`, 'Label style kind must be labelStyle.')
  }

  validateColor(style.color, `${path}.color`, errors)
  validateOpacity(style.opacity, `${path}.opacity`, errors)
  validatePositiveFinite(style.fontSize, `${path}.fontSize`, errors)

  if (!isLabelAnchor(style.anchor)) {
    pushError(errors, `${path}.anchor`, 'Label anchor is not supported.')
  }
}

function validateCurveStyleSegments(
  segments: CurveStyleSegment[],
  path: string,
  errors: DiagramValidationIssue[],
): void {
  segments.forEach((segment, index) => {
    const segmentPath = `${path}[${index}]`
    validateId(segment.id, `${segmentPath}.id`, errors)

    if (!Number.isFinite(segment.from) || segment.from < 0) {
      pushError(
        errors,
        `${segmentPath}.from`,
        'Curve style segment start must be finite and at least 0.',
      )
    }

    if (!Number.isFinite(segment.to) || segment.to > 1) {
      pushError(
        errors,
        `${segmentPath}.to`,
        'Curve style segment end must be finite and at most 1.',
      )
    }

    if (!(segment.from < segment.to)) {
      pushError(
        errors,
        segmentPath,
        'Curve style segments must satisfy from < to.',
      )
    }

    validatePartialCurveStyle(segment.style, `${segmentPath}.style`, errors)
  })

  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      if (segmentsOverlap(segments[i], segments[j])) {
        pushError(
          errors,
          `${path}[${i}]`,
          `Curve style segment overlaps ${path}[${j}].`,
        )
      }
    }
  }
}

function validateUniqueIds(
  diagram: Diagram,
  errors: DiagramValidationIssue[],
): void {
  const seenIds = new Map<string, string>()

  diagram.strata.forEach((stratum, index) => {
    addUniqueId(stratum.id, `strata[${index}].id`, seenIds, errors)
  })

  diagram.labels.forEach((label, index) => {
    addUniqueId(label.id, `labels[${index}].id`, seenIds, errors)
  })
}

function addUniqueId(
  id: string,
  path: string,
  seenIds: Map<string, string>,
  errors: DiagramValidationIssue[],
): void {
  if (id.trim().length === 0) {
    return
  }

  const previousPath = seenIds.get(id)

  if (previousPath === undefined) {
    seenIds.set(id, path)
    return
  }

  pushError(errors, path, `Id must be unique; already used at ${previousPath}.`)
}

function segmentsOverlap(
  first: CurveStyleSegment,
  second: CurveStyleSegment,
): boolean {
  return first.from < second.to && second.from < first.to
}

function validateVec2(
  point: Vec2,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateFinite(point.x, `${path}.x`, errors)
  validateFinite(point.y, `${path}.y`, errors)
}

function validateVec3ForAmbient(
  point: Vec3,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateFinite(point.x, `${path}.x`, errors)
  validateFinite(point.y, `${path}.y`, errors)
  validateFinite(point.z, `${path}.z`, errors)

  if (ambientDimension === 2 && point.z !== 0) {
    pushError(errors, `${path}.z`, '2D diagram coordinates must have z = 0.')
  }
}

function validateColor(
  color: string,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!isHexColor(color)) {
    pushError(errors, path, 'Color must be a #RRGGBB hex color.')
  }
}

function validateOpacity(
  opacity: number,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!isOpacity(opacity)) {
    pushError(errors, path, 'Opacity must be a number between 0 and 1.')
  }
}

function validateFinite(
  value: number,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!Number.isFinite(value)) {
    pushError(errors, path, 'Value must be a finite number.')
  }
}

function validatePositiveFinite(
  value: number,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!isPositiveFiniteNumber(value)) {
    pushError(errors, path, 'Value must be a positive finite number.')
  }
}

function validateId(
  id: string,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (id.trim().length === 0) {
    pushError(errors, path, 'Id must be non-empty.')
  }
}

function validateName(
  name: string,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (name.trim().length === 0) {
    pushError(errors, path, 'Name must be non-empty.')
  }
}

function validateOptionalName(
  name: string | undefined,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (name === undefined) {
    return
  }

  validateName(name, path, errors)
}

function validateOptionalPathLabel(
  pathLabel: string | undefined,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (pathLabel !== undefined && typeof pathLabel !== 'string') {
    pushError(errors, path, 'Path label must be a string when present.')
  }
}

function validateLayer(
  layer: number,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateFinite(layer, path, errors)
}

function pointsApproximatelyEqual(
  first: Vec3,
  second: Vec3,
  epsilon = 1e-9,
): boolean {
  return (
    Math.abs(first.x - second.x) <= epsilon &&
    Math.abs(first.y - second.y) <= epsilon &&
    Math.abs(first.z - second.z) <= epsilon
  )
}

function pushError(
  errors: DiagramValidationIssue[],
  path: string,
  message: string,
): void {
  errors.push({ path, message })
}

function regionStratumKind(stratum: RegionStratum): unknown {
  return (stratum as { readonly kind?: unknown }).kind
}

function isFilledRegion2DStratum(
  stratum: RegionStratum,
): stratum is FilledRegion2DStratum {
  return regionStratumKind(stratum) === 'filledRegion'
}
