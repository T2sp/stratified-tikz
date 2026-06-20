import {
  isValidWorkPlaneFrameSnapshot,
  pointFromWorkPlaneLocalCoordinate,
} from '../geometry/bezierControls.ts'
import type { ScalarInputValue } from './scalarExpressions.ts'
import { latticePatterns } from './types.ts'
import type {
  AmbientDimension,
  GridFrame,
  GridParameterRange,
  GridRectangleClip,
  GridStratum,
  LatticePattern,
  Vec3,
  WorkPlaneFrameSnapshot,
} from './types.ts'

export type GridPreviewSegment = {
  start: Vec3
  end: Vec3
}

export type GridPreviewResult =
  | {
      ok: true
      segments: GridPreviewSegment[]
      lineCount: number
    }
  | {
      ok: false
      errors: GridValidationIssue[]
    }

export type GridValidationIssue = {
  path: string
  message: string
}

type ScalarRangeValues = {
  min: number
  max: number
  step: number
}

type ClipValues = {
  uMin: number
  uMax: number
  vMin: number
  vMax: number
}

type LocalPoint = {
  u: number
  v: number
}

type LocalSegment = {
  start: LocalPoint
  end: LocalPoint
}

type ParameterSequence = {
  firstIndex: number
  count: number
}

export const maxGridPreviewLines = 500
export const defaultLatticePattern: LatticePattern = 'rectangular'

const gridEpsilon = 1e-9
const sqrtThree = Math.sqrt(3)

export function createNumericScalarInputValue(value: number): ScalarInputValue {
  return {
    kind: 'numeric',
    value,
  }
}

export function cloneScalarInputValue(value: ScalarInputValue): ScalarInputValue {
  return value.kind === 'numeric'
    ? {
        kind: 'numeric',
        value: value.value,
      }
    : {
        kind: 'symbolic',
        expression: value.expression,
        previewValue: value.previewValue,
      }
}

export function isLatticePattern(value: unknown): value is LatticePattern {
  return (
    typeof value === 'string' &&
    latticePatterns.some((pattern) => pattern === value)
  )
}

export function gridLatticePattern(
  grid: Pick<GridStratum, 'latticePattern'>,
): LatticePattern {
  return isLatticePattern(grid.latticePattern)
    ? grid.latticePattern
    : defaultLatticePattern
}

export function cloneGridFrame(frame: GridFrame): GridFrame {
  return {
    kind: frame.kind,
    frame: cloneWorkPlaneFrameSnapshot(frame.frame),
  }
}

export function cloneGridParameterRange(
  range: GridParameterRange,
): GridParameterRange {
  return {
    min: cloneScalarInputValue(range.min),
    max: cloneScalarInputValue(range.max),
    step: cloneScalarInputValue(range.step),
  }
}

export function cloneGridRectangleClip(
  clip: GridRectangleClip,
): GridRectangleClip {
  return {
    kind: 'rectangle',
    uMin: cloneScalarInputValue(clip.uMin),
    uMax: cloneScalarInputValue(clip.uMax),
    vMin: cloneScalarInputValue(clip.vMin),
    vMax: cloneScalarInputValue(clip.vMax),
  }
}

export function xyGridFrame(): GridFrame {
  return {
    kind: 'xy',
    frame: {
      origin: { x: 0, y: 0, z: 0 },
      u: { x: 1, y: 0, z: 0 },
      v: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
    },
  }
}

export function workPlaneGridFrame(frame: WorkPlaneFrameSnapshot): GridFrame {
  return {
    kind: 'workPlane',
    frame: cloneWorkPlaneFrameSnapshot(frame),
  }
}

export function scalarInputPreviewValue(value: ScalarInputValue): number {
  return value.kind === 'numeric' ? value.value : value.previewValue
}

export function defaultGridParameterRange(): GridParameterRange {
  return {
    min: createNumericScalarInputValue(-2),
    max: createNumericScalarInputValue(2),
    step: createNumericScalarInputValue(1),
  }
}

