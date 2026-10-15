import { captureCheckoutIdentity, pointNodeScenarios, pointNodeScenarioArtifacts } from '../../scripts/automation/phase-verification.mjs'
import { dashCapScenario } from '../../scripts/pointDashCapContract.mjs'
import { dashCapEvidence, syntheticDashCapLivePng } from './dashCapEvidenceFixture.mjs'
import { dashCapMechanismStem } from '../../scripts/pointDashCapMechanismContract.mjs'
import { syntheticMechanismEvidence, syntheticMechanismLiveSvg, syntheticMechanismLivePng } from './pointDashCapMechanismFixture.mjs'
import { polygonJoinScenario, polygonJoinCases, polygonJoinScales } from '../../scripts/pointPolygonJoinContract.mjs'

const combinedLabelGroups = ['existing-renderer-regressions', 'independent-oracle-negative-controls', 'boundary-anchor-camera-matrix',
  'inverted-success-and-failure-races', 'pending-lock-and-autohide', 'deletion-and-unmount', 'real-App-input-JSON-history-reused-ID-load',
  'current-SVG-cloning', 'inline-node-rendering-placement-halo-picking', 'inline-node-lifecycle-path-operations-export',
  'settled-SVG-export-standalone', 'combined-free-inline-workflows']

// Existing 32A/B policy fixtures are shared unchanged with the complete 32D
// parent/runner fixture, avoiding a second heavyweight paint-evidence builder.
const pointGroups = [...combinedLabelGroups, ...Object.keys(pointNodeScenarios)]
const importRegressionScenarios = [
  'point-paint-local-override-intent', 'point-paint-cross-file-resolution', 'point-paint-unsupported-color-bindings',
]
const correctionScenarios = ['point-paint-unsupported-mutations', 'point-paint-clear-imported-style']
const continuityScenarios = ['point-paint-mutation-directory-uncertainty', 'point-paint-app-continuity']
const targetedPaintScenarios = [
  'point-paint-namespace-aliases',
  'point-paint-responsive-circle',
  'point-paint-responsive-triangle',
  'point-paint-responsive-downloads',
  ...importRegressionScenarios, ...correctionScenarios, ...continuityScenarios, polygonJoinScenario, dashCapScenario,
]
function importRegressionEvidence(name) {
  const snapshot = (key, expected, warnings = []) => {
    const colors = Object.entries(expected).filter(([, value]) => typeof value === 'string' && value.startsWith('#'))
    const definitions = colors.map(([channel, value]) => `\\definecolor{${channel}Color}{HTML}{${value.slice(1)}}`).join('\n')
    const options = Object.entries(expected).filter(([, value]) => value !== null)
      .map(([channel, value]) => `${channel}=${value.startsWith('#') ? `${channel}Color` : value}`).join(',')
    const code = `%   \\input{base.sty}\n%   \\input{outer.sty}\n${definitions}\n\\node[${key},${options}] at (0,0) {};`
    return { key, current: { importedTikzStyleReferenceId: 'fixture-reference' }, warnings,
      observation: { contour: { fill: 'rgb(0, 0, 0)' }, leaves: [{ fill: 'rgb(0, 0, 0)' }] },
      state: { json: '{}', history: '{}' }, output: { standalone: code, inlineMath: code } }
  }
  const result = { download: { boundary: 'download', differencePaths: [] }, reload: { boundary: 'reload', differencePaths: [] },
    standalone: { pageErrors: [], observation: { contour: { fill: 'rgb(0, 0, 0)' }, leaves: [{ fill: 'rgb(0, 0, 0)' }] } } }
  if (name === 'point-paint-local-override-intent') {
    for (const boundary of ['untouched', 'reset']) result[boundary] = snapshot('example', { fill: null, text: null })
    for (const boundary of ['away', 'undone']) result[boundary] = snapshot('example', { fill: '#123456', text: null })
    for (const boundary of ['back', 'redone', 'reloaded']) result[boundary] = snapshot('example', { fill: '#000000', text: null })
    result.settingsBefore = snapshot('unknown controls', { fill: null, text: null, draw: null, 'fill opacity': null, 'line width': null })
    result.settingsFocusBlur = snapshot('unknown controls', { fill: null, text: null, draw: null, 'fill opacity': null, 'line width': null })
    result.settingsFocusBlur.current.style = { importedPaint: { overriddenFields: [] } }
    result.settingsFocusBlur.focusBlurControls = ['Fill opacity', 'Border width'].map((name) => ({ name, before: '1', after: '1', focused: true, blurred: true }))
    result.settingsBack = snapshot('unknown controls', { fill: null, text: null, draw: null, 'fill opacity': '1', 'line width': '0.4pt' })
    const source = '\\tikzstyle{example}=[fill=\\mycolor,text=red]\n\\tikzstyle{unknown controls}=[fill=\\mycolor,text=\\mytext,draw=\\myborder,fill opacity=\\myalpha,line width=\\mywidth]\n'
    for (const boundary of ['untouched', 'away', 'back', 'undone', 'redone', 'reloaded', 'reset', 'settingsBefore', 'settingsFocusBlur', 'settingsBack']) {
      const entry = result[boundary]
      entry.warnings = ['Unsupported executable paint option: fill=\\mycolor. Runtime color bindings and option handlers remain unknown; later paint cannot restore certainty.']
      entry.modelDiagnostics = { validation: { valid: true }, resolution: { executionUncertain: true, diagnostics: entry.warnings,
        unresolvedFields: ['fillColor', 'fillEnabled', 'drawColor', 'drawEnabled', 'textColor', 'fillOpacity', 'drawOpacity',
          'textOpacity', 'lineWidth', 'dashPattern', 'dashPhase', 'lineCap', 'lineJoin'] }, reference: { previewDiagnostics: entry.warnings } }
      entry.diagram = { externalTikzStyleSources: [{ rawSource: source }] }
      const overriddenFields = ['untouched', 'reset', 'settingsBefore', 'settingsFocusBlur'].includes(boundary) ? []
        : boundary === 'settingsBack' ? ['fill.opacity', 'stroke.width'] : ['fill.color']
      entry.current.style = { paint: { fill: { color: ['away', 'undone'].includes(boundary) ? '#123456' : '#000000' } }, importedPaint: { overriddenFields } }
      entry.observation.leaves[0].fillAlpha = 1
    }
    result.standalone.observation = result.reloaded.observation
  } else if (name === 'point-paint-cross-file-resolution') {
    for (const boundary of ['crossFile', 'reloaded']) result[boundary] = snapshot('outer', { fill: '#ff0000', text: '#00ff00', draw: '#0000ff' })
    result.priorColor = snapshot('outer', { fill: '#123456', text: '#00ff00', draw: '#0000ff' })
    result.redefined = snapshot('outer', { fill: '#ffff00', text: '#0000ff', draw: '#00ff00' })
    result.missing = snapshot('outer', { fill: null, text: null, draw: null }, ['Unsupported absent base'])
    result.missing.modelDiagnostics = { resolution: { executionUncertain: true,
      diagnostics: ['Unsupported absent base'], unresolvedFields: ['fillColor', 'drawColor', 'textColor'] } }
    result.laterUndone = snapshot('outer', { fill: '#000000', text: null })
    for (const boundary of ['later', 'laterRedone', 'laterReloaded']) result[boundary] = snapshot('outer', { fill: '#000000', text: '#00ff00', draw: '#0000ff' })
    result.laterDownload = { boundary: 'download', differencePaths: [] }; result.laterReload = { boundary: 'reload', differencePaths: [] }
  } else if (name === 'point-paint-mutation-directory-uncertainty') {
    result.directory = snapshot('outer', { fill: null, text: null, draw: null })
    result.independent = snapshot('independent', { fill: '#0000ff', text: '#00ff00', draw: '#ff0000' })
    result.independent.modelDiagnostics = { validation: { valid: true }, resolution: {} }
    result.independent.observation = { contour: { fill: 'rgb(0, 0, 255)', stroke: 'rgb(255, 0, 0)' }, leaves: [{ fill: 'rgb(0, 255, 0)', fillAlpha: 1 }] }
    for (const boundary of ['away', 'undone']) result[boundary] = snapshot('outer', { fill: null, text: '#123456', draw: null })
    for (const boundary of ['back', 'redone', 'reloaded']) result[boundary] = snapshot('outer', { fill: null, text: '#ff0000', draw: null })
    const source = '\\tikzset{\n  myPoint/.style={fill=red,text=red},\n  myPoint/.append style={/other/.cd},\n  /other/text/.style={/tikz/text=blue,/tikz/.cd},\n  outer/.style={myPoint,text=green}\n}'
    for (const boundary of ['directory', 'away', 'back', 'undone', 'redone', 'reloaded']) {
      const entry = result[boundary]
      entry.warnings = ['Unsupported runtime directory /.cd']
      entry.modelDiagnostics = { validation: { valid: true }, resolution: { unresolvedFields: ['textColor'] }, reference: { previewDiagnostics: entry.warnings } }
      entry.diagram = { externalTikzStyleSources: [{ rawSource: source }] }
      entry.current.style = { paint: { text: { color: ['away', 'undone'].includes(boundary) ? '#123456' : '#ff0000' } },
        importedPaint: { overriddenFields: boundary === 'directory' ? [] : ['text.color'] } }
      entry.observation = { contour: { fill: 'rgb(255, 0, 0)' }, leaves: [{ fill: 'rgb(255, 0, 0)', fillAlpha: 1 }] }
    }
    result.away.state.history = JSON.stringify({ past: [{ earlier: 1 }], present: { text: '#123456' }, future: [] })
    result.back.state.history = JSON.stringify({ past: [{ earlier: 1 }, { text: '#123456' }], present: { text: '#ff0000' }, future: [] })
    result.standalone.observation = result.reloaded.observation
  } else if (name === 'point-paint-unsupported-mutations') {
    result.mutation = snapshot('myPoint', { fill: null, text: null, draw: null })
    for (const boundary of ['away', 'undone']) result[boundary] = snapshot('myPoint', { fill: '#123456', text: null, draw: null })
    for (const boundary of ['back', 'redone', 'reloaded']) result[boundary] = snapshot('myPoint', { fill: '#ff0000', text: null, draw: null })
    const source = '\\tikzset{\n  myPoint/.style={fill=red,text=red},\n  myPoint/.append style={fill=blue,text=blue}\n}'
    for (const boundary of ['mutation', 'away', 'back', 'undone', 'redone', 'reloaded']) {
      const entry = result[boundary]
      entry.warnings = ['Unsupported myPoint/.append style']
      entry.modelDiagnostics = { validation: { valid: true }, resolution: { unresolvedFields: ['fillColor', 'textColor'] },
        reference: { previewDiagnostics: entry.warnings } }
      entry.diagram = { externalTikzStyleSources: [{ rawSource: source }] }
      entry.current.style = { paint: { fill: { color: ['away', 'undone'].includes(boundary) ? '#123456' : '#ff0000' } },
        importedPaint: { overriddenFields: boundary === 'mutation' ? [] : ['fill.color'] } }
      entry.observation = { contour: { fill: 'rgb(255, 0, 0)' }, leaves: [{ fill: 'rgb(255, 0, 0)', fillAlpha: 1 }] }
    }
    result.standalone.observation = result.reloaded.observation
  } else {
    result.unsupported = snapshot('myPoint', { fill: null, text: null, draw: '#000000' }, ['Unsupported red'])
    for (const boundary of ['away', 'undone']) result[boundary] = snapshot('myPoint', { fill: '#123456', text: null })
    for (const boundary of ['back', 'redone', 'reloaded']) result[boundary] = snapshot('myPoint', { fill: '#000000', text: null })
  }
  return result
}
function clearRegressionEvidence() {
  // Synthetic policy fixtures only: these records exercise parent acceptance
  // assertions and do not claim native browser, model, or download observations.
  const basePaint = { text: { color: '#000000', opacity: 1 }, fill: { enabled: true, color: '#ff0000', opacity: 1 },
    stroke: { enabled: true, color: '#000000', opacity: 1, width: .4, lineStyle: 'solid', dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' } }
  const mixedPaint = { text: { color: '#654321', opacity: .5 }, fill: { enabled: true, color: '#123456', opacity: .25 },
    stroke: { enabled: true, color: '#008000', opacity: .75, width: 3, lineStyle: 'solid', dashPattern: [3, 2], dashPhase: 1, lineCap: 'round', lineJoin: 'bevel' } }
  const expectedObservation = (paint) => {
    const rgb = (hex) => `rgb(${[1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)).join(', ')})`
    return { contour: { fill: rgb(paint.fill.color), fillAlpha: paint.fill.opacity, stroke: rgb(paint.stroke.color),
      strokeAlpha: paint.stroke.opacity, strokeWidth: paint.stroke.width * 1.2, dash: paint.stroke.dashPattern ? '3, 2' : 'none',
      dashOffset: paint.stroke.dashPhase * 1.2, cap: paint.stroke.lineCap, join: paint.stroke.lineJoin },
    leaves: [{ fill: rgb(paint.text.color), fillAlpha: paint.text.opacity }], bodyBounds: { width: 2 }, shapeBounds: { width: 5 } }
  }
  const layoutForPoint = (index) => {
    const xContext = { fontSizePt: 12 + index, xHeightPt: 5 + index }
    const yContext = { fontSizePt: 10 + index, xHeightPt: 4 + index }
    const baseline = { innerXSep: xContext.fontSizePt, innerYSep: yContext.xHeightPt,
      outerXSep: 1 + index / 10, outerYSep: .5 + index / 10,
      minimumWidth: 36 + index, minimumHeight: 18 + index,
      anchor: ['base east', 'north west', 'south'][index], fontContext: xContext,
      units: {
        innerXSep: { source: '1em', unit: 'em', texPoints: xContext.fontSizePt, fontContext: xContext },
        innerYSep: { source: '1ex', unit: 'ex', texPoints: yContext.xHeightPt, fontContext: yContext },
        outerXSep: { source: `${1 + index / 10}pt`, unit: 'pt', texPoints: 1 + index / 10 },
        outerYSep: { source: `${.5 + index / 10}pt`, unit: 'pt', texPoints: .5 + index / 10 },
        minimumWidth: { source: `${36 + index}pt`, unit: 'pt', texPoints: 36 + index },
        minimumHeight: { source: `${18 + index}pt`, unit: 'pt', texPoints: 18 + index },
      } }
    const layout = structuredClone(baseline)
    layout.innerXSep = 1.5 * xContext.fontSizePt
    layout.units.innerXSep = { source: '1.5em', unit: 'em', texPoints: layout.innerXSep, fontContext: structuredClone(xContext) }
    return { layout, importedLayout: { referenceId: 'reference', baseline: structuredClone(baseline), overriddenFields: ['innerXSep'] } }
  }
  const makeCase = (ids) => {
    const multiple = ids.length === 2, key = multiple ? 'independent point' : 'redpoint'
    const secondPaint = { text: { color: '#ff0000', opacity: .6 }, fill: { enabled: true, color: '#0000ff', opacity: .35 },
      stroke: { enabled: true, color: '#00ff00', opacity: .7, width: 2, lineStyle: 'solid', dashPattern: [3, 2], dashPhase: 1, lineCap: 'round', lineJoin: 'bevel' } }
    const points = ['app-point', 'bulk-point', 'copy-point'].map((id, index) => ({
      current: { id, text: ['Clear target', 'Clear second', 'Control point'][index], stylePresetId: 'preset', importedTikzStyleReferenceId: 'reference',
        style: { opacity: 1, paint: structuredClone(multiple ? index === 0 ? mixedPaint : secondPaint : basePaint),
          importedPaint: { referenceId: 'reference' }, ...layoutForPoint(index) } },
      observation: expectedObservation(multiple ? index === 0 ? mixedPaint : secondPaint : basePaint),
    }))
    const snapshot = (detached) => {
      const current = structuredClone(points)
      if (detached) for (const { current: point } of current) if (ids.includes(point.id)) {
        delete point.stylePresetId; delete point.importedTikzStyleReferenceId; delete point.style.importedPaint; delete point.style.importedShape; delete point.style.importedLayout
      }
      const diagram = { strata: current.map((point) => point.current), userStylePresets: [{ id: 'preset' }],
        externalTikzStyleSources: [{ id: 'source', rawSource: 'preserved source' }], importedTikzStyleReferences: [{ id: 'reference', key }] }
      const nodes = current.map(({ current: point }, index) => {
        const { paint } = point.style
        const colors = ['fill', 'text', 'stroke'].map((channel) => `\\definecolor{${channel}${index}}{HTML}{${paint[channel].color.slice(1)}}`).join('\n')
        const dash = paint.stroke.dashPattern ? `dash pattern=on 3pt off 2pt` : 'solid'
        return `${colors}\n\\node[${point.importedTikzStyleReferenceId ? `${key},` : ''}fill=fill${index},text=text${index},draw=stroke${index},fill opacity=${paint.fill.opacity},text opacity=${paint.text.opacity},draw opacity=${paint.stroke.opacity},line width=${paint.stroke.width}pt,${dash},dash phase=${paint.stroke.dashPhase}pt,line cap=${paint.stroke.lineCap},line join=${paint.stroke.lineJoin}] at (${index},0) {${point.text}};`
      }).join('\n')
      // Synthetic policy evidence only; these markers are not browser/model observations.
      const beforePresent = { clear: 'before', ids }, afterPresent = { clear: 'after', ids }
      return { points: current, diagram, output: { standalone: nodes, inlineMath: nodes }, modelDiagnostics: { validation: { valid: true } },
        state: { json: JSON.stringify({ diagram }), history: JSON.stringify({
          past: detached ? [{ before: 'retained' }, beforePresent] : [{ before: 'retained' }],
          present: detached ? afterPresent : beforePresent, future: [],
        }) } }
    }
    const entry = { evidenceKind: 'synthetic-policy', ids, nativeAction: { selector: 'TikZ style selector', action: 'Clear TikZ style' },
      before: snapshot(false), cleared: snapshot(true), undone: snapshot(false), redone: snapshot(true), reloaded: snapshot(true),
      download: { boundary: 'download', differencePaths: [] }, reload: { boundary: 'reload', differencePaths: [] },
      standalone: { pageErrors: [], observation: points[0].observation,
        points: multiple ? [{ id: 'bulk-point', observation: points[1].observation }] : [] } }
    return entry
  }
  return { evidenceKind: 'synthetic-policy', single: makeCase(['app-point']), multiple: makeCase(['app-point', 'bulk-point']) }
}

// Faults must agree across all duplicate representations before the acceptance
// policy checks their semantics. This deliberately leaves history unchanged.
function synchronizeClearSnapshot(entry) {
  entry.diagram.strata = entry.points.map((point) => structuredClone(point.current))
  const saved = JSON.parse(entry.state.json)
  saved.diagram = structuredClone(entry.diagram)
  entry.state.json = JSON.stringify(saved)
}
function appContinuityEvidence() {
  // Policy fixtures only; native App transitions and negative controls run in
  // check:free-labels and cannot be substituted with these synthetic records.
  const expectedUrl = 'http://fixture/stratified-tikz/scripts/fixtures/freeLabelsApp.html'
  const snapshot = (boundary, pageId = 'app-main', generation = 'document-main') => ({ boundary, pageId, expectedUrl,
    closed: false, crashed: false, document: { url: expectedUrl, generation, readyState: 'complete',
      api: { type: 'object', stateType: 'function', sameInstance: true }, root: { children: 1 },
      scripts: [{ type: 'module', src: 'http://fixture/stratified-tikz/scripts/fixtures/freeLabelsApp.tsx' }] },
    state: { json: '{}', runtimeDiagramJson: '{}', history: '{}', labelDocumentRevision: 1 } })
  const names = ['point-paint-local-override-intent', 'point-paint-cross-file-resolution', 'point-paint-unsupported-color-bindings',
    'point-paint-unsupported-mutations', 'point-paint-mutation-directory-uncertainty', 'point-paint-clear-imported-style', 'point-paint-clear-imported-style-multi']
  const transitions = names.map((name, index) => ({ name, result: 'passed', before: snapshot(`${name}:before-standalone`), after: snapshot(`${name}:after-standalone-close`),
    standalonePages: [{ pageId: `svg-${index}`, closed: true, events: [{ event: 'main-frame-navigation', url: `file:///tmp/${name}.svg` }, { event: 'close' }] }] }))
  const files = {}
  const controls = ['missing-api', 'wrong-api', 'same-url-reload'].map((fault) => {
    const prefix = `point-paint-app-control-${fault}`, pageId = `app-${fault}`
    const before = snapshot('startup', pageId, `document-${fault}`)
    const failed = structuredClone(before); failed.boundary = 'failure'
    failed.document.dom = { nodes: [{ tag: 'html' }], bytes: 14, maxNodes: 512, maxBytes: 64_000 }
    if (fault === 'same-url-reload') failed.document.generation += '-new'
    if (fault === 'missing-api') failed.document.api.type = 'undefined'
    if (fault === 'wrong-api') failed.document.api.sameInstance = false
    const evidence = { pageId, expectedUrl, deliberateNegativeControl: true, fault, snapshot: failed,
      screenshot: `${prefix}-failure.png`, error: { message: fault === 'same-url-reload' ? 'generation changed' : fault === 'missing-api' ? 'API missing' : 'API instance changed' } }
    files[`${prefix}-failure.json`] = evidence
    files[`${prefix}-lifecycle.json`] = { pageId, expectedUrl, events: [{ event: 'document-observation', boundary: 'failure' }] }
    return { fault, result: 'passed', before, evidence }
  })
  const evidence = { schema: 1, startup: snapshot('startup-committed'), transitions, controls,
    helperReturn: snapshot('import-helper-return'), beforeNextLoad: snapshot('before-next-app-load'), afterControls: snapshot('after-native-continuity-controls') }
  files['point-paint-app-transitions.json'] = { transitions }
  files['point-paint-app-lifecycle.json'] = { schema: 1, pageId: 'app-main', expectedUrl, expected: { generation: 'document-main' },
    events: [{ event: 'document-observation', boundary: 'import-helper-return' }] }
  files['point-paint-app-controls.json'] = { schema: 1, controls }
  return { evidence, files }
}
function polygonJoinEvidence() {
  return { scenario: polygonJoinScenario, group: 'point-node-paint-import-persistence', result: 'passed',
    cases: polygonJoinCases.flatMap((specification) => polygonJoinScales.map((scale) => ({
      key: specification.key, scale, specification, modelUnchanged: true,
      observation: { source: '', bodyStatus: 'ready', vertices: Array.from({ length: specification.shape === 'star' ? 10 : 3 }, (_, index) => {
          const angle = -Math.PI / 2 - index * Math.PI / (specification.shape === 'star' ? 5 : 1.5)
          const radius = specification.size * 1.2 / 2 * Math.SQRT2 * (specification.shape === 'star' ? index % 2 === 0 ? 1.5 : 1 : 2)
          return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
        }),
        strokeWidth: specification.widthPt * 1.2, fill: 'none', join: specification.join,
        miterLimit: 10, resolution: 16, boundaryPixelCount: 100, boundsMatch: true,
        declaredBounds: [-10, specification.key === 'triangle-bevel-wide' ? -15.4544155877 : -10, 10, specification.key === 'triangle-miter-wide' ? 20.5455844123 : 10],
        rasterBounds: { minX: -10, minY: specification.key === 'triangle-bevel-wide' ? -15.4544155877 : -10, maxX: 10, maxY: specification.key === 'triangle-miter-wide' ? 20.5455844123 : 10 }, ctm: { a: scale, b: 0, c: 0, d: scale, e: 10, f: 10 } },
      probes: ['paint', 'within', 'outside', 'interior', ...(specification.exact ? ['exact'] : []),
        ...(specification.key === 'triangle-miter-wide' ? ['miter-tip'] : []),
        ...(specification.key === 'triangle-bevel-wide' ? ['bevel-edge'] : [])].map((kind) => {
        const candidates = ['outside', 'exact'].includes(kind) ? ['control'] : ['control', 'p']
        const local = kind === 'exact' ? specification.exact : kind === 'miter-tip' ? { x: 0, y: -40.8 } : kind === 'bevel-edge' ? { x: 10, y: -14 } : { x: 0, y: 0 }
        return { kind, screenshot: `${polygonJoinScenario}-${specification.key}-scale-${scale}-${kind}.png`, nativeStrokeContains: true, local, transform: { ctm: { a: scale, b: 0, c: 0, d: scale, e: 10, f: 20 } }, selectionCleared: true,
          rasterDistance: ({ paint: 0, within: 5.5, outside: 6.5, interior: 0, exact: specification.join === 'miter' ? 7.4544155877 : 8.5455844123, 'miter-tip': 0, 'bevel-edge': 0 })[kind],
          actions: [false, true, true, true].map((alt, index) => ({ alt, trusted: true, beforeSelection: null,
            overlayExcluded: true, candidates, screen: { x: scale * local.x + 10, y: scale * local.y + 20 }, point: { x: 450 + local.x, y: 350 + local.y }, selection: { id: index === 0 && ['paint', 'miter-tip', 'bevel-edge'].includes(kind) ? 'p' : candidates[index % candidates.length] } })) }
      }),
    }))) }
}

function completePointEvidence(fixture) {
  fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(pointGroups)
  fixture.env.STZ_TEST_POINT_ARTIFACTS = 'yes'
  const bodyStructure = (background) => ({ title: 'Scale', expectedBackground: background,
    exportBackground: { markers: background === 'white'
      ? [{ attribute: { namespace: null, name: 'data-stratified-tikz-export-background', value: 'white' } }] : [] },
  })
  const bodySample = (background, shape, variant, scale) => ({ background, shape, variant, scale,
    bodyContractPassed: true, output: { capture: { coordinatesStable: true } },
    bodyObservation: { structure: bodyStructure(background),
      literal: { source: 'Scale', documentUnchanged: true, fontReadiness: { status: 'loaded', checked: true } },
      settling: { documentUnchanged: true, status: 'loaded', leaves: [{ readiness: { status: 'loaded', checked: true } }] } },
  })
  const evidence = { checkout: captureCheckoutIdentity({ cwd: fixture.cwd, env: fixture.env }),
    evidence: Object.entries(pointNodeScenarios).flatMap(([group, names]) => names.map((name) =>
      ({ group, name, result: 'passed', artifacts: pointNodeScenarioArtifacts(name) }))) }
  fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
  fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(Object.fromEntries(targetedPaintScenarios.map((name) => [
    `${name}.json`, { scenario: name, group: 'point-node-paint-import-persistence', result: 'passed',
      ...(name === dashCapScenario ? dashCapEvidence() : name === polygonJoinScenario ? polygonJoinEvidence() : name === 'point-paint-app-continuity' ? appContinuityEvidence().evidence : name === 'point-paint-clear-imported-style' ? clearRegressionEvidence() : [...importRegressionScenarios, 'point-paint-unsupported-mutations', 'point-paint-mutation-directory-uncertainty'].includes(name) ? importRegressionEvidence(name) : name === 'point-paint-responsive-downloads' ? {
        cases: ['transparent', 'white'].flatMap((background) => [['circle', 'solid'], ['triangle', 'solid'], ['circle', 'dashed']]
          .map(([shape, variant]) => ({ background, shape, variant,
            baseline: { fixture: { source: 'Scale' }, expectedBackground: background, saved: bodyStructure(background) },
            fileUnchanged: true, documentRestored: true,
            scales: [.5, 2].map((scale) => bodySample(background, shape, variant, scale)),
            returnScale: bodySample(background, shape, variant, .5),
            negativeControls: [['text-mutation', 'foreground content/order'], ['body-displacement', 'body local placement transform'],
              ['font-change', 'text font family']].map(([kind, reason]) =>
              ({ kind, rejected: true, reason: `displayed file: ${reason}`, documentUnchanged: true })),
          }))),
      } : name.startsWith('point-paint-responsive-') ? { cases: [.5, 2].map((scale) => ({ scale, negativeControlRejected: true })) }
        : { cases: ['shadowing', 'missing', 'aliases'].map((name) => ({ name, source: 'fixture style',
          output: { standalone: 'fixture', inlineMath: 'fixture' },
          reloadedOutput: { standalone: 'fixture', inlineMath: 'fixture' },
          editedOutput: { standalone: 'fixture', inlineMath: 'fixture' },
          uneditedDownload: { boundary: 'download', differencePaths: [] }, uneditedReload: { boundary: 'reload', differencePaths: [] },
          editedDownload: { boundary: 'download', differencePaths: [] }, editedReload: { boundary: 'reload', differencePaths: [] },
        })) }),
    },
  ])))
  const mechanism = syntheticMechanismEvidence()
  fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify({
    ...JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES), ...appContinuityEvidence().files,
    [`${dashCapMechanismStem}.json`]: mechanism,
    ...Object.fromEntries(mechanism.cases.flatMap((entry) => {
      const stem = `${dashCapMechanismStem}-${entry.key}`
      return [[`${stem}.json`, entry], [`${stem}.live.svg`, syntheticMechanismLiveSvg(entry)],
        ...entry.livePaint.captures.map((capture) => [capture.file, { syntheticPngBase64: syntheticMechanismLivePng(capture.scale, entry.key).toString('base64') }]),
        ...['input.svg', 'solid.input.svg'].map((suffix) =>
        [`${stem}.${suffix}`, `<svg xmlns="http://www.w3.org/2000/svg"><polygon points="${entry.source.rawPoints}" fill="none" stroke="#000000" stroke-width="${entry.specification.width}" stroke-dasharray="${suffix === 'solid.input.svg' ? 'none' : entry.specification.pattern?.join(' ') ?? 'none'}" stroke-dashoffset="${suffix === 'solid.input.svg' ? 0 : entry.specification.phase}" stroke-linecap="${entry.specification.cap}" stroke-linejoin="${entry.specification.join}" stroke-miterlimit="${entry.specification.miterLimit}"></polygon></svg>`])]
    })),
    ...Object.fromEntries(dashCapEvidence().cases.filter((entry) => entry.specification.audit).flatMap((entry) => {
      const stem = `${dashCapScenario}-${entry.key}-scale-${entry.scale}`
      return [[`${stem}-engine-audit.json`, entry.observation.engineAudit],
        ...[...(entry.observation.livePaint?.captures ?? []), ...entry.probes.flatMap(({ liveCapture }) => liveCapture ? [liveCapture] : [])]
          .map((capture) => [capture.screenshot, { syntheticPngBase64: syntheticDashCapLivePng(capture, entry.key).toString('base64') }]),
        ...['.input.svg', '-solid.input.svg'].map((suffix) =>
        [`${stem}${suffix}`, `<svg xmlns="http://www.w3.org/2000/svg"><polygon points="${entry.observation.engineAudit.rawPoints}" fill="none" stroke="black"></polygon></svg>`])]
    })),
  })
  return evidence
}

export { pointGroups, importRegressionScenarios, correctionScenarios, continuityScenarios, targetedPaintScenarios, importRegressionEvidence, clearRegressionEvidence, synchronizeClearSnapshot, appContinuityEvidence, polygonJoinEvidence, completePointEvidence }
