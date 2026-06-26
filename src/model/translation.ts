import {
  evaluateScalarExpression,
  parseScalarExpression,
} from './scalarExpressions.ts'
import {
  coordinateComponentPreviewValue,
  numericCoordinateComponent,
  type CoordinateExpressionContext,
} from './symbolicCoordinates.ts'
import {
  cloneWorkPlaneLocalCoordinateSource,
  evaluateWorkPlaneLocalCoordinate,
} from './workPlaneLocalCoordinates.ts'
import type {
  AmbientDimension,
  BoundaryPathSnapshot,
  ClosedPathBoundary,
  CoonsBoundarySnapshot,
  CoonsConstantPointBoundarySnapshot,
  CoordinateComponent,
  CubicBezierControlMode,
  CurvedSheetPrimitive,
  Diagram,
  PathSegment,
  PathTemplate,
  QuadSheetStratum,
  RegionStratum,
  SheetStratum,
  Stratum,
  SymbolicVec3,
  TextLabel,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinateSource,
} from './types.ts'
import { resolveSymbolicVariables } from './variables.ts'

export type TranslationVector = SymbolicVec3

export type DiagramTranslationContext = {
  ambientDimension: AmbientDimension
  coordinateExpressionContext: CoordinateExpressionContext
}

export type ParseTranslationVectorInput = {
  dx: string
  dy: string
  dz?: string
}

export type ParseTranslationVectorResult =
  | {
      ok: true
      translation: TranslationVector
      preview: Vec3
    }
  | {
      ok: false
      error: string
    }

export type NormalizeTranslationVectorOptions = {
  reject2DNonZeroZ?: boolean
}

const previewValueEpsilon = 1e-9

export function diagramTranslationContext(
  diagram: Diagram,
): DiagramTranslationContext {
  const resolved = resolveSymbolicVariables(diagram.variables ?? [])

  if (!resolved.ok) {
    const firstError = resolved.errors[0]
    throw new Error(
      firstError === undefined
        ? 'Symbolic variables could not be resolved.'
        : `${firstError.path}: ${firstError.message}`,
    )
  }

  return {
    ambientDimension: diagram.ambientDimension,
    coordinateExpressionContext: {
      variableNames: resolved.variables.map((variable) => variable.name),
      previewValues: resolved.values,
    },
  }
}

export function parseTranslationVectorFromInputs(
  diagram: Diagram,
  input: ParseTranslationVectorInput,
): ParseTranslationVectorResult {
  let context: DiagramTranslationContext

  try {
    context = diagramTranslationContext(diagram)
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error, 'Symbolic variables could not be resolved.'),
    }
  }

  const dx = parseTranslationComponent(
    input.dx,
    context.coordinateExpressionContext,
    'dx',
  )
  if (!dx.ok) {
    return dx
  }

  const dy = parseTranslationComponent(
    input.dy,
    context.coordinateExpressionContext,
    'dy',
  )
  if (!dy.ok) {
    return dy
  }

  const dz =
    diagram.ambientDimension === 2
      ? { ok: true as const, component: numericCoordinateComponent(0) }
      : parseTranslationComponent(
          input.dz ?? '0',
          context.coordinateExpressionContext,
          'dz',
        )

  if (!dz.ok) {
    return dz
  }

  const translation = normalizeTranslationVectorForDiagram(
    diagram,
    {
      x: dx.component,
      y: dy.component,
      z: dz.component,
    },
    { reject2DNonZeroZ: true },
  )

  return {
    ok: true,
    translation,
    preview: translationVectorPreview(translation),
  }
}

export function translationVectorFromNumericVec3(
  diagram: Diagram,
  translation: Vec3,
  options: NormalizeTranslationVectorOptions = {},
): TranslationVector {
  if (!isFiniteVec3(translation)) {
    throw new Error('translation must contain finite dx, dy, and dz values.')
  }

  return normalizeTranslationVectorForDiagram(
    diagram,
    {
      x: numericCoordinateComponent(translation.x),
      y: numericCoordinateComponent(translation.y),
      z: numericCoordinateComponent(translation.z),
    },
    options,
  )
}