export function defaultGridRectangleClip(): GridRectangleClip {
  return {
    kind: 'rectangle',
    uMin: createNumericScalarInputValue(-2),
    uMax: createNumericScalarInputValue(2),
    vMin: createNumericScalarInputValue(-2),
    vMax: createNumericScalarInputValue(2),
  }
}

export function validateGridPreview(
  grid: GridStratum,
  ambientDimension: AmbientDimension,
  path = 'grid',
  maxLineCount = maxGridPreviewLines,
): GridValidationIssue[] {
  const errors: GridValidationIssue[] = []

  validateGridFrame(grid.frame, ambientDimension, `${path}.frame`, errors)
  const pattern = readGridLatticePattern(grid, path, errors)

  const uRange = readRangeValues(grid.uRange, `${path}.uRange`, errors)
  const vRange = readRangeValues(grid.vRange, `${path}.vRange`, errors)
  const clip = readClipValues(grid.clip, `${path}.clip`, errors)

  if (
    pattern === null ||
    uRange === null ||
    vRange === null ||
    clip === null
  ) {
    return errors
  }

  const lineCount = gridPreviewLineCountForPattern(
    pattern,
    uRange,
    vRange,
    clip,
    path,
    errors,
    maxLineCount,
  )

  if (lineCount !== null && lineCount > maxLineCount) {
    errors.push({
      path,
      message: `Grid preview would create ${lineCount} lines, exceeding the ${maxLineCount} line cap.`,
    })
  }

  return errors
}

export function gridPreviewSegments(
  grid: GridStratum,
  ambientDimension: AmbientDimension,
  maxLineCount = maxGridPreviewLines,
): GridPreviewResult {
  const errors = validateGridPreview(
    grid,
    ambientDimension,
    'grid',
    maxLineCount,
  )

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    }
  }

  const uRange = scalarRangeValues(grid.uRange)
  const vRange = scalarRangeValues(grid.vRange)
  const clip = clipValues(grid.clip)
  const localSegments = localGridSegmentsForPattern(
    gridLatticePattern(grid),
    uRange,
    vRange,
    clip,
  )
  const segments = localSegments.map((segment) =>
    workPlaneSegmentFromLocalSegment(grid.frame.frame, segment),
  )
  const nonFiniteSegmentIndex = segments.findIndex(
    (segment) => !isFiniteVec3(segment.start) || !isFiniteVec3(segment.end),
  )

  if (nonFiniteSegmentIndex !== -1) {
    return {
      ok: false,
      errors: [
        {
          path: `grid.segments[${nonFiniteSegmentIndex}]`,
          message: 'Grid preview generated a non-finite line segment.',
        },
      ],
    }
  }

  return {
    ok: true,
    segments,
    lineCount: segments.length,
  }
}

function readGridLatticePattern(
  grid: GridStratum,
  path: string,
  errors: GridValidationIssue[],
): LatticePattern | null {
  const latticePattern = (grid as { latticePattern?: unknown }).latticePattern

  if (latticePattern === undefined) {
    return defaultLatticePattern
  }

  if (!isLatticePattern(latticePattern)) {
    errors.push({
      path: `${path}.latticePattern`,
      message: 'Grid lattice pattern must be rectangular, triangular, or honeycomb.',
    })
    return null
  }

  return latticePattern
}

function validateGridFrame(
  gridFrame: GridFrame,
  ambientDimension: AmbientDimension,
  path: string,
  errors: GridValidationIssue[],
): void {
  if (gridFrame.kind !== 'xy' && gridFrame.kind !== 'workPlane') {
    errors.push({
      path: `${path}.kind`,
      message: 'Grid frame kind must be xy or workPlane.',
    })
    return
  }

  if (!isValidWorkPlaneFrameSnapshot(gridFrame.frame)) {
    errors.push({
      path: `${path}.frame`,
      message: 'Grid frame must be an orthonormal right-handed frame.',
    })
    return
  }

  if (ambientDimension === 2) {
    if (gridFrame.kind !== 'xy' || !isCanonicalXyFrame(gridFrame.frame)) {
      errors.push({
        path,
        message: '2D grids must use the xy frame at z = 0.',
      })
    }
    return
  }

  if (gridFrame.kind !== 'workPlane') {
    errors.push({
      path: `${path}.kind`,
      message: '3D grids must store an active work-plane frame snapshot.',
    })
  }
}

