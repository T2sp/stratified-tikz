import {
  evaluateScalarExpression,
  parseScalarExpression,
  scalarExpressionVariables,
} from './scalarExpressions.ts'
import type { ScalarInputValue } from './scalarExpressions.ts'
import type {
  AmbientDimension,
  BoundaryPathSnapshot,
  ClosedPathBoundary,
  CoordinateComponent,
  CubicBezierControlMode,
  CurvedSheetPrimitive,
  Diagram,
  DiagramValidationIssue,
  PathSegment,
  PathTemplate,
  Stratum,
  SymbolicVec3,
  Vec3,
  WorkPlaneFrameSnapshot,
} from './types.ts'

export type CoordinateAxis = 'x' | 'y' | 'z'

export type CoordinateExpressionContext = {
  variableNames: readonly string[]
  previewValues: ReadonlyMap<string, number>
}

export type CreateCoordinateComponentResult =
  | {
      ok: true
      component: CoordinateComponent
    }
  | {
      ok: false
      error: string
    }

export type CreateCoordinateVec3Result =
  | {
      ok: true
      point: Vec3
    }
  | {
      ok: false
      error: string
    }

export type RefreshSymbolicCoordinatePreviewsResult =
  | {
      ok: true
      diagram: Diagram
    }
  | {
      ok: false
      errors: DiagramValidationIssue[]
    }

export const emptyCoordinateExpressionContext: CoordinateExpressionContext = {
  variableNames: [],
  previewValues: new Map(),
}

const coordinateAxes = ['x', 'y', 'z'] as const
const previewValueEpsilon = 1e-9

export function createCoordinateComponentFromInput(
  source: string,
  context: CoordinateExpressionContext = emptyCoordinateExpressionContext,
): CreateCoordinateComponentResult {
  const expression = source.trim()
  const parsed = parseScalarExpression(expression, {
    variables: context.variableNames,
  })

  if (!parsed.ok) {
    return parsed
  }

  const evaluated = evaluateScalarExpression(
    parsed.expression,
    context.previewValues,
  )

  if (!evaluated.ok) {
    return evaluated
  }

  if (scalarExpressionVariables(parsed.expression).length === 0) {
    return {
      ok: true,
      component: {
        kind: 'numeric',
        value: evaluated.value,
      },
    }
  }

  return {
    ok: true,
    component: {
      kind: 'symbolic',
      expression,
      previewValue: evaluated.value,
    },
  }
}

export function createVec3FromCoordinateInputs(
  coordinates: { x: string; y: string; z: string },
  ambientDimension: AmbientDimension,
  context: CoordinateExpressionContext = emptyCoordinateExpressionContext,
): CreateCoordinateVec3Result {
  const x = createCoordinateComponentFromInput(coordinates.x, context)
  const y = createCoordinateComponentFromInput(coordinates.y, context)

  if (!x.ok) {
    return x
  }

  if (!y.ok) {
    return y
  }

  if (ambientDimension === 2) {
    return {
      ok: true,
      point: vec3FromCoordinateComponents(
        {
          x: x.component,
          y: y.component,
          z: numericCoordinateComponent(0),
        },
        ambientDimension,
      ),
    }
  }

  const z = createCoordinateComponentFromInput(coordinates.z, context)

  if (!z.ok) {
    return z
  }

  return {
    ok: true,
    point: vec3FromCoordinateComponents(
      {
        x: x.component,
        y: y.component,
        z: z.component,
      },
      ambientDimension,
    ),
  }
}

export function updateVec3CoordinateComponent(
  point: Vec3,
  axis: CoordinateAxis,
  component: CoordinateComponent,
  ambientDimension: AmbientDimension,
): Vec3 {
  const components = symbolicVec3ComponentsFromPoint(point)

  components[axis] = cloneCoordinateComponent(component)

  return vec3FromCoordinateComponents(components, ambientDimension)
}

export function numericCoordinateComponent(value: number): CoordinateComponent {
  return {
    kind: 'numeric',
    value,
  }
}

export function coordinateComponentPreviewValue(
  component: CoordinateComponent,
): number {
  return component.kind === 'numeric' ? component.value : component.previewValue
}

export function hasSymbolicVec3Coordinates(point: Vec3): boolean {
  const symbolic = point.symbolic

  return (
    isRecord(symbolic) &&
    coordinateAxes.some((axis) => {
      const component = symbolic[axis]

      return isRecord(component) && component.kind === 'symbolic'
    })
  )
}

export function refreshDiagramSymbolicCoordinatePreviews(
  diagram: Diagram,
  context: CoordinateExpressionContext,
): RefreshSymbolicCoordinatePreviewsResult {
  const errors: DiagramValidationIssue[] = []
  const strata = diagram.strata.map((stratum, index) =>
    refreshStratumSymbolicCoordinatePreviews(
      stratum,
      diagram.ambientDimension,
      context,
      `strata[${index}]`,
      errors,
    ),
  )
  const labels = diagram.labels.map((label, index) => ({
    ...label,
    position: refreshVec3SymbolicPreview(
      label.position,
      diagram.ambientDimension,
      context,
      `labels[${index}].position`,
      errors,
    ),
  }))

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    }
  }

  return {
    ok: true,
    diagram: {
      ...diagram,
      strata,
      labels,
    },
  }
}

