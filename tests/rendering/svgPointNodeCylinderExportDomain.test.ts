import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cylinderDimensionDomain, cylinderDimensionSourcesForStyle } from '../../src/geometry/pointNodeShapes/cylinderDomain.ts'
import { resolveCylinderDomainContext } from '../../src/rendering/cylinderDomainSourceResolution.ts'
import { restrictedBorderRotation } from '../../src/geometry/pointNodeShapes/solve.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { defaultVisibilityOptions, hiddenPointStyleFromBase } from '../../src/model/visibility.ts'
import { prepareSvgSurfaceGeometry, projectSvgSurfaceScene } from '../../src/rendering/svgSurfaceScene.ts'
import { prepareSvgVisibility } from '../../src/rendering/svgVisibilityPreparation.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type { Diagram, PointStratum } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import { createSvgLabelController, createSvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { currentSvgPointNodeLayout, pendingSvgPointNodeLayout, svgPointNodeLayout, svgPointNodeOwner, type SvgPointNodeCommit } from '../../src/rendering/svgPointNodeLayout.ts'
import { SvgPointNodeView } from '../../src/rendering/svgPointNodeView.ts'
import { svgPointNodeTextFontFamily } from '../../src/rendering/svgPointNodeText.ts'
import { collectSvgPreviewSelectionCandidates, createSvgSelectionCandidateVisibility } from '../../src/rendering/svgHitTesting.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'

type Run = { exportMode: 'standalone' | 'inlineMath'; exitCode: number; observedDivisorSp: number; command: string[];
  firstDivide: { numerator: string; divisor: string }; artifacts: Record<string, string> }
type ReferenceRecord = { id: string; ambientDimension: 2 | 3; source: string; expectedDivisorSp: number; expectedExit: number; expectedError?: string;
  imported?: boolean; detach?: boolean; edit?: string; removeRecordedOverride?: boolean; rawCurrent?: string; dimPreset?: boolean; domainRotate?: number; domainIncircle?: boolean; artifacts: { model: string; externalSource?: string }; runs: Run[] }
const directory = new URL('../fixtures/point-node-anchors/cylinder-export-domain/', import.meta.url)
const fixture = JSON.parse(readFileSync(new URL('references.json', directory), 'utf8')) as {
  schema: string; pgfVersion: string; engine: string; engineBinarySha256: string; priorReferenceSha256: string; generatorSha256: string;
  sourceHashes: { [key: string]: string }; applicationSourceHashes: { [key: string]: string }; artifactHashes: { [key: string]: string }; records: ReferenceRecord[]
}
const hash = (url: URL): string => createHash('sha256').update(readFileSync(url)).digest('hex')
const diagnostic = 'Cylinder effective transverse radius is zero; PGF’s fitting division is undefined.'
function model(record: ReferenceRecord): Diagram {
  const loaded = parseSavedDiagramJson(readFileSync(new URL(record.artifacts.model, directory), 'utf8'))
  assert.ok(loaded.ok); return loaded.diagram
}
function point(diagram: Diagram): PointStratum {
  const value = diagram.strata[0]
  assert.equal(value.geometricKind, 'point')
  if (value.geometricKind !== 'point') throw new Error('Expected point')
  return value
}
function commit(value: PointStratum, ownerIdentity: string, requestIdentity: string, layout: ReturnType<typeof svgPointNodeLayout>): SvgPointNodeCommit {
  return { source: '', ownerIdentity, requestIdentity, fontGeneration: 0, shape: value.style.shape, size: value.style.size, layout }
}