function readRangeValues(
  range: GridParameterRange,
  path: string,
  errors: GridValidationIssue[],
): ScalarRangeValues | null {
  const values = scalarRangeValues(range)

  validateFinite(values.min, `${path}.min`, errors)
  validateFinite(values.max, `${path}.max`, errors)
  validateFinite(values.step, `${path}.step`, errors)

  if (values.step <= 0) {
    errors.push({
      path: `${path}.step`,
      message: 'Grid range step must be positive.',
    })
  }

  if (values.max < values.min) {
    errors.push({
      path,
      message: 'Grid range max must be greater than or equal to min.',
    })
  }

  return errors.some((error) => error.path === path || error.path.startsWith(`${path}.`))
    ? null
    : values
}

function readClipValues(
  clip: GridRectangleClip,
  path: string,
  errors: GridValidationIssue[],
): ClipValues | null {
  const values = clipValues(clip)

  if (clip.kind !== 'rectangle') {
    errors.push({
      path: `${path}.kind`,
      message: 'Grid clip kind must be rectangle.',
    })
  }

  validateFinite(values.uMin, `${path}.uMin`, errors)
  validateFinite(values.uMax, `${path}.uMax`, errors)
  validateFinite(values.vMin, `${path}.vMin`, errors)
  validateFinite(values.vMax, `${path}.vMax`, errors)

  if (values.uMax < values.uMin) {
    errors.push({
      path: `${path}.uMax`,
      message: 'Grid clip u max must be greater than or equal to u min.',
    })
  }

  if (values.vMax < values.vMin) {
    errors.push({
      path: `${path}.vMax`,
      message: 'Grid clip v max must be greater than or equal to v min.',
    })
  }

  return errors.some((error) => error.path === path || error.path.startsWith(`${path}.`))
    ? null
    : values
}

function scalarRangeValues(range: GridParameterRange): ScalarRangeValues {
  return {
    min: scalarInputPreviewValue(range.min),
    max: scalarInputPreviewValue(range.max),
    step: scalarInputPreviewValue(range.step),
  }
}

function clipValues(clip: GridRectangleClip): ClipValues {
  return {
    uMin: scalarInputPreviewValue(clip.uMin),
    uMax: scalarInputPreviewValue(clip.uMax),
    vMin: scalarInputPreviewValue(clip.vMin),
    vMax: scalarInputPreviewValue(clip.vMax),
  }
}

function parameterSequenceForRange(
  range: ScalarRangeValues,
  clipMin: number,
  clipMax: number,
  path: string,
  errors: GridValidationIssue[],
): ParameterSequence | null {
  const sequence = parameterSequenceForRangeUnchecked(range, clipMin, clipMax)

  if (sequence.count < 0 || !Number.isSafeInteger(sequence.count)) {
    errors.push({
      path,
      message: 'Grid line count must be a finite safe integer.',
    })
    return null
  }

  return sequence
}

function parameterSequenceForRangeUnchecked(
  range: ScalarRangeValues,
  clipMin: number,
  clipMax: number,
): ParameterSequence {
  const lower = Math.max(range.min, clipMin)
  const upper = Math.min(range.max, clipMax)

  if (upper < lower - gridEpsilon) {
    return {
      firstIndex: 0,
      count: 0,
    }
  }

  const firstIndex = Math.max(
    0,
    Math.ceil((lower - range.min) / range.step - gridEpsilon),
  )
  const lastIndex = Math.floor(
    (upper - range.min) / range.step + gridEpsilon,
  )

  if (lastIndex < firstIndex) {
    return {
      firstIndex: 0,
      count: 0,
    }
  }

  return {
    firstIndex,
    count: lastIndex - firstIndex + 1,
  }
}

