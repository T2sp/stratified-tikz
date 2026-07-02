import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import {
  isFiniteVec3,
  projectPointToWorkPlaneCoordinates,
  validateWorkPlane,
  workPlaneToBasis,
} from '../geometry/workPlane.ts'
import { isValidWorkPlaneFrameSnapshot } from '../geometry/bezierControls.ts'
import {
  cloneCoordinateAnchorPosition,
  coordinateAnchorPositionPreview,
  coordinateAnchorPositionToVec3,
  isCoordinateAnchorTikzName,
  normalizeCoordinateAnchorName,
  symbolicVec3FromVec3,
} from '../model/coordinateAnchors.ts'
import {
  coordinateAnchorReferenceCount,
  findCoordinateAnchorReferences,
  resolveDiagramCoordinateRefs,
  type CoordinateReferenceLocation,
} from '../model/coordinateReferences.ts'
import { translateCoordinateAnchors } from '../model/coordinateAnchorTranslation.ts'
import type { ScalarInputValue } from '../model/scalarExpressions.ts'
import {
  coordinateComponentPreviewValue,
  updateVec3CoordinateComponent,
  type CoordinateExpressionContext,
} from '../model/symbolicCoordinates.ts'
import {
  isZeroTranslationVector,
  type TranslationVector,
} from '../model/translation.ts'
import { resolveSymbolicVariables } from '../model/variables.ts'
import { evaluateWorkPlaneLocalCoordinate } from '../model/workPlaneLocalCoordinates.ts'
import type {
  AmbientDimension,
  CoordinateAnchor,
  CoordinateAnchorPosition,
  CoordinateComponent,
  Diagram,
  Vec3,
  WorkPlane,
  WorkPlaneFrameSnapshot,
} from '../model/types.ts'
import type {
  CoordinateAxis,
  WorkPlaneLocalCoordinateAxis,
} from './diagramUpdates.ts'
import { formatVec3 } from './inspectorSummary.ts'
import {
  clearSelectionForLayerFilter,
  normalizeLayerFilterForDiagram,
} from './layerFilter.ts'
import {
  selectedElements,
  type SelectedElement,
} from './selection.ts'
import {
  commitDiagramChange,
  type UndoableEditorState,
} from './undo.ts'

export {
  deleteCoordinateAnchorWithDetach,
  deleteCoordinateAnchorsWithDetach,
  type DeletedCoordinateAnchorSummary,
  type DeleteCoordinateAnchorWithDetachResult,
  type DeleteCoordinateAnchorsWithDetachResult,
} from './coordinateAnchorDeletion.ts'

export type CoordinateAnchorEditResult =
  | {
      ok: true
      diagram: Diagram
    }
  | {
      ok: false
      diagram: Diagram
      error: string
    }

export type DeleteUnusedCoordinateAnchorResult =
  | {
      ok: true
      diagram: Diagram
      deleted: true
    }
  | {
      ok: false
      diagram: Diagram
      deleted: false
      reason: 'missing' | 'referenced'
      referenceCount: number
      message: string
    }

export type CoordinateAnchorTranslateSelectedResult =
  | {
      ok: true
      diagram: Diagram
      translated: boolean
      translatedCount: number
      message: string
    }
  | {
      ok: false
      diagram: Diagram
      error: string
    }

export type CoordinateAnchorTranslationEditorState = UndoableEditorState & {
  layerOperationStatus: string
}

export type CoordinateAnchorInspectorField = {
  label: string
}

export type CoordinateAnchorInspectorModel = {
  title: 'Coordinate'
  fields: CoordinateAnchorInspectorField[]
  sourceLabel: 'Global xyz' | 'Work-plane local'
  preview: string
  deleteDisabled: boolean
  deleteMessage: string | null
  referenceCount: number
  usageCount: number
  usageMessage: string
}