export function validateSymbolicVec3(
  point: Vec3,
  ambientDimension: AmbientDimension,
  path: string,
  context: CoordinateExpressionContext | undefined,
  errors: DiagramValidationIssue[],
): void {
  const symbolic = point.symbolic

  if (symbolic === undefined) {
    return
  }

  if (!isRecord(symbolic)) {
    pushError(errors, `${path}.symbolic`, 'Symbolic coordinate metadata must be an object.')
    return
  }

  coordinateAxes.forEach((axis) => {
    const component = readCoordinateComponent(
      symbolic[axis],
      `${path}.symbolic.${axis}`,
      context,
      errors,
    )

    if (component === null) {
      return
    }

    const previewValue = coordinateComponentPreviewValue(component)

    if (
      ambientDimension === 2 &&
      axis === 'z' &&
      (component.kind === 'symbolic' || !numbersApproximatelyEqual(previewValue, 0))
    ) {
      pushError(
        errors,
        `${path}.symbolic.z`,
        '2D symbolic coordinates must keep z numeric and equal to 0.',
      )
    }

    if (
      Number.isFinite(point[axis]) &&
      Number.isFinite(previewValue) &&
      !numbersApproximatelyEqual(point[axis], previewValue)
    ) {
      pushError(
        errors,
        `${path}.${axis}`,
        'Coordinate preview value must match symbolic metadata.',
      )
    }
  })
}

export function validateDiagramSymbolicCoordinateMetadata(
  diagram: Diagram,
): DiagramValidationIssue[] {
  const errors: DiagramValidationIssue[] = []

  if (Array.isArray(diagram.strata)) {
    diagram.strata.forEach((stratum, index) => {
      validateStratumSymbolicCoordinateMetadata(
        stratum,
        diagram.ambientDimension,
        `strata[${index}]`,
        errors,
      )
    })
  }

  if (Array.isArray(diagram.labels)) {
    diagram.labels.forEach((label, index) => {
      if (!isRecord(label)) {
        return
      }

      validateSymbolicVec3Metadata(
        label.position,
        diagram.ambientDimension,
        `labels[${index}].position`,
        errors,
      )
    })
  }

  return errors
}

function validateStratumSymbolicCoordinateMetadata(
  stratum: unknown,
  ambientDimension: AmbientDimension,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!isRecord(stratum)) {
    return
  }

  switch (stratum.geometricKind) {
    case 'region':
      if (stratum.kind === 'filledRegion') {
        validateClosedPathBoundariesSymbolicMetadata(
          stratum.boundaries,
          ambientDimension,
          `${path}.boundaries`,
          errors,
        )
      }
      return
    case 'sheet':
      if (stratum.kind === 'quadSheet' && Array.isArray(stratum.corners)) {
        stratum.corners.forEach((corner, index) =>
          validateSymbolicVec3Metadata(
            corner,
            ambientDimension,
            `${path}.corners[${index}]`,
            errors,
          ),
        )
        return
      }

      if (stratum.kind === 'polygonSheet' && Array.isArray(stratum.vertices)) {
        stratum.vertices.forEach((vertex, index) =>
          validateSymbolicVec3Metadata(
            vertex,
            ambientDimension,
            `${path}.vertices[${index}]`,
            errors,
          ),
        )
        return
      }

      if (stratum.kind === 'workPlaneFilledSheet') {
        validateWorkPlaneFrameSnapshotSymbolicMetadata(
          stratum.planeFrame,
          `${path}.planeFrame`,
          errors,
        )
        validateClosedPathBoundariesSymbolicMetadata(
          stratum.boundaries,
          ambientDimension,
          `${path}.boundaries`,
          errors,
        )
        return
      }

      if (stratum.kind === 'curvedSheet') {
        validateCurvedSheetPrimitiveSymbolicMetadata(
          stratum.primitive,
          `${path}.primitive`,
          errors,
        )
      }
      return
    case 'curve':
      if (
        (stratum.kind === 'polyline' || stratum.kind === 'cubicBezier') &&
        Array.isArray(stratum.points)
      ) {
        stratum.points.forEach((point, index) =>
          validateSymbolicVec3Metadata(
            point,
            ambientDimension,
            `${path}.points[${index}]`,
            errors,
          ),
        )
        if (stratum.kind === 'cubicBezier') {
          validateCubicBezierControlModeSymbolicMetadata(
            stratum.bezierControls,
            `${path}.bezierControls`,
            errors,
          )
        }
        return
      }

      if (stratum.kind === 'concatenatedPath') {
        validatePathSegmentsSymbolicMetadata(
          stratum.segments,
          ambientDimension,
          `${path}.segments`,
          errors,
        )
        return
      }

      if (stratum.kind === 'templatePath' && isRecord(stratum.template)) {
        validateSymbolicVec3Metadata(
          stratum.template.center,
          ambientDimension,
          `${path}.template.center`,
          errors,
        )
        validatePathTemplateFrameSymbolicMetadata(
          stratum.template,
          `${path}.template`,
          errors,
        )
      }
      return
    case 'point':
      validateSymbolicVec3Metadata(
        stratum.position,
        ambientDimension,
        `${path}.position`,
        errors,
      )
      return
    default:
      return
  }
}

function validateClosedPathBoundariesSymbolicMetadata(
  boundaries: unknown,
  ambientDimension: AmbientDimension,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!Array.isArray(boundaries)) {
    return
  }

  boundaries.forEach((boundary, index) => {
    if (!isRecord(boundary)) {
      return
    }

    validatePathSegmentsSymbolicMetadata(
      boundary.segments,
      ambientDimension,
      `${path}[${index}].segments`,
      errors,
    )
  })
}

function validatePathSegmentsSymbolicMetadata(
  segments: unknown,
  ambientDimension: AmbientDimension,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!Array.isArray(segments)) {
    return
  }

  segments.forEach((segment, index) =>
    validatePathSegmentSymbolicMetadata(
      segment,
      ambientDimension,
      `${path}[${index}]`,
      errors,
    ),
  )
}