export function normalizeTranslationVectorForDiagram(
  diagram: Diagram,
  translation: TranslationVector,
  options: NormalizeTranslationVectorOptions = {},
): TranslationVector {
  assertFiniteTranslationPreview(translation)

  if (
    diagram.ambientDimension === 2 &&
    options.reject2DNonZeroZ === true &&
    !numbersApproximatelyEqual(coordinateComponentPreviewValue(translation.z), 0)
  ) {
    throw new Error('2D layer translation does not allow dz.')
  }

  return diagram.ambientDimension === 2
    ? {
        x: cloneCoordinateComponent(translation.x),
        y: cloneCoordinateComponent(translation.y),
        z: numericCoordinateComponent(0),
      }
    : cloneTranslationVector(translation)
}

export function translationVectorPreview(
  translation: TranslationVector,
): Vec3 {
  return {
    x: coordinateComponentPreviewValue(translation.x),
    y: coordinateComponentPreviewValue(translation.y),
    z: coordinateComponentPreviewValue(translation.z),
  }
}

export function isZeroTranslationVector(
  translation: TranslationVector,
): boolean {
  const preview = translationVectorPreview(translation)

  return preview.x === 0 && preview.y === 0 && preview.z === 0
}

export function translateTextLabel(
  label: TextLabel,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): TextLabel {
  return {
    ...label,
    position: translateVec3(label.position, translation, context),
  }
}

export function translateStratum(
  stratum: Stratum,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): Stratum {
  switch (stratum.geometricKind) {
    case 'region':
      return translateRegionStratum(stratum, translation, context)
    case 'sheet':
      return translateSheetStratum(stratum, translation, context)
    case 'curve':
      return translateCurveStratum(stratum, translation, context)
    case 'point':
      return {
        ...stratum,
        position: translateVec3(stratum.position, translation, context),
      }
    default:
      throw new Error(
        `Unsupported stratum geometric kind "${unknownKind(
          (stratum as { geometricKind?: unknown }).geometricKind,
        )}".`,
      )
  }
}

export function translateVec3(
  point: Vec3,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): Vec3 {
  if (point.symbolic?.source?.kind === 'workPlaneLocal') {
    return translateWorkPlaneLocalVec3(
      point.symbolic.source,
      translation,
      context,
    )
  }

  const components: SymbolicVec3 =
    context.ambientDimension === 2
      ? {
          x: translateCoordinateComponent(
            coordinateComponentForPoint(point, 'x'),
            translation.x,
            context.coordinateExpressionContext,
            'x',
          ),
          y: translateCoordinateComponent(
            coordinateComponentForPoint(point, 'y'),
            translation.y,
            context.coordinateExpressionContext,
            'y',
          ),
          z: numericCoordinateComponent(0),
        }
      : {
          x: translateCoordinateComponent(
            coordinateComponentForPoint(point, 'x'),
            translation.x,
            context.coordinateExpressionContext,
            'x',
          ),
          y: translateCoordinateComponent(
            coordinateComponentForPoint(point, 'y'),
            translation.y,
            context.coordinateExpressionContext,
            'y',
          ),
          z: translateCoordinateComponent(
            coordinateComponentForPoint(point, 'z'),
            translation.z,
            context.coordinateExpressionContext,
            'z',
          ),
        }

  return vec3FromCoordinateComponents(components, context.ambientDimension)
}

export function translateWorkPlaneLocalCoordinateSource(
  source: WorkPlaneLocalCoordinateSource,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): WorkPlaneLocalCoordinateSource {
  const translatedSource = cloneWorkPlaneLocalCoordinateSource(source)

  translatedSource.frame = translateFrameOrigin(
    source.frame,
    translation,
    context,
  )

  return translatedSource
}