test('second actual-generated PGF bundle authenticates source/model/context/commands/compiler and independently observed divisors', () => {
  assert.equal(fixture.schema, 'stz-pgf-cylinder-actual-export-domain-v1')
  assert.equal(fixture.pgfVersion, '3.1.11a')
  assert.equal(fixture.engine, 'pdfTeX 3.141592653-2.6-1.40.29 (TeX Live 2026)')
  assert.match(fixture.engineBinarySha256, /^[a-f\d]{64}$/)
  assert.equal(fixture.records.length, 33)
  assert.equal(fixture.records.flatMap(value => value.runs).length, 66)
  assert.equal(hash(new URL('../cylinder-fitting-scanning/references.json', directory)), fixture.priorReferenceSha256)
  assert.equal(hash(new URL('generate.mjs', directory)), fixture.generatorSha256)
  assert.doesNotMatch(readFileSync(new URL('generate.mjs', directory), 'utf8'), /from ['"][^'"]*(?:geometry|rendering)\//)
  for (const [file, expected] of Object.entries(fixture.artifactHashes)) assert.equal(hash(new URL(file, directory)), expected, file)
  for (const [file, expected] of Object.entries(fixture.applicationSourceHashes)) assert.equal(hash(new URL(`../../../../${file}`, directory)), expected, file)
  for (const value of fixture.records) for (const run of value.runs) {
    const source = readFileSync(new URL(run.artifacts.source!, directory), 'utf8')
    assert.equal(source, generateTikz(model(value), { exportMode: run.exportMode }))
    const wrapped = readFileSync(new URL(run.artifacts.wrapper!, directory), 'utf8')
    assert.ok(wrapped.includes(source)); assert.ok(wrapped.includes('\\usepackage{tikz-3dplot}'))
    if (value.imported) assert.ok(wrapped.includes('\\input{tiny-cylinder.sty}'))
    assert.deepEqual(run.command, ['/Library/TeX/texbin/pdflatex', '-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'actual-generated-wrapped.tex'])
    assert.equal(run.exitCode, value.expectedExit)
    const output = readFileSync(new URL(run.artifacts.compilation!, directory), 'utf8')
    assert.ok(output.includes('STZ PGF VERSION 3.1.11a'))
    if (value.expectedError) assert.ok(output.includes(value.expectedError))
    else assert.match(output, /Output written on/)
    const raw = readFileSync(new URL(run.artifacts.domain!, directory), 'utf8')
    const first = /^DIVIDE ([^;]+); ([^\n]+)$/m.exec(raw)!
    assert.deepEqual(run.firstDivide, { numerator: first[1]!, divisor: first[2]! })
    assert.equal(run.observedDivisorSp, Math.round(Number(first[2]) * 65536))
    assert.equal(run.observedDivisorSp, value.expectedDivisorSp)
  }
})

for (const record of fixture.records) test(`${record.id}: emitted local pt/inherited raw source matches authenticated PGF domain in shared pending/live/settled/model/exports`, async () => {
  const diagram = model(record), value = point(diagram), before = structuredClone(diagram)
  assert.equal(validateDiagram(diagram).valid, true)
  assert.equal(value.codim, record.ambientDimension)
  assert.equal(value.style.layout?.units?.innerYSep?.source, record.edit ?? record.source)
  const actualStyle = record.dimPreset ? hiddenPointStyleFromBase(value.style) : value.style
  const context = resolveCylinderDomainContext(diagram, value, actualStyle)!
  const sources = context.dimensionSources
  const inherited = record.imported && !record.edit && !record.detach && !record.dimPreset
  const expectedRaw = record.rawCurrent ? /inner ysep=([^,}]+)/.exec(record.rawCurrent)![1] : record.source
  assert.equal(sources.innerYSep?.source, inherited ? expectedRaw : `${Number(value.style.layout!.innerYSep!.toFixed(6))}pt`)
  assert.equal(context.borderRotate, record.domainRotate ?? value.style.shapeParameters?.borderRotate ?? 0)
  assert.equal(context.borderUsesIncircle, record.domainIncircle ?? value.style.shapeParameters?.borderUsesIncircle ?? false)
  const domain = cylinderDimensionDomain({ shape: 'cylinder', body: { width: 0, height: 0, depth: 0 },
    innerXSep: value.style.layout!.innerXSep!, innerYSep: value.style.layout!.innerYSep!,
    outerXSep: 0, outerYSep: 0, minimumWidth: value.style.layout!.minimumWidth!, minimumHeight: value.style.layout!.minimumHeight!,
    dimensionSources: sources }, context.borderUsesIncircle ? context.borderRotate : restrictedBorderRotation(context.borderRotate, true), context.borderUsesIncircle)
  assert.equal(domain.divisorSp, record.expectedDivisorSp)
  const position = projectToSvgPoint(diagram.camera, value.position, 360), ownerIdentity = svgPointNodeOwner(902, 'p')
  const measurement = { identity: '32d-actual-export-domain-empty', measure: () => ({ width: 0, ascent: 0, descent: 0 }), lineMetrics: () => ({ ascent: 0, descent: 0 }) }
  const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
  const captured = captureSvgLabelExport({ runtime, source: '', pointStyle: actualStyle, position, fontSize: 12,
    fontFamily: svgPointNodeTextFontFamily, color: '#000000', opacity: 1, anchor: 'center', settings: svgLabelLayoutSettings(12, svgPointNodeTextFontFamily), ownerIdentity, pointCylinderDomainContext: context })
  const controller = createSvgLabelController(runtime), cancel = controller.start(captured)
  try {
    const pending = controller.getSnapshot()!
    assert.equal(pending.status, 'pending')
    const [settled] = await settleSvgExportLabels([captured])
    assert.equal(settled.status, 'ready')
    for (const state of [pending, settled]) {
      const layout = svgPointNodeLayout(actualStyle, state, captured.pointCylinderDomainContext)
      if (record.expectedDivisorSp === 0) {
        assert.equal(layout.geometry.limitation, diagnostic)
        assert.equal(layout.geometry.solution, undefined)
        assert.deepEqual(layout.paintedBounds, { minX: 0, minY: 0, maxX: 0, maxY: 0 })
        assert.ok(layout.selectionRadius < 13); assert.equal(layout.stroke, 0)
      } else assert.notEqual(layout.geometry.limitation, diagnostic, 'a surviving register is not classified as a zero divisor, including independent later reciprocal-overflow controls')
      const live = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg' }, createElement(SvgPointNodeView, { capture: captured, state })))
      assert.equal(live, renderSettledSvgLabelDocument(captured, state))
      if (record.expectedDivisorSp === 0) {
        assert.match(live, /data-point-shape-warning="true"/)
        assert.doesNotMatch(live, /data-point-contour|data-point-paint-region|data-point-internal-border/)
      } else if (record.expectedExit === 0) {
        assert.equal(layout.geometry.solution?.contours.length, 2)
        assert.match(live, /data-point-contour="true"/); assert.doesNotMatch(live, /data-point-shape-warning/)
      }
      const commits = new Map([['p', commit(value, ownerIdentity, state.requestIdentity, layout)]])
      assert.equal(currentSvgPointNodeLayout(value, commits, 902, 0, context), layout)
      assert.equal(currentSvgPointNodeLayout(value, commits, 903, 0, context), null)
      if (record.expectedDivisorSp === 0) {
        const warning = layout.warningBounds!
        const options = { diagram, camera: diagram.camera, viewportHeight: 360, pointCommits: commits, pointDocumentRevision: 902, pointFontGeneration: 0 }
        assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: { x: position.x + warning.minX + 1, y: position.y + warning.minY + 1 } })[0]?.id, 'p')
        assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: { x: position.x + 100, y: position.y + 100 } }), [])
      }
    }
  } finally { cancel(); runtime.dispose() }
  const saved = serializeDiagram(diagram), loaded = parseSavedDiagramJson(saved)
  assert.ok(loaded.ok); assert.equal(serializeDiagram(loaded.diagram), saved)
  assert.doesNotMatch(saved, /dimensionSources|divisorSp|cylinderFitting|limitation/)
  for (const run of record.runs) assert.equal(generateTikz(loaded.diagram, { exportMode: run.exportMode }), readFileSync(new URL(run.artifacts.source!, directory), 'utf8'))
  assert.deepEqual(diagram, before)
})