function parameterValues(
  range: ScalarRangeValues,
  sequence: ParameterSequence,
): number[] {
  return Array.from({ length: sequence.count }, (_, offset) =>
    normalizeNearZero(range.min + (sequence.firstIndex + offset) * range.step),
  )
}

function validateFinite(
  value: number,
  path: string,
  errors: GridValidationIssue[],
): void {
  if (!Number.isFinite(value)) {
    errors.push({
      path,
      message: 'Grid scalar preview value must be finite.',
    })
  }
}

function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}

function gridPreviewLineCountForPattern(
  pattern: LatticePattern,
  uRange: ScalarRangeValues,
  vRange: ScalarRangeValues,
  clip: ClipValues,
  path: string,
  errors: GridValidationIssue[],
  maxLineCount: number,
): number | null {
  switch (pattern) {
    case 'rectangular':
      return rectangularGridPreviewLineCount(uRange, vRange, clip, path, errors)
    case 'triangular':
      return triangularGridPreviewLineCount(uRange, vRange, clip)
    case 'honeycomb': {
      const result = honeycombLocalSegments(
        uRange,
        vRange,
        clip,
        maxLineCount + 1,
      )

      return result.truncated ? maxLineCount + 1 : result.segments.length
    }
  }
}

function rectangularGridPreviewLineCount(
  uRange: ScalarRangeValues,
  vRange: ScalarRangeValues,
  clip: ClipValues,
  path: string,
  errors: GridValidationIssue[],
): number | null {
  const uSequence = parameterSequenceForRange(
    uRange,
    clip.uMin,
    clip.uMax,
    `${path}.uRange`,
    errors,
  )
  const vSequence = parameterSequenceForRange(
    vRange,
    clip.vMin,
    clip.vMax,
    `${path}.vRange`,
    errors,
  )

  return uSequence === null || vSequence === null
    ? null
    : uSequence.count + vSequence.count
}

function triangularGridPreviewLineCount(
  uRange: ScalarRangeValues,
  vRange: ScalarRangeValues,
  clip: ClipValues,
): number {
  const domain = clippedRangeDomain(uRange, vRange, clip)

  if (domain === null) {
    return 0
  }

  const spacing = uRange.step
  const verticalSpacing = (sqrtThree / 2) * spacing
  const horizontalCount = parameterCountFromBounds(
    vRange.min,
    verticalSpacing,
    domain.vMin,
    domain.vMax,
  )
  const positiveDiagonalCount = parameterCountFromBounds(
    uRange.min,
    spacing,
    minCornerValue(domain, (corner) => corner.u - corner.v / sqrtThree),
    maxCornerValue(domain, (corner) => corner.u - corner.v / sqrtThree),
  )
  const negativeDiagonalCount = parameterCountFromBounds(
    uRange.min,
    spacing,
    minCornerValue(domain, (corner) => corner.u + corner.v / sqrtThree),
    maxCornerValue(domain, (corner) => corner.u + corner.v / sqrtThree),
  )

  return horizontalCount + positiveDiagonalCount + negativeDiagonalCount
}

function localGridSegmentsForPattern(
  pattern: LatticePattern,
  uRange: ScalarRangeValues,
  vRange: ScalarRangeValues,
  clip: ClipValues,
): LocalSegment[] {
  switch (pattern) {
    case 'rectangular':
      return rectangularLocalSegments(uRange, vRange, clip)
    case 'triangular':
      return triangularLocalSegments(uRange, vRange, clip)
    case 'honeycomb':
      return honeycombLocalSegments(uRange, vRange, clip).segments
  }
}

