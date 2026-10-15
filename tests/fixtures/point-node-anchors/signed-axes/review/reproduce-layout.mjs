import { writeFileSync } from 'node:fs';
const root = '/Users/takamatoshinori/Desktop/stratified-tikz';
const load = (file) => import(`${root}/${file}`);
const { createEmptyDiagram, createPointStratum } = await load('src/model/constructors.ts');
const { defaultPointStyle } = await load('src/model/styles.ts');
const { validateDiagram } = await load('src/model/validation.ts');
const { serializeDiagram, parseSavedDiagramJson } = await load('src/model/serialization.ts');
const { generateTikz } = await load('src/tikz/generateTikz.ts');
const { createLabelService } = await load('src/rendering/labels/labelService.ts');
const { createSvgLabelRuntime } = await load('src/rendering/labels/svgLabelRuntime.ts');
const { svgLabelLayoutSettings } = await load('src/rendering/labels/svgLabelLayout.ts');
const { captureSvgLabelExport } = await load('src/rendering/svgLabelExportRegistry.ts');
const { svgPointNodeLayout, svgPointNodeOwner } = await load('src/rendering/svgPointNodeLayout.ts');
const { settleSvgExportLabels, renderSettledSvgLabelDocument } = await load('src/ui/svgSettledExport.ts');
const { collectSvgPreviewSelectionCandidates } = await load('src/rendering/svgHitTesting.ts');
const { projectToSvgPoint } = await load('src/rendering/svgProjection.ts');
// Fixed metrics match the independent PGF body: width20pt, height8pt, depth3pt.
// This is a pure fixed-box production integration check, not native or MathJax evidence.
const measurement = { identity: 'review-fixed-20-8-3',
  measure: () => ({ width: 24, ascent: 9.6, descent: 3.6 }),
  lineMetrics: () => ({ ascent: 9.6, descent: 3.6 }) };
const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) });
const output = [];
for (const [id, shape, inner, minimumWidth, minimumHeight, anchor] of [
  ['ellipse-small', 'ellipse', -30, -2, -5, 'east'],
  ['rectangle-small', 'rectangle', -30, -2, -5, 'east'],
  ['ellipse-strong', 'ellipse', -100, -160, -160, 'center'],
  ['ellipse-empty', 'ellipse', -100, -160, -160, 'east'],
  ['rectangle-empty', 'rectangle', -100, -160, -160, 'east'],
]) {
  const source = id.endsWith('-empty') ? '' : 'x';
  const point = createPointStratum({ ambientDimension: 2, id: 'p', text: source, position: { x: 1, y: 2, z: 0 },
    style: { ...defaultPointStyle, shape, layout: { innerXSep: inner, innerYSep: inner,
      outerXSep: 0, outerYSep: 0, minimumWidth, minimumHeight, anchor } } });
  const diagram = { ...createEmptyDiagram({ ambientDimension: 2 }), strata: [point] };
  const saved = serializeDiagram(diagram);
  const capture = captureSvgLabelExport({ runtime, source, pointStyle: point.style, position: { x: 123, y: 87 },
    fontSize: 12, fontFamily: 'Times New Roman, Times, serif', color: '#000000', opacity: 1, anchor: 'center',
    settings: svgLabelLayoutSettings(12, 'Times New Roman, Times, serif'), ownerIdentity: svgPointNodeOwner(1, 'p') });
  const [state] = await settleSvgExportLabels([capture]);
  const layout = svgPointNodeLayout(point.style, state);
  const item = { id, validation: validateDiagram(diagram), loaded: parseSavedDiagramJson(saved).ok,
    limitation: layout.geometry.limitation ?? null, selectedAnchor: layout.selectedAnchor,
    placementOffset: layout.placementOffset, bodyMetrics: state.layout.metrics,
    vertices: layout.geometry.vertices, path: layout.geometry.solution.contours[0].path,
    tikzNode: generateTikz(diagram).match(/\\node\[[\s\S]*?\] at[^;]+;/)?.[0] };
  if (id === 'ellipse-strong') {
    const projected = projectToSvgPoint(diagram.camera, point.position, 360);
    const testPoint = { x: projected.x + 67.2, y: projected.y - 67.2 };
    const entry = { source: 'x', ownerIdentity: svgPointNodeOwner(1, 'p'), fontGeneration: 0,
      shape, size: point.style.size, requestIdentity: state.requestIdentity, layout };
    item.picking = { localPoint: { x: 67.2, y: -67.2 }, paintedRadius: 96,
      distanceFromPaintCenter: Math.hypot(67.2, 67.2),
      samplingBoundaryDistance: (134.4 - 96) / Math.SQRT2,
      candidates: collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight: 360,
        point: testPoint, pointCommits: new Map([['p', entry]]), pointDocumentRevision: 1, pointFontGeneration: 0,
        showCoordinateAnchors: false }) };
  }
  writeFileSync(new URL(`${id}.svg`, import.meta.url), renderSettledSvgLabelDocument(capture, state));
  writeFileSync(new URL(`${id}.json`, import.meta.url), saved);
  output.push(item);
}
writeFileSync(new URL('production-results.json', import.meta.url), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