function validatePathSegmentSymbolicMetadata(
  segment: unknown,
  ambientDimension: AmbientDimension,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!isRecord(segment)) {
    return
  }

  switch (segment.kind) {
    case 'line':
      validateSymbolicVec3Metadata(
        segment.start,
        ambientDimension,
        `${path}.start`,
        errors,
      )
      validateSymbolicVec3Metadata(
        segment.end,
        ambientDimension,
        `${path}.end`,
        errors,
      )
      return
    case 'cubicBezier':
      validateSymbolicVec3Metadata(
        segment.start,
        ambientDimension,
        `${path}.start`,
        errors,
      )
      validateSymbolicVec3Metadata(
        segment.control1,
        ambientDimension,
        `${path}.control1`,
        errors,
      )
      validateSymbolicVec3Metadata(
        segment.control2,
        ambientDimension,
        `${path}.control2`,
        errors,
      )
      validateSymbolicVec3Metadata(
        segment.end,
        ambientDimension,
        `${path}.end`,
        errors,
      )
      validateCubicBezierControlModeSymbolicMetadata(
        segment.controlMode,
        `${path}.controlMode`,
        errors,
      )
      return
    case 'arc':
      validateSymbolicVec3Metadata(
        segment.start,
        ambientDimension,
        `${path}.start`,
        errors,
      )
      validateSymbolicVec3Metadata(
        segment.end,
        ambientDimension,
        `${path}.end`,
        errors,
      )
      validateSymbolicVec3Metadata(
        segment.center,
        ambientDimension,
        `${path}.center`,
        errors,
      )
      validateWorkPlaneFrameSnapshotSymbolicMetadata(
        segment.frame,
        `${path}.frame`,
        errors,
      )
      return
    default:
      return
  }
}

function validateCubicBezierControlModeSymbolicMetadata(
  controlMode: unknown,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!isRecord(controlMode)) {
    return
  }

  if (
    controlMode.kind === 'workPlaneRelativeCartesian' ||
    controlMode.kind === 'workPlaneRelativePolar'
  ) {
    validateWorkPlaneFrameSnapshotSymbolicMetadata(
      controlMode.frame,
      `${path}.frame`,
      errors,
    )
  }
}

function validatePathTemplateFrameSymbolicMetadata(
  template: unknown,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!isRecord(template) || template.frame === undefined) {
    return
  }

  validateWorkPlaneFrameSnapshotSymbolicMetadata(
    template.frame,
    `${path}.frame`,
    errors,
  )
}

function validateCurvedSheetPrimitiveSymbolicMetadata(
  primitive: unknown,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!isRecord(primitive)) {
    return
  }

  if (primitive.kind === 'hemisphere') {
    validateSymbolicVec3Metadata(
      primitive.center,
      3,
      `${path}.center`,
      errors,
    )
    validateWorkPlaneFrameSnapshotSymbolicMetadata(
      primitive.frame,
      `${path}.frame`,
      errors,
    )
    return
  }

  if (primitive.kind === 'saddle') {
    validateWorkPlaneFrameSnapshotSymbolicMetadata(
      primitive.frame,
      `${path}.frame`,
      errors,
    )
    return
  }

  if (primitive.kind === 'ruledSurface') {
    validateBoundaryPathSnapshotSymbolicMetadata(
      primitive.boundary0,
      `${path}.boundary0`,
      errors,
    )
    validateBoundaryPathSnapshotSymbolicMetadata(
      primitive.boundary1,
      `${path}.boundary1`,
      errors,
    )
    return
  }

  if (primitive.kind === 'coonsPatch') {
    validateBoundaryPathSnapshotSymbolicMetadata(
      primitive.bottom,
      `${path}.bottom`,
      errors,
    )
    validateBoundaryPathSnapshotSymbolicMetadata(
      primitive.right,
      `${path}.right`,
      errors,
    )
    validateBoundaryPathSnapshotSymbolicMetadata(
      primitive.top,
      `${path}.top`,
      errors,
    )
    validateBoundaryPathSnapshotSymbolicMetadata(
      primitive.left,
      `${path}.left`,
      errors,
    )
  }
}

function validateBoundaryPathSnapshotSymbolicMetadata(
  snapshot: unknown,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!isRecord(snapshot)) {
    return
  }

  validatePathSegmentsSymbolicMetadata(
    snapshot.segments,
    3,
    `${path}.segments`,
    errors,
  )
}

function validateWorkPlaneFrameSnapshotSymbolicMetadata(
  frame: unknown,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!isRecord(frame)) {
    return
  }

  validateSymbolicVec3Metadata(frame.origin, 3, `${path}.origin`, errors)
  validateSymbolicVec3Metadata(frame.u, 3, `${path}.u`, errors)
  validateSymbolicVec3Metadata(frame.v, 3, `${path}.v`, errors)
  validateSymbolicVec3Metadata(frame.normal, 3, `${path}.normal`, errors)
}

function validateSymbolicVec3Metadata(
  point: unknown,
  ambientDimension: AmbientDimension,
  path: string,
  errors: DiagramValidationIssue[],
): void {
  if (!isRecord(point)) {
    return
  }

  const symbolic = point.symbolic

  if (symbolic === undefined) {
    return
  }

  if (!isRecord(symbolic)) {
    pushError(errors, `${path}.symbolic`, 'Symbolic coordinate metadata must be an object.')
    return
  }

  coordinateAxes.forEach((axis) => {
    const component = readCoordinateComponent(
      symbolic[axis],
      `${path}.symbolic.${axis}`,
      undefined,
      errors,
    )

    if (component === null) {
      return
    }

    const previewValue = coordinateComponentPreviewValue(component)

    if (
      ambientDimension === 2 &&
      axis === 'z' &&
      (component.kind === 'symbolic' || !numbersApproximatelyEqual(previewValue, 0))
    ) {
      pushError(
        errors,
        `${path}.symbolic.z`,
        '2D symbolic coordinates must keep z numeric and equal to 0.',
      )
    }
  })
}

