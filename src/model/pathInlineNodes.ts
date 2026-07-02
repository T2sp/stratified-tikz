import type {
  AmbientDimension,
  CurveStratum,
  PathInlineNode,
  PathInlineNodeMarker,
  PathInlineNodePlacement,
  PathInlineNodePosition,
  Vec3,
} from './types.ts'
import {
  pathInlineNodeMarkers,
  pathInlineNodePlacements,
} from './types.ts'
import {
  pathSegmentPointAt,
  sampleTemplatePathPoints,
} from './paths.ts'

export const defaultPathInlineNodePosition = 0.5

export type PathInlineNodeEditableCurve = Exclude<
  CurveStratum,
  Extract<CurveStratum, { kind: 'grid' }>
>

export function isPathInlineNodeEditableCurve(
  curve: CurveStratum,
): curve is PathInlineNodeEditableCurve {
  return curve.kind !== 'grid'
}

export function curveInlineNodeSegmentCount(curve: CurveStratum): number {
  switch (curve.kind) {
    case 'polyline':
      return Math.max(0, curve.points.length - 1)
    case 'cubicBezier':
      return curve.points.length === 4 ? 1 : 0
    case 'concatenatedPath':
      return curve.segments.length
    case 'templatePath':
      return 1
    case 'grid':
      return 0
  }
}

export function isValidPathInlineNodePositionValue(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value < 1
  )
}

export function isPathInlineNodePlacement(
  value: unknown,
): value is PathInlineNodePlacement {
  return isOneOfStringValues(pathInlineNodePlacements, value)
}

export function isPathInlineNodeMarker(
  value: unknown,
): value is PathInlineNodeMarker {
  return isOneOfStringValues(pathInlineNodeMarkers, value)
}

export function createDefaultPathInlineNode(
  id: string,
  segmentIndex = 0,
): PathInlineNode {
  return {
    id,
    position: {
      kind: 'segment',
      segmentIndex,
      value: defaultPathInlineNodePosition,
    },
    text: '',
    options: {
      placement: 'above',
      marker: 'none',
    },
  }
}

export function clonePathInlineNode(node: PathInlineNode): PathInlineNode {
  return {
    id: node.id,
    position: clonePathInlineNodePosition(node.position),
    text: node.text,
    options: {
      ...(node.options.placement === undefined
        ? {}
        : { placement: node.options.placement }),
      ...(node.options.sloped === undefined
        ? {}
        : { sloped: node.options.sloped }),
      ...(node.options.allowUpsideDown === undefined
        ? {}
        : { allowUpsideDown: node.options.allowUpsideDown }),
      ...(node.options.anchor === undefined
        ? {}
        : { anchor: node.options.anchor }),
      ...(node.options.marker === undefined
        ? {}
        : { marker: node.options.marker }),
    },
  }
}

export function clonePathInlineNodes(
  nodes: readonly PathInlineNode[] | undefined,
): PathInlineNode[] | undefined {
  return nodes === undefined ? undefined : nodes.map(clonePathInlineNode)
}

export function pathInlineNodePoint(
  curve: CurveStratum,
  node: PathInlineNode,
  ambientDimension: AmbientDimension,
): Vec3 | null {
  const position = node.position

  if (!isSegmentPathInlineNodePosition(position, curve)) {
    return null
  }

  switch (curve.kind) {
    case 'polyline': {
      const start = curve.points[position.segmentIndex]
      const end = curve.points[position.segmentIndex + 1]

      return start === undefined || end === undefined
        ? null
        : pathSegmentPointAt(
            {
              kind: 'line',
              start,
              end,
            },
            position.value,
            ambientDimension,
          )
    }
    case 'cubicBezier': {
      if (curve.points.length !== 4) {
        return null
      }
      const start = curve.points[0]
      const control1 = curve.points[1]
      const control2 = curve.points[2]
      const end = curve.points[3]

      if (
        start === undefined ||
        control1 === undefined ||
        control2 === undefined ||
        end === undefined
      ) {
        return null
      }

      return pathSegmentPointAt(
        {
          kind: 'cubicBezier',
          start,
          control1,
          control2,
          end,
        },
        position.value,
        ambientDimension,
      )
    }
    case 'concatenatedPath': {
      const segment = curve.segments[position.segmentIndex]

      return segment === undefined
        ? null
        : pathSegmentPointAt(segment, position.value, ambientDimension)
    }
    case 'templatePath':
      return templatePathPointAt(curve, ambientDimension, position.value)
    case 'grid':
      return null
  }
}

function isSegmentPathInlineNodePosition(
  position: PathInlineNodePosition,
  curve: CurveStratum,
): boolean {
  return (
    position.kind === 'segment' &&
    Number.isInteger(position.segmentIndex) &&
    position.segmentIndex >= 0 &&
    position.segmentIndex < curveInlineNodeSegmentCount(curve) &&
    isValidPathInlineNodePositionValue(position.value)
  )
}

function templatePathPointAt(
  curve: Extract<CurveStratum, { kind: 'templatePath' }>,
  ambientDimension: AmbientDimension,
  value: number,
): Vec3 | null {
  if (!isValidPathInlineNodePositionValue(value)) {
    return null
  }

  const sampleCount = 128
  const samples = sampleTemplatePathPoints(
    curve.template,
    ambientDimension,
    sampleCount,
    { maxSamples: sampleCount },
  )
  const scaled = value * sampleCount
  const leftIndex = Math.floor(scaled)
  const rightIndex = Math.min(sampleCount, leftIndex + 1)
  const local = scaled - leftIndex
  const left = samples[leftIndex]
  const right = samples[rightIndex]

  if (left === undefined || right === undefined) {
    return null
  }

  return {
    x: left.x + (right.x - left.x) * local,
    y: left.y + (right.y - left.y) * local,
    z: left.z + (right.z - left.z) * local,
  }
}

function clonePathInlineNodePosition(
  position: PathInlineNodePosition,
): PathInlineNodePosition {
  return {
    kind: 'segment',
    segmentIndex: position.segmentIndex,
    value: position.value,
  }
}

function isOneOfStringValues<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === 'string' &&
    (values as readonly string[]).includes(value)
  )
}
