import {
  coordinateAnchorPositionToVec3,
  symbolicVec3FromVec3,
} from './coordinateAnchors.ts'
import { numericCoordinateComponent } from './symbolicCoordinates.ts'
import {
  diagramTranslationContext,
  isZeroTranslationVector,
  normalizeTranslationVectorForDiagram,
  translateVec3,
  translationVectorFromNumericVec3,
  type DiagramTranslationContext,
  type TranslationVector,
} from './translation.ts'
import { evaluateWorkPlaneLocalCoordinate } from './workPlaneLocalCoordinates.ts'
import type {
  CoordinateAnchor,
  CoordinateAnchorPosition,
  CoordinateComponent,
  CoordinateSource,
  Diagram,
  DiagramValidationIssue,
  SymbolicVec3,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinateSource,
} from './types.ts'

export type CoordinateAnchorTranslationDelta = Vec3 | TranslationVector

export type TranslateCoordinateAnchorsResult =
  | {
      ok: true
      value: {
        diagram: Diagram
        translatedCount: number
        detachedCoordinateReferenceCount: number
      }
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachContext = {
  previewResolver: CoordinateAnchorPreviewResolver
  translationContext: DiagramTranslationContext
}

type CoordinateAnchorIndexEntry = {
  anchor: CoordinateAnchor
  index: number
}

type DetachPositionResult =
  | {
      ok: true
      position: CoordinateAnchorPosition
      detachedCount: number
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachPointResult =
  | {
      ok: true
      point: Vec3
      detachedCount: number
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type DetachFrameResult =
  | {
      ok: true
      frame: WorkPlaneFrameSnapshot
      detachedCount: number
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type TranslatePositionResult =
  | {
      ok: true
      position: CoordinateAnchorPosition
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type PreviewResult =
  | {
      ok: true
      point: Vec3
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

type PreviewFrameResult =
  | {
      ok: true
      frame: WorkPlaneFrameSnapshot
    }
  | {
      ok: false
      error: DiagramValidationIssue
    }

const frameFields = ['origin', 'u', 'v', 'normal'] as const
const previewValueEpsilon = 1e-9

export function translateCoordinateAnchors(
  diagram: Diagram,
  coordinateIds: readonly string[],
  delta: CoordinateAnchorTranslationDelta,
): TranslateCoordinateAnchorsResult {
  const uniqueIds = [...new Set(coordinateIds)]
  const anchors = diagram.coordinateAnchors ?? []
  const anchorIndexById = coordinateAnchorIndexById(anchors)
  const selectedAnchorIds = new Set<string>()

  for (const id of uniqueIds) {
    const entry = anchorIndexById.get(id)

    if (entry === undefined) {
      return failure(
        'coordinateAnchors',
        `Coordinate anchor "${id}" does not exist.`,
      )
    }

    selectedAnchorIds.add(id)
  }

  const translation = normalizeCoordinateAnchorTranslation(diagram, delta)

  if (!translation.ok) {
    return translation
  }

  if (uniqueIds.length === 0 || isZeroTranslationVector(translation.vector)) {
    return {
      ok: true,
      value: {
        diagram,
        translatedCount: 0,
        detachedCoordinateReferenceCount: 0,
      },
    }
  }

  let translationContext: DiagramTranslationContext
  try {
    translationContext = diagramTranslationContext(diagram)
  } catch (error) {
    return failure(
      'variables',
      errorMessage(error, 'Symbolic variables could not be resolved.'),
    )
  }

  const detachContext: DetachContext = {
    previewResolver: new CoordinateAnchorPreviewResolver(
      anchorIndexById,
      translationContext,
    ),
    translationContext,
  }
  let detachedCount = 0
  const translatedAnchors: CoordinateAnchor[] = []

  for (const [index, anchor] of anchors.entries()) {
    if (!selectedAnchorIds.has(anchor.id)) {
      translatedAnchors.push(anchor)
      continue
    }

    const path = `coordinateAnchors[${index}].position`
    const detached = detachCoordinateAnchorPositionInternalRefs(
      anchor.position,
      detachContext,
      path,
    )

    if (!detached.ok) {
      return detached
    }

    const translated = translateCoordinateAnchorPosition(
      detached.position,
      translation.vector,
      translationContext,
      path,
    )

    if (!translated.ok) {
      return translated
    }

    const remainingRef = firstCoordinateRefInPosition(translated.position, path)

    if (remainingRef !== null) {
      return failure(
        remainingRef,
        'Translated coordinate anchor position still contains a coordinateRef source.',
      )
    }

    detachedCount += detached.detachedCount
    translatedAnchors.push({
      ...anchor,
      position: translated.position,
    })
  }

  return {
    ok: true,
    value: {
      diagram: {
        ...diagram,
        coordinateAnchors: translatedAnchors,
      },
      translatedCount: uniqueIds.length,
      detachedCoordinateReferenceCount: detachedCount,
    },
  }
}

function normalizeCoordinateAnchorTranslation(
  diagram: Diagram,
  delta: CoordinateAnchorTranslationDelta,
):
  | {
      ok: true
      vector: TranslationVector
    }
  | {
      ok: false
      error: DiagramValidationIssue
    } {
  try {
    return {
      ok: true,
      vector: isTranslationVector(delta)
        ? normalizeTranslationVectorForDiagram(
            diagram,
            delta,
            { reject2DNonZeroZ: true },
          )
        : translationVectorFromNumericVec3(
            diagram,
            delta,
            { reject2DNonZeroZ: true },
          ),
    }
  } catch (error) {
    return failure(
      'delta',
      errorMessage(error, 'Coordinate anchor translation delta is invalid.'),
    )
  }
}

function coordinateAnchorIndexById(
  anchors: readonly CoordinateAnchor[],
): ReadonlyMap<string, CoordinateAnchorIndexEntry> {
  const anchorIndexById = new Map<string, CoordinateAnchorIndexEntry>()

  anchors.forEach((anchor, index) => {
    if (!anchorIndexById.has(anchor.id)) {
      anchorIndexById.set(anchor.id, { anchor, index })
    }
  })

  return anchorIndexById
}

class CoordinateAnchorPreviewResolver {
  private readonly anchorIndexById: ReadonlyMap<string, CoordinateAnchorIndexEntry>
  private readonly context: DiagramTranslationContext
  private readonly previewById = new Map<string, Vec3>()
  private readonly resolvingIds = new Set<string>()

  constructor(
    anchorIndexById: ReadonlyMap<string, CoordinateAnchorIndexEntry>,
    context: DiagramTranslationContext,
  ) {
    this.anchorIndexById = anchorIndexById
    this.context = context
  }

  previewForCoordinateRef(
    coordinateId: string,
    path: string,
  ): PreviewResult {
    const cached = this.previewById.get(coordinateId)

    if (cached !== undefined) {
      return {
        ok: true,
        point: cloneConcreteVec3(cached),
      }
    }

    if (this.resolvingIds.has(coordinateId)) {
      return failure(
        path,
        `Could not resolve coordinate reference "${coordinateId}" because coordinate anchors contain a cycle.`,
      )
    }

    const entry = this.anchorIndexById.get(coordinateId)

    if (entry === undefined) {
      return failure(
        path,
        `Could not detach coordinate reference "${coordinateId}" because its coordinate anchor does not exist.`,
      )
    }

    this.resolvingIds.add(coordinateId)
    const preview = this.previewForAnchor(
      entry.anchor,
      `coordinateAnchors[${entry.index}].position`,
    )
    this.resolvingIds.delete(coordinateId)

    if (!preview.ok) {
      return preview
    }

    if (!isFiniteVec3(preview.point)) {
      return failure(
        path,
        `Could not detach coordinate reference "${coordinateId}" because its coordinate anchor is not finite.`,
      )
    }

    this.previewById.set(coordinateId, cloneConcreteVec3(preview.point))

    return {
      ok: true,
      point: cloneConcreteVec3(preview.point),
    }
  }

  previewForAnchor(anchor: CoordinateAnchor, path: string): PreviewResult {
    return this.previewForPosition(anchor.position, path)
  }

  private previewForPosition(
    position: CoordinateAnchorPosition,
    path: string,
  ): PreviewResult {
    const directRef = coordinateReferenceLike(position)

    if (directRef !== null) {
      return this.previewForCoordinateRef(directRef.coordinateId, path)
    }

    switch (position.kind) {
      case 'global':
        return this.previewForGlobalPosition(position, path)
      case 'workPlaneLocal':
        return this.previewForWorkPlaneLocalPosition(position, path)
      default:
        return failure(
          `${path}.kind`,
          'Coordinate anchor position kind must be global or workPlaneLocal.',
        )
    }
  }

  private previewForGlobalPosition(
    position: Extract<CoordinateAnchorPosition, { kind: 'global' }>,
    path: string,
  ): PreviewResult {
    const source = position.value.source

    if (source?.kind === 'coordinateRef') {
      return this.previewForCoordinateRef(source.coordinateId, `${path}.value.source`)
    }

    if (source !== undefined) {
      return failure(
        `${path}.value.source`,
        'Global coordinate anchor source metadata cannot be resolved for translation.',
      )
    }

    try {
      const point = coordinateAnchorPositionToVec3(
        position,
        this.context.ambientDimension,
      )
      const refreshed = translateVec3(point, zeroTranslationVector(), this.context)

      return {
        ok: true,
        point: concretePreviewPoint(refreshed, this.context.ambientDimension),
      }
    } catch (error) {
      return failure(
        path,
        errorMessage(error, 'Coordinate anchor position is invalid.'),
      )
    }
  }

  private previewForWorkPlaneLocalPosition(
    position: Extract<CoordinateAnchorPosition, { kind: 'workPlaneLocal' }>,
    path: string,
  ): PreviewResult {
    const frame = this.previewFrame(position.frame, `${path}.frame`)

    if (!frame.ok) {
      return frame
    }

    return recomputeWorkPlaneLocalPreview(
      {
        kind: 'workPlaneLocal',
        frame: frame.frame,
        local: position.local,
      },
      this.context,
      path,
    )
  }

  private previewFrame(
    frame: WorkPlaneFrameSnapshot,
    path: string,
  ): PreviewFrameResult {
    const origin = this.previewPoint(frame.origin, `${path}.origin`)
    if (!origin.ok) {
      return origin
    }

    const u = this.previewPoint(frame.u, `${path}.u`)
    if (!u.ok) {
      return u
    }

    const v = this.previewPoint(frame.v, `${path}.v`)
    if (!v.ok) {
      return v
    }

    const normal = this.previewPoint(frame.normal, `${path}.normal`)
    if (!normal.ok) {
      return normal
    }

    return {
      ok: true,
      frame: {
        origin: origin.point,
        u: u.point,
        v: v.point,
        normal: normal.point,
      },
    }
  }

  private previewPoint(point: Vec3, path: string): PreviewResult {
    const directRef = coordinateReferenceSourceForPoint(point)

    if (directRef !== null) {
      return this.previewForCoordinateRef(directRef.coordinateId, path)
    }

    const source = point.symbolic?.source

    if (source === undefined) {
      return {
        ok: true,
        point: cloneVec3(point),
      }
    }

    if (source.kind !== 'workPlaneLocal') {
      return failure(
        `${path}.symbolic.source`,
        'Coordinate source kind must be workPlaneLocal or coordinateRef.',
      )
    }

    const frame = this.previewFrame(source.frame, `${path}.symbolic.source.frame`)

    if (!frame.ok) {
      return frame
    }

    const detachedSource: WorkPlaneLocalCoordinateSource = {
      kind: 'workPlaneLocal',
      frame: frame.frame,
      local: {
        a: cloneScalarInputValue(source.local.a),
        b: cloneScalarInputValue(source.local.b),
      },
    }
    const preview = recomputeWorkPlaneLocalPreview(
      detachedSource,
      this.context,
      `${path}.symbolic.source`,
    )

    if (!preview.ok) {
      return preview
    }

    return {
      ok: true,
      point: {
        ...preview.point,
        symbolic: {
          x: numericCoordinateComponent(preview.point.x),
          y: numericCoordinateComponent(preview.point.y),
          z: numericCoordinateComponent(preview.point.z),
          source: detachedSource,
        },
      },
    }
  }
}

function detachCoordinateAnchorPositionInternalRefs(
  position: CoordinateAnchorPosition,
  context: DetachContext,
  path: string,
): DetachPositionResult {
  const directRef = coordinateReferenceLike(position)

  if (directRef !== null) {
    const replacement = context.previewResolver.previewForCoordinateRef(
      directRef.coordinateId,
      path,
    )

    if (!replacement.ok) {
      return replacement
    }

    return {
      ok: true,
      position: globalPositionFromPreview(replacement.point),
      detachedCount: 1,
    }
  }

  switch (position.kind) {
    case 'global':
      return detachGlobalCoordinateAnchorPosition(position, context, path)
    case 'workPlaneLocal':
      return detachWorkPlaneLocalCoordinateAnchorPosition(position, context, path)
    default:
      return failure(
        `${path}.kind`,
        'Coordinate anchor position kind must be global or workPlaneLocal.',
      )
  }
}

function detachGlobalCoordinateAnchorPosition(
  position: Extract<CoordinateAnchorPosition, { kind: 'global' }>,
  context: DetachContext,
  path: string,
): DetachPositionResult {
  const source = position.value.source

  if (source === undefined) {
    return {
      ok: true,
      position: {
        kind: 'global',
        value: cloneSymbolicVec3(position.value),
      },
      detachedCount: 0,
    }
  }

  if (source.kind !== 'coordinateRef') {
    return failure(
      `${path}.value.source`,
      'Global coordinate anchor source metadata cannot be detached for translation.',
    )
  }

  const replacement = context.previewResolver.previewForCoordinateRef(
    source.coordinateId,
    `${path}.value.source`,
  )

  if (!replacement.ok) {
    return replacement
  }

  return {
    ok: true,
    position: globalPositionFromPreview(replacement.point),
    detachedCount: 1,
  }
}

function detachWorkPlaneLocalCoordinateAnchorPosition(
  position: Extract<CoordinateAnchorPosition, { kind: 'workPlaneLocal' }>,
  context: DetachContext,
  path: string,
): DetachPositionResult {
  const frame = detachWorkPlaneFrameCoordinateRefs(
    position.frame,
    context,
    `${path}.frame`,
  )

  if (!frame.ok) {
    return frame
  }

  const previewRefCount = countCoordinateRefsInPoint(position.preview)
  const source: WorkPlaneLocalCoordinateSource = {
    kind: 'workPlaneLocal',
    frame: frame.frame,
    local: {
      a: cloneScalarInputValue(position.local.a),
      b: cloneScalarInputValue(position.local.b),
    },
  }
  const preview = recomputeWorkPlaneLocalPreview(
    source,
    context.translationContext,
    path,
  )

  if (!preview.ok) {
    return preview
  }

  return {
    ok: true,
    position: {
      ...source,
      preview: preview.point,
    },
    detachedCount: frame.detachedCount + previewRefCount,
  }
}

function detachWorkPlaneFrameCoordinateRefs(
  frame: WorkPlaneFrameSnapshot,
  context: DetachContext,
  path: string,
): DetachFrameResult {
  const origin = detachCoordinateReferencePoint(
    frame.origin,
    context,
    `${path}.origin`,
    new WeakSet<object>(),
  )
  if (!origin.ok) {
    return origin
  }

  const u = detachCoordinateReferencePoint(
    frame.u,
    context,
    `${path}.u`,
    new WeakSet<object>(),
  )
  if (!u.ok) {
    return u
  }

  const v = detachCoordinateReferencePoint(
    frame.v,
    context,
    `${path}.v`,
    new WeakSet<object>(),
  )
  if (!v.ok) {
    return v
  }

  const normal = detachCoordinateReferencePoint(
    frame.normal,
    context,
    `${path}.normal`,
    new WeakSet<object>(),
  )
  if (!normal.ok) {
    return normal
  }

  return {
    ok: true,
    frame: {
      origin: origin.point,
      u: u.point,
      v: v.point,
      normal: normal.point,
    },
    detachedCount:
      origin.detachedCount +
      u.detachedCount +
      v.detachedCount +
      normal.detachedCount,
  }
}

function detachCoordinateReferencePoint(
  point: Vec3,
  context: DetachContext,
  path: string,
  seen: WeakSet<object>,
): DetachPointResult {
  const directRef = coordinateReferenceSourceForPoint(point)

  if (directRef !== null) {
    const replacement = context.previewResolver.previewForCoordinateRef(
      directRef.coordinateId,
      path,
    )

    if (!replacement.ok) {
      return replacement
    }

    return {
      ok: true,
      point: replacement.point,
      detachedCount: 1,
    }
  }

  const source = point.symbolic?.source

  if (source === undefined) {
    return {
      ok: true,
      point: cloneVec3(point),
      detachedCount: 0,
    }
  }

  if (source.kind !== 'workPlaneLocal') {
    return failure(
      `${path}.symbolic.source`,
      'Coordinate source kind must be workPlaneLocal or coordinateRef.',
    )
  }

  if (seen.has(source)) {
    return failure(
      `${path}.symbolic.source`,
      'Coordinate source references must not be cyclic.',
    )
  }

  seen.add(source)
  const frame = detachWorkPlaneFrameCoordinateRefsWithSeen(
    source.frame,
    context,
    `${path}.symbolic.source.frame`,
    seen,
  )
  seen.delete(source)

  if (!frame.ok) {
    return frame
  }

  const detachedSource: WorkPlaneLocalCoordinateSource = {
    kind: 'workPlaneLocal',
    frame: frame.frame,
    local: {
      a: cloneScalarInputValue(source.local.a),
      b: cloneScalarInputValue(source.local.b),
    },
  }
  const preview = recomputeWorkPlaneLocalPreview(
    detachedSource,
    context.translationContext,
    `${path}.symbolic.source`,
  )

  if (!preview.ok) {
    return preview
  }

  return {
    ok: true,
    point: {
      ...preview.point,
      symbolic: {
        x: numericCoordinateComponent(preview.point.x),
        y: numericCoordinateComponent(preview.point.y),
        z: numericCoordinateComponent(preview.point.z),
        source: detachedSource,
      },
    },
    detachedCount: frame.detachedCount,
  }
}

function detachWorkPlaneFrameCoordinateRefsWithSeen(
  frame: WorkPlaneFrameSnapshot,
  context: DetachContext,
  path: string,
  seen: WeakSet<object>,
): DetachFrameResult {
  const origin = detachCoordinateReferencePoint(
    frame.origin,
    context,
    `${path}.origin`,
    seen,
  )
  if (!origin.ok) {
    return origin
  }

  const u = detachCoordinateReferencePoint(frame.u, context, `${path}.u`, seen)
  if (!u.ok) {
    return u
  }

  const v = detachCoordinateReferencePoint(frame.v, context, `${path}.v`, seen)
  if (!v.ok) {
    return v
  }

  const normal = detachCoordinateReferencePoint(
    frame.normal,
    context,
    `${path}.normal`,
    seen,
  )
  if (!normal.ok) {
    return normal
  }

  return {
    ok: true,
    frame: {
      origin: origin.point,
      u: u.point,
      v: v.point,
      normal: normal.point,
    },
    detachedCount:
      origin.detachedCount +
      u.detachedCount +
      v.detachedCount +
      normal.detachedCount,
  }
}

function translateCoordinateAnchorPosition(
  position: CoordinateAnchorPosition,
  translation: TranslationVector,
  context: DiagramTranslationContext,
  path: string,
): TranslatePositionResult {
  try {
    const point = coordinateAnchorPositionToVec3(position, context.ambientDimension)
    const translated = translateVec3(point, translation, context)

    switch (position.kind) {
      case 'global':
        return {
          ok: true,
          position: {
            kind: 'global',
            value: symbolicVec3FromVec3(translated),
          },
        }
      case 'workPlaneLocal': {
        const source = translated.symbolic?.source

        if (source?.kind !== 'workPlaneLocal') {
          return failure(
            `${path}.symbolic.source`,
            'Translated work-plane-local coordinate anchor lost its work-plane-local source.',
          )
        }

        return {
          ok: true,
          position: {
            ...cloneWorkPlaneLocalCoordinateSource(source),
            preview: concretePreviewPoint(translated, context.ambientDimension),
          },
        }
      }
      default:
        return failure(
          `${path}.kind`,
          'Coordinate anchor position kind must be global or workPlaneLocal.',
        )
    }
  } catch (error) {
    return failure(
      path,
      errorMessage(error, 'Coordinate anchor position could not be translated.'),
    )
  }
}

function recomputeWorkPlaneLocalPreview(
  source: WorkPlaneLocalCoordinateSource,
  context: DiagramTranslationContext,
  path: string,
): PreviewResult {
  const evaluated = evaluateWorkPlaneLocalCoordinate(
    source,
    context.coordinateExpressionContext,
    path,
  )

  if (!evaluated.ok) {
    const firstError = evaluated.errors[0]

    return failure(
      firstError?.path ?? path,
      firstError?.message ??
        'Work-plane-local coordinate anchor preview could not be recomputed.',
    )
  }

  if (
    context.ambientDimension === 2 &&
    !numbersApproximatelyEqual(evaluated.point.z, 0)
  ) {
    return failure(
      path,
      '2D work-plane-local coordinate anchor previews must have z = 0.',
    )
  }

  const point = concretePreviewPoint(evaluated.point, context.ambientDimension)

  if (!isFiniteVec3(point)) {
    return failure(
      path,
      'Work-plane-local coordinate anchor preview must be finite after translation.',
    )
  }

  return {
    ok: true,
    point,
  }
}

function coordinateReferenceSourceForPoint(
  point: Vec3,
): { coordinateId: string } | null {
  const source = point.symbolic?.source

  return source?.kind === 'coordinateRef' ? source : null
}

function coordinateReferenceLike(value: unknown): { coordinateId: string } | null {
  if (!isRecord(value) || value.kind !== 'coordinateRef') {
    return null
  }

  return typeof value.coordinateId === 'string'
    ? { coordinateId: value.coordinateId }
    : null
}

function firstCoordinateRefInPosition(
  position: CoordinateAnchorPosition,
  path: string,
): string | null {
  const directRef = coordinateReferenceLike(position)

  if (directRef !== null) {
    return path
  }

  switch (position.kind) {
    case 'global':
      return position.value.source?.kind === 'coordinateRef'
        ? `${path}.value.source`
        : null
    case 'workPlaneLocal':
      return (
        firstCoordinateRefInFrame(position.frame, `${path}.frame`) ??
        firstCoordinateRefInPoint(position.preview, `${path}.preview`)
      )
  }
}

function firstCoordinateRefInFrame(
  frame: WorkPlaneFrameSnapshot,
  path: string,
): string | null {
  for (const field of frameFields) {
    const found = firstCoordinateRefInPoint(frame[field], `${path}.${field}`)

    if (found !== null) {
      return found
    }
  }

  return null
}

function firstCoordinateRefInPoint(point: Vec3, path: string): string | null {
  const source = point.symbolic?.source

  if (source?.kind === 'coordinateRef') {
    return `${path}.symbolic.source`
  }

  if (source?.kind !== 'workPlaneLocal') {
    return null
  }

  return firstCoordinateRefInFrame(source.frame, `${path}.symbolic.source.frame`)
}

function countCoordinateRefsInPoint(point: Vec3): number {
  const source = point.symbolic?.source

  if (source?.kind === 'coordinateRef') {
    return 1
  }

  if (source?.kind !== 'workPlaneLocal') {
    return 0
  }

  return frameFields.reduce(
    (count, field) => count + countCoordinateRefsInPoint(source.frame[field]),
    0,
  )
}

function globalPositionFromPreview(point: Vec3): CoordinateAnchorPosition {
  return {
    kind: 'global',
    value: {
      x: numericCoordinateComponent(point.x),
      y: numericCoordinateComponent(point.y),
      z: numericCoordinateComponent(point.z),
    },
  }
}

function concretePreviewPoint(
  point: Vec3,
  ambientDimension: Diagram['ambientDimension'],
): Vec3 {
  return ambientDimension === 2
    ? { x: point.x, y: point.y, z: 0 }
    : cloneConcreteVec3(point)
}

function zeroTranslationVector(): TranslationVector {
  return {
    x: numericCoordinateComponent(0),
    y: numericCoordinateComponent(0),
    z: numericCoordinateComponent(0),
  }
}

function cloneWorkPlaneLocalCoordinateSource(
  source: WorkPlaneLocalCoordinateSource,
): WorkPlaneLocalCoordinateSource {
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
}

function cloneVec3(point: Vec3): Vec3 {
  return point.symbolic === undefined
    ? cloneConcreteVec3(point)
    : {
        ...cloneConcreteVec3(point),
        symbolic: cloneSymbolicVec3(point.symbolic),
      }
}

function cloneConcreteVec3(point: Vec3): Vec3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
  }
}

function cloneSymbolicVec3(value: SymbolicVec3): SymbolicVec3 {
  return {
    x: cloneCoordinateComponent(value.x),
    y: cloneCoordinateComponent(value.y),
    z: cloneCoordinateComponent(value.z),
    ...(value.source === undefined
      ? {}
      : { source: cloneCoordinateSource(value.source) }),
  }
}

function cloneCoordinateSource(source: CoordinateSource): CoordinateSource {
  switch (source.kind) {
    case 'coordinateRef':
      return {
        kind: 'coordinateRef',
        coordinateId: source.coordinateId,
        preview: cloneVec3(source.preview),
      }
    case 'workPlaneLocal':
      return cloneWorkPlaneLocalCoordinateSource(source)
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

function cloneScalarInputValue<T extends { kind: string }>(value: T): T {
  return { ...value }
}

function isTranslationVector(
  delta: CoordinateAnchorTranslationDelta,
): delta is TranslationVector {
  return (
    isCoordinateComponent(delta.x) &&
    isCoordinateComponent(delta.y) &&
    isCoordinateComponent(delta.z)
  )
}

function isCoordinateComponent(value: unknown): value is CoordinateComponent {
  if (!isRecord(value)) {
    return false
  }

  if (value.kind === 'numeric') {
    return typeof value.value === 'number'
  }

  return (
    value.kind === 'symbolic' &&
    typeof value.expression === 'string' &&
    typeof value.previewValue === 'number'
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function failure(
  path: string,
  message: string,
): {
  ok: false
  error: DiagramValidationIssue
} {
  return {
    ok: false,
    error: {
      path,
      message,
    },
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