function rectangularLocalSegments(
  uRange: ScalarRangeValues,
  vRange: ScalarRangeValues,
  clip: ClipValues,
): LocalSegment[] {
  const uSequence = parameterSequenceForRangeUnchecked(
    uRange,
    clip.uMin,
    clip.uMax,
  )
  const vSequence = parameterSequenceForRangeUnchecked(
    vRange,
    clip.vMin,
    clip.vMax,
  )

  return [
    ...parameterValues(uRange, uSequence).map((u) => ({
      start: { u, v: clip.vMin },
      end: { u, v: clip.vMax },
    })),
    ...parameterValues(vRange, vSequence).map((v) => ({
      start: { u: clip.uMin, v },
      end: { u: clip.uMax, v },
    })),
  ]
}

function triangularLocalSegments(
  uRange: ScalarRangeValues,
  vRange: ScalarRangeValues,
  clip: ClipValues,
): LocalSegment[] {
  const domain = clippedRangeDomain(uRange, vRange, clip)

  if (domain === null) {
    return []
  }

  const spacing = uRange.step
  const verticalSpacing = (sqrtThree / 2) * spacing
  const paddedUMin = domain.uMin - diagonalLinePadding(domain, spacing)
  const paddedUMax = domain.uMax + diagonalLinePadding(domain, spacing)
  const segments: LocalSegment[] = []

  parameterValuesFromBounds(vRange.min, verticalSpacing, domain.vMin, domain.vMax)
    .map((v) => ({
      start: { u: domain.uMin, v },
      end: { u: domain.uMax, v },
    }))
    .forEach((segment) => pushClippedLocalSegment(segments, segment, domain))

  parameterValuesFromBounds(
    uRange.min,
    spacing,
    minCornerValue(domain, (corner) => corner.u - corner.v / sqrtThree),
    maxCornerValue(domain, (corner) => corner.u - corner.v / sqrtThree),
  )
    .map((intercept) => ({
      start: {
        u: paddedUMin,
        v: sqrtThree * (paddedUMin - intercept),
      },
      end: {
        u: paddedUMax,
        v: sqrtThree * (paddedUMax - intercept),
      },
    }))
    .forEach((segment) => pushClippedLocalSegment(segments, segment, domain))

  parameterValuesFromBounds(
    uRange.min,
    spacing,
    minCornerValue(domain, (corner) => corner.u + corner.v / sqrtThree),
    maxCornerValue(domain, (corner) => corner.u + corner.v / sqrtThree),
  )
    .map((intercept) => ({
      start: {
        u: paddedUMin,
        v: -sqrtThree * (paddedUMin - intercept),
      },
      end: {
        u: paddedUMax,
        v: -sqrtThree * (paddedUMax - intercept),
      },
    }))
    .forEach((segment) => pushClippedLocalSegment(segments, segment, domain))

  return segments
}

function honeycombLocalSegments(
  uRange: ScalarRangeValues,
  vRange: ScalarRangeValues,
  clip: ClipValues,
  maxSegmentCount = Number.POSITIVE_INFINITY,
): { segments: LocalSegment[]; truncated: boolean } {
  const domain = clippedRangeDomain(uRange, vRange, clip)

  if (domain === null) {
    return { segments: [], truncated: false }
  }

  const edgeLength = uRange.step
  const centerColumnStep = 1.5 * edgeLength
  const centerRowStep = sqrtThree * edgeLength
  const iFirst = Math.floor((domain.uMin - edgeLength - uRange.min) / centerColumnStep)
  const iLast = Math.ceil((domain.uMax + edgeLength - uRange.min) / centerColumnStep)
  const columnCount = iLast - iFirst + 1
  const roughRowCount = Math.ceil(
    (domain.vMax - domain.vMin + 2 * centerRowStep) / centerRowStep,
  )

  if (
    columnCount > 0 &&
    roughRowCount > 0 &&
    columnCount * roughRowCount * 3 > maxSegmentCount
  ) {
    return { segments: [], truncated: true }
  }

  const edges = new Map<string, LocalSegment>()

  for (let i = iFirst; i <= iLast; i += 1) {
    const centerU = uRange.min + i * centerColumnStep
    const rowOffset = isOddInteger(i) ? centerRowStep / 2 : 0
    const jFirst = Math.floor(
      (domain.vMin - centerRowStep - vRange.min - rowOffset) / centerRowStep,
    )
    const jLast = Math.ceil(
      (domain.vMax + centerRowStep - vRange.min - rowOffset) / centerRowStep,
    )

    for (let j = jFirst; j <= jLast; j += 1) {
      const centerV = vRange.min + rowOffset + j * centerRowStep
      const vertices = honeycombHexagonVertices(centerU, centerV, edgeLength)

      for (let vertexIndex = 0; vertexIndex < vertices.length; vertexIndex += 1) {
        const edge = {
          start: vertices[vertexIndex],
          end: vertices[(vertexIndex + 1) % vertices.length],
        }
        const key = localSegmentKey(edge)

        if (!edges.has(key)) {
          edges.set(key, edge)
        }
      }
    }
  }

  const segments: LocalSegment[] = []

  for (const edge of edges.values()) {
    pushClippedLocalSegment(segments, edge, domain)

    if (segments.length > maxSegmentCount) {
      return { segments: [], truncated: true }
    }
  }

  return { segments, truncated: false }
}

