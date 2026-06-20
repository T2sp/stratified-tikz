import {
  evaluateScalarExpression,
  parseScalarExpression,
  scalarExpressionVariables,
} from './scalarExpressions.ts'
import type {
  AmbientDimension,
  ClosedPathBoundary,
  CoordinateComponent,
  Diagram,
  DiagramValidationIssue,
  PathSegment,
  PathTemplate,
  Stratum,
  SymbolicVec3,
  Vec3,
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
  return point.symbolic !== undefined && symbolicVec3HasSymbolic(point.symbolic)
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
            boundaries: refreshClosedPathBoundaries(
              stratum.boundaries,
              ambientDimension,
              context,
              `${path}.boundaries`,
              errors,
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

function refreshPathSegments(
  segments: readonly PathSegment[],
  ambientDimension: AmbientDimension,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): PathSegment[] {
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
  switch (template.kind) {
    case 'circleTemplate':
      return {
        ...template,
        center: refreshVec3SymbolicPreview(
          template.center,
          ambientDimension,
          context,
          `${path}.center`,
          errors,
        ),
      }
    case 'ellipseTemplate':
      return {
        ...template,
        center: refreshVec3SymbolicPreview(
          template.center,
          ambientDimension,
          context,
          `${path}.center`,
          errors,
        ),
      }
  }
}

function refreshVec3SymbolicPreview(
  point: Vec3,
  ambientDimension: AmbientDimension,
  context: CoordinateExpressionContext,
  path: string,
  errors: DiagramValidationIssue[],
): Vec3 {
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

  return {
    x:
      symbolic?.x.kind === 'symbolic'
        ? cloneCoordinateComponent(symbolic.x)
        : numericCoordinateComponent(point.x),
    y:
      symbolic?.y.kind === 'symbolic'
        ? cloneCoordinateComponent(symbolic.y)
        : numericCoordinateComponent(point.y),
    z:
      symbolic?.z.kind === 'symbolic'
        ? cloneCoordinateComponent(symbolic.z)
        : numericCoordinateComponent(point.z),
  }
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