export function createCoordinateAnchorInspectorModel(
  diagram: Diagram,
  anchor: CoordinateAnchor,
): CoordinateAnchorInspectorModel {
  const references = findCoordinateAnchorReferences(diagram, anchor.id)
  const referenceCount = references.length
  const usageCount = coordinateAnchorUsageCount(references)
  const coordinateLabels =
    anchor.position.kind === 'workPlaneLocal'
      ? ['Plane x / a', 'Plane y / b']
      : coordinateAxesForInspector(diagram.ambientDimension)

  return {
    title: 'Coordinate',
    fields: [
      { label: 'Name' },
      { label: 'TikZ name' },
      { label: 'Source' },
      ...coordinateLabels.map((label) => ({ label })),
      { label: 'Preview' },
      { label: 'Usage' },
      { label: 'Delete coordinate' },
    ],
    sourceLabel:
      anchor.position.kind === 'workPlaneLocal'
        ? 'Work-plane local'
        : 'Global xyz',
    preview: formatCoordinateAnchorPreview(anchor, diagram.ambientDimension),
    deleteDisabled: false,
    deleteMessage:
      referenceCount > 0
        ? `Deleting will detach ${coordinateReferenceCountLabel(referenceCount)}.`
        : null,
    referenceCount,
    usageCount,
    usageMessage: `Used by ${coordinateUsageCountLabel(usageCount)}`,
  }
}

export function updateCoordinateAnchorName(
  diagram: Diagram,
  coordinateId: string,
  name: string,
): Diagram {
  return updateCoordinateAnchorById(diagram, coordinateId, (anchor) => ({
    ...anchor,
    name: normalizeCoordinateAnchorName(name),
  }))
}

export function updateCoordinateAnchorTikzName(
  diagram: Diagram,
  coordinateId: string,
  tikzName: string,
): CoordinateAnchorEditResult {
  const normalizedName = tikzName.trim()

  if (!isCoordinateAnchorTikzName(normalizedName)) {
    return {
      ok: false,
      diagram,
      error:
        'TikZ name must contain only letters and digits and start with a letter.',
    }
  }

  const duplicate = (diagram.coordinateAnchors ?? []).find(
    (anchor) => anchor.id !== coordinateId && anchor.tikzName === normalizedName,
  )

  if (duplicate !== undefined) {
    return {
      ok: false,
      diagram,
      error: `TikZ name "${normalizedName}" is already used by ${duplicate.name}.`,
    }
  }

  const nextDiagram = updateCoordinateAnchorById(
    diagram,
    coordinateId,
    (anchor) => ({
      ...anchor,
      tikzName: normalizedName,
    }),
  )

  return {
    ok: true,
    diagram: nextDiagram,
  }
}

export function updateCoordinateAnchorGlobalCoordinate(
  diagram: Diagram,
  coordinateId: string,
  axis: CoordinateAxis,
  component: CoordinateComponent,
): Diagram {
  if (!Number.isFinite(coordinateComponentPreviewValue(component))) {
    return diagram
  }

  return updateCoordinateAnchorById(diagram, coordinateId, (anchor) => {
    if (anchor.position.kind !== 'global') {
      return anchor
    }

    const currentPoint = coordinateAnchorPositionToVec3(
      anchor.position,
      diagram.ambientDimension,
    )
    const nextPoint = updateVec3CoordinateComponent(
      currentPoint,
      axis,
      component,
      diagram.ambientDimension,
    )

    return {
      ...anchor,
      position: {
        kind: 'global',
        value: symbolicVec3FromVec3(nextPoint),
      },
    }
  })
}

export function updateCoordinateAnchorWorkPlaneLocalCoordinate(
  diagram: Diagram,
  coordinateId: string,
  axis: WorkPlaneLocalCoordinateAxis,
  value: ScalarInputValue,
): Diagram {
  return updateCoordinateAnchorById(diagram, coordinateId, (anchor) => {
    if (diagram.ambientDimension !== 3 || anchor.position.kind !== 'workPlaneLocal') {
      return anchor
    }

    const position: CoordinateAnchorPosition = cloneCoordinateAnchorPosition(
      anchor.position,
    )

    if (position.kind !== 'workPlaneLocal') {
      return anchor
    }

    position.local[axis] = cloneScalarInputValue(value)

    const evaluated = evaluateWorkPlaneLocalCoordinate(
      position,
      coordinateExpressionContextForDiagram(diagram),
      'coordinate.position',
    )

    if (!evaluated.ok) {
      return anchor
    }

    const preview = normalizePointForAmbientDimension(3, evaluated.point)

    if (!isFiniteVec3(preview)) {
      return anchor
    }

    return {
      ...anchor,
      position: {
        ...position,
        preview,
      },
    }
  })
}