test('normal Clear detachment chooses emitted pt while stale unassociated provenance remains rejected by model validation', () => {
  for (const ambientDimension of [2, 3] as const) {
    const detached = model(fixture.records.find(value => value.id === `detached-em-${ambientDimension}d`)!)
    const value = point(detached)
    assert.equal(value.importedTikzStyleReferenceId, undefined); assert.equal(value.stylePresetId, undefined)
    assert.equal(value.style.importedLayout, undefined)
    assert.equal(cylinderDimensionSourcesForStyle(value.style).innerYSep?.source, '0.000074pt')
    const stale = structuredClone(detached)
    point(stale).style.importedLayout = point(model(fixture.records.find(value => value.id === `inherited-em-${ambientDimension}d`)!)).style.importedLayout
    const validation = validateDiagram(stale)
    assert.equal(validation.valid, false)
    assert.ok(validation.errors.some(error => error.path === 'strata[0].style.importedLayout.referenceId'))
  }
})


test('same-owner inherited zero→equal-valued local override rejects the preceding domain-source commit', async () => {
  for (const ambientDimension of [2, 3] as const) {
    const inheritedDiagram = model(fixture.records.find(value => value.id === `inherited-em-${ambientDimension}d`)!)
    const editedDiagram = model(fixture.records.find(value => value.id === `same-value-local-edit-em-${ambientDimension}d`)!)
    const inherited = point(inheritedDiagram), edited = point(editedDiagram)
    const oldContext = resolveCylinderDomainContext(inheritedDiagram, inherited)!, newContext = resolveCylinderDomainContext(editedDiagram, edited)!
    assert.equal(edited.style.layout?.innerYSep, inherited.style.layout?.innerYSep)
    const measurement = { identity: '32d-domain-source-owner-empty', measure: () => ({ width: 0, ascent: 0, descent: 0 }), lineMetrics: () => ({ ascent: 0, descent: 0 }) }
    const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
    const ownerIdentity = svgPointNodeOwner(904, 'p')
    try {
      const capture = (value: PointStratum) => captureSvgLabelExport({ runtime, source: '', pointStyle: value.style, position: { x: 50, y: 60 }, fontSize: 12,
        fontFamily: svgPointNodeTextFontFamily, color: '#000000', opacity: 1, anchor: 'center', settings: svgLabelLayoutSettings(12, svgPointNodeTextFontFamily), ownerIdentity, pointCylinderDomainContext: value === inherited ? oldContext : newContext })
      const [oldState, newState] = await settleSvgExportLabels([capture(inherited), capture(edited)])
      const oldLayout = svgPointNodeLayout(inherited.style, oldState, oldContext), newLayout = svgPointNodeLayout(edited.style, newState, newContext)
      assert.equal(oldLayout.geometry.limitation, diagnostic)
      assert.equal(newLayout.geometry.limitation, undefined)
      const oldCommit = commit(inherited, ownerIdentity, oldState.requestIdentity, oldLayout)
      const newCommit = commit(edited, ownerIdentity, newState.requestIdentity, newLayout)
      assert.equal(currentSvgPointNodeLayout(inherited, new Map([['p', oldCommit]]), 904, 0, oldContext), oldLayout)
      assert.equal(currentSvgPointNodeLayout(edited, new Map([['p', oldCommit]]), 904, 0, newContext), null, 'equal numeric values cannot authenticate a changed effective dimension source')
      assert.equal(currentSvgPointNodeLayout(edited, new Map([['p', newCommit]]), 904, 0, newContext), newLayout)
      assert.equal(currentSvgPointNodeLayout(inherited, new Map([['p', newCommit]]), 904, 0, oldContext), null)
    } finally { runtime.dispose() }
  }
})