export function translatePathSegment(
  segment: PathSegment,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): PathSegment {
  switch (segment.kind) {
    case 'line':
      return {
        ...segment,
        start: translateVec3(segment.start, translation, context),
        end: translateVec3(segment.end, translation, context),
      }
    case 'cubicBezier':
      return {
        ...segment,
        start: translateVec3(segment.start, translation, context),
        control1: translateVec3(segment.control1, translation, context),
        control2: translateVec3(segment.control2, translation, context),
        end: translateVec3(segment.end, translation, context),
        ...(segment.controlMode === undefined
          ? {}
          : {
              controlMode: translateCubicBezierControlMode(
                segment.controlMode,
                translation,
                context,
              ),
            }),
      }
    case 'arc':
      return {
        ...segment,
        start: translateVec3(segment.start, translation, context),
        end: translateVec3(segment.end, translation, context),
        center: translateVec3(segment.center, translation, context),
        ...(segment.frame === undefined
          ? {}
          : {
              frame: translateFrameOrigin(
                segment.frame,
                translation,
                context,
              ),
            }),
      }
    default:
      throw new Error(
        `Unsupported path segment kind "${unknownKind(
          (segment as { kind?: unknown }).kind,
        )}".`,
      )
  }
}

export function translateFrameOrigin(
  frame: WorkPlaneFrameSnapshot,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): WorkPlaneFrameSnapshot {
  return {
    origin: translateVec3(frame.origin, translation, context),
    u: cloneVec3(frame.u),
    v: cloneVec3(frame.v),
    normal: cloneVec3(frame.normal),
  }
}

function parseTranslationComponent(
  source: string,
  context: CoordinateExpressionContext,
  label: 'dx' | 'dy' | 'dz',
):
  | {
      ok: true
      component: CoordinateComponent
    }
  | {
      ok: false
      error: string
    } {
  const expression = source.trim()
  const parsed = parseScalarExpression(expression, {
    variables: context.variableNames,
  })

  if (!parsed.ok) {
    return {
      ok: false,
      error: `${label}: ${parsed.error}`,
    }
  }

  const evaluated = evaluateScalarExpression(
    parsed.expression,
    context.previewValues,
  )

  if (!evaluated.ok) {
    return {
      ok: false,
      error: `${label}: ${evaluated.error}`,
    }
  }

  return {
    ok: true,
    component:
      expressionHasVariablesOrSyntax(expression, context)
        ? {
            kind: 'symbolic',
            expression,
            previewValue: evaluated.value,
          }
        : numericCoordinateComponent(evaluated.value),
  }
}

function translateRegionStratum(
  stratum: RegionStratum,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): RegionStratum {
  switch (stratum.kind) {
    case undefined:
    case 'ambientRegion':
      return stratum
    case 'filledRegion':
      return {
        ...stratum,
        boundaries: translateClosedPathBoundaries(
          stratum.boundaries,
          translation,
          context,
        ),
      }
    default:
      throw new Error(
        `Unsupported region stratum kind "${unknownKind(
          (stratum as { kind?: unknown }).kind,
        )}".`,
      )
  }
}

function translateSheetStratum(
  stratum: SheetStratum,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): SheetStratum {
  switch (stratum.kind) {
    case 'quadSheet':
      return {
        ...stratum,
        corners: stratum.corners.map((corner) =>
          translateVec3(corner, translation, context),
        ) as QuadSheetStratum['corners'],
      }
    case 'polygonSheet':
      return {
        ...stratum,
        vertices: stratum.vertices.map((vertex) =>
          translateVec3(vertex, translation, context),
        ),
      }
    case 'workPlaneFilledSheet':
      return {
        ...stratum,
        planeFrame: translateFrameOrigin(
          stratum.planeFrame,
          translation,
          context,
        ),
        boundaries: translateClosedPathBoundaries(
          stratum.boundaries,
          translation,
          context,
        ),
      }
    case 'curvedSheet':
      return {
        ...stratum,
        primitive: translateCurvedSheetPrimitive(
          stratum.primitive,
          translation,
          context,
        ),
      }
    default:
      throw new Error(
        `Unsupported sheet stratum kind "${unknownKind(
          (stratum as { kind?: unknown }).kind,
        )}".`,
      )
  }
}