function refreshStratumSymbolicCoordinatePreviews(
  stratum: Stratum,
  ambientDimension: AmbientDimension,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): Stratum {
  switch (stratum.geometricKind) {
    case 'region':
      if (stratum.kind !== 'filledRegion') {
        return stratum
      }

      return {
        ...stratum,
        boundaries: refreshClosedPathBoundaries(
          stratum.boundaries,
          ambientDimension,
          context,
          `${path}.boundaries`,
          errors,
        ),
      }
    case 'sheet':
      switch (stratum.kind) {
        case 'quadSheet':
          return {
            ...stratum,
            corners: stratum.corners.map((corner, index) =>
              refreshVec3SymbolicPreview(
                corner,
                ambientDimension,
                context,
                `${path}.corners[${index}]`,
                errors,
              ),
            ) as typeof stratum.corners,
          }
        case 'polygonSheet':
          return {
            ...stratum,
            vertices: stratum.vertices.map((vertex, index) =>
              refreshVec3SymbolicPreview(
                vertex,
                ambientDimension,
                context,
                `${path}.vertices[${index}]`,
                errors,
              ),
            ),
          }
        case 'workPlaneFilledSheet':
          return {
            ...stratum,
            planeFrame: refreshWorkPlaneFrameSnapshotSymbolicPreviews(
              stratum.planeFrame,
              context,
              `${path}.planeFrame`,
              errors,
            ),
            boundaries: refreshClosedPathBoundaries(
              stratum.boundaries,
              ambientDimension,
              context,
              `${path}.boundaries`,
              errors,
            ),
          }
        case 'curvedSheet':
          return {
            ...stratum,
            primitive: refreshCurvedSheetPrimitiveSymbolicPreviews(
              stratum.primitive,
              context,
              `${path}.primitive`,
              errors,
            ),
          }
        default:
          return stratum
      }
    case 'curve':
      switch (stratum.kind) {
        case 'polyline':
          return {
            ...stratum,
            points: stratum.points.map((point, index) =>
              refreshVec3SymbolicPreview(
                point,
                ambientDimension,
                context,
                `${path}.points[${index}]`,
                errors,
              ),
            ),
          }
        case 'cubicBezier':
          return {
            ...stratum,
            points: stratum.points.map((point, index) =>
              refreshVec3SymbolicPreview(
                point,
                ambientDimension,
                context,
                `${path}.points[${index}]`,
                errors,
              ),
            ),
            ...(stratum.bezierControls === undefined
              ? {}
              : {
                  bezierControls: refreshCubicBezierControlModeSymbolicPreviews(
                    stratum.bezierControls,
                    context,
                    `${path}.bezierControls`,
                    errors,
                  ),
                }),
          }
        case 'concatenatedPath':
          return {
            ...stratum,
            segments: refreshPathSegments(
              stratum.segments,
              ambientDimension,
              context,
              `${path}.segments`,
              errors,
            ),
          }
        case 'templatePath':
          return {
            ...stratum,
            template: refreshPathTemplate(
              stratum.template,
              ambientDimension,
              context,
              `${path}.template`,
              errors,
            ),
          }
        case 'grid':
          return {
            ...stratum,
            uRange: {
              min: refreshScalarInputValuePreview(
                stratum.uRange.min,
                context,
                `${path}.uRange.min`,
                errors,
              ),
              max: refreshScalarInputValuePreview(
                stratum.uRange.max,
                context,
                `${path}.uRange.max`,
                errors,
              ),
              step: refreshScalarInputValuePreview(
                stratum.uRange.step,
                context,
                `${path}.uRange.step`,
                errors,
              ),
            },
            vRange: {
              min: refreshScalarInputValuePreview(
                stratum.vRange.min,
                context,
                `${path}.vRange.min`,
                errors,
              ),
              max: refreshScalarInputValuePreview(
                stratum.vRange.max,
                context,
                `${path}.vRange.max`,
                errors,
              ),
              step: refreshScalarInputValuePreview(
                stratum.vRange.step,
                context,
                `${path}.vRange.step`,
                errors,
              ),
            },
            clip: {
              kind: 'rectangle',
              uMin: refreshScalarInputValuePreview(
                stratum.clip.uMin,
                context,
                `${path}.clip.uMin`,
                errors,
              ),
              uMax: refreshScalarInputValuePreview(
                stratum.clip.uMax,
                context,
                `${path}.clip.uMax`,
                errors,
              ),
              vMin: refreshScalarInputValuePreview(
                stratum.clip.vMin,
                context,
                `${path}.clip.vMin`,
                errors,
              ),
              vMax: refreshScalarInputValuePreview(
                stratum.clip.vMax,
                context,
                `${path}.clip.vMax`,
                errors,
              ),
            },
          }
        default:
          return stratum
      }
    case 'point':
      return {
        ...stratum,
        position: refreshVec3SymbolicPreview(
          stratum.position,
          ambientDimension,
          context,
          `${path}.position`,
          errors,
        ),
      }
  }
}

function refreshClosedPathBoundaries(
  boundaries: readonly ClosedPathBoundary[],
  ambientDimension: AmbientDimension,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): ClosedPathBoundary[] {
  return boundaries.map((boundary, index) => ({
    ...boundary,
    segments: refreshPathSegments(
      boundary.segments,
      ambientDimension,
      context,
      `${path}[${index}].segments`,
      errors,
    ),
  }))
}