test('cylinder click captures freeze effective source/font/fitting context before subsequent mutable input changes', async () => {
  for (const ambientDimension of [2, 3] as const) {
    const diagram = model(fixture.records.find(value => value.id === `inherited-em-${ambientDimension}d`)!), value = point(diagram)
    const context = resolveCylinderDomainContext(diagram, value)!, before = structuredClone(context), beforeStyle = structuredClone(value.style)
    const measurement = { identity: '32d-domain-freeze-empty', measure: () => ({ width: 0, ascent: 0, descent: 0 }), lineMetrics: () => ({ ascent: 0, descent: 0 }) }
    const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
    try {
      const captured = captureSvgLabelExport({ runtime, source: '', pointStyle: value.style, pointCylinderDomainContext: context,
        position: { x: 50, y: 60 }, fontSize: 12, fontFamily: svgPointNodeTextFontFamily, color: '#000000', opacity: 1, anchor: 'center',
        settings: svgLabelLayoutSettings(12, svgPointNodeTextFontFamily), ownerIdentity: svgPointNodeOwner(905, 'p') })
      const owned = captured.pointCylinderDomainContext!
      assert.notEqual(owned, context); assert.deepEqual(owned, before)
      assert.ok(Object.isFrozen(owned)); assert.ok(Object.isFrozen(owned.dimensionSources))
      assert.ok(Object.isFrozen(owned.dimensionSources.innerYSep)); assert.ok(Object.isFrozen(owned.dimensionSources.innerYSep?.fontContext))
      context.dimensionSources.innerYSep!.fontContext!.fontSizePt = 99
      context.dimensionSources.innerYSep!.source = '1pt'; context.dimensionSources.innerYSep!.unit = 'pt'; context.dimensionSources.innerYSep!.texPoints = 1
      context.borderRotate = 90; context.borderUsesIncircle = true
      value.style.layout!.units!.innerYSep!.fontContext!.fontSizePt = 99
      diagram.externalTikzStyleSources![0].rawSource = diagram.externalTikzStyleSources![0].rawSource!.replace('0.0000074em', '1pt')
      const [state] = await settleSvgExportLabels([captured])
      assert.deepEqual(owned, before); assert.deepEqual(captured.pointStyle, beforeStyle)
      const layout = svgPointNodeLayout(captured.pointStyle!, state, owned)
      assert.equal(layout.geometry.limitation, diagnostic); assert.deepEqual(layout.placementOffset, { x: 0, y: 0 })
      const rendered = renderSettledSvgLabelDocument(captured, state)
      assert.match(rendered, /data-point-shape-warning="true"/); assert.doesNotMatch(rendered, /data-point-contour|data-point-paint-region|data-point-internal-border/)
    } finally { runtime.dispose() }
  }
})