function clippedRangeDomain(
  uRange: ScalarRangeValues,
  vRange: ScalarRangeValues,
  clip: ClipValues,
): ClipValues | null {
  const domain = {
    uMin: Math.max(uRange.min, clip.uMin),
    uMax: Math.min(uRange.max, clip.uMax),
    vMin: Math.max(vRange.min, clip.vMin),
    vMax: Math.min(vRange.max, clip.vMax),
  }

  return domain.uMax < domain.uMin - gridEpsilon ||
    domain.vMax < domain.vMin - gridEpsilon
    ? null
    : domain
}

function diagonalLinePadding(domain: ClipValues, spacing: number): number {
  return Math.max(
    spacing,
    domain.uMax - domain.uMin,
    domain.vMax - domain.vMin,
  )
}

function parameterValuesFromBounds(
  base: number,
  step: number,
  lower: number,
  upper: number,
): number[] {
  const count = parameterCountFromBounds(base, step, lower, upper)

  if (count <= 0 || !Number.isSafeInteger(count)) {
    return []
  }

  const firstIndex = Math.ceil((lower - base) / step - gridEpsilon)

  return Array.from({ length: count }, (_, offset) =>
    normalizeNearZero(base + (firstIndex + offset) * step),
  )
}

function parameterCountFromBounds(
  base: number,
  step: number,
  lower: number,
  upper: number,
): number {
  if (upper < lower - gridEpsilon) {
    return 0
  }

  const firstIndex = Math.ceil((lower - base) / step - gridEpsilon)
  const lastIndex = Math.floor((upper - base) / step + gridEpsilon)

  if (lastIndex < firstIndex) {
    return 0
  }

  return lastIndex - firstIndex + 1
}

function pushClippedLocalSegment(
  segments: LocalSegment[],
  segment: LocalSegment,
  domain: ClipValues,
): void {
  const clipped = clipLocalSegmentToRectangle(segment, domain)

  if (clipped !== null) {
    segments.push(clipped)
  }
}

function clipLocalSegmentToRectangle(
  segment: LocalSegment,
  domain: ClipValues,
): LocalSegment | null {
  const dx = segment.end.u - segment.start.u
  const dy = segment.end.v - segment.start.v
  let t0 = 0
  let t1 = 1

  const checks = [
    { p: -dx, q: segment.start.u - domain.uMin },
    { p: dx, q: domain.uMax - segment.start.u },
    { p: -dy, q: segment.start.v - domain.vMin },
    { p: dy, q: domain.vMax - segment.start.v },
  ]

  for (const { p, q } of checks) {
    if (Math.abs(p) <= gridEpsilon) {
      if (q < -gridEpsilon) {
        return null
      }
      continue
    }

    const r = q / p

    if (p < 0) {
      t0 = Math.max(t0, r)
    } else {
      t1 = Math.min(t1, r)
    }

    if (t0 > t1 + gridEpsilon) {
      return null
    }
  }

  const start = {
    u: normalizeNearZero(segment.start.u + t0 * dx),
    v: normalizeNearZero(segment.start.v + t0 * dy),
  }
  const end = {
    u: normalizeNearZero(segment.start.u + t1 * dx),
    v: normalizeNearZero(segment.start.v + t1 * dy),
  }

  return Math.abs(start.u - end.u) <= gridEpsilon &&
    Math.abs(start.v - end.v) <= gridEpsilon
    ? null
    : { start, end }
}

