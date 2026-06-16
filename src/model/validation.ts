import { absoluteCubicBezierPointsFromControlMode } from '../geometry/bezierControls.ts'
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
import type {
  Camera,
  CubicBezierControlMode,
  CurveStratum,
  CurveStyle,
  CurveStyleSegment,
  Diagram,
  DiagramValidationIssue,
  DiagramValidationResult,
  LabelStyle,
  PartialCurveStyle,
  PointStratum,
  PointStyle,
  RegionStyle,
  SheetStratum,
  SheetStyle,
  Stratum,
  TextLabel,
  Vec2,
  Vec3,
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

  validatePositiveFinite(camera.scale, `${path}.scale`, errors)
  validateVec2(camera.origin, `${path}.origin`, errors)

  if (camera.mode === '3d') {
    if (camera.projection !== 'orthographic') {
      pushError(
        errors,
        `${path}.projection`,
        '3D camera projection must be orthographic.',
      )
    }

    validateBasisVector(camera.xVector, `${path}.xVector`, errors)
    validateBasisVector(camera.yVector, `${path}.yVector`, errors)
    validateBasisVector(camera.zVector, `${path}.zVector`, errors)
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
      validateRegionStyle(stratum.style, `${path}.style`, errors)
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
    pushError(errors, `${path}.kind`, 'Sheet kind must be quadSheet or polygonSheet.')
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
  sheetVertices(stratum).forEach((vertex, index) => {
    validateVec3ForAmbient(
      vertex,
      ambientDimension,
      `${path}.${stratum.kind === 'quadSheet' ? 'corners' : 'vertices'}[${index}]`,
      errors,
    )
  })
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

  if (stratum.kind !== 'polyline' && stratum.kind !== 'cubicBezier') {
    pushError(
      errors,
      `${path}.kind`,
      'Curve kind must be polyline or cubicBezier.',
    )
  }

  if (stratum.kind === 'polyline' && stratum.points.length < 2) {
    pushError(
      errors,
      `${path}.points`,
      'Polyline curves must have at least two points.',
    )
  }

  if (stratum.kind === 'cubicBezier' && stratum.points.length !== 4) {
    pushError(
      errors,
      `${path}.points`,
      'Cubic Bezier curves must have exactly four points.',
    )
  }

  validateCubicBezierControlMode(
    stratum,
    ambientDimension,
    `${path}.bezierControls`,
    errors,
  )

  validateCurveStyle(stratum.style, `${path}.style`, errors)
  validateOptionalPathLabel(stratum.pathLabel, `${path}.pathLabel`, errors)
  stratum.points.forEach((point, index) => {
    validateVec3ForAmbient(
      point,
      ambientDimension,
      `${path}.points[${index}]`,
      errors,
    )
  })
  validateCurveStyleSegments(stratum.styleSegments, `${path}.styleSegments`, errors)
}

function validateCubicBezierControlMode(
  stratum: CurveStratum,
  ambientDimension: 2 | 3,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  const controlMode = stratum.bezierControls

  if (controlMode === undefined) {
    return
  }

  if (stratum.kind !== 'cubicBezier') {
    pushError(errors, path, 'Bezier control metadata is valid only on cubic Bezier curves.')
    return
  }

  switch (controlMode.kind) {
    case 'absolute':
      return
    case 'relativeCartesian':
      validateRelativeCartesianControlMode(controlMode, ambientDimension, path, errors)
      validateRelativeControlModeMatchesPoints(
        stratum,
        ambientDimension,
        controlMode,
        path,
        errors,
      )
      return
    case 'relativePolar':
      validateRelativePolarControlMode(controlMode, ambientDimension, path, errors)
      validateRelativeControlModeMatchesPoints(
        stratum,
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

function validateRelativeControlModeMatchesPoints(
  stratum: CurveStratum,
  ambientDimension: 2 | 3,
  controlMode: CubicBezierControlMode,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (stratum.points.length !== 4) {
    return
  }

  const expectedPoints = absoluteCubicBezierPointsFromControlMode(
    ambientDimension,
    stratum.points[0],
    stratum.points[3],
    controlMode,
  )

  if (expectedPoints === null) {
    return
  }

  if (!pointsApproximatelyEqual(stratum.points[1], expectedPoints[1])) {
    pushError(
      errors,
      `${path}.firstControl`,
      'Bezier relative first control metadata must match the stored absolute control point.',
    )
  }

  if (!pointsApproximatelyEqual(stratum.points[2], expectedPoints[2])) {
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

function validateBasisVector(
  vector: [number, number],
  path: string,
  errors: DiagramValidationIssue[],
): void {
  validateFinite(vector[0], `${path}[0]`, errors)
  validateFinite(vector[1], `${path}[1]`, errors)
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

function pointsApproximatelyEqual(first: Vec3, second: Vec3): boolean {
  const epsilon = 1e-9

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