test('same-owner current raw-source and fitting-flag changes reject preceding commits and preserve reverse-transition authority', async () => {
  for (const ambientDimension of [2, 3] as const) for (const id of ['inherited-current-source', 'source-rotate90']) {
    const current = model(fixture.records.find(value => value.id === `${id}-${ambientDimension}d`)!), value = point(current)
    const original = structuredClone(current)
    original.externalTikzStyleSources![0].rawSource = id === 'inherited-current-source'
      ? current.externalTikzStyleSources![0].rawSource!.replace('1pt', '0.0000074em')
      : current.externalTikzStyleSources![0].rawSource!.replace('shape border rotate=90,', '')
    const oldContext = resolveCylinderDomainContext(original, point(original))!, currentContext = resolveCylinderDomainContext(current, value)!
    assert.notDeepEqual(oldContext, currentContext)
    const ownerIdentity = svgPointNodeOwner(906, 'p')
    const measurement = { identity: '32d-domain-source-change-empty', measure: () => ({ width: 0, ascent: 0, descent: 0 }), lineMetrics: () => ({ ascent: 0, descent: 0 }) }
    const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
    try {
      const capture = (domain: typeof oldContext) => captureSvgLabelExport({ runtime, source: '', pointStyle: value.style, pointCylinderDomainContext: domain,
        position: { x: 50, y: 60 }, fontSize: 12, fontFamily: svgPointNodeTextFontFamily, color: '#000000', opacity: 1, anchor: 'center',
        settings: svgLabelLayoutSettings(12, svgPointNodeTextFontFamily), ownerIdentity })
      const [state] = await settleSvgExportLabels([capture(oldContext)])
      const oldLayout = svgPointNodeLayout(value.style, state, oldContext), newLayout = svgPointNodeLayout(value.style, state, currentContext)
      const oldCommit = commit(value, ownerIdentity, state.requestIdentity, oldLayout), newCommit = commit(value, ownerIdentity, state.requestIdentity, newLayout)
      assert.equal(currentSvgPointNodeLayout(value, new Map([['p', oldCommit]]), 906, 0, currentContext), null)
      assert.equal(currentSvgPointNodeLayout(value, new Map([['p', newCommit]]), 906, 0, currentContext), newLayout)
      assert.equal(currentSvgPointNodeLayout(value, new Map([['p', newCommit]]), 906, 0, oldContext), null)
      assert.equal(currentSvgPointNodeLayout(value, new Map([['p', oldCommit]]), 906, 0, oldContext), oldLayout)
    } finally { runtime.dispose() }
  }
})

test('invalid cylinder bottom anchor uses warning/body placement instead of legacy Size/2 synthetic anchors in both dimensions', () => {
  for (const ambientDimension of [2, 3] as const) {
    const diagram = model(fixture.records.find(value => value.id === `source-rotate90-${ambientDimension}d`)!), value = point(diagram)
    value.style.layout = { ...value.style.layout, anchor: 'bottom' }
    const context = resolveCylinderDomainContext(diagram, value)!, layout = pendingSvgPointNodeLayout(value, context)
    assert.equal(layout.geometry.limitation, diagnostic)
    assert.deepEqual(layout.selectedAnchor, { x: 0, y: 0 }); assert.deepEqual(layout.placementOffset, { x: 0, y: 0 })
    assert.deepEqual(layout.warningBounds, { minX: -8, minY: -2, maxX: -6, maxY: 10 })
    assert.ok(layout.selectionRadius < 13)
    const position = projectToSvgPoint(diagram.camera, value.position, 360), warning = layout.warningBounds!
    const options = { diagram, camera: diagram.camera, viewportHeight: 360 }
    assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: { x: position.x + warning.minX + 1, y: position.y + warning.minY + 1 } })[0]?.id, 'p')
    assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: { x: position.x + 100, y: position.y + 100 } }), [])
  }
})

