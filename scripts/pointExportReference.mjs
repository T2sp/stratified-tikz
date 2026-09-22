import assert from 'node:assert/strict'

// Compare native Canvas quantities in declared local font units. SVG advances
// can differ with the viewport's device scale; exported contours/bounds are
// intentionally absent from this independent environment check.
const fontProperties = ['font-family', 'font-size', 'font-style', 'font-weight',
  'font-stretch', 'font-kerning', 'letter-spacing', 'word-spacing', 'text-rendering', 'tab-size']
const canvasProperties = ['requested', 'effective', 'textAlign', 'textBaseline',
  'direction', 'fontKerning', 'textRendering', 'fontStretch', 'letterSpacing', 'wordSpacing']
const requiredMetrics = ['width', 'actualBoundingBoxAscent', 'actualBoundingBoxDescent',
  'actualBoundingBoxLeft', 'actualBoundingBoxRight']
const optionalMetrics = ['fontBoundingBoxAscent', 'fontBoundingBoxDescent']
const normalizedSource = (source) => source.replace(/\r\n?/gu, '\n')
// CSS serializes multiword declared families with quotes. This normalization
// only relates request declarations to computed CSS; FontFace descriptors below
// remain exact and are never used to select/delete a face.
const declaredFamilies = (family) => family.split(',').map((part) => part.trim().replace(/^(["'])(.*)\1$/u, '$2'))

function requiredProperties(value, keys, name) {
  assert.ok(value && typeof value === 'object', `${name}: missing properties`)
  return Object.fromEntries(keys.map((key) => {
    assert.ok(typeof value[key] === 'string' && value[key] !== '', `${name}: missing ${key}`)
    return [key, value[key]]
  }))
}

function canvasMetrics(value, name) {
  assert.ok(value && typeof value === 'object', `${name}: missing Canvas metrics`)
  const keys = [...requiredMetrics, ...optionalMetrics.filter((key) => value[key] !== undefined)]
  for (const key of keys) assert.ok(Number.isFinite(value[key]), `${name}: nonfinite ${key}`)
  assert.ok(value.width >= 0, `${name}: negative width`)
  return Object.fromEntries(keys.map((key) => [key, value[key]]))
}

function localRequest(point, name) {
  assert.equal(typeof point.source, 'string', `${name}: missing source`)
  assert.equal(typeof point.request, 'string', `${name}: missing request`)
  const request = JSON.parse(point.request)
  assert.ok(Array.isArray(request) && request.length === 9, `${name}: request shape`)
  assert.equal(request[0], point.source, `${name}: request source`)
  assert.equal(point.pointRequest, point.request, `${name}: contour/body request`)
  assert.ok(point.runtime, `${name}: missing current runtime`)
  assert.equal(request[5], point.runtime.fontGeneration, `${name}: stale local font generation`)
  assert.equal(request[8], point.owner, `${name}: stale local owner`)
  const owner = JSON.parse(point.owner)
  assert.ok(Array.isArray(owner) && owner.length === 3 && owner[0] === 'point-node'
    && typeof owner[2] === 'string' && owner[2] !== '', `${name}: point owner shape`)
  assert.equal(owner[1], point.runtime.documentRevision, `${name}: stale document revision`)
  assert.ok(['pending', 'ready', 'fallback'].includes(point.status), `${name}: missing layout status`)
  const literal = point.literalObservation
  assert.ok(literal, `${name}: missing native literal observation`)
  assert.equal(literal.request, point.request, `${name}: native observation request`)
  assert.equal(literal.pointRequest, point.pointRequest, `${name}: native observation contour request`)
  assert.equal(literal.source, point.source, `${name}: native observation source`)
  assert.equal(literal.title, point.source, `${name}: native observation title`)
  assert.equal(literal.status, point.status, `${name}: native observation status`)
  const properties = literal.font?.properties
  assert.ok(properties, `${name}: missing declared native font`)
  assert.deepEqual(declaredFamilies(properties['font-family']), declaredFamilies(request[1]), `${name}: request font family`)
  assert.equal(properties['font-size'], `${request[2]}px`, `${name}: request font size`)
  assert.equal(properties['font-weight'], request[3], `${name}: request font weight`)
  assert.equal(properties['font-style'], request[4], `${name}: request font style`)
  assert.equal(Number(properties['tab-size']), request[6], `${name}: request tab size`)
  assert.equal(literal.lineGap, request[2] * request[7], `${name}: request line gap`)
  return request.filter((_, index) => index !== 5 && index !== 8)
}

function measurementEnvironment(observation, source, name) {
  assert.ok(observation, `${name}: missing native observation`)
  const properties = requiredProperties(observation.font?.properties, fontProperties, `${name} font`)
  const configuration = requiredProperties(observation.canvasConfiguration, canvasProperties, `${name} Canvas`)
  assert.equal(configuration.requested,
    `${properties['font-style']} ${properties['font-weight']} ${properties['font-size']} ${properties['font-family']}`,
    `${name}: Canvas requested font matches declared font`)
  const readiness = observation.fontReadiness
  assert.ok(readiness, `${name}: missing font readiness`)
  assert.equal(readiness.status, 'loaded', `${name}: fonts ready`)
  assert.equal(readiness.checked, true, `${name}: intended native font ready`)
  assert.ok(Array.isArray(readiness.faces), `${name}: missing FontFaceSet observations`)
  const faces = readiness.faces.map((face) => requiredProperties(face, ['family', 'style', 'weight', 'status'], `${name} FontFace`))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const fontProbe = canvasMetrics(observation.fontProbe, `${name} Mg probe`)
  const space = canvasMetrics(observation.space, `${name} space probe`)
  const sourceLines = source === '' ? [] : source.split(/\r\n|[\r\n]/u)
  const tokens = sourceLines.flatMap((line, index) => line.split('\t').filter(Boolean).map((text) => ({ text, line: index })))
  assert.ok(Array.isArray(observation.measurements), `${name}: missing source measurements`)
  assert.deepEqual(observation.measurements.map(({ text, line }) => ({ text, line })), tokens, `${name}: exact source measurement tokens`)
  const measurements = observation.measurements.map(({ text, line, canvas }, index) => ({ text, line,
    canvas: canvasMetrics(canvas, `${name} source measurement ${index}`) }))
  assert.ok(Array.isArray(observation.lines), `${name}: missing native logical lines`)
  assert.equal(observation.lines.length, sourceLines.length, `${name}: physical line count`)
  const lines = observation.lines.map((line, index) => Object.fromEntries(['width', 'ascent', 'descent', 'baseline'].map((key) => {
    assert.ok(Number.isFinite(line[key]), `${name}: line ${index} ${key}`)
    return [key, line[key]]
  })))
  const lineContract = observation.lineContract
  assert.ok(lineContract && Number.isFinite(lineContract.ascent) && Number.isFinite(lineContract.descent)
    && typeof lineContract.method === 'string', `${name}: missing native line contract`)
  assert.ok(Number.isFinite(observation.lineGap), `${name}: missing line gap`)
  return { properties, configuration, faces, fontProbe, space, measurements, lines,
    lineContract: { ascent: lineContract.ascent, descent: lineContract.descent, method: lineContract.method }, lineGap: observation.lineGap }
}

/** Guard every radius/bounds comparison with the export-click snapshot and
 * current, settled renderer result. Runtime counters and owners are page-local.
 * The live App may already have a later source/document when this runs. */
export function assertPointExportCompatibility({ click, saved, reference }) {
  const clickRequest = localRequest(click, 'export click')
  const referenceRequest = localRequest(reference, 'renderer reference')
  assert.ok(['ready', 'fallback'].includes(reference.status), 'renderer reference: layout must be settled')
  assert.equal(reference.source, click.source, 'renderer reference: captured source')
  assert.deepEqual(referenceRequest, clickRequest, 'renderer reference: captured font configuration')
  const styleKeys = ['shape', 'size', 'color', 'opacity', 'fill']
  for (const key of styleKeys) {
    assert.notEqual(click.style?.[key], undefined, `export click: missing point style ${key}`)
    assert.equal(reference.style?.[key], click.style[key], `renderer reference: captured point style ${key}`)
  }
  assert.equal(saved.source, normalizedSource(click.source), 'saved SVG: captured source with XML newline normalization')
  assert.equal(saved.literalObservation?.title, saved.source, 'saved SVG: native observation source title')
  assert.equal(saved.contourKind, click.style.shape === 'circle' ? 'circle' : 'polygon', 'saved SVG: captured contour kind')
  assert.equal(Number(saved.opacity), click.style.opacity, 'saved SVG: captured point opacity')
  assert.equal(saved.paints?.stroke?.toLowerCase(), click.style.color.toLowerCase(), 'saved SVG: captured point color')
  assert.equal(saved.paints?.fill?.toLowerCase(), click.style.fill === 'hollow' ? '#ffffff' : click.style.color.toLowerCase(), 'saved SVG: captured point fill')
  assert.equal(saved.paints?.text?.toLowerCase(), '#000000', 'saved SVG: point body text color')
  const environment = measurementEnvironment(click.literalObservation, click.source, 'export click')
  assert.deepEqual(measurementEnvironment(reference.literalObservation, click.source, 'renderer reference'), environment,
    'renderer reference: compatible native font environment and exact-source Canvas metrics')
  assert.deepEqual(measurementEnvironment(saved.literalObservation, click.source, 'saved SVG'), environment,
    'saved SVG: compatible native font environment and exact-source Canvas metrics')
}