export function translateSelectedCoordinateAnchors(
  diagram: Diagram,
  selection: SelectedElement,
  translation: TranslationVector,
): CoordinateAnchorTranslateSelectedResult {
  const elements = selectedElements(selection)

  if (elements.length === 0 || isZeroTranslationVector(translation)) {
    return {
      ok: true,
      diagram,
      translated: false,
      translatedCount: 0,
      message: 'No selected coordinates translated.',
    }
  }

  if (!elements.every((element) => element.kind === 'coordinate')) {
    return {
      ok: false,
      diagram,
      error:
        'Translate selected coordinates failed: coordinate translation supports coordinate-only selections.',
    }
  }

  const result = translateCoordinateAnchors(
    diagram,
    elements.map((element) => element.id),
    translation,
  )

  if (!result.ok) {
    return {
      ok: false,
      diagram,
      error: `Translate selected coordinates failed: ${result.error.message}`,
    }
  }

  const translatedCount = result.value.translatedCount

  return {
    ok: true,
    diagram:
      translatedCount === 0
        ? diagram
        : resolveDiagramCoordinateRefs(result.value.diagram),
    translated: translatedCount > 0,
    translatedCount,
    message:
      translatedCount === 0
        ? 'No selected coordinates translated.'
        : `Translated ${translatedCount} ${
            translatedCount === 1 ? 'coordinate' : 'coordinates'
          }.`,
  }
}

export function applyCoordinateAnchorTranslateToEditorState<
  T extends CoordinateAnchorTranslationEditorState,
>(current: T, translation: TranslationVector): T {
  const result = translateSelectedCoordinateAnchors(
    current.editableDiagram,
    current.selectedElement,
    translation,
  )

  if (!result.ok) {
    return {
      ...current,
      layerOperationStatus: result.error,
    }
  }

  const nextLayerFilter = normalizeLayerFilterForDiagram(
    result.diagram,
    current.layerFilter,
  )
  const nextSelection = clearSelectionForLayerFilter(
    result.diagram,
    current.selectedElement,
    nextLayerFilter,
  )

  return commitDiagramChange(current, {
    ...current,
    editableDiagram: result.diagram,
    selectedElement: nextSelection,
    layerFilter: nextLayerFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    layerOperationStatus: result.message,
  })
}

export function moveCoordinateAnchorToPoint(
  diagram: Diagram,
  coordinateId: string,
  point: Vec3,
  workPlane?: WorkPlane,
): Diagram {
  const position = coordinateAnchorPositionFromCursorPoint(
    diagram,
    point,
    workPlane,
  )

  return updateCoordinateAnchorById(diagram, coordinateId, (anchor) => ({
    ...anchor,
    position,
  }))
}

export function deleteUnusedCoordinateAnchor(
  diagram: Diagram,
  coordinateId: string,
): DeleteUnusedCoordinateAnchorResult {
  const anchorExists = (diagram.coordinateAnchors ?? []).some(
    (anchor) => anchor.id === coordinateId,
  )

  if (!anchorExists) {
    return {
      ok: false,
      diagram,
      deleted: false,
      reason: 'missing',
      referenceCount: 0,
      message: 'Coordinate anchor does not exist.',
    }
  }

  const referenceCount = coordinateAnchorReferenceCount(diagram, coordinateId)

  if (referenceCount > 0) {
    return {
      ok: false,
      diagram,
      deleted: false,
      reason: 'referenced',
      referenceCount,
      message: 'Coordinate has references; delete with detach to remove it.',
    }
  }

  return {
    ok: true,
    diagram: {
      ...diagram,
      coordinateAnchors: (diagram.coordinateAnchors ?? []).filter(
        (anchor) => anchor.id !== coordinateId,
      ),
    },
    deleted: true,
  }
}