test('authenticated actual 3D dimHidden preset-only node keeps dim/hide/dim selection context and generated local-pt domain', async () => {
  const record = fixture.records.find(value => value.id === 'dimmed-preset-only-3d')!, diagram = model(record), value = point(diagram)
  const beforeSerialized = serializeDiagram(diagram)
  const visibilityOptions = diagram.view!.visibility!
  const surface = projectSvgSurfaceScene(prepareSvgSurfaceGeometry(diagram), diagram.camera)
  const occlusion = prepareSvgVisibility(diagram, diagram.camera, visibilityOptions, surface.projectedFaces)
  assert.equal(occlusion.pointOcclusionById.get('p')?.visibility, 'hidden')
  const dimStyle = hiddenPointStyleFromBase(value.style), dimContext = resolveCylinderDomainContext(diagram, value, dimStyle)!
  const baseContext = resolveCylinderDomainContext(diagram, value)!
  assert.equal(baseContext.dimensionSources.innerYSep?.source, '0.0000074em')
  assert.equal(dimContext.dimensionSources.innerYSep?.source, '0.000074pt')
  for (const run of record.runs) {
    const source = readFileSync(new URL(run.artifacts.source!, directory), 'utf8')
    assert.match(source, /hidden behind sheet \[occluding-sheet\] face 0 and dimmed/)
    const node = /\\node\[([\s\S]*?)\]/.exec(source)![1]!
    assert.doesNotMatch(node, /tinyCylinder/); assert.match(node, /inner ysep=0\.000074pt/)
    assert.match(node, /opacity=0\.28/); assert.equal(run.observedDivisorSp, 5); assert.equal(run.exitCode, 0)
  }
  const measurement = { identity: '32d-dim-domain-empty', measure: () => ({ width: 0, ascent: 0, descent: 0 }), lineMetrics: () => ({ ascent: 0, descent: 0 }) }
  const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
  try {
    const position = projectToSvgPoint(diagram.camera, value.position, 360), ownerIdentity = svgPointNodeOwner(907, 'p')
    const capture = captureSvgLabelExport({ runtime, source: '', pointStyle: dimStyle, pointCylinderDomainContext: dimContext, position,
      fontSize: 12, fontFamily: svgPointNodeTextFontFamily, color: '#000000', opacity: .28, anchor: 'center', settings: svgLabelLayoutSettings(12, svgPointNodeTextFontFamily), ownerIdentity })
    const [state] = await settleSvgExportLabels([capture]), layout = svgPointNodeLayout(dimStyle, state, capture.pointCylinderDomainContext)
    assert.equal(layout.geometry.limitation, undefined)
    const commits = new Map([['p', commit(value, ownerIdentity, state.requestIdentity, layout)]])
    const vertex = layout.geometry.solution!.contours[0].vertices[0]!
    const click = { x: position.x + vertex.x + layout.placementOffset.x, y: position.y + vertex.y + layout.placementOffset.y }
    for (const mode of ['dimHidden', 'hideHidden', 'dimHidden'] as const) {
      const visibility = createSvgSelectionCandidateVisibility({ visibilityOptions: { ...defaultVisibilityOptions, ...visibilityOptions, pointVisibility: mode }, pointOcclusionById: occlusion.pointOcclusionById })
      const candidates = collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight: 360, point: click,
        visibility, pointCommits: commits, pointDocumentRevision: 907, pointFontGeneration: 0 })
      assert.equal(candidates.some(candidate => candidate.id === 'p'), mode === 'dimHidden')
      assert.equal(visibility.dimmedPointIds?.has('p') ?? false, mode === 'dimHidden')
    }
    assert.equal(serializeDiagram(diagram), beforeSerialized)
  } finally { runtime.dispose() }
})
