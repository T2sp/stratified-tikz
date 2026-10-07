import {
  sampleCoonsPatch,
  validateCurvedSheetPrimitive,
} from '../geometry/curvedSheets.ts'
import {
  detachSampledCurvedSheetPrimitiveCoordinateReferences,
} from './coordinateReferences.ts'
import {
  diagramTranslationContext,
  isZeroTranslationVector,
  normalizeTranslationVectorForDiagram,
  translateStratum,
  translationVectorPreview,
  type TranslationVector,
} from './translation.ts'
import type {
  CoonsBoundarySnapshot,
  CoordinateComponent,
  CurvedSheetStratum,
  Diagram,
  PathSegment,
  Stratum,
  Vec3,
} from './types.ts'
import { validateDiagram } from './validation.ts'

export type CoonsPatchStratum = CurvedSheetStratum & {
  primitive: Extract<CurvedSheetStratum['primitive'], { kind: 'coonsPatch' }>
}

export type TranslateCoonsPatchResult =
  | {
      ok: true
      diagram: Diagram
      patchId: string
    }
  | {
      ok: false
      diagram: Diagram
      error: string
    }

export function isCoonsPatchStratum(
  stratum: Stratum,
): stratum is CoonsPatchStratum {
  const candidate = stratum as Partial<CurvedSheetStratum>

  return (
    isCurvedSheetStratum(stratum) &&
    typeof candidate.primitive === 'object' &&
    candidate.primitive !== null &&
    candidate.primitive.kind === 'coonsPatch'
  )
}

/**
 * Translate one Coons patch in place. Active boundary links are removed from
 * the local candidate before it is returned to the central commit/synchronizer.
 */
export function translateCoonsPatch(
  diagram: Diagram,
  patchId: string,
  translation: TranslationVector,
): TranslateCoonsPatchResult {
  try {
    const sourceIndex = diagram.strata.findIndex(
      (stratum) => stratum.id === patchId,
    )
    const source = diagram.strata[sourceIndex]

    if (source === undefined) {
      return translateFailure(diagram, `Coons patch "${patchId}" does not exist.`)
    }

    if (!isCoonsPatchStratum(source)) {
      return translateFailure(
        diagram,
        `Stratum "${patchId}" is not a Coons patch.`,
      )
    }

    const normalizedTranslation = normalizeTranslationVectorForDiagram(
      diagram,
      translation,
      { reject2DNonZeroZ: true },
    )

    if (isZeroTranslationVector(normalizedTranslation)) {
      return translateFailure(diagram, 'Enter a non-zero translation.')
    }

    const localCandidate = structuredClone(source) as CoonsPatchStratum
    delete localCandidate.primitive.boundarySources

    const detached = detachSampledCurvedSheetPrimitiveCoordinateReferences(
      diagram,
      localCandidate.primitive,
      `strata[${sourceIndex}].primitive`,
    )

    if (!detached.ok || detached.value.primitive.kind !== 'coonsPatch') {
      const message = detached.ok
        ? 'Detached curved-sheet primitive changed kind.'
        : detached.error.message

      return translateFailure(
        diagram,
        `Translate Coons patch failed: ${message}`,
      )
    }

    localCandidate.primitive = detached.value.primitive
    const context = diagramTranslationContext(
      diagram,
      localCandidate.primitive.boundarySnapshotState === 'frozen'
        ? 'preserveStored'
        : 'evaluateExpressions',
    )
    const materializedBaseline = translateStratum(
      localCandidate,
      zeroTranslationVector(),
      context,
    )

    if (!isCoonsPatchStratum(materializedBaseline)) {
      return translateFailure(
        diagram,
        'Translate Coons patch failed: baseline primitive changed kind.',
      )
    }

    const translated = translateStratum(
      localCandidate,
      normalizedTranslation,
      context,
    )

    if (!isCoonsPatchStratum(translated)) {
      return translateFailure(
        diagram,
        'Translate Coons patch failed: translated primitive changed kind.',
      )
    }

    const representability = coonsPatchTranslationRepresentability(
      materializedBaseline.primitive,
      translated.primitive,
      normalizedTranslation,
    )

    if (!representability.ok) {
      return translateFailure(
        diagram,
        'Translation is too small to change this Coons patch at its current coordinate scale.',
      )
    }

    const primitiveValidation = validateCurvedSheetPrimitive(
      translated.primitive,
    )

    if (!primitiveValidation.valid) {
      return translateFailure(
        diagram,
        validationErrorMessage(
          'Translated Coons patch is invalid',
          primitiveValidation.errors,
        ),
      )
    }

    const strata = [...diagram.strata]
    strata[sourceIndex] = translated
    const candidate = { ...diagram, strata }
    const diagramValidation = validateDiagram(candidate)

    if (!diagramValidation.valid) {
      return translateFailure(
        diagram,
        validationErrorMessage(
          'Translated diagram is invalid',
          diagramValidation.errors,
        ),
      )
    }

    return {
      ok: true,
      diagram: candidate,
      patchId: translated.id,
    }
  } catch (error) {
    return translateFailure(
      diagram,
      error instanceof Error
        ? `Translate Coons patch failed: ${error.message}`
        : 'Translate Coons patch failed.',
    )
  }
}

function isCurvedSheetStratum(
  stratum: Diagram['strata'][number],
): stratum is CurvedSheetStratum {
  return (
    stratum.geometricKind === 'sheet' && stratum.kind === 'curvedSheet'
  )
}

function translateFailure(
  diagram: Diagram,
  error: string,
): TranslateCoonsPatchResult {
  return { ok: false, diagram, error }
}