function translateCurveStratum(
  stratum: Extract<Stratum, { geometricKind: 'curve' }>,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): Extract<Stratum, { geometricKind: 'curve' }> {
  switch (stratum.kind) {
    case 'polyline':
      return {
        ...stratum,
        points: stratum.points.map((point) =>
          translateVec3(point, translation, context),
        ),
      }
    case 'cubicBezier':
      return {
        ...stratum,
        points: stratum.points.map((point) =>
          translateVec3(point, translation, context),
        ),
        ...(stratum.bezierControls === undefined
          ? {}
          : {
              bezierControls: translateCubicBezierControlMode(
                stratum.bezierControls,
                translation,
                context,
              ),
            }),
      }
    case 'concatenatedPath':
      return {
        ...stratum,
        segments: stratum.segments.map((segment) =>
          translatePathSegment(segment, translation, context),
        ),
      }
    case 'templatePath':
      return {
        ...stratum,
        template: translatePathTemplate(stratum.template, translation, context),
      }
    case 'grid':
      return {
        ...stratum,
        frame: {
          ...stratum.frame,
          frame: translateFrameOrigin(
            stratum.frame.frame,
            translation,
            context,
          ),
        },
      }
    default:
      throw new Error(
        `Unsupported curve stratum kind "${unknownKind(
          (stratum as { kind?: unknown }).kind,
        )}".`,
      )
  }
}

function translateClosedPathBoundaries(
  boundaries: readonly ClosedPathBoundary[],
  translation: TranslationVector,
  context: DiagramTranslationContext,
): ClosedPathBoundary[] {
  return boundaries.map((boundary) => ({
    ...boundary,
    segments: boundary.segments.map((segment) =>
      translatePathSegment(segment, translation, context),
    ),
  }))
}

function translatePathTemplate(
  template: PathTemplate,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): PathTemplate {
  switch (template.kind) {
    case 'circleTemplate':
      return {
        ...template,
        center: translateVec3(template.center, translation, context),
        ...(template.frame === undefined
          ? {}
          : {
              frame: translateFrameOrigin(
                template.frame,
                translation,
                context,
              ),
            }),
      }
    case 'ellipseTemplate':
      return {
        ...template,
        center: translateVec3(template.center, translation, context),
        ...(template.frame === undefined
          ? {}
          : {
              frame: translateFrameOrigin(
                template.frame,
                translation,
                context,
              ),
            }),
      }
    default:
      throw new Error(
        `Unsupported path template kind "${unknownKind(
          (template as { kind?: unknown }).kind,
        )}".`,
      )
  }
}

function translateCubicBezierControlMode(
  controlMode: CubicBezierControlMode,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): CubicBezierControlMode {
  switch (controlMode.kind) {
    case 'absolute':
    case 'relativeCartesian':
    case 'relativePolar':
      return controlMode
    case 'workPlaneRelativeCartesian':
      return {
        ...controlMode,
        frame: translateFrameOrigin(controlMode.frame, translation, context),
      }
    case 'workPlaneRelativePolar':
      return {
        ...controlMode,
        frame: translateFrameOrigin(controlMode.frame, translation, context),
      }
    default:
      throw new Error(
        `Unsupported cubic Bezier control mode "${unknownKind(
          (controlMode as { kind?: unknown }).kind,
        )}".`,
      )
  }
}

function translateCurvedSheetPrimitive(
  primitive: CurvedSheetPrimitive,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): CurvedSheetPrimitive {
  switch (primitive.kind) {
    case 'hemisphere':
      return {
        ...primitive,
        center: translateVec3(primitive.center, translation, context),
        frame: translateFrameOrigin(primitive.frame, translation, context),
      }
    case 'saddle':
      return {
        ...primitive,
        frame: translateFrameOrigin(primitive.frame, translation, context),
      }
    case 'ruledSurface':
      return {
        ...primitive,
        boundary0: translateBoundaryPathSnapshot(
          primitive.boundary0,
          translation,
          context,
        ),
        boundary1: translateBoundaryPathSnapshot(
          primitive.boundary1,
          translation,
          context,
        ),
      }
    case 'coonsPatch':
      return {
        ...primitive,
        bottom: translateCoonsBoundarySnapshot(
          primitive.bottom,
          translation,
          context,
        ),
        right: translateCoonsBoundarySnapshot(
          primitive.right,
          translation,
          context,
        ),
        top: translateCoonsBoundarySnapshot(
          primitive.top,
          translation,
          context,
        ),
        left: translateCoonsBoundarySnapshot(
          primitive.left,
          translation,
          context,
        ),
      }
    default:
      throw new Error(
        `Unsupported curved sheet primitive kind "${unknownKind(
          (primitive as { kind?: unknown }).kind,
        )}".`,
      )
  }
}

