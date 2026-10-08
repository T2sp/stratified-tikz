import assert from 'node:assert/strict'

export const layoutAnchorGroup = 'point-node-layout-anchors-combined'
export const layoutShapes = ['circle', 'rectangle', 'square', 'triangle', 'ellipse', 'diamond', 'regular polygon',
  'star', 'trapezium', 'isosceles triangle', 'kite', 'dart', 'semicircle', 'circular sector', 'cylinder']
export const layoutRegimes = [
  { key: 'unequal-padding', layout: { innerXSep: 4, innerYSep: 1, outerXSep: 0, outerYSep: 0, anchor: 'center' } },
  { key: 'zero', layout: { innerXSep: 0, innerYSep: 0, outerXSep: 0, outerYSep: 0, anchor: 'center' } },
  { key: 'negative', layout: { innerXSep: -1, innerYSep: -.5, outerXSep: -.2, outerYSep: -.1, anchor: 'center' } },
  { key: 'minimum-dominant', layout: { innerXSep: 0, innerYSep: 0, minimumWidth: 90, minimumHeight: 60, anchor: 'center' } },
  { key: 'unequal-minima', layout: { innerXSep: 2, innerYSep: 5, minimumWidth: 35, minimumHeight: 85, anchor: 'center' } },
  { key: 'outer-clearance', layout: { innerXSep: 4, innerYSep: 1, outerXSep: 8, outerYSep: 13, anchor: 'center' } },
]
export function layoutForShapeRegime(shape, regime) {
  return shape === 'cylinder' && regime.key === 'negative' ? { ...regime.layout, innerYSep: 0 } : regime.layout
}
export const standardPointAnchors = ['center', 'text', 'base', 'mid',
  'north', 'north east', 'east', 'south east', 'south', 'south west', 'west', 'north west', '17', '213']
const textSideShapes = new Set(['circle', 'rectangle', 'ellipse', 'trapezium', 'isosceles triangle', 'kite', 'dart', 'semicircle', 'cylinder'])
export function pointAnchorsForShape(shape) {
  return [...standardPointAnchors, ...(textSideShapes.has(shape) ? ['base west', 'base east', 'mid west', 'mid east'] : []), ...specificPointAnchors[shape]]
}
// Category representatives are literal PGF names. Indexed anchors exercise both
// ends of the configured family; tests below require every recorded identity.
export const specificPointAnchors = {
  circle: [], rectangle: [], square: ['corner 1', 'corner 4', 'side 1', 'side 4'],
  triangle: ['corner 1', 'corner 3', 'side 1', 'side 3'], ellipse: [], diamond: [],
  'regular polygon': ['corner 1', 'corner 7', 'side 1', 'side 7'],
  star: ['outer point 1', 'outer point 7', 'inner point 1', 'inner point 7'],
  trapezium: ['top left corner', 'top right corner', 'bottom left corner', 'bottom right corner', 'top side', 'bottom side', 'left side', 'right side'],
  'isosceles triangle': ['apex', 'left corner', 'right corner', 'left side', 'right side', 'lower side'],
  kite: ['upper vertex', 'lower vertex', 'left vertex', 'right vertex', 'upper left side', 'upper right side', 'lower left side', 'lower right side'],
  dart: ['tip', 'tail center', 'left tail', 'right tail', 'left side', 'right side'],
  semicircle: ['apex', 'arc start', 'arc end', 'chord center'],
  'circular sector': ['arc start', 'arc end', 'arc center', 'sector center'],
  cylinder: ['shape center', 'before top', 'after top', 'before bottom', 'after bottom', 'top', 'bottom'],
}
export const layoutShapeParameters = {
  'regular polygon': { regularPolygonSides: 7, borderRotate: 23 }, star: { starPoints: 7, starPointMode: 'height', starPointHeight: 8, borderRotate: 17 },
  diamond: { aspect: 1.8 }, trapezium: { trapeziumLeftAngle: 65, trapeziumRightAngle: 75, trapeziumStretches: true, trapeziumStretchesBody: true },
  'isosceles triangle': { isoscelesTriangleApexAngle: 65, isoscelesTriangleStretches: true, borderUsesIncircle: true, borderRotate: 31 },
  kite: { kiteUpperVertexAngle: 100, kiteLowerVertexAngle: 75, borderUsesIncircle: true, borderRotate: 20 },
  dart: { dartTipAngle: 55, dartTailAngle: 125 }, semicircle: { borderUsesIncircle: true, borderRotate: 33 },
  'circular sector': { circularSectorAngle: 110, borderRotate: 17 }, cylinder: { aspect: .55 },
}
export const layoutAnchorScenarios = ['point-layout-per-shape-spacing-minima', 'point-layout-anchor-support-rotation',
  'point-layout-native-controls-persistence', 'point-layout-import-order-units', 'point-layout-async-combined-isolation',
  'point-layout-native-interaction-2d-3d', 'point-layout-pending-transparent-edit', 'point-layout-pending-white-load']