function validatePathSegmentForSymbolicPreviewRefresh(
  segment: unknown,
  ambientDimension: AmbientDimension,
  path: string,
  errors: DiagramValidationIssue[],
): segment is PathSegment {
  if (!isRecord(segment)) {
    pushError(errors, path, 'Path segment must be an object.')
    return false
  }

  switch (segment.kind) {
    case 'line': {
      const startIsValid = validateVec3ForSymbolicPreviewRefresh(
        segment.start,
        `${path}.start`,
        errors,
      )
      const endIsValid = validateVec3ForSymbolicPreviewRefresh(
        segment.end,
        `${path}.end`,
        errors,
      )

      return startIsValid && endIsValid
    }
    case 'cubicBezier': {
      const startIsValid = validateVec3ForSymbolicPreviewRefresh(
        segment.start,
        `${path}.start`,
        errors,
      )
      const control1IsValid = validateVec3ForSymbolicPreviewRefresh(
        segment.control1,
        `${path}.control1`,
        errors,
      )
      const control2IsValid = validateVec3ForSymbolicPreviewRefresh(
        segment.control2,
        `${path}.control2`,
        errors,
      )
      const endIsValid = validateVec3ForSymbolicPreviewRefresh(
        segment.end,
        `${path}.end`,
        errors,
      )
      const controlModeIsValid =
        validateCubicBezierControlModeForSymbolicPreviewRefresh(
          segment.controlMode,
          `${path}.controlMode`,
          errors,
        )

      return (
        startIsValid &&
        control1IsValid &&
        control2IsValid &&
        endIsValid &&
        controlModeIsValid
      )
    }
    case 'arc': {
      const startIsValid = validateVec3ForSymbolicPreviewRefresh(
        segment.start,
        `${path}.start`,
        errors,
      )
      const endIsValid = validateVec3ForSymbolicPreviewRefresh(
        segment.end,
        `${path}.end`,
        errors,
      )
      const centerIsValid = validateVec3ForSymbolicPreviewRefresh(
        segment.center,
        `${path}.center`,
        errors,
      )
      const radiusIsValid = validateFiniteNumberForSymbolicPreviewRefresh(
        segment.radius,
        `${path}.radius`,
        'Arc radius',
        errors,
      )
      const startAngleIsValid = validateFiniteNumberForSymbolicPreviewRefresh(
        segment.startAngleDeg,
        `${path}.startAngleDeg`,
        'Arc start angle',
        errors,
      )
      const endAngleIsValid = validateFiniteNumberForSymbolicPreviewRefresh(
        segment.endAngleDeg,
        `${path}.endAngleDeg`,
        'Arc end angle',
        errors,
      )
      const directionIsValid =
        segment.direction === 'counterclockwise' ||
        segment.direction === 'clockwise'

      if (!directionIsValid) {
        pushError(
          errors,
          `${path}.direction`,
          'Arc direction must be counterclockwise or clockwise.',
        )
      }

      if (
        typeof segment.radius === 'number' &&
        Number.isFinite(segment.radius) &&
        segment.radius <= 0
      ) {
        pushError(errors, `${path}.radius`, 'Arc radius must be positive.')
      }

      let frameIsValid = true

      if (segment.frame === undefined) {
        if (ambientDimension === 3) {
          pushError(errors, `${path}.frame`, '3D arc segments must store a work-plane frame.')
          frameIsValid = false
        }
      } else {
        frameIsValid = validateWorkPlaneFrameForSymbolicPreviewRefresh(
          segment.frame,
          `${path}.frame`,
          errors,
        )
      }

      return (
        startIsValid &&
        endIsValid &&
        centerIsValid &&
        radiusIsValid &&
        startAngleIsValid &&
        endAngleIsValid &&
        directionIsValid &&
        frameIsValid
      )
    }
    default:
      pushError(
        errors,
        `${path}.kind`,
        'Path segment kind must be line, cubicBezier, or arc.',
      )
      return false
  }
}

function refreshPathSegments(
  segments: readonly PathSegment[],
  ambientDimension: AmbientDimension,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): PathSegment[] {
  if (!Array.isArray(segments)) {
    pushError(errors, path, 'Path segments must be an array.')
    return segments as unknown as PathSegment[]
  }

  return segments.map((segment, index) =>
    refreshPathSegment(
      segment,
      ambientDimension,
      context,
      `${path}[${index}]`,
      errors,
    ),
  )
}

function refreshPathSegment(
  segment: PathSegment,
  ambientDimension: AmbientDimension,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): PathSegment {
  if (
    !validatePathSegmentForSymbolicPreviewRefresh(
      segment,
      ambientDimension,
      path,
      errors,
    )
  ) {
    return segment
  }

  switch (segment.kind) {
    case 'line':
      return {
        ...segment,
        start: refreshVec3SymbolicPreview(
          segment.start,
          ambientDimension,
          context,
          `${path}.start`,
          errors,
        ),
        end: refreshVec3SymbolicPreview(
          segment.end,
          ambientDimension,
          context,
          `${path}.end`,
          errors,
        ),
      }
    case 'cubicBezier':
      return {
        ...segment,
        start: refreshVec3SymbolicPreview(
          segment.start,
          ambientDimension,
          context,
          `${path}.start`,
          errors,
        ),
        control1: refreshVec3SymbolicPreview(
          segment.control1,
          ambientDimension,
          context,
          `${path}.control1`,
          errors,
        ),
        control2: refreshVec3SymbolicPreview(
          segment.control2,
          ambientDimension,
          context,
          `${path}.control2`,
          errors,
        ),
        end: refreshVec3SymbolicPreview(
          segment.end,
          ambientDimension,
          context,
          `${path}.end`,
          errors,
        ),
        ...(segment.controlMode === undefined
          ? {}
          : {
              controlMode: refreshCubicBezierControlModeSymbolicPreviews(
                segment.controlMode,
                context,
                `${path}.controlMode`,
                errors,
              ),
            }),
      }
    case 'arc':
      return {
        ...segment,
        start: refreshVec3SymbolicPreview(
          segment.start,
          ambientDimension,
          context,
          `${path}.start`,
          errors,
        ),
        end: refreshVec3SymbolicPreview(
          segment.end,
          ambientDimension,
          context,
          `${path}.end`,
          errors,
        ),
        center: refreshVec3SymbolicPreview(
          segment.center,
          ambientDimension,
          context,
          `${path}.center`,
          errors,
        ),
        ...(segment.frame === undefined
          ? {}
          : {
              frame: refreshWorkPlaneFrameSnapshotSymbolicPreviews(
                segment.frame,
                context,
                `${path}.frame`,
                errors,
              ),
            }),
      }
  }
}