function honeycombHexagonVertices(
  centerU: number,
  centerV: number,
  edgeLength: number,
): LocalPoint[] {
  const halfHeight = (sqrtThree / 2) * edgeLength

  return [
    { u: centerU + edgeLength, v: centerV },
    { u: centerU + edgeLength / 2, v: centerV + halfHeight },
    { u: centerU - edgeLength / 2, v: centerV + halfHeight },
    { u: centerU - edgeLength, v: centerV },
    { u: centerU - edgeLength / 2, v: centerV - halfHeight },
    { u: centerU + edgeLength / 2, v: centerV - halfHeight },
  ]
}

function minCornerValue(
  domain: ClipValues,
  value: (corner: LocalPoint) => number,
): number {
  return Math.min(...rectangleCorners(domain).map(value))
}

function maxCornerValue(
  domain: ClipValues,
  value: (corner: LocalPoint) => number,
): number {
  return Math.max(...rectangleCorners(domain).map(value))
}

function rectangleCorners(domain: ClipValues): LocalPoint[] {
  return [
    { u: domain.uMin, v: domain.vMin },
    { u: domain.uMin, v: domain.vMax },
    { u: domain.uMax, v: domain.vMin },
    { u: domain.uMax, v: domain.vMax },
  ]
}

function localSegmentKey(segment: LocalSegment): string {
  const start = localPointKey(segment.start)
  const end = localPointKey(segment.end)

  return start < end ? `${start}|${end}` : `${end}|${start}`
}

function localPointKey(point: LocalPoint): string {
  const scale = 1 / gridEpsilon

  return `${Math.round(point.u * scale)},${Math.round(point.v * scale)}`
}

function isOddInteger(value: number): boolean {
  return Math.abs(value % 2) === 1
}

function workPlaneSegmentFromLocalSegment(
  frame: WorkPlaneFrameSnapshot,
  segment: LocalSegment,
): GridPreviewSegment {
  return {
    start: pointFromWorkPlaneLocalCoordinate(frame, {
      a: segment.start.u,
      b: segment.start.v,
    }),
    end: pointFromWorkPlaneLocalCoordinate(frame, {
      a: segment.end.u,
      b: segment.end.v,
    }),
  }
}

function isCanonicalXyFrame(frame: WorkPlaneFrameSnapshot): boolean {
  const canonical = xyGridFrame().frame

  return (
    Math.abs(frame.origin.z) <= gridEpsilon &&
    vec3ApproximatelyEqual(frame.u, canonical.u) &&
    vec3ApproximatelyEqual(frame.v, canonical.v) &&
    vec3ApproximatelyEqual(frame.normal, canonical.normal)
  )
}

function vec3ApproximatelyEqual(first: Vec3, second: Vec3): boolean {
  return (
    Math.abs(first.x - second.x) <= gridEpsilon &&
    Math.abs(first.y - second.y) <= gridEpsilon &&
    Math.abs(first.z - second.z) <= gridEpsilon
  )
}

function cloneWorkPlaneFrameSnapshot(
  frame: WorkPlaneFrameSnapshot,
): WorkPlaneFrameSnapshot {
  return {
    origin: { ...frame.origin },
    u: { ...frame.u },
    v: { ...frame.v },
    normal: { ...frame.normal },
  }
}

function normalizeNearZero(value: number): number {
  return Math.abs(value) <= gridEpsilon ? 0 : value
}
