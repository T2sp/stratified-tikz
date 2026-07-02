import {
  createDefaultPathInlineNode,
  curveInlineNodeSegmentCount,
  isPathInlineNodeEditableCurve,
  isPathInlineNodeMarker,
  isPathInlineNodePlacement,
  isValidPathInlineNodePositionValue,
} from '../model/pathInlineNodes.ts'
import type {
  PathInlineNode,
  PathInlineNodeMarker,
  PathInlineNodePlacement,
  CurveStratum,
  Stratum,
} from '../model/types.ts'

export type PathInlineNodeBooleanOption = 'off' | 'on'

export const pathInlineNodeBooleanOptions: readonly PathInlineNodeBooleanOption[] =
  ['off', 'on']

export function addPathInlineNode(
  stratum: Stratum,
  id?: string,
): Stratum {
  if (
    stratum.geometricKind !== 'curve' ||
    !isPathInlineNodeEditableCurve(stratum) ||
    curveInlineNodeSegmentCount(stratum) === 0
  ) {
    return stratum
  }

  const node = createDefaultPathInlineNode(
    id ?? nextPathInlineNodeId(stratum.inlineNodes, stratum.id),
  )

  return {
    ...stratum,
    inlineNodes: [...(stratum.inlineNodes ?? []), node],
  }
}

export function updatePathInlineNodePosition(
  stratum: Stratum,
  nodeId: string,
  value: number,
): Stratum {
  if (
    stratum.geometricKind !== 'curve' ||
    !isPathInlineNodeEditableCurve(stratum) ||
    !isValidPathInlineNodePositionValue(value)
  ) {
    return stratum
  }

  return updatePathInlineNode(stratum, nodeId, (node) => ({
    ...node,
    position: {
      ...node.position,
      value,
    },
  }))
}

export function updatePathInlineNodeSegmentIndex(
  stratum: Stratum,
  nodeId: string,
  segmentIndex: number,
): Stratum {
  if (
    stratum.geometricKind !== 'curve' ||
    !isPathInlineNodeEditableCurve(stratum) ||
    !Number.isInteger(segmentIndex) ||
    segmentIndex < 0 ||
    segmentIndex >= curveInlineNodeSegmentCount(stratum)
  ) {
    return stratum
  }

  return updatePathInlineNode(stratum, nodeId, (node) => ({
    ...node,
    position: {
      ...node.position,
      segmentIndex,
    },
  }))
}

export function updatePathInlineNodeText(
  stratum: Stratum,
  nodeId: string,
  text: string,
): Stratum {
  if (stratum.geometricKind !== 'curve' || !isPathInlineNodeEditableCurve(stratum)) {
    return stratum
  }

  return updatePathInlineNode(stratum, nodeId, (node) => ({
    ...node,
    text,
  }))
}

export function updatePathInlineNodePlacement(
  stratum: Stratum,
  nodeId: string,
  placement: PathInlineNodePlacement,
): Stratum {
  if (
    stratum.geometricKind !== 'curve' ||
    !isPathInlineNodeEditableCurve(stratum) ||
    !isPathInlineNodePlacement(placement)
  ) {
    return stratum
  }

  return updatePathInlineNode(stratum, nodeId, (node) => ({
    ...node,
    options: {
      ...node.options,
      placement,
    },
  }))
}

export function updatePathInlineNodeSloped(
  stratum: Stratum,
  nodeId: string,
  sloped: boolean,
): Stratum {
  if (stratum.geometricKind !== 'curve' || !isPathInlineNodeEditableCurve(stratum)) {
    return stratum
  }

  return updatePathInlineNode(stratum, nodeId, (node) => ({
    ...node,
    options: {
      ...node.options,
      sloped,
    },
  }))
}

export function updatePathInlineNodeAllowUpsideDown(
  stratum: Stratum,
  nodeId: string,
  allowUpsideDown: boolean,
): Stratum {
  if (stratum.geometricKind !== 'curve' || !isPathInlineNodeEditableCurve(stratum)) {
    return stratum
  }

  return updatePathInlineNode(stratum, nodeId, (node) => ({
    ...node,
    options: {
      ...node.options,
      allowUpsideDown,
    },
  }))
}

export function updatePathInlineNodeAnchor(
  stratum: Stratum,
  nodeId: string,
  anchor: string,
): Stratum {
  if (stratum.geometricKind !== 'curve' || !isPathInlineNodeEditableCurve(stratum)) {
    return stratum
  }

  return updatePathInlineNode(stratum, nodeId, (node) => {
    const options = { ...node.options }
    const trimmed = anchor.trim()

    if (trimmed.length === 0) {
      delete options.anchor
    } else {
      options.anchor = trimmed
    }

    return {
      ...node,
      options,
    }
  })
}

export function updatePathInlineNodeMarker(
  stratum: Stratum,
  nodeId: string,
  marker: PathInlineNodeMarker,
): Stratum {
  if (
    stratum.geometricKind !== 'curve' ||
    !isPathInlineNodeEditableCurve(stratum) ||
    !isPathInlineNodeMarker(marker)
  ) {
    return stratum
  }

  return updatePathInlineNode(stratum, nodeId, (node) => ({
    ...node,
    options: {
      ...node.options,
      marker,
    },
  }))
}

export function deletePathInlineNode(
  stratum: Stratum,
  nodeId: string,
): Stratum {
  if (stratum.geometricKind !== 'curve' || stratum.inlineNodes === undefined) {
    return stratum
  }

  const inlineNodes = stratum.inlineNodes.filter((node) => node.id !== nodeId)

  if (inlineNodes.length === stratum.inlineNodes.length) {
    return stratum
  }

  const nextStratum = { ...stratum }

  if (inlineNodes.length === 0) {
    delete nextStratum.inlineNodes
  } else {
    nextStratum.inlineNodes = inlineNodes
  }

  return nextStratum
}

function updatePathInlineNode<T extends CurveStratum>(
  stratum: T,
  nodeId: string,
  updater: (node: PathInlineNode) => PathInlineNode,
): T {
  const inlineNodes = stratum.inlineNodes ?? []
  let changed = false
  const nextNodes = inlineNodes.map((node) => {
    if (node.id !== nodeId) {
      return node
    }

    changed = true
    return updater(node)
  })

  return changed
    ? {
        ...stratum,
        inlineNodes: nextNodes,
      }
    : stratum
}

function nextPathInlineNodeId(
  inlineNodes: readonly PathInlineNode[] | undefined,
  pathId: string,
): string {
  const usedIds = new Set((inlineNodes ?? []).map((node) => node.id))
  const stem = `${pathId}-inline-node`
  let index = usedIds.size + 1
  let candidate = `${stem}-${index}`

  while (usedIds.has(candidate)) {
    index += 1
    candidate = `${stem}-${index}`
  }

  return candidate
}