function validationErrorMessage(
  prefix: string,
  errors: readonly { path: string; message: string }[],
): string {
  const first = errors[0]

  return first === undefined
    ? `${prefix}.`
    : `${prefix}: ${first.path}: ${first.message}`
}

type TranslationAxis = 'x' | 'y' | 'z'

type RequiredSpatialPreview = {
  path: string
  materialized: Vec3
  stored?: Vec3
}

type CoonsPatchTranslationRepresentabilityResult =
  | { ok: true }
  | {
      ok: false
      path: string
      axis: TranslationAxis
    }

function coonsPatchTranslationRepresentability(
  before: CoonsPatchStratum['primitive'],
  after: CoonsPatchStratum['primitive'],
  translation: TranslationVector,
): CoonsPatchTranslationRepresentabilityResult {
  const beforePreviews = requiredCoonsPatchSpatialPreviews(before)
  const afterPreviews = requiredCoonsPatchSpatialPreviews(after)

  if (beforePreviews.length !== afterPreviews.length) {
    throw new Error(
      'Translated Coons patch changed required spatial preview structure.',
    )
  }

  const delta = translationVectorPreview(translation)
  const axes: readonly TranslationAxis[] = ['x', 'y', 'z']

  for (let index = 0; index < beforePreviews.length; index += 1) {
    const beforePreview = beforePreviews[index]
    const afterPreview = afterPreviews[index]

    if (
      beforePreview === undefined ||
      afterPreview === undefined ||
      beforePreview.path !== afterPreview.path
    ) {
      throw new Error(
        'Translated Coons patch changed required spatial preview structure.',
      )
    }

    for (const axis of axes) {
      if (
        delta[axis] !== 0 &&
        (afterPreview.materialized[axis] ===
          beforePreview.materialized[axis] ||
          (afterPreview.stored ?? afterPreview.materialized)[axis] ===
            (beforePreview.stored ?? beforePreview.materialized)[axis])
      ) {
        return {
          ok: false,
          path: beforePreview.path,
          axis,
        }
      }
    }
  }

  return { ok: true }
}

function zeroTranslationVector(): TranslationVector {
  return {
    x: { kind: 'numeric', value: 0 },
    y: { kind: 'numeric', value: 0 },
    z: { kind: 'numeric', value: 0 },
  }
}

function requiredCoonsPatchSpatialPreviews(
  primitive: CoonsPatchStratum['primitive'],
): RequiredSpatialPreview[] {
  const previews: RequiredSpatialPreview[] = []

  for (const role of ['bottom', 'right', 'top', 'left'] as const) {
    appendCoonsBoundarySpatialPreviews(
      previews,
      `primitive.${role}`,
      primitive[role],
    )
  }

  sampleCoonsPatch(primitive).vertices.forEach((point, index) => {
    appendVec3SpatialPreviews(
      previews,
      `primitive.sampledMesh.vertices[${index}]`,
      point,
    )
  })

  return previews
}

function appendCoonsBoundarySpatialPreviews(
  previews: RequiredSpatialPreview[],
  path: string,
  boundary: CoonsBoundarySnapshot,
): void {
  if ('point' in boundary) {
    appendVec3SpatialPreviews(previews, `${path}.point`, boundary.point)
    return
  }

  boundary.segments.forEach((segment, index) => {
    appendPathSegmentSpatialPreviews(
      previews,
      `${path}.segments[${index}]`,
      segment,
    )
  })
}

function appendPathSegmentSpatialPreviews(
  previews: RequiredSpatialPreview[],
  path: string,
  segment: PathSegment,
): void {
  appendVec3SpatialPreviews(previews, `${path}.start`, segment.start)
  appendVec3SpatialPreviews(previews, `${path}.end`, segment.end)

  switch (segment.kind) {
    case 'line':
      return
    case 'cubicBezier':
      appendVec3SpatialPreviews(
        previews,
        `${path}.control1`,
        segment.control1,
      )
      appendVec3SpatialPreviews(
        previews,
        `${path}.control2`,
        segment.control2,
      )
      if (
        segment.controlMode?.kind === 'workPlaneRelativeCartesian' ||
        segment.controlMode?.kind === 'workPlaneRelativePolar'
      ) {
        appendVec3SpatialPreviews(
          previews,
          `${path}.controlMode.frame.origin`,
          segment.controlMode.frame.origin,
        )
      }
      return
    case 'arc':
      appendVec3SpatialPreviews(previews, `${path}.center`, segment.center)
      if (segment.frame !== undefined) {
        appendVec3SpatialPreviews(
          previews,
          `${path}.frame.origin`,
          segment.frame.origin,
        )
      }
  }
}

function appendVec3SpatialPreviews(
  previews: RequiredSpatialPreview[],
  path: string,
  point: Vec3,
): void {
  previews.push({
    path,
    materialized: { x: point.x, y: point.y, z: point.z },
    ...(point.symbolic === undefined
      ? {}
      : {
          stored: {
            x: coordinateComponentStoredPreview(point.symbolic.x),
            y: coordinateComponentStoredPreview(point.symbolic.y),
            z: coordinateComponentStoredPreview(point.symbolic.z),
          },
        }),
  })

  if (point.symbolic === undefined) {
    return
  }

  if (point.symbolic.source?.kind === 'workPlaneLocal') {
    appendVec3SpatialPreviews(
      previews,
      `${path}.symbolic.source.frame.origin`,
      point.symbolic.source.frame.origin,
    )
  }
}

function coordinateComponentStoredPreview(
  component: CoordinateComponent,
): number {
  return component.kind === 'numeric'
    ? component.value
    : component.previewValue
}
