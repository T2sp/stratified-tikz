import {
  isValidWorkPlaneFrameSnapshot,
  pointFromWorkPlaneLocalCoordinate,
} from '../geometry/bezierControls.ts'
import type { ScalarInputValue } from './scalarExpressions.ts'
import type {
  AmbientDimension,
  GridFrame,
  GridParameterRange,
  GridRectangleClip,
  GridStratum,
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

type ParameterSequence = {
  firstIndex: number
  count: number
}

export const maxGridPreviewLines = 500

const gridEpsilon = 1e-9

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

  const uRange = readRangeValues(grid.uRange, `${path}.uRange`, errors)
  const vRange = readRangeValues(grid.vRange, `${path}.vRange`, errors)
  const clip = readClipValues(grid.clip, `${path}.clip`, errors)

  if (uRange === null || vRange === null || clip === null) {
    return errors
  }

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

  if (uSequence === null || vSequence === null) {
    return errors
  }

  const lineCount = uSequence.count + vSequence.count

  if (lineCount > maxLineCount) {
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
  const segments = [
    ...parameterValues(uRange, uSequence).map((u) => ({
      start: pointFromWorkPlaneLocalCoordinate(grid.frame.frame, {
        a: u,
        b: clip.vMin,
      }),
      end: pointFromWorkPlaneLocalCoordinate(grid.frame.frame, {
        a: u,
        b: clip.vMax,
      }),
    })),
    ...parameterValues(vRange, vSequence).map((v) => ({
      start: pointFromWorkPlaneLocalCoordinate(grid.frame.frame, {
        a: clip.uMin,
        b: v,
      }),
      end: pointFromWorkPlaneLocalCoordinate(grid.frame.frame, {
        a: clip.uMax,
        b: v,
      }),
    })),
  ]
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
