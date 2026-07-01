export type SvgPreviewHitTestTargetKind =
  | 'geometryHandle'
  | 'coordinateAnchor'
  | 'pointOrLabel'
  | 'curve'
  | 'sheetOrRegion'
  | 'background'

export type SvgPreviewHitTestCandidate = {
  kind: SvgPreviewHitTestTargetKind
  id?: string
  hit: boolean
}

export const svgPreviewHitTestPriority: readonly SvgPreviewHitTestTargetKind[] = [
  'geometryHandle',
  'coordinateAnchor',
  'pointOrLabel',
  'curve',
  'sheetOrRegion',
  'background',
]

export function svgPreviewHitTestPriorityRank(
  kind: SvgPreviewHitTestTargetKind,
): number {
  const rank = svgPreviewHitTestPriority.indexOf(kind)

  return rank >= 0 ? rank : svgPreviewHitTestPriority.length
}

export function pickSvgPreviewHitTestCandidate(
  candidates: readonly SvgPreviewHitTestCandidate[],
): SvgPreviewHitTestCandidate {
  let best: { candidate: SvgPreviewHitTestCandidate; rank: number; index: number } =
    {
      candidate: { kind: 'background', hit: true },
      rank: svgPreviewHitTestPriorityRank('background'),
      index: -1,
    }

  candidates.forEach((candidate, index) => {
    if (!candidate.hit) {
      return
    }

    const rank = svgPreviewHitTestPriorityRank(candidate.kind)

    if (rank < best.rank || (rank === best.rank && index > best.index)) {
      best = { candidate, rank, index }
    }
  })

  return best.candidate
}