function refreshPathTemplate(
  template: PathTemplate,
  ambientDimension: AmbientDimension,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): PathTemplate {
  if (!isRecord(template)) {
    pushError(errors, path, 'Path template must be an object.')
    return template
  }

  switch (template.kind) {
    case 'circleTemplate':
      if (
        !validateVec3ForSymbolicPreviewRefresh(
          template.center,
          `${path}.center`,
          errors,
        )
      ) {
        return template
      }

      return {
        ...template,
        center: refreshVec3SymbolicPreview(
          template.center,
          ambientDimension,
          context,
          `${path}.center`,
          errors,
        ),
        ...(template.frame === undefined
          ? {}
          : {
              frame: refreshWorkPlaneFrameSnapshotSymbolicPreviews(
                template.frame,
                context,
                `${path}.frame`,
                errors,
              ),
            }),
      }
    case 'ellipseTemplate':
      if (
        !validateVec3ForSymbolicPreviewRefresh(
          template.center,
          `${path}.center`,
          errors,
        )
      ) {
        return template
      }

      return {
        ...template,
        center: refreshVec3SymbolicPreview(
          template.center,
          ambientDimension,
          context,
          `${path}.center`,
          errors,
        ),
        ...(template.frame === undefined
          ? {}
          : {
              frame: refreshWorkPlaneFrameSnapshotSymbolicPreviews(
                template.frame,
                context,
                `${path}.frame`,
                errors,
              ),
            }),
      }
  }
}

function validateCubicBezierControlModeForSymbolicPreviewRefresh(
  controlMode: unknown,
  path: string,
  errors: DiagramValidationIssue[],
): controlMode is CubicBezierControlMode | undefined {
  if (controlMode === undefined) {
    return true
  }

  if (!isRecord(controlMode)) {
    pushError(errors, path, 'Cubic Bezier control mode must be an object.')
    return false
  }

  switch (controlMode.kind) {
    case 'absolute':
    case 'relativeCartesian':
    case 'relativePolar':
      return true
    case 'workPlaneRelativeCartesian':
    case 'workPlaneRelativePolar':
      return validateWorkPlaneFrameForSymbolicPreviewRefresh(
        controlMode.frame,
        `${path}.frame`,
        errors,
      )
    default:
      pushError(
        errors,
        `${path}.kind`,
        'Cubic Bezier control mode kind is not supported.',
      )
      return false
  }
}

function refreshCubicBezierControlModeSymbolicPreviews(
  controlMode: CubicBezierControlMode,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): CubicBezierControlMode {
  if (
    !validateCubicBezierControlModeForSymbolicPreviewRefresh(
      controlMode,
      path,
      errors,
    )
  ) {
    return controlMode
  }

  switch (controlMode.kind) {
    case 'absolute':
    case 'relativeCartesian':
    case 'relativePolar':
      return controlMode
    case 'workPlaneRelativeCartesian':
    case 'workPlaneRelativePolar':
      return {
        ...controlMode,
        frame: refreshWorkPlaneFrameSnapshotSymbolicPreviews(
          controlMode.frame,
          context,
          `${path}.frame`,
          errors,
        ),
      }
  }
}

function refreshCurvedSheetPrimitiveSymbolicPreviews(
  primitive: CurvedSheetPrimitive,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): CurvedSheetPrimitive {
  switch (primitive.kind) {
    case 'hemisphere':
      return {
        ...primitive,
        center: refreshVec3SymbolicPreview(
          primitive.center,
          3,
          context,
          `${path}.center`,
          errors,
        ),
        frame: refreshWorkPlaneFrameSnapshotSymbolicPreviews(
          primitive.frame,
          context,
          `${path}.frame`,
          errors,
        ),
      }
    case 'saddle':
      return {
        ...primitive,
        frame: refreshWorkPlaneFrameSnapshotSymbolicPreviews(
          primitive.frame,
          context,
          `${path}.frame`,
          errors,
        ),
      }
    case 'ruledSurface':
      return {
        ...primitive,
        boundary0: refreshBoundaryPathSnapshotSymbolicPreviews(
          primitive.boundary0,
          context,
          `${path}.boundary0`,
          errors,
        ),
        boundary1: refreshBoundaryPathSnapshotSymbolicPreviews(
          primitive.boundary1,
          context,
          `${path}.boundary1`,
          errors,
        ),
      }
    case 'coonsPatch':
      return {
        ...primitive,
        bottom: refreshBoundaryPathSnapshotSymbolicPreviews(
          primitive.bottom,
          context,
          `${path}.bottom`,
          errors,
        ),
        right: refreshBoundaryPathSnapshotSymbolicPreviews(
          primitive.right,
          context,
          `${path}.right`,
          errors,
        ),
        top: refreshBoundaryPathSnapshotSymbolicPreviews(
          primitive.top,
          context,
          `${path}.top`,
          errors,
        ),
        left: refreshBoundaryPathSnapshotSymbolicPreviews(
          primitive.left,
          context,
          `${path}.left`,
          errors,
        ),
      }
  }
}