function translateBoundaryPathSnapshot(
  snapshot: BoundaryPathSnapshot,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): BoundaryPathSnapshot {
  return {
    ...snapshot,
    segments: snapshot.segments.map((segment) =>
      translatePathSegment(segment, translation, context),
    ),
  }
}

function translateCoonsBoundarySnapshot(
  snapshot: CoonsBoundarySnapshot,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): CoonsBoundarySnapshot {
  if (snapshotIsCoonsConstantPointBoundary(snapshot)) {
    return {
      ...snapshot,
      point: translateVec3(snapshot.point, translation, context),
    }
  }

  return translateBoundaryPathSnapshot(snapshot, translation, context)
}

function snapshotIsCoonsConstantPointBoundary(
  snapshot: CoonsBoundarySnapshot,
): snapshot is CoonsConstantPointBoundarySnapshot {
  return 'kind' in snapshot && snapshot.kind === 'constantPoint'
}

function translateCoordinateComponent(
  component: CoordinateComponent,
  delta: CoordinateComponent,
  context: CoordinateExpressionContext,
  axis: 'x' | 'y' | 'z',
): CoordinateComponent {
  if (component.kind === 'numeric' && delta.kind === 'numeric') {
    const value = component.value + delta.value

    if (!Number.isFinite(value)) {
      throw new Error(`Translation would create a non-finite coordinate on ${axis}.`)
    }

    return numericCoordinateComponent(value)
  }

  const expression = additionExpression(component, delta)
  const parsed = parseScalarExpression(expression, {
    variables: context.variableNames,
  })

  if (!parsed.ok) {
    throw new Error(`${axis} translation expression is invalid: ${parsed.error}`)
  }

  const evaluated = evaluateScalarExpression(
    parsed.expression,
    context.previewValues,
  )

  if (!evaluated.ok) {
    throw new Error(`${axis} translation expression is invalid: ${evaluated.error}`)
  }

  return {
    kind: 'symbolic',
    expression,
    previewValue: evaluated.value,
  }
}

function translateWorkPlaneLocalVec3(
  source: WorkPlaneLocalCoordinateSource,
  translation: TranslationVector,
  context: DiagramTranslationContext,
): Vec3 {
  const translatedSource = translateWorkPlaneLocalCoordinateSource(
    source,
    translation,
    context,
  )
  const evaluated = evaluateWorkPlaneLocalCoordinate(
    translatedSource,
    context.coordinateExpressionContext,
  )

  if (!evaluated.ok) {
    const firstError = evaluated.errors[0]
    throw new Error(
      firstError === undefined
        ? 'Translated work-plane-local coordinate is invalid.'
        : `${firstError.path}: ${firstError.message}`,
    )
  }

  const preview =
    context.ambientDimension === 2
      ? {
          x: evaluated.point.x,
          y: evaluated.point.y,
          z: 0,
        }
      : evaluated.point

  if (!isFiniteVec3(preview)) {
    throw new Error(
      'Translation would create a non-finite work-plane-local coordinate.',
    )
  }

  return {
    ...preview,
    symbolic: {
      x: numericCoordinateComponent(preview.x),
      y: numericCoordinateComponent(preview.y),
      z: numericCoordinateComponent(preview.z),
      source: translatedSource,
    },
  }
}

function additionExpression(
  component: CoordinateComponent,
  delta: CoordinateComponent,
): string {
  if (delta.kind === 'numeric' && numbersApproximatelyEqual(delta.value, 0)) {
    return coordinateComponentExpression(component)
  }

  if (component.kind === 'numeric' && numbersApproximatelyEqual(component.value, 0)) {
    return coordinateComponentExpression(delta)
  }

  const left = component.kind === 'symbolic'
    ? `(${component.expression})`
    : formatExpressionNumber(component.value)
  const right = delta.kind === 'symbolic'
    ? `(${delta.expression})`
    : formatExpressionNumber(delta.value)

  return `${left} + ${right}`
}