export const layoutFieldKeys = ['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight', 'anchor']
export const layoutImportCases = [
  { key: 'layout ordered shorthand', options: 'inner xsep=2pt,inner sep=3pt,inner ysep=4pt,outer xsep=2pt,outer sep=5pt,outer ysep=6pt,minimum width=20pt,minimum size=30pt,minimum height=40pt', expected: { innerXSep: 3, innerYSep: 4, outerXSep: 5, outerYSep: 6, minimumWidth: 30, minimumHeight: 40 } },
  { key: 'layout ordered axis', options: 'inner sep=3pt,inner xsep=2pt,outer sep=5pt,outer xsep=2pt,minimum size=30pt,minimum width=20pt', expected: { innerXSep: 2, innerYSep: 3, outerXSep: 2, outerYSep: 5, minimumWidth: 20, minimumHeight: 30 } },
  { key: 'layout physical inches', options: 'inner xsep=1in,inner ysep=25.4mm,minimum width=2.54cm,minimum height=72.27pt', expected: { innerXSep: 72.27, innerYSep: 72.27, minimumWidth: 72.27, minimumHeight: 72.27 } },
  { key: 'layout physical bp', options: 'inner xsep=72bp,inner ysep=72.27pt', expected: { innerXSep: 72.27, innerYSep: 72.27 } },
  { key: 'layout contextual units', options: 'inner xsep=2em,inner ysep=2ex', expected: { innerXSep: 20, innerYSep: 8.61108 } },
  { key: 'layout signed zero', options: 'inner xsep=-1mm,inner ysep=0pt,outer sep=-.5pt,minimum size=0pt,anchor=base east', expected: { innerXSep: -72.27 / 25.4, innerYSep: 0, outerXSep: -.5, outerYSep: -.5, minimumWidth: 0, minimumHeight: 0, anchor: 'base east' } },
]
export function layoutAnchorArtifacts(name) {
  const files = [`${name}.json`]
  if (name.startsWith('point-layout-pending-')) files.push(`${name}.svg`, `${name}.png`, `${name}-standalone.json`, `${name}-standalone.tex`, `${name}-inlineMath.tex`)
  if (name === 'point-layout-native-controls-persistence') files.push(`${name}-saved.json`, `${name}-standalone.tex`, `${name}-inlineMath.tex`)
  if (name === 'point-layout-import-order-units') files.push(`${name}.sty`, `${name}-saved.json`, `${name}-standalone.tex`, `${name}-inlineMath.tex`)
  return files
}
export function assertPointTikzSourceByMode(outputs, source) {
  assert.ok(outputs.standalone.includes(`{${source}}`), 'Standalone retains the exact raw node body')
  const inlineBody = source.replace(/\r\n?/g, '\n').replace(/[^\S\n]*\n+[^\S\n]*/g, ' ')
  assert.ok(outputs.inlineMath.includes(`{${inlineBody}}`), 'Inline retains the established physical-line folding convention')
}
function finitePoint(point, message) {
  assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y), message)
}
export function assertObservedPointPlacement(entry) {
  assert.equal(entry.result, 'passed'); assert.equal(entry.rendered.source, entry.source)
  assert.equal(entry.rendered.shape, entry.shape); assert.equal(entry.rendered.anchor, entry.anchor)
  assert.equal(entry.rendered.pointRequest, entry.rendered.bodyRequest, 'One revision owns contour and body')
  assert.ok(['ready', 'pending', 'fallback'].includes(entry.rendered.state))
  for (const key of ['bodyOrigin', 'placement', 'anchorOffset', 'placedAnchor']) finitePoint(entry.rendered[key], key)
  for (const value of Object.values(entry.rendered.bounds)) assert.ok(Number.isFinite(value))
  assert.ok(entry.rendered.contourLength > 0)
  assert.ok(Math.abs(entry.rendered.placedAnchor.x - entry.rendered.placement.x) < .001)
  assert.ok(Math.abs(entry.rendered.placedAnchor.y - entry.rendered.placement.y) < .001)
  assert.equal(entry.modelPositionUnchanged, true)
}
export function assertLayoutAnchorEvidence(evidence, name) {
  assert.equal(evidence.scenario, name); assert.equal(evidence.group, layoutAnchorGroup); assert.equal(evidence.result, 'passed')
  assert.deepEqual(evidence.pageErrors, [])
  if (name === 'point-layout-per-shape-spacing-minima') {
    assert.equal(evidence.cases.length, layoutShapes.length * layoutRegimes.length)
    for (const shape of layoutShapes) for (const regime of layoutRegimes) {
      const found = evidence.cases.filter((entry) => entry.shape === shape && entry.regime === regime.key)
      assert.equal(found.length, 1, `${shape}/${regime.key}`); assert.deepEqual(found[0].layout, layoutForShapeRegime(shape, regime))
      assertObservedPointPlacement(found[0]); assert.equal(found[0].rendered.state, 'ready')
    }
    assert.equal(evidence.outerSepPaintInvariant.length, layoutShapes.length)
    for (const shape of layoutShapes) {
      const invariant = evidence.outerSepPaintInvariant.filter((entry) => entry.shape === shape)
      assert.equal(invariant.length, 1)
      assert.equal(invariant[0].sameContour, shape !== 'diamond')
      assert.equal(invariant[0].samePaintedBounds, shape !== 'diamond'); assert.equal(invariant[0].differentAnchorBounds, true)
      if (shape === 'diamond') {
        // PGF 3.1.11a's background radius is fitted+(1-1.414213)*outer axis,
        // independently of its enlarged anchor axes (recorded lines329–341).
        const expected = { width: 2 * .414213 * 8 * 1.2, height: 2 * .414213 * 13 * 1.2 }
        for (const [axis, difference] of Object.entries(expected)) assert.ok(Math.abs(invariant[0].paintShrink[axis] - difference) < .001)
      }
    }
  } else if (name === 'point-layout-anchor-support-rotation') {
    const expected = layoutShapes.flatMap((shape) => pointAnchorsForShape(shape).map((anchor) => ({ shape, anchor })))
    assert.equal(evidence.cases.length, expected.length)
    for (const { shape, anchor } of expected) {
      const found = evidence.cases.filter((entry) => entry.shape === shape && entry.anchor === anchor)
      assert.equal(found.length, 1, `${shape}/${anchor}`); assertObservedPointPlacement(found[0]); assert.equal(found[0].rendered.state, 'ready')
      assert.equal(found[0].rendered.bodyUpright, true)
    }
    assert.ok(evidence.unsupportedAnchor.diagnostic.length > 0)
    assert.equal(evidence.unsupportedAnchor.savedAnchor, 'not a PGF anchor')
    assert.equal(evidence.unsupportedAnchor.nativeCases.length, 6)
    for (const ambientDimension of [2, 3]) for (const shape of ['ellipse', 'circle', 'cylinder']) {
      const found = evidence.unsupportedAnchor.nativeCases.filter((entry) => entry.ambientDimension === ambientDimension && entry.shape === shape)
      assert.equal(found.length, 1)
      const entry = found[0], rendered = entry.rendered
      assert.equal(entry.result, 'passed'); assert.equal(entry.diagramUnchanged, true); assert.equal(rendered.state, 'ready')
      assert.equal(rendered.source, 'WWWW diagnostic'); assert.equal(rendered.anchor, evidence.unsupportedAnchor.savedAnchor)
      assert.ok(rendered.diagnostic.length > 0); assert.equal(rendered.contourCount, 0); assert.equal(rendered.nativeCanvasAtFarClick, true)
      assert.equal(rendered.layout.minimumWidth, 1000); assert.equal(rendered.layout.minimumHeight, 1000)
      assert.ok(rendered.shapeBounds.maxX - rendered.shapeBounds.minX >= 1000)
      assert.ok(rendered.anchorBounds.maxX - rendered.anchorBounds.minX >= 1000)
      assert.ok(Object.values(rendered.paintedBounds).every((value) => value === 0))
      for (const bounds of [rendered.bodyBounds, rendered.warningBounds]) for (const value of Object.values(bounds)) assert.ok(Number.isFinite(value))
      const inBounds = (point, bounds) => point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY
      assert.ok(inBounds(rendered.bodyClick.local, rendered.bodyBounds)); assert.ok(inBounds(rendered.warningClick.local, rendered.warningBounds))
      assert.ok(inBounds(rendered.farClick.local, rendered.shapeBounds))
      for (const bounds of [rendered.bodyBounds, rendered.warningBounds]) {
        const point = rendered.farClick.local
        assert.ok(Math.max(bounds.minX - point.x, point.x - bounds.maxX, bounds.minY - point.y, point.y - bounds.maxY, 0) > 6)
      }
      const visibleRadius = Math.max(...[rendered.bodyBounds, rendered.warningBounds].flatMap((bounds) => [
        [bounds.minX, bounds.minY], [bounds.maxX, bounds.minY], [bounds.minX, bounds.maxY], [bounds.maxX, bounds.maxY],
      ]).map(([x, y]) => Math.hypot(x - entry.ring.cx, y - entry.ring.cy)))
      assert.ok(Number.isFinite(entry.ring.radius) && entry.ring.radius >= visibleRadius && entry.ring.radius <= visibleRadius + 20)
      assert.deepEqual(entry.clicks.map(({ kind }) => kind), ['body', 'far', 'warning'])
      for (const action of entry.clicks) {
        assert.deepEqual(action.click, rendered[`${action.kind}Click`])
        if (action.kind === 'far') assert.notEqual(action.selectedId, 'app-point')
        else assert.equal(action.selectedId, 'app-point')
        for (const type of ['pointerdown', 'pointerup', 'click']) assert.ok(action.events.some((event) => event.type === type && event.trusted === true
          && Math.abs(event.x - action.click.screen.x) < 1 && Math.abs(event.y - action.click.screen.y) < 1))
      }
    }
  } else if (name === 'point-layout-native-controls-persistence') {
    for (const key of ['nativeInputs', 'historyRestored', 'clipboardRestored', 'presetRestored', 'saveReloadRestored', 'rawSourcePreserved', 'standaloneTikz', 'inlineTikz']) assert.equal(evidence[key], true, key)
    assert.equal(evidence.fields.length, 7)
    for (const key of layoutFieldKeys) {
      const found = evidence.fields.filter((field) => field.key === key)
      assert.equal(found.length, 1, `Native field identity ${key}`)
      const field = found[0]
      assert.ok(field.events.length > 0); assert.ok(field.events.every(({ type, trusted }) => type === 'input' && trusted === true))
      assert.equal(field.events.at(-1).value, field.expected, `Final trusted event ${key}`)
      assert.equal(field.value, field.expected); assert.equal(field.modelValue, field.expectedModel)
      assert.equal(field.requestsUnchanged, true)
    }
  } else if (name === 'point-layout-import-order-units') {
    assert.equal(evidence.cases.length, layoutImportCases.length)
    for (const spec of layoutImportCases) {
      const found = evidence.cases.filter((entry) => entry.key === spec.key)
      assert.equal(found.length, 1, `Imported unit/order identity ${spec.key}`)
      const entry = found[0]
      assert.equal(entry.result, 'passed'); assert.deepEqual(entry.expected, spec.expected)
      for (const [key, expected] of Object.entries(spec.expected)) {
        if (typeof expected === 'number') assert.ok(Number.isFinite(entry.actual[key]) && Math.abs(entry.actual[key] - expected) < .00001, `${spec.key}/${key}`)
        else assert.equal(entry.actual[key], expected)
      }
      assert.equal(entry.sourcePreserved, true)
    }
    for (const key of ['nativeImport', 'saveReloadRestored', 'standaloneTikz', 'inlineTikz', 'unsupportedTextMetricsDiagnosed']) assert.equal(evidence[key], true, key)
  } else if (name === 'point-layout-async-combined-isolation') {
    assert.deepEqual(evidence.transitions.map(({ key }) => key), ['pending-wide', 'ready-wide', 'fallback', 'ready-tall', 'stale-load', 'undo', 'redo', 'stale-undo', 'font-before', 'font-loaded', 'font-restored'])
    for (const entry of evidence.transitions) {
      assertObservedPointPlacement(entry); assert.equal(entry.siblingsUnchanged, true)
      assert.equal(entry.rendered.state, entry.key === 'pending-wide' ? 'pending' : entry.key === 'fallback' || entry.key.startsWith('font-') ? 'fallback' : 'ready')
      if (entry.rendered.state === 'ready') assert.ok(entry.rendered.math > 0)
    }
    assert.equal(evidence.actualMathJax, true); assert.equal(evidence.historyUnchangedOnSettle, true)
    assert.equal(evidence.nativeFontChanged, true); assert.equal(evidence.nativeFontRestored, true)
    const before = evidence.transitions.find(({ key }) => key === 'font-before').literalObservation.lines[0].width
    const loaded = evidence.transitions.find(({ key }) => key === 'font-loaded').literalObservation.lines[0].width
    const restored = evidence.transitions.find(({ key }) => key === 'font-restored').literalObservation.lines[0].width
    assert.ok(Number.isFinite(before) && Number.isFinite(loaded) && Number.isFinite(restored))
    assert.notEqual(loaded, before); assert.equal(restored, before)
    assert.equal(evidence.ownedFace.ownedFacePresent, true)
    assert.equal(evidence.fontLifecycle.restored.restored.ownedFacePresent, false)
    assert.ok(evidence.fontLifecycle.restored.restored.previousFaces.every(({ present }) => present))
  } else if (name === 'point-layout-native-interaction-2d-3d') {
    assert.equal(evidence.cases.length, 4)
    for (const ambientDimension of [2, 3]) for (const shape of ['rectangle', 'circular sector']) {
      const found = evidence.cases.filter((entry) => entry.ambientDimension === ambientDimension && entry.shape === shape)
      assert.equal(found.length, 1); assert.equal(found[0].codim, ambientDimension)
      for (const key of ['trustedBoundaryClick', 'trustedDrag', 'anchorStayedAtModel', 'undoRestored', 'redoRestored', 'altCycling', 'lockedUnchanged', 'hiddenAbsent', 'cameraPlacement', 'referenceUnchanged']) assert.equal(found[0][key], true, key)
      const selection = found[0].observed.nativeSelection
      assert.equal(selection.selected.id, selection.id)
      assert.deepEqual(selection.requestedClick, found[0].observed.boundary)
      for (const type of ['pointerdown', 'pointerup', 'click']) assert.ok(selection.events.some((event) => event.type === type && event.trusted === true))
      for (const type of ['pointerdown', 'pointermove']) assert.ok(found[0].events.some((event) => event.type === type && event.trusted === true))
      assert.ok(found[0].referenceCode.includes('at (LayoutReference)'))
    }
    assert.equal(evidence.bodyOverflowCases.length, 2)
    for (const ambientDimension of [2, 3]) {
      const found = evidence.bodyOverflowCases.filter((entry) => entry.ambientDimension === ambientDimension)
      assert.equal(found.length, 1)
      const entry = found[0]; assertObservedPointPlacement(entry)
      assert.equal(entry.shape, 'rectangle'); assert.equal(entry.anchor, 'base east'); assert.equal(entry.layout.innerXSep, -15)
      assert.equal(entry.diagramUnchanged, true)
      const { localBodyClick: click, characterBounds: ink, clickInContour: local, contourBounds: bounds, distance } = entry.rendered.bodyOverflow
      assert.ok(click.x >= ink.x && click.x <= ink.x + ink.width && click.y >= ink.y && click.y <= ink.y + ink.height)
      const measured = Math.max(bounds.x - local.x, local.x - bounds.x - bounds.width, bounds.y - local.y, local.y - bounds.y - bounds.height, 0)
      assert.ok(Number.isFinite(measured) && measured > 6); assert.equal(distance, measured)
      const ring = entry.rendered.bodyOverflow.selectionRing
      assert.ok(Number.isFinite(ring.radius) && Number.isFinite(ring.inkRadius) && ring.inkRadius > 6 && ring.radius >= ring.inkRadius)
      assert.deepEqual(entry.rendered.nativeSelection.requestedClick, entry.rendered.boundary)
      assert.equal(entry.rendered.nativeSelection.selected.id, 'overflow-overlap'); assert.equal(entry.altSelection.id, 'app-point')
      for (const type of ['pointerdown', 'pointerup', 'click']) {
        assert.ok(entry.rendered.nativeSelection.events.some((event) => event.type === type && event.trusted === true))
        assert.ok(entry.altSelection.events.some((event) => event.type === type && event.trusted === true && event.altKey === true))
      }
    }
  } else {
    assert.ok(name.startsWith('point-layout-pending-'))
    assert.equal(evidence.background, name.includes('transparent') ? 'transparent' : 'white')
    for (const key of ['actualDownload', 'capturedPending', 'reopened', 'immutableSource', 'immutableLayout', 'immutablePlacement', 'settledContour', 'combinedLabels', 'noExternalAssets']) assert.equal(evidence[key], true, key)
    assert.equal(evidence.expected.length, layoutShapes.length)
    assert.equal(evidence.click.error, undefined)
    assert.equal(evidence.click.snapshot.points.length, layoutShapes.length)
    for (const shape of layoutShapes) {
      const found = evidence.expected.filter((entry) => entry.shape === shape)
      assert.equal(found.length, 1); assertObservedPointPlacement(found[0]); assert.equal(found[0].rendered.state, 'ready')
      assert.ok(found[0].rendered.math > 0)
    }
  }
}