function coordinateAnchorPositionFromCursorPoint(
  diagram: Diagram,
  point: Vec3,
  workPlane?: WorkPlane,
): CoordinateAnchorPosition {
  const normalizedPoint = normalizePointForAmbientDimension(
    diagram.ambientDimension,
    point,
  )

  if (diagram.ambientDimension === 3 && workPlane !== undefined) {
    const localPosition = workPlaneLocalCoordinateAnchorPositionFromPoint(
      normalizedPoint,
      workPlane,
    )

    if (localPosition !== null) {
      return localPosition
    }
  }

  return {
    kind: 'global',
    value: symbolicVec3FromVec3(normalizedPoint),
  }
}

export function formatCoordinateAnchorPreview(
  anchor: CoordinateAnchor,
  ambientDimension: AmbientDimension,
): string {
  try {
    return formatVec3(
      coordinateAnchorPositionPreview(anchor.position, ambientDimension),
      ambientDimension,
    )
  } catch {
    return 'unavailable'
  }
}

function updateCoordinateAnchorById(
  diagram: Diagram,
  coordinateId: string,
  updater: (anchor: CoordinateAnchor) => CoordinateAnchor,
): Diagram {
  let changed = false
  const coordinateAnchors = (diagram.coordinateAnchors ?? []).map((anchor) => {
    if (anchor.id !== coordinateId) {
      return anchor
    }

    changed = true
    return updater(anchor)
  })

  return changed
    ? resolveDiagramCoordinateRefs({
        ...diagram,
        coordinateAnchors,
      })
    : diagram
}

function coordinateAxesForInspector(
  ambientDimension: AmbientDimension,
): CoordinateAxis[] {
  return ambientDimension === 2 ? ['x', 'y'] : ['x', 'y', 'z']
}

function coordinateReferenceCountLabel(count: number): string {
  return `${count} coordinate ${count === 1 ? 'reference' : 'references'}`
}

function coordinateUsageCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'object' : 'objects'}`
}

function coordinateAnchorUsageCount(
  references: readonly CoordinateReferenceLocation[],
): number {
  return new Set(
    references.map(
      (reference) => `${reference.owner.kind}:${reference.owner.id}`,
    ),
  ).size
}

function coordinateExpressionContextForDiagram(
  diagram: Diagram,
): CoordinateExpressionContext {
  const resolved = resolveSymbolicVariables(diagram.variables ?? [])

  if (!resolved.ok) {
    return {
      variableNames: [],
      previewValues: new Map(),
    }
  }

  return {
    variableNames: resolved.variables.map((variable) => variable.name),
    previewValues: resolved.values,
  }
}

function workPlaneLocalCoordinateAnchorPositionFromPoint(
  point: Vec3,
  workPlane: WorkPlane,
): Extract<CoordinateAnchorPosition, { kind: 'workPlaneLocal' }> | null {
  const frame = workPlaneFrameSnapshotFromWorkPlane(workPlane)

  if (frame === null) {
    return null
  }

  try {
    const local = projectPointToWorkPlaneCoordinates(point, workPlane)

    if (!Number.isFinite(local.a) || !Number.isFinite(local.b)) {
      return null
    }

    return {
      kind: 'workPlaneLocal',
      frame,
      local: {
        a: numericScalarInputValue(local.a),
        b: numericScalarInputValue(local.b),
      },
      preview: normalizePointForAmbientDimension(3, point),
    }
  } catch {
    return null
  }
}

function workPlaneFrameSnapshotFromWorkPlane(
  workPlane: WorkPlane,
): WorkPlaneFrameSnapshot | null {
  const validation = validateWorkPlane(workPlane)

  if (!validation.valid) {
    return null
  }

  try {
    const basis = workPlaneToBasis(workPlane)
    const frame = {
      origin: { ...basis.origin },
      u: { ...basis.u },
      v: { ...basis.v },
      normal: { ...basis.normal },
    }

    return isValidWorkPlaneFrameSnapshot(frame) ? frame : null
  } catch {
    return null
  }
}

function cloneScalarInputValue(value: ScalarInputValue): ScalarInputValue {
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

function numericScalarInputValue(value: number): ScalarInputValue {
  return {
    kind: 'numeric',
    value,
  }
}