function coordinateComponentExpression(component: CoordinateComponent): string {
  return component.kind === 'symbolic'
    ? component.expression
    : formatExpressionNumber(component.value)
}

function coordinateComponentForPoint(
  point: Vec3,
  axis: 'x' | 'y' | 'z',
): CoordinateComponent {
  const component = point.symbolic?.[axis]

  return component?.kind === 'symbolic'
    ? {
        kind: 'symbolic',
        expression: component.expression,
        previewValue: component.previewValue,
      }
    : numericCoordinateComponent(point[axis])
}

function vec3FromCoordinateComponents(
  components: SymbolicVec3,
  ambientDimension: AmbientDimension,
): Vec3 {
  const normalizedComponents =
    ambientDimension === 2
      ? {
          x: cloneCoordinateComponent(components.x),
          y: cloneCoordinateComponent(components.y),
          z: numericCoordinateComponent(0),
        }
      : cloneTranslationVector(components)
  const point: Vec3 =
    ambientDimension === 2
      ? {
          x: coordinateComponentPreviewValue(normalizedComponents.x),
          y: coordinateComponentPreviewValue(normalizedComponents.y),
          z: 0,
        }
      : {
          x: coordinateComponentPreviewValue(normalizedComponents.x),
          y: coordinateComponentPreviewValue(normalizedComponents.y),
          z: coordinateComponentPreviewValue(normalizedComponents.z),
        }

  if (!isFiniteVec3(point)) {
    throw new Error('Translation would create a non-finite coordinate.')
  }

  return hasSymbolicComponent(normalizedComponents)
    ? {
        ...point,
        symbolic: normalizedComponents,
      }
    : point
}

function expressionHasVariablesOrSyntax(
  expression: string,
  context: CoordinateExpressionContext,
): boolean {
  const numeric = Number(expression)

  if (Number.isFinite(numeric) && expression.trim() !== '') {
    return false
  }

  return context.variableNames.some((name) => expression.includes(name)) ||
    /[A-Za-z_(]/u.test(expression)
}

function assertFiniteTranslationPreview(translation: TranslationVector): void {
  const preview = translationVectorPreview(translation)

  if (!isFiniteVec3(preview)) {
    throw new Error('translation must contain finite dx, dy, and dz values.')
  }
}

function cloneTranslationVector(translation: TranslationVector): TranslationVector {
  return {
    x: cloneCoordinateComponent(translation.x),
    y: cloneCoordinateComponent(translation.y),
    z: cloneCoordinateComponent(translation.z),
  }
}

function cloneCoordinateComponent(
  component: CoordinateComponent,
): CoordinateComponent {
  return component.kind === 'numeric'
    ? numericCoordinateComponent(component.value)
    : {
        kind: 'symbolic',
        expression: component.expression,
        previewValue: component.previewValue,
      }
}

function cloneVec3(point: Vec3): Vec3 {
  return point.symbolic === undefined
    ? { x: point.x, y: point.y, z: point.z }
    : {
        x: point.x,
        y: point.y,
        z: point.z,
        symbolic: cloneSymbolicVec3(point.symbolic),
      }
}

function cloneSymbolicVec3(symbolic: SymbolicVec3): SymbolicVec3 {
  return {
    x: cloneCoordinateComponent(symbolic.x),
    y: cloneCoordinateComponent(symbolic.y),
    z: cloneCoordinateComponent(symbolic.z),
    ...(symbolic.source === undefined
      ? {}
      : { source: cloneWorkPlaneLocalCoordinateSource(symbolic.source) }),
  }
}

function hasSymbolicComponent(components: SymbolicVec3): boolean {
  return (
    components.x.kind === 'symbolic' ||
    components.y.kind === 'symbolic' ||
    components.z.kind === 'symbolic'
  )
}

function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}

function numbersApproximatelyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= previewValueEpsilon
}

function formatExpressionNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('Cannot format a non-finite number in a translation expression.')
  }

  if (Object.is(value, -0)) {
    return '0'
  }

  if (Number.isInteger(value)) {
    return String(value)
  }

  return String(Number(value.toPrecision(15)))
}

function unknownKind(value: unknown): string {
  return typeof value === 'string' ? value : String(value)
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
