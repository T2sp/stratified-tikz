import assert from 'node:assert/strict'

// Test-side contract only. Never derive expected paint from rendered stroke,
// painted bounds, selection geometry, or the production paint/layout helpers.
function finiteMeasurement(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** Nonthrowing collection lets diagnostics persist even malformed attributes
 * before the assertion fails. The caller supplies the fixture's declared paint. */
export function observeCircleSelection(point, declaredBorder) {
  const contourRadius = finiteMeasurement(point?.contourAttributes?.radius)
  const actualHighlightRadius = finiteMeasurement(point?.highlight)
  const widthPt = finiteMeasurement(declaredBorder?.widthPt)
  const expectedStrokeWidthAttribute = widthPt === null ? null : widthPt * 1.2
  const expectedBorderWidth = typeof declaredBorder?.enabled !== 'boolean' ? null
    : declaredBorder.enabled ? expectedStrokeWidthAttribute : 0
  const expectedHalfWidth = expectedBorderWidth === null ? null : expectedBorderWidth / 2
  const expectedHighlightRadius = contourRadius === null || expectedHalfWidth === null ? null
    : contourRadius + expectedHalfWidth + 6
  return {
    source: point?.source, owner: point?.owner, request: point?.request, pointRequest: point?.pointRequest,
    fontGeneration: point?.runtime?.fontGeneration, runtime: point?.runtime, modelStyle: point?.style,
    declaredBorder, contourAttributes: point?.contourAttributes, observedContourRadius: point?.radius,
    contourRadius, actualStrokeWidth: finiteMeasurement(point?.contourAttributes?.strokeWidth),
    actualStrokeOpacity: finiteMeasurement(point?.contourAttributes?.strokeOpacity),
    actualHighlight: point?.highlight, actualHighlightRadius,
    expectedStrokeWidthAttribute, expectedBorderWidth, expectedHalfWidth, selectionPadding: 6,
    expectedHighlightRadius, delta: actualHighlightRadius === null || expectedHighlightRadius === null ? null
      : actualHighlightRadius - expectedHighlightRadius,
  }
}

/** Circle-only: polygon selection retains its separate miter-aware contract. */
export function assertCircleSelection(observation) {
  const { declaredBorder, contourAttributes } = observation
  assert.equal(contourAttributes?.kind, 'circle', 'Circle selection oracle requires a circle contour')
  assert.equal(typeof declaredBorder?.enabled, 'boolean', 'Declared border enabled is required')
  assert.ok(typeof declaredBorder.widthPt === 'number' && Number.isFinite(declaredBorder.widthPt)
    && declaredBorder.widthPt > 0, 'Declared border width must be positive finite TeX points')
  assert.ok(typeof declaredBorder.opacity === 'number' && Number.isFinite(declaredBorder.opacity)
    && declaredBorder.opacity >= 0 && declaredBorder.opacity <= 1, 'Declared border opacity is required')
  for (const key of ['observedContourRadius', 'contourRadius', 'actualStrokeWidth', 'actualStrokeOpacity',
    'actualHighlightRadius', 'expectedStrokeWidthAttribute', 'expectedBorderWidth', 'expectedHalfWidth', 'expectedHighlightRadius']) {
    assert.ok(typeof observation[key] === 'number' && Number.isFinite(observation[key]), `${key} must be a present finite measurement`)
  }
  assert.ok(observation.contourRadius >= 0, 'Contour radius must be nonnegative')
  assert.equal(observation.observedContourRadius, observation.contourRadius, 'Use the current native contour radius')
  assert.ok(typeof contourAttributes.stroke === 'string' && contourAttributes.stroke.trim() !== '', 'Contour stroke attribute is required')
  assert.equal(contourAttributes.stroke === 'none', !declaredBorder.enabled, 'Contour stroke presence matches declared border')
  // Disabled SVG strokes retain their positive stored width attribute. Only
  // their effective geometry is zero; alpha zero does not disable geometry.
  assert.equal(observation.actualStrokeWidth, observation.expectedStrokeWidthAttribute, 'Contour stroke width matches declared TeX points')
  assert.equal(observation.actualStrokeOpacity, declaredBorder.opacity, 'Contour stroke opacity matches declared border (fixture overall opacity 1)')
  assert.equal(observation.actualHighlightRadius, observation.expectedHighlightRadius,
    'Circle selection includes exactly one declared border half-width and 6 SVG units')
}