function refreshBoundaryPathSnapshotSymbolicPreviews(
  snapshot: BoundaryPathSnapshot,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): BoundaryPathSnapshot {
  if (!isRecord(snapshot)) {
    pushError(errors, path, 'Boundary path snapshot must be an object.')
    return snapshot
  }

  if (!Array.isArray(snapshot.segments)) {
    pushError(errors, `${path}.segments`, 'Boundary path segments must be an array.')
    return snapshot
  }

  return {
    ...snapshot,
    segments: refreshPathSegments(
      snapshot.segments,
      3,
      context,
      `${path}.segments`,
      errors,
    ),
  }
}

function validateWorkPlaneFrameForSymbolicPreviewRefresh(
  frame: unknown,
  path: string,
  errors: DiagramValidationIssue[],
): frame is WorkPlaneFrameSnapshot {
  if (!isRecord(frame)) {
    pushError(errors, path, 'Work-plane frame must be an object.')
    return false
  }

  const originIsValid = validateVec3ForSymbolicPreviewRefresh(
    frame.origin,
    `${path}.origin`,
    errors,
  )
  const uIsValid = validateVec3ForSymbolicPreviewRefresh(
    frame.u,
    `${path}.u`,
    errors,
  )
  const vIsValid = validateVec3ForSymbolicPreviewRefresh(
    frame.v,
    `${path}.v`,
    errors,
  )
  const normalIsValid = validateVec3ForSymbolicPreviewRefresh(
    frame.normal,
    `${path}.normal`,
    errors,
  )

  return originIsValid && uIsValid && vIsValid && normalIsValid
}

function refreshWorkPlaneFrameSnapshotSymbolicPreviews(
  frame: WorkPlaneFrameSnapshot,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): WorkPlaneFrameSnapshot {
  if (!validateWorkPlaneFrameForSymbolicPreviewRefresh(frame, path, errors)) {
    return frame
  }

  return {
    origin: refreshVec3SymbolicPreview(
      frame.origin,
      3,
      context,
      `${path}.origin`,
      errors,
    ),
    u: refreshVec3SymbolicPreview(
      frame.u,
      3,
      context,
      `${path}.u`,
      errors,
    ),
    v: refreshVec3SymbolicPreview(
      frame.v,
      3,
      context,
      `${path}.v`,
      errors,
    ),
    normal: refreshVec3SymbolicPreview(
      frame.normal,
      3,
      context,
      `${path}.normal`,
      errors,
    ),
  }
}

function validateVec3ForSymbolicPreviewRefresh(
  point: unknown,
  path: string,
  errors: DiagramValidationIssue[],
): point is Vec3 {
  if (!isRecord(point)) {
    pushError(errors, path, 'Coordinate must be an object.')
    return false
  }

  const xIsValid = validateFiniteNumberForSymbolicPreviewRefresh(
    point.x,
    `${path}.x`,
    'Coordinate x value',
    errors,
  )
  const yIsValid = validateFiniteNumberForSymbolicPreviewRefresh(
    point.y,
    `${path}.y`,
    'Coordinate y value',
    errors,
  )
  const zIsValid = validateFiniteNumberForSymbolicPreviewRefresh(
    point.z,
    `${path}.z`,
    'Coordinate z value',
    errors,
  )

  return xIsValid && yIsValid && zIsValid
}

function validateFiniteNumberForSymbolicPreviewRefresh(
  value: unknown,
  path: string,
  label: string,
  errors: DiagramValidationIssue[],
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    pushError(errors, path, `${label} must be a finite number.`)
    return false
  }

  return true
}

function refreshVec3SymbolicPreview(
  point: Vec3,
  ambientDimension: AmbientDimension,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): Vec3 {
  if (!validateVec3ForSymbolicPreviewRefresh(point, path, errors)) {
    return point
  }

  if (point.symbolic === undefined) {
    return normalizePreviewPoint(point, ambientDimension)
  }

  const components = symbolicVec3ComponentsFromPoint(point)

  if (ambientDimension === 2 && components.z.kind === 'symbolic') {
    pushError(
      errors,
      `${path}.symbolic.z`,
      '2D symbolic coordinates must keep z numeric and equal to 0.',
    )
    return point
  }

  for (const axis of coordinateAxes) {
    const component = components[axis]

    if (component.kind !== 'symbolic') {
      continue
    }

    const refreshed = refreshSymbolicCoordinateComponent(
      component,
      context,
      `${path}.symbolic.${axis}`,
      errors,
    )

    if (refreshed === null) {
      return point
    }

    components[axis] = refreshed
  }

  return vec3FromCoordinateComponents(components, ambientDimension)
}

function refreshScalarInputValuePreview(
  value: ScalarInputValue,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): ScalarInputValue {
  if (value.kind === 'numeric') {
    return value
  }

  const parsed = parseScalarExpression(value.expression, {
    variables: context.variableNames,
  })

  if (!parsed.ok) {
    pushError(errors, `${path}.expression`, parsed.error)
    return value
  }

  const evaluated = evaluateScalarExpression(
    parsed.expression,
    context.previewValues,
  )

  if (!evaluated.ok) {
    pushError(errors, `${path}.expression`, evaluated.error)
    return value
  }

  return {
    ...value,
    previewValue: evaluated.value,
  }
}

function refreshSymbolicCoordinateComponent(
  component: Extract<CoordinateComponent, { kind: 'symbolic' }>,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): CoordinateComponent | null {
  const parsed = parseScalarExpression(component.expression, {
    variables: context.variableNames,
  })

  if (!parsed.ok) {
    pushError(errors, `${path}.expression`, parsed.error)
    return null
  }

  const evaluated = evaluateScalarExpression(
    parsed.expression,
    context.previewValues,
  )

  if (!evaluated.ok) {
    pushError(errors, `${path}.expression`, evaluated.error)
    return null
  }

  return {
    ...component,
    previewValue: evaluated.value,
  }
}

