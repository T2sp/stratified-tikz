import assert from 'node:assert/strict'

// Browser-side observation. The root rectangle/viewBox conversion is separate
// from the contour CTM and from the production candidate/selection helpers.
export function observeClosedDashTransferCoordinates(samples) {
  const root = document.querySelector('svg.svg-diagram')
  const contour = root.querySelector('[data-point-id="p"] [data-point-contour]')
  const rect = root.getBoundingClientRect(), box = root.viewBox.baseVal
  const matrix = contour.getScreenCTM(), css = getComputedStyle(contour), state = window.stzLabels.state()
  const ctm = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, matrix[key]]))
  return { source: contour.outerHTML, ctm,
    root: { bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      viewBox: { x: box.x, y: box.y, width: box.width, height: box.height }, style: root.getAttribute('style') },
    viewport: { width: innerWidth, height: innerHeight }, model: state.points, json: state.json, history: state.history,
    stroke: { width: css.strokeWidth, pattern: css.strokeDasharray, phase: css.strokeDashoffset, cap: css.strokeLinecap,
      join: css.strokeLinejoin, miterLimit: css.strokeMiterlimit, rawPattern: contour.getAttribute('stroke-dasharray') },
    samples: samples.map(({ local }) => {
      const viewBoxPoint = { x: 450 + local.x, y: 350 + local.y }
      return { local, viewBoxPoint,
        screenFromRoot: { x: rect.x + (viewBoxPoint.x - box.x) * rect.width / box.width,
          y: rect.y + (viewBoxPoint.y - box.y) * rect.height / box.height },
        screenFromContour: { x: matrix.a * local.x + matrix.c * local.y + matrix.e,
          y: matrix.b * local.x + matrix.d * local.y + matrix.f } }
    }) }
}

export function assertClosedDashTransferCoordinates(observed, { expectedScale, source, json, history }) {
  const { ctm, root, viewport } = observed
  assert.ok(Object.values(ctm).every(Number.isFinite), 'Fresh finite transfer CTM')
  assert.deepEqual({ a: ctm.a, b: ctm.b, c: ctm.c, d: ctm.d }, { a: expectedScale, b: 0, c: 0, d: expectedScale }, 'Actual transfer action/capture scale')
  assert.equal(observed.source, source, 'Same literal emitted transfer source')
  assert.equal(observed.json, json, 'Transfer coordinates retain model')
  assert.equal(observed.history, history, 'Transfer coordinates retain history')
  assert.ok([...Object.values(root.bounds), ...Object.values(root.viewBox), ...Object.values(viewport)].every(Number.isFinite), 'Finite independent root framing')
  assert.ok(root.bounds.width > 0 && root.bounds.height > 0 && root.viewBox.width > 0 && root.viewBox.height > 0, 'Nonempty independent root framing')
  assert.ok(Math.abs(root.bounds.width / root.viewBox.width - expectedScale) <= 1e-9
    && Math.abs(root.bounds.height / root.viewBox.height - expectedScale) <= 1e-9, 'Independent root scale matches contour scale')
  for (const sample of observed.samples) {
    assert.ok([...Object.values(sample.local), ...Object.values(sample.viewBoxPoint), ...Object.values(sample.screenFromRoot), ...Object.values(sample.screenFromContour)].every(Number.isFinite), 'Finite independently converted transfer sample')
    assert.deepEqual(sample.viewBoxPoint, { x: 450 + sample.local.x, y: 350 + sample.local.y }, 'Retained fixture origin maps the intended local sample')
    const independent = { x: root.bounds.x + (sample.viewBoxPoint.x - root.viewBox.x) * root.bounds.width / root.viewBox.width,
      y: root.bounds.y + (sample.viewBoxPoint.y - root.viewBox.y) * root.bounds.height / root.viewBox.height }
    for (const axis of ['x', 'y']) {
      assert.ok(Math.abs(sample.screenFromRoot[axis] - independent[axis]) <= 1e-9, 'Retained root conversion uses measured framing')
      assert.ok(Math.abs(sample.screenFromRoot[axis] - sample.screenFromContour[axis]) <= 1e-9, 'Independent root and contour coordinate conversions agree')
    }
    const screen = sample.screenFromRoot
    assert.ok(screen.x >= root.bounds.x && screen.x < root.bounds.x + root.bounds.width
      && screen.y >= root.bounds.y && screen.y < root.bounds.y + root.bounds.height
      && screen.x >= 0 && screen.x < viewport.width && screen.y >= 0 && screen.y < viewport.height, 'Transfer sample inside action root and viewport')
  }
}
