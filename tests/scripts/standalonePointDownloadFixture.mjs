import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { geometricShapeGroup, geometricShapeManifest } from '../../scripts/pointGeometricShapesContract.mjs'
import { layoutAnchorGroup, layoutShapes } from '../../scripts/pointLayoutAnchorsContract.mjs'

// Fabricated policy records use a complete retained PNG only to exercise byte
// validation. They do not assert native download or screenshot acceptance.
const fixturePng = readFileSync(new URL('../fixtures/dash-cap-native-endpoints/point-paint-dash-caps-triangle-square-wide-scale-0.5-edit-dashPhase.screen.png', import.meta.url))
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

export function syntheticStandalonePointDownload(directory, scenario) {
  const geometric = scenario.startsWith('point-geometric-download-')
  const background = scenario.includes('transparent') ? 'transparent' : 'white'
  const group = geometric ? geometricShapeGroup : layoutAnchorGroup
  const specs = geometric ? geometricShapeManifest : layoutShapes.map((shape) => ({ shape, slug: shape.replaceAll(' ', '-'), parameters: {} }))
  const expected = specs.map((spec, index) => {
    const shape = spec.shape, source = `${spec.slug} $x_i$`, id = `${geometric ? 'geometric' : 'layout'}-${spec.slug}`
    const anchor = shape === 'cylinder' ? 'shape center' : 'base', layout = { innerXSep: 4, innerYSep: 2, anchor }
    const contour = { tag: 'path', attributes: { d: `M${index},0 L${index + 3},0 L${index + 3},3 Z`, stroke: '#000000', fill: 'none' } }
    const paintRegions = shape === 'cylinder' ? ['#99ddff', '#ffcc66'].map((fill, index) => ({ role: index ? 'body' : 'end',
      tag: 'path', attributes: { d: `M${index},0 L3,0 L3,3 Z`, stroke: 'none', fill } })) : []
    const rendered = { source, shape, state: 'ready', math: 1, contourLength: 120, parameters: spec.parameters,
      contour, paintRegions, anchor, pointRequest: 'settled', bodyRequest: 'settled',
      bodyOrigin: { x: -20, y: -12 }, placement: { x: 310, y: 290 }, anchorOffset: { x: 20, y: 4 },
      placedAnchor: { x: 310, y: 290 }, bounds: { x: -20, y: -10, width: 40, height: 20 },
      nodeTransform: `translate(${index * 10},20)`, bodyTransform: 'translate(-20,-12)' }
    return { id, source, shape, ...(geometric ? {} : { result: 'passed', anchor, layout, modelPositionUnchanged: true }), rendered }
  })
  const click = { snapshot: { points: expected.map((entry, index) => ({ id: entry.id, source: entry.source, status: index ? 'ready' : 'pending',
    nodeTransform: entry.rendered.nodeTransform, style: { shape: entry.shape, shapeParameters: specs[index].parameters, ...(geometric ? {} : { layout: entry.layout }) } })) } }
  const svgPath = resolve(directory, `${scenario}.svg`), pngPath = resolve(directory, `${scenario}.png`)
  const fileUrl = pathToFileURL(svgPath).href
  const root = { localName: 'svg', namespace: 'http://www.w3.org/2000/svg', width: '520', height: '360', viewBox: '0 0 520 360' }
  const measurements = { url: fileUrl, contentType: 'image/svg+xml', readyState: 'complete', bodyExists: false, htmlBodyExists: false, parserErrors: [],
    root: { ...root, bounds: { x: 0, y: 0, width: 520, height: 360 } }, viewport: { width: 1500, height: 1150 }, scroll: { x: 0, y: 0 }, devicePixelRatio: 2 }
  const capture = { status: 'saved', requestedPath: pngPath, retainedPath: pngPath, fileExists: true,
    options: { path: pngPath, fullPage: false, scale: 'css', timeout: 5000 }, measurements: [measurements], before: measurements, after: structuredClone(measurements),
    coverage: { completeRoot: true, bounds: measurements.root.bounds, viewport: measurements.viewport }, coordinatesStable: true,
    png: { width: 1500, height: 1150, bytes: fixturePng.length } }
  const pending = { contour: { tag: 'path', attributes: { d: 'M0,0 L1,0 Z' } } }
  const outputs = Object.fromEntries(['standalone', 'inlineMath'].map((mode) => [mode,
    expected.map((entry) => `\\node[anchor=${entry.shape === 'cylinder' ? 'shape center' : 'base'}] {${entry.source}};`).join('\n')]))
  const evidence = { scenario, group, result: 'passed', pageErrors: [], background, expected, click, capture,
    actualDownload: true, reopened: true, immutableSource: true, noExternalAssets: true,
    ...(geometric ? { shapes: specs.map(({ shape }) => shape), immutableParameters: true, separateCylinderPaints: true }
      : { capturedPending: true, immutableLayout: true, immutablePlacement: true, settledContour: true, combinedLabels: true, pending }) }
  const reopened = expected.map((entry) => ({ source: entry.source, shape: entry.shape, contour: entry.rendered.contour, glyphs: 1, errors: 0,
    ...(geometric ? { regions: entry.rendered.paintRegions.map((region) => ({ tag: region.tag, attributes: region.attributes })) }
      : { nodeTransform: entry.rendered.nodeTransform, bodyTransform: entry.rendered.bodyTransform }) }))
  const raw = { scenario, group, result: 'observed', background, svgPath, fileUrl, expected: structuredClone(expected), click: structuredClone(click), capture,
    requests: [fileUrl], pageErrors: [], standaloneErrors: [], cleanupErrors: [], reopened: structuredClone(reopened),
    document: { root, forbiddenCount: 0, externalReferences: [], backgroundCount: background === 'white' ? 1 : 0 },
    ...(geometric ? {} : { pending: structuredClone(pending), outputs }) }
  const element = ({ tag, attributes }) => `<${tag} ${Object.entries(attributes).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}/>`
  const svg = `<svg xmlns="${root.namespace}" width="520" height="360" viewBox="0 0 520 360">${background === 'white' ? '<rect data-stratified-tikz-export-background="white" width="520" height="360" fill="white"/>' : ''}`
    + expected.map((entry) => `<g transform="${entry.rendered.nodeTransform}">${element(entry.rendered.contour)}${entry.rendered.paintRegions.map(element).join('')}<g transform="${entry.rendered.bodyTransform}"><title>${escape(entry.source)}</title><path d="M0,0 L1,1"/></g></g>`).join('') + '</svg>'
  writeFileSync(svgPath, svg); writeFileSync(pngPath, fixturePng)
  for (const [mode, source] of Object.entries(outputs)) if (!geometric) writeFileSync(resolve(directory, `${scenario}-${mode}.tex`), source)
  return { evidence, raw, svgPath, pngPath, svg, png: Buffer.from(fixturePng) }
}