function vec3FromCoordinateComponents(
  components: SymbolicVec3,
  ambientDimension: AmbientDimension,
): Vec3 {
  const normalizedComponents = normalizeSymbolicVec3ForAmbientDimension(
    components,
    ambientDimension,
  )
  const point = normalizePreviewPoint(
    {
      x: coordinateComponentPreviewValue(normalizedComponents.x),
      y: coordinateComponentPreviewValue(normalizedComponents.y),
      z: coordinateComponentPreviewValue(normalizedComponents.z),
    },
    ambientDimension,
  )

  if (!symbolicVec3HasSymbolic(normalizedComponents)) {
    return point
  }

  return {
    ...point,
    symbolic: cloneSymbolicVec3(normalizedComponents),
  }
}

function normalizeSymbolicVec3ForAmbientDimension(
  components: SymbolicVec3,
  ambientDimension: AmbientDimension,
): SymbolicVec3 {
  if (ambientDimension === 3) {
    return cloneSymbolicVec3(components)
  }

  return {
    x: cloneCoordinateComponent(components.x),
    y: cloneCoordinateComponent(components.y),
    z: numericCoordinateComponent(0),
  }
}

function symbolicVec3ComponentsFromPoint(point: Vec3): SymbolicVec3 {
  const symbolic = point.symbolic
  const symbolicX = coordinateComponentFromUnknown(symbolic?.x)
  const symbolicY = coordinateComponentFromUnknown(symbolic?.y)
  const symbolicZ = coordinateComponentFromUnknown(symbolic?.z)

  return {
    x:
      symbolicX?.kind === 'symbolic'
        ? cloneCoordinateComponent(symbolicX)
        : numericCoordinateComponent(point.x),
    y:
      symbolicY?.kind === 'symbolic'
        ? cloneCoordinateComponent(symbolicY)
        : numericCoordinateComponent(point.y),
    z:
      symbolicZ?.kind === 'symbolic'
        ? cloneCoordinateComponent(symbolicZ)
        : numericCoordinateComponent(point.z),
  }
}

function coordinateComponentFromUnknown(
  component: unknown,
): CoordinateComponent | null {
  if (!isRecord(component)) {
    return null
  }

  if (component.kind === 'numeric') {
    return typeof component.value === 'number' && Number.isFinite(component.value)
      ? {
          kind: 'numeric',
          value: component.value,
        }
      : null
  }

  if (component.kind !== 'symbolic') {
    return null
  }

  return typeof component.expression === 'string' &&
    typeof component.previewValue === 'number' &&
    Number.isFinite(component.previewValue)
    ? {
        kind: 'symbolic',
        expression: component.expression,
        previewValue: component.previewValue,
      }
    : null
}

function symbolicVec3HasSymbolic(symbolic: SymbolicVec3): boolean {
  return coordinateAxes.some((axis) => symbolic[axis].kind === 'symbolic')
}

function cloneSymbolicVec3(symbolic: SymbolicVec3): SymbolicVec3 {
  return {
    x: cloneCoordinateComponent(symbolic.x),
    y: cloneCoordinateComponent(symbolic.y),
    z: cloneCoordinateComponent(symbolic.z),
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

function readCoordinateComponent(
  rawComponent: unknown,
  path: string,
  context: CoordinateExpressionContext | undefined,
  errors: DiagramValidationIssue[],
): CoordinateComponent | null {
  if (!isRecord(rawComponent)) {
    pushError(errors, path, 'Coordinate component must be an object.')
    return null
  }

  if (rawComponent.kind === 'numeric') {
    if (typeof rawComponent.value !== 'number' || !Number.isFinite(rawComponent.value)) {
      pushError(errors, `${path}.value`, 'Numeric coordinate value must be finite.')
      return null
    }

    return {
      kind: 'numeric',
      value: rawComponent.value,
    }
  }

  if (rawComponent.kind !== 'symbolic') {
    pushError(errors, `${path}.kind`, 'Coordinate component kind must be numeric or symbolic.')
    return null
  }

  if (typeof rawComponent.expression !== 'string') {
    pushError(errors, `${path}.expression`, 'Symbolic coordinate expression must be a string.')
    return null
  }

  if (
    typeof rawComponent.previewValue !== 'number' ||
    !Number.isFinite(rawComponent.previewValue)
  ) {
    pushError(errors, `${path}.previewValue`, 'Symbolic coordinate preview value must be finite.')
    return null
  }

  if (context !== undefined) {
    const parsed = parseScalarExpression(rawComponent.expression, {
      variables: context.variableNames,
    })

    if (!parsed.ok) {
      pushError(errors, `${path}.expression`, parsed.error)
      return null
    }

    const evaluated = evaluateScalarExpression(
      parsed.expression,
      context.previewValues,
    )

    if (!evaluated.ok) {
      pushError(errors, `${path}.expression`, evaluated.error)
      return null
    }

    if (!numbersApproximatelyEqual(rawComponent.previewValue, evaluated.value)) {
      pushError(
        errors,
        `${path}.previewValue`,
        'Symbolic coordinate preview value must match the evaluated expression.',
      )
    }
  }

  return {
    kind: 'symbolic',
    expression: rawComponent.expression,
    previewValue: rawComponent.previewValue,
  }
}

function normalizePreviewPoint(
  point: Pick<Vec3, 'x' | 'y' | 'z'>,
  ambientDimension: AmbientDimension,
): Vec3 {
  return ambientDimension === 2
    ? { x: point.x, y: point.y, z: 0 }
    : { x: point.x, y: point.y, z: point.z }
}

function numbersApproximatelyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= previewValueEpsilon
}

function pushError(
  errors: DiagramValidationIssue[],
  path: string,
  message: string,
): void {
  errors.push({ path, message })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
