import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

// This narrowly scoped proof concerns only the seven point-only fixture owners.
// Their common render category/depth makes the production total key layer -> ID.
export const signedPointRenderOrderProof = Object.freeze({
  source: 'src/rendering/svgRenderSort.ts',
  sha256: 'a271d1f4202a01c5a7046c080286cc7a19aead788ce3b73a8dc7b558a2b0609a',
  pointOnlyKey: ['layer', 'id'],
})
// The unchanged production SvgDiagram and standalone sanitizer emit this root
// for this fixed point-only fixture in both dimensions. No root transform or
// inherited paint may escape the file-local matrix/paint replay.
export const signedPointStandaloneRootAttributes = Object.freeze({
  xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 520 360', preserveAspectRatio: 'xMidYMid meet',
  version: '1.1', style: 'color:#94a3b8;font-family:Inter,Arial,sans-serif;', width: '520', height: '360',
})
const svgNamespace = 'http://www.w3.org/2000/svg'
const matrixKeys = ['a', 'b', 'c', 'd', 'e', 'f']
const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
const fixtureOwnerOrder = ['signed-regular-polygon', 'signed-square', 'signed-triangle',
  'signed-star', 'signed-isosceles-triangle', 'signed-dart', 'signed-zero-axis']
const fixtureShapeOrder = ['regular polygon', 'square', 'triangle', 'star', 'isosceles triangle', 'dart', 'ellipse']

// Browser observers deliberately return document order, native metadata and
// structural ownership. They never copy expected shape/ID onto sanitized nodes.
export function observeSignedPointPreExport() {
  const roots = [...document.querySelectorAll('svg.svg-diagram')], root = roots[0]
  const path = (element) => {
    const result = []
    for (let current = element; current && current !== root; current = current.parentElement) {
      if (!current.parentElement) return null
      result.unshift([...current.parentElement.children].indexOf(current))
    }
    return element && root?.contains(element) ? result : null
  }
  const matrix = (value) => value && Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, value[key]]))
  const structure = (node, body, contour, title) => ({
    nodePath: path(node), bodyPath: path(body), contourPath: path(contour), titlePath: path(title),
    nodeTag: node?.localName ?? null, bodyTag: body?.localName ?? null,
    contourTag: contour?.localName ?? null, titleTag: title?.localName ?? null,
    nodeChildTags: node ? [...node.children].map((entry) => entry.localName) : [],
    bodyChildTags: body ? [...body.children].map((entry) => entry.localName) : [],
    titleCount: body ? [...body.children].filter((entry) => entry.localName === 'title').length : 0,
    bodyCount: node ? [...node.children].filter((entry) => [...entry.children].some((child) => child.localName === 'title')).length : 0,
    contourCount: node ? [...node.children].filter((entry) => entry.localName === 'path' && entry.hasAttribute('stroke')).length : 0,
    connected: { node: node?.isConnected === true, body: body?.isConnected === true,
      contour: contour?.isConnected === true, title: title?.isConnected === true },
    currentRoot: { node: node?.ownerSVGElement === root, body: body?.ownerSVGElement === root,
      contour: contour?.ownerSVGElement === root, title: title?.ownerSVGElement === root },
  })
  const state = window.stzAppLabels.state(), runtime = window.stzAppLabels.pointRuntime()
  return { url: location.href, rootCount: roots.length, rootConnected: root?.isConnected === true,
    rootOwnerDocument: root?.ownerDocument === document, labelDocumentRevision: state.labelDocumentRevision, runtime,
    root: root ? { localName: root.localName, namespace: root.namespaceURI, width: root.getAttribute('width'),
      height: root.getAttribute('height'), viewBox: root.getAttribute('viewBox') } : null,
    points: root ? [...root.querySelectorAll('[data-point-id] [data-point-node]')].map((node, domOrdinal) => {
      const body = node.querySelector('[data-label-state]'), contour = node.querySelector('[data-point-contour]')
      const title = body && [...body.children].find((entry) => entry.localName === 'title')
      return { domOrdinal, id: node.closest('[data-point-id]')?.getAttribute('data-point-id') ?? null,
        source: title?.textContent ?? null, bodySource: body?.getAttribute('data-label-source') ?? null,
        shape: node.getAttribute('data-point-shape'), owner: node.getAttribute('data-point-node'),
        request: node.getAttribute('data-point-request'), bodyRequest: body?.getAttribute('data-label-request') ?? null,
        state: body?.getAttribute('data-label-state') ?? null, nodeTransform: node.getAttribute('transform'),
        bodyTransform: body?.getAttribute('transform') ?? null, structure: structure(node, body, contour, title),
        matrices: { nodeCTM: matrix(node.getCTM()), bodyCTM: matrix(body?.getCTM()), contourCTM: matrix(contour?.getCTM()),
          nodeScreenCTM: matrix(node.getScreenCTM()), bodyScreenCTM: matrix(body?.getScreenCTM()), contourScreenCTM: matrix(contour?.getScreenCTM()) } }
    }) : [] }
}

export function observeSignedPointReopening() {
  const root = document.documentElement
  const path = (element) => {
    const result = []
    for (let current = element; current && current !== root; current = current.parentElement) {
      if (!current.parentElement) return null
      result.unshift([...current.parentElement.children].indexOf(current))
    }
    return element && root.contains(element) ? result : null
  }
  const matrix = (value) => value && Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, value[key]]))
  const clean = (element) => ({ tag: element.localName, attributes: Object.fromEntries([...element.attributes]
    .filter(({ name }) => !name.startsWith('data-') && name !== 'pointer-events').map(({ name, value }) => [name, value])) })
  const titles = [...root.querySelectorAll('g > title')]
  const reopened = titles.map((title, domOrdinal) => {
    const body = title.parentElement, node = body?.parentElement
    const contours = node ? [...node.children].filter((element) => element.localName === 'path' && element.hasAttribute('stroke')) : []
    const contour = contours[0]
    return { domOrdinal, source: title.textContent, contour: contour ? clean(contour) : null,
      nodeTransform: node?.getAttribute('transform') ?? null, bodyTransform: body?.getAttribute('transform') ?? null,
      screenCTM: matrix(contour?.getScreenCTM?.()), errors: document.querySelectorAll('parsererror,foreignObject,image,script').length,
      structure: { nodePath: path(node), bodyPath: path(body), contourPath: path(contour), titlePath: path(title),
        nodeTag: node?.localName ?? null, bodyTag: body?.localName ?? null, contourTag: contour?.localName ?? null, titleTag: title.localName,
        nodeChildTags: node ? [...node.children].map((entry) => entry.localName) : [], bodyChildTags: [...body.children].map((entry) => entry.localName),
        titleCount: [...body.children].filter((entry) => entry.localName === 'title').length,
        bodyCount: node ? [...node.children].filter((entry) => [...entry.children].some((child) => child.localName === 'title')).length : 0,
        contourCount: contours.length,
        connected: { node: node?.isConnected === true, body: body.isConnected, contour: contour?.isConnected === true, title: title.isConnected },
        currentRoot: { node: node?.ownerSVGElement === root, body: body.ownerSVGElement === root,
          contour: contour?.ownerSVGElement === root, title: title.ownerSVGElement === root } },
      matrices: { nodeCTM: matrix(node?.getCTM?.()), bodyCTM: matrix(body.getCTM?.()), contourCTM: matrix(contour?.getCTM?.()),
        nodeScreenCTM: matrix(node?.getScreenCTM?.()), bodyScreenCTM: matrix(body.getScreenCTM?.()), contourScreenCTM: matrix(contour?.getScreenCTM?.()) } }
  })
  const bounds = root.getBoundingClientRect()
  return { reopened, document: { root: { localName: root.localName, namespace: root.namespaceURI,
    width: root.getAttribute('width'), height: root.getAttribute('height'), viewBox: root.getAttribute('viewBox') },
    rootAttributes: Object.fromEntries([...root.attributes].map(({ name, value }) => [name, value])),
    forbiddenCount: document.querySelectorAll('parsererror,foreignObject,image,script,[data-svg-export-exclude]').length,
    externalReferences: [...document.querySelectorAll('[href]')].map((element) => element.getAttribute('href'))
      .filter((href) => !href.startsWith('#') || !document.getElementById(href.slice(1))),
    backgroundCount: document.querySelectorAll('[data-stratified-tikz-export-background]').length,
    inventory: { titleCount: root.querySelectorAll('title').length, pathCount: root.querySelectorAll('path').length,
      groupCount: root.querySelectorAll('g').length, rootChildTags: [...root.children].map((element) => element.localName),
      contourCandidates: [...root.querySelectorAll('path')].map((element) => ({ path: path(element), parentPath: path(element.parentElement),
        parentTransform: element.parentElement?.getAttribute('transform') ?? null,
        siblingBodyCount: element.parentElement ? [...element.parentElement.children]
          .filter((entry) => [...entry.children].some((child) => child.localName === 'title')).length : 0 })) },
    frame: { url: location.href, contentType: document.contentType, readyState: document.readyState,
      rootConnected: root.isConnected, rootOwnerDocument: root.ownerDocument === document,
      rootCTM: matrix(root.getCTM?.()), rootScreenCTM: matrix(root.getScreenCTM?.()),
      rootBounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      scroll: { x: window.scrollX, y: window.scrollY }, viewport: { width: window.innerWidth, height: window.innerHeight } } } }
}

function translate(value) {
  const match = /^translate\(\s*([^\s,]+)[\s,]+([^\s,)]+)\s*\)$/u.exec(value ?? '')
  if (!match) return null
  const x = Number(match[1]), y = Number(match[2])
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}
const placementKey = (placement) => placement ? `${placement.x},${placement.y}` : null
function canonicalPoints(points) {
  return points.map((point, expectedIndex) => ({ point, expectedIndex }))
    .sort((left, right) => left.point.layer - right.point.layer || left.point.id.localeCompare(right.point.id))
}

// Derivation is retained even when authentication/structure fails. Matching uses
// only the unique outer placement and pre-export native owners, never d/paint or
// the fitted body/anchor translation whose correctness is subsequently tested.
export function createSignedPointAssociationCandidate(input) {
  try { return deriveSignedPointAssociationCandidate(input) }
  catch (error) {
    return { schema: 'stz-signed-point-standalone-association-v1', expectedOrder: [], renderOrder: [],
      candidates: (Array.isArray(input?.reopened) ? input.reopened : []).map((entry, arrayIndex) => ({
        actualDomOrdinal: entry?.domOrdinal ?? null, projectedPlacement: translate(entry?.nodeTransform),
        ownerCandidates: [], expectedIndices: [], failureReasons: ['association-derivation-failed'], arrayIndex })),
      associations: [], failureReasons: [{ reason: 'association-derivation-failed', message: error.message }] }
  }
}
function deriveSignedPointAssociationCandidate(input) {
  const expected = input.expected ?? [], observed = input.preExport?.points ?? [], reopened = input.reopened ?? []
  const failureReasons = [], candidates = [], associations = []
  let canonical = []
  try { canonical = canonicalPoints(expected.map((entry) => entry.modelPoint)) }
  catch (error) { failureReasons.push({ reason: 'invalid-immutable-owners', message: error.message }) }
  for (const [arrayIndex, actual] of reopened.entries()) {
    const projectedPlacement = translate(actual.nodeTransform)
    const owners = observed.filter((entry) => placementKey(translate(entry.nodeTransform)) === placementKey(projectedPlacement))
    const expectedIndices = owners.flatMap((owner) => expected.flatMap((entry, index) => entry.id === owner.id ? [index] : []))
    const reasons = []
    if (!projectedPlacement) reasons.push('nonfinite-or-unsupported-outer-placement')
    if (actual.domOrdinal !== arrayIndex) reasons.push('document-ordinal-does-not-match-observed-order')
    if (owners.length !== 1 || expectedIndices.length !== 1) reasons.push('missing-duplicate-foreign-or-ambiguous-owner-placement')
    if (owners.length === 1 && owners[0].id !== canonical[arrayIndex]?.point.id) reasons.push('noncanonical-render-order')
    try { assertStructure(actual.structure) } catch { reasons.push('invalid-native-group-body-contour-ownership') }
    try {
      for (const name of ['nodeCTM', 'bodyCTM', 'contourCTM', 'nodeScreenCTM', 'bodyScreenCTM', 'contourScreenCTM']) assertFiniteMatrix(actual.matrices?.[name])
      assertFiniteMatrix(actual.screenCTM)
    } catch { reasons.push('nonfinite-singular-or-missing-native-matrix') }
    if (actual.source !== '' || actual.errors !== 0) reasons.push('foreign-native-source-or-reopening-error')
    if (Object.hasOwn(actual, 'id') || Object.hasOwn(actual, 'shape')) reasons.push('derived-identity-present-as-native-metadata')
    const candidate = { actualDomOrdinal: actual.domOrdinal, projectedPlacement, ownerCandidates: owners.map(({ id, domOrdinal }) => ({ id, domOrdinal })),
      expectedIndices, failureReasons: reasons }
    candidates.push(candidate)
    failureReasons.push(...reasons.map((reason) => ({ arrayIndex, reason })))
    if (reasons.length === 0) associations.push({ expectedId: owners[0].id, expectedIndex: expectedIndices[0],
      actualDomOrdinal: actual.domOrdinal, preExportDomOrdinal: owners[0].domOrdinal, projectedPlacement,
      derivedShape: expected[expectedIndices[0]].shape, identityOrigin: 'derived-pre-export-owner-order-and-projected-placement' })
  }
  try { assertOwnerInputs(input) } catch (error) { failureReasons.push({ reason: 'owner-authentication', message: error.message }) }
  const inventory = input.document?.inventory
  if (!inventory || inventory.pathCount !== 7 || inventory.titleCount !== 7 || inventory.groupCount !== 36
    || inventory.contourCandidates?.length !== 7) failureReasons.push({ reason: 'missing-duplicate-or-foreign-file-group-inventory' })
  try { assert.deepEqual(input.document?.rootAttributes, signedPointStandaloneRootAttributes) }
  catch (error) { failureReasons.push({ reason: 'document-root-attributes', message: error.message }) }
  return { schema: 'stz-signed-point-standalone-association-v1', expectedOrder: expected.map(({ id }) => id),
    renderOrder: canonical.map(({ point }) => point.id), candidates, associations, failureReasons }
}

function assertFiniteMatrix(matrix) {
  assert.ok(matrix && matrixKeys.every((key) => Number.isFinite(matrix[key])), 'Current native SVG matrix is finite')
  assert.ok(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) > 1e-12, 'Current native SVG matrix is invertible')
}
function multiply(left, right) {
  return { a: left.a * right.a + left.c * right.b, b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d, d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e, f: left.b * right.e + left.d * right.f + left.f }
}
function translationMatrix(value) {
  if (value === null || value === undefined) return identity
  const placement = translate(value)
  assert.ok(placement, 'Fixture uses finite native translate transforms')
  // Chromium stores each authored SVG transform component as binary32.
  return { ...identity, e: Math.fround(placement.x), f: Math.fround(placement.y) }
}
function assertMatrix(actual, expected) {
  assertFiniteMatrix(actual); assertFiniteMatrix(expected)
  for (const key of matrixKeys) assert.ok(Math.abs(actual[key] - expected[key]) <= 1e-7,
    `Current ${key} matrix component belongs to the file-local owned group`)
}
function assertStructure(structure) {
  assert.ok(structure)
  for (const key of ['node', 'body', 'contour', 'title']) {
    assert.equal(structure.connected[key], true); assert.equal(structure.currentRoot[key], true)
    assert.ok(Array.isArray(structure[`${key}Path`]) && structure[`${key}Path`].length > 0)
    assert.ok(structure[`${key}Path`].every((ordinal) => Number.isInteger(ordinal) && ordinal >= 0))
  }
  assert.deepEqual([structure.nodeTag, structure.bodyTag, structure.contourTag, structure.titleTag], ['g', 'g', 'path', 'title'])
  assert.deepEqual(structure.nodeChildTags, ['path', 'g']); assert.deepEqual(structure.bodyChildTags, ['title', 'g'])
  assert.equal(structure.titleCount, 1); assert.equal(structure.bodyCount, 1); assert.equal(structure.contourCount, 1)
  assert.deepEqual(structure.contourPath, [...structure.nodePath, 0])
  assert.deepEqual(structure.bodyPath, [...structure.nodePath, 1])
  assert.deepEqual(structure.titlePath, [...structure.bodyPath, 0])
}
function assertOrderedPaths(entries) {
  let previous = null
  for (const entry of entries) {
    const path = entry.structure.nodePath
    if (previous) {
      const index = path.findIndex((ordinal, offset) => ordinal !== previous[offset])
      assert.ok(index >= 0 && path[index] > previous[index], 'Native paths are unique and follow actual SVG document order')
    }
    previous = path
  }
}
function assertOwnerInputs(input) {
  const { expected, click, beforeExportState, savedJson, preExport } = input
  assert.equal(createHash('sha256').update(readFileSync(new URL('../src/rendering/svgRenderSort.ts', import.meta.url))).digest('hex'),
    signedPointRenderOrderProof.sha256, 'The authenticated point-only ordering is the current production comparator')
  assert.deepEqual(preExport.renderOrderProof, signedPointRenderOrderProof)
  assert.equal(expected.length, 7); assert.equal(preExport.points.length, 7)
  assert.equal(preExport.rootCount, 1); assert.equal(preExport.rootConnected, true); assert.equal(preExport.rootOwnerDocument, true)
  assert.equal(preExport.root.localName, 'svg'); assert.equal(preExport.root.namespace, svgNamespace)
  assert.ok(/^https?:\/\//u.test(preExport.url), 'Native pre-export ownership comes from the current App document')
  assert.equal(new URL(preExport.url).pathname, '/stratified-tikz/scripts/fixtures/freeLabelsApp.html')
  const snapshot = click.snapshot, saved = JSON.parse(savedJson), model = saved.diagram
  assert.equal(saved.version, 2); assert.equal(click.error, undefined); assert.equal(snapshot.documentUnchanged, true)
  assert.equal(snapshot.points.length, 7)
  assert.ok(Number.isInteger(beforeExportState.labelDocumentRevision) && beforeExportState.labelDocumentRevision >= 0)
  assert.ok(Number.isInteger(snapshot.runtime.documentRevision) && snapshot.runtime.documentRevision >= 0)
  assert.ok(Number.isInteger(snapshot.runtime.fontGeneration) && snapshot.runtime.fontGeneration >= 0)
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'uiSettings']) assert.deepEqual(snapshot[field], beforeExportState[field])
  assert.equal(snapshot.runtime.documentRevision, beforeExportState.labelDocumentRevision)
  assert.equal(preExport.labelDocumentRevision, beforeExportState.labelDocumentRevision)
  assert.deepEqual(preExport.runtime, snapshot.runtime)
  for (const diagram of [JSON.parse(snapshot.json).diagram, JSON.parse(snapshot.runtimeDiagramJson), JSON.parse(snapshot.history).present]) {
    assert.deepEqual(diagram.strata, model.strata); assert.deepEqual(diagram.labels, model.labels)
  }
  assert.equal(model.strata.length, 7)
  assert.ok([2, 3].includes(model.ambientDimension))
  if (input.ambientDimension !== undefined) assert.equal(input.ambientDimension, model.ambientDimension)
  assert.deepEqual(model.strata.map(({ id }) => id), fixtureOwnerOrder, 'The immutable fixture retains all declared owners in model order')
  assert.deepEqual(expected.map(({ id }) => id), fixtureOwnerOrder)
  assert.deepEqual(snapshot.points.map(({ id }) => id), fixtureOwnerOrder)
  const canonical = canonicalPoints(model.strata), placements = new Set(), nativeOwners = new Set()
  for (const [expectedIndex, entry] of expected.entries()) {
    const point = model.strata[expectedIndex], captured = snapshot.points[expectedIndex]
    assert.equal(point.geometricKind, 'point'); assert.equal(point.codim, model.ambientDimension); assert.equal(point.layer, 0); assert.equal(point.text, '')
    assert.equal(point.style.shape, fixtureShapeOrder[expectedIndex])
    assert.deepEqual(point.position, { x: expectedIndex < 6 ? 1 + expectedIndex % 3 * 2 : 7,
      y: expectedIndex < 6 ? 1 + Math.floor(expectedIndex / 3) * 2 : 3, z: model.ambientDimension === 3 ? .5 : 0 })
    assert.equal(entry.id, point.id); assert.deepEqual(entry.modelPoint, point); assert.equal(entry.source, '')
    assert.equal(entry.shape, point.style.shape); assert.equal(captured.id, point.id)
    assert.equal(captured.source, ''); assert.equal(captured.modelSource, ''); assert.equal(captured.status, 'ready')
    assert.deepEqual(captured.position, point.position); assert.deepEqual(captured.style, point.style)
    assert.equal(captured.held, null); assert.deepEqual(captured.runtime, snapshot.runtime)
    assert.deepEqual(JSON.parse(captured.owner), ['point-node', beforeExportState.labelDocumentRevision, point.id])
    assert.equal(captured.owner, entry.rendered.pointOwner); assert.equal(captured.request, entry.rendered.bodyRequest)
    assert.ok(captured.request); assert.equal(captured.request, captured.pointRequest); assert.equal(captured.pointRequest, entry.rendered.pointRequest)
    const request = JSON.parse(captured.request)
    assert.ok(Array.isArray(request) && request.length === 9, 'Native request retains the source-proven runtime identity envelope')
    assert.equal(request[0], captured.source); assert.equal(request[5], snapshot.runtime.fontGeneration); assert.equal(request[8], captured.owner)
    assert.ok(typeof request[1] === 'string' && request[1].length > 0)
    assert.ok(Number.isFinite(request[2]) && request[2] > 0)
    assert.ok(typeof request[3] === 'string' && typeof request[4] === 'string')
    assert.ok(Number.isFinite(request[6]) && request[6] > 0 && Number.isFinite(request[7]) && request[7] >= 0)
    assert.equal(captured.nodeTransform, entry.rendered.nodeTransform)
    const placement = translate(captured.nodeTransform)
    assert.ok(placement); assert.ok(!placements.has(placementKey(placement)), 'Captured outer projected placements are unique')
    placements.add(placementKey(placement))
  }
  for (const [ordinal, observed] of preExport.points.entries()) {
    const { point, expectedIndex } = canonical[ordinal], entry = expected[expectedIndex], captured = snapshot.points[expectedIndex]
    assert.equal(observed.domOrdinal, ordinal); assert.equal(observed.id, point.id, 'Native App DOM order follows the source-proven layer/ID comparator')
    assert.ok(!nativeOwners.has(observed.id)); nativeOwners.add(observed.id)
    assert.equal(observed.source, ''); assert.equal(observed.bodySource, captured.source)
    assert.equal(observed.shape, point.style.shape); assert.equal(observed.state, 'ready')
    assert.equal(observed.owner, captured.owner); assert.equal(observed.request, captured.pointRequest); assert.equal(observed.bodyRequest, captured.request)
    assert.equal(observed.nodeTransform, captured.nodeTransform); assert.equal(observed.bodyTransform, entry.rendered.bodyTransform)
    assertStructure(observed.structure)
    for (const matrix of Object.values(observed.matrices)) assertFiniteMatrix(matrix)
  }
  assertOrderedPaths(preExport.points)
}

// A small bounded XML tree parser retains element paths and direct-child
// ownership. A global attribute-string search cannot establish that ownership.
export function parseSignedPointSvg(xml) {
  assert.ok(typeof xml === 'string' && xml.length < 2_000_000)
  const decode = (value) => value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/giu, (entity) => {
    if (entity.startsWith('&#')) return String.fromCodePoint(Number.parseInt(entity.slice(entity[2] === 'x' ? 3 : 2, -1), entity[2] === 'x' ? 16 : 10))
    return { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' }[entity]
  })
  const stack = [], roots = []
  let cursor = 0, elements = 0
  for (const match of xml.matchAll(/<[^>]*>/gu)) {
    const text = xml.slice(cursor, match.index), token = match[0]; cursor = match.index + token.length
    if (stack.length) stack.at(-1).text += decode(text)
    else assert.ok(text.trim() === '', 'No text outside the SVG root')
    if (/^<\?xml\b/u.test(token)) { assert.equal(roots.length, 0); continue }
    assert.ok(!/^<!/u.test(token), 'No document declarations/comments in the scoped fixture')
    if (token.startsWith('</')) { assert.equal(stack.pop()?.tag, token.slice(2, -1).trim()); continue }
    const opening = /^<([\w:-]+)([\s\S]*?)(\/?)>$/u.exec(token)
    assert.ok(opening); assert.ok(++elements <= 512, 'Bounded standalone point-only XML tree')
    const attributes = {}, body = opening[2]
    let offset = 0
    for (const attribute of body.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) {
      assert.ok(body.slice(offset, attribute.index).trim() === ''); offset = attribute.index + attribute[0].length
      assert.equal(attributes[attribute[1]], undefined, 'No duplicate XML attribute')
      attributes[attribute[1]] = decode(attribute[2] ?? attribute[3])
    }
    assert.ok(body.slice(offset).trim() === '')
    const parent = stack.at(-1), siblings = parent?.children ?? roots
    const element = { tag: opening[1], attributes, children: [], text: '', path: parent ? [...parent.path, siblings.length] : [] }
    siblings.push(element)
    if (!opening[3]) stack.push(element)
  }
  assert.equal(stack.length, 0); assert.equal(roots.length, 1); assert.ok(xml.slice(cursor).trim() === '')
  const root = roots[0]
  assert.equal(root.tag, 'svg'); assert.equal(root.attributes.xmlns, svgNamespace)
  const titles = [], walk = (element) => { if (element.tag === 'title') titles.push(element); for (const child of element.children) walk(child) }
  walk(root)
  return { root, titles }
}
function elementAt(root, path) { return path.reduce((element, ordinal) => element?.children[ordinal], root) }
function xmlMatrix(root, path, rootMatrix) {
  let result = rootMatrix, element = root
  for (const ordinal of path) {
    element = element.children[ordinal]; assert.ok(element)
    result = multiply(result, translationMatrix(element.attributes.transform))
  }
  return result
}
function assertFileLocal(input, xml) {
  const { root, titles } = parseSignedPointSvg(xml), actualRoot = input.document.root
  assert.deepEqual(root.attributes, input.document.rootAttributes, 'Native full root attributes belong to the exact downloaded XML')
  assert.deepEqual(root.attributes, signedPointStandaloneRootAttributes,
    'The scoped production root has no foreign transform, inherited paint or style')
  assert.deepEqual(actualRoot, { localName: root.tag, namespace: root.attributes.xmlns,
    width: root.attributes.width ?? null, height: root.attributes.height ?? null, viewBox: root.attributes.viewBox ?? null })
  assert.equal(titles.length, 7, 'Exact file contains one native title/body per fixture owner')
  assert.deepEqual(root.children.map(({ tag }) => tag), ['g'])
  assert.deepEqual(root.children[0].attributes, {})
  assert.equal(root.children[0].children.length, 7)
  const elements = [], walk = (element) => { elements.push(element); for (const child of element.children) walk(child) }
  walk(root)
  assert.equal(elements.filter(({ tag }) => tag === 'g').length, 36)
  assert.equal(elements.filter(({ tag }) => tag === 'path').length, 7)
  assert.ok(elements.every(({ tag }) => ['svg', 'g', 'path', 'title'].includes(tag)), 'Only the seven empty point owners paint this scoped fixture')
  assert.ok(elements.every(({ text }) => text === ''), 'Empty-source native shells contain no stray text')
  assert.ok(elements.every(({ attributes }) => Object.keys(attributes)
    .every((name) => !name.startsWith('data-') && !name.startsWith('aria-'))), 'The entire downloaded point fixture remains metadata-sanitized')
  for (const [ordinal, actual] of input.reopened.entries()) {
    const structure = actual.structure, title = titles[ordinal]
    assert.deepEqual(title.path, structure.titlePath, 'Retained ordinal is the actual title/body document order')
    const node = elementAt(root, structure.nodePath), body = elementAt(root, structure.bodyPath), contour = elementAt(root, structure.contourPath)
    assert.equal(title, body?.children[0]); assert.equal(body, node?.children[1]); assert.equal(contour, node?.children[0])
    const wrapper = root.children[0].children[ordinal]
    assert.equal(wrapper.tag, 'g'); assert.deepEqual(wrapper.children, [node]); assert.deepEqual(wrapper.attributes, {})
    assert.deepEqual(actual.structure.nodePath, [0, ordinal, 0])
    assert.equal(body.children[1].tag, 'g'); assert.equal(body.children[1].children.length, 1)
    assert.equal(body.children[1].children[0].tag, 'g'); assert.equal(body.children[1].children[0].children.length, 0)
    const association = input.association.associations.find((entry) => entry.actualDomOrdinal === ordinal)
    assert.ok(association, 'The empty shell belongs to its authenticated immutable owner')
    const style = input.expected[association.expectedIndex].modelPoint.style
    assert.deepEqual(title.attributes, {})
    // svgLabelView retains the native ink/content groups for empty source. Bind
    // their complete attributes to immutable authored paint without adding ink.
    assert.deepEqual(body.children[1].attributes, { transform: 'translate(0 0)',
      opacity: String(style.opacity * style.paint.text.opacity),
      fill: style.paint.text.color, color: style.paint.text.color, 'pointer-events': 'none' })
    assert.deepEqual(body.children[1].children[0].attributes, {})
    assert.deepEqual(node.children.map(({ tag }) => tag), structure.nodeChildTags)
    assert.deepEqual(body.children.map(({ tag }) => tag), structure.bodyChildTags)
    assert.equal(title.text, actual.source); assert.equal(title.children.length, 0)
    assert.equal(node.attributes.transform ?? null, actual.nodeTransform); assert.equal(body.attributes.transform ?? null, actual.bodyTransform)
    assert.deepEqual(node.attributes, { transform: actual.nodeTransform }); assert.deepEqual(body.attributes, { transform: actual.bodyTransform })
    assert.deepEqual({ tag: contour.tag, attributes: Object.fromEntries(Object.entries(contour.attributes)
      .filter(([name]) => !name.startsWith('data-') && name !== 'pointer-events')) }, actual.contour,
    'Every observed contour attribute belongs to its own exact file-local node')
    for (const element of [node, body, contour, title]) assert.ok(Object.keys(element.attributes)
      .every((name) => !name.startsWith('data-') && !name.startsWith('aria-')), 'Exported owners remain sanitized')
    for (const [kind, path] of [['node', structure.nodePath], ['body', structure.bodyPath], ['contour', structure.contourPath]]) {
      assertMatrix(actual.matrices[`${kind}CTM`], xmlMatrix(root, path, input.document.frame.rootCTM))
      assertMatrix(actual.matrices[`${kind}ScreenCTM`], xmlMatrix(root, path, input.document.frame.rootScreenCTM))
    }
  }
}

export function assertSignedPointStandaloneAssociation(input, xml) {
  assertOwnerInputs(input)
  assert.equal(input.reopened.length, 7)
  const derived = createSignedPointAssociationCandidate(input)
  assert.deepEqual(derived.failureReasons, [], 'Every actual group has one current authenticated unique owner')
  assert.equal(derived.associations.length, 7)
  assert.equal(new Set(derived.associations.map(({ expectedId }) => expectedId)).size, 7)
  assert.equal(new Set(derived.associations.map(({ actualDomOrdinal }) => actualDomOrdinal)).size, 7)
  assert.deepEqual(input.association, derived, 'Stored derived correspondence is independently reconstructed')
  const frame = input.document.frame
  assert.deepEqual(input.document.rootAttributes, signedPointStandaloneRootAttributes)
  assert.equal(frame.url, input.fileUrl); assert.equal(frame.contentType, 'image/svg+xml'); assert.equal(frame.readyState, 'complete')
  assert.equal(frame.rootConnected, true); assert.equal(frame.rootOwnerDocument, true)
  assert.ok(frame.viewport && [frame.viewport.width, frame.viewport.height].every((value) => Number.isFinite(value) && value > 0),
    'The reopened native pixel frame has a finite positive CSS viewport')
  assert.equal(input.document.root.viewBox, input.preExport.root.viewBox)
  assert.deepEqual(frame.scroll, { x: 0, y: 0 })
  assert.deepEqual(frame.rootBounds, { x: 0, y: 0, width: Number(input.document.root.width), height: Number(input.document.root.height) })
  assertMatrix(frame.rootCTM, identity); assertMatrix(frame.rootScreenCTM, identity)
  if (input.capture !== undefined) {
    const initial = input.capture.measurements?.[0]
    assert.ok(initial, 'Pixel replay retains the first complete-root native capture measurement')
    assert.deepEqual({ url: frame.url, contentType: frame.contentType, readyState: frame.readyState,
      rootBounds: frame.rootBounds, scroll: frame.scroll, viewport: frame.viewport },
    { url: initial.url, contentType: initial.contentType, readyState: initial.readyState,
      rootBounds: initial.root.bounds, scroll: initial.scroll, viewport: initial.viewport },
    'Reopened CTMs belong to the initial native capture frame before any one owned viewport expansion')
  }
  const inventory = input.document.inventory
  assert.equal(inventory.titleCount, 7); assert.equal(inventory.pathCount, 7); assert.equal(inventory.groupCount, 36)
  assert.deepEqual(inventory.rootChildTags, ['g'])
  assert.deepEqual(inventory.contourCandidates, input.reopened.map((actual) => ({ path: actual.structure.contourPath,
    parentPath: actual.structure.nodePath, parentTransform: actual.nodeTransform, siblingBodyCount: 1 })),
  'Every native file contour candidate has exactly one retained point owner')
  for (const [ordinal, actual] of input.reopened.entries()) {
    assert.equal(actual.domOrdinal, ordinal); assert.equal(actual.source, ''); assert.equal(actual.errors, 0)
    assert.equal(Object.hasOwn(actual, 'shape'), false, 'Sanitized-file shape is never native metadata')
    assert.equal(Object.hasOwn(actual, 'id'), false, 'Sanitized-file owner ID is never native metadata')
    assertStructure(actual.structure)
    for (const value of Object.values(actual.matrices)) assertFiniteMatrix(value)
    assert.deepEqual(actual.screenCTM, actual.matrices.contourScreenCTM)
    const outer = multiply(frame.rootScreenCTM, translationMatrix(actual.nodeTransform))
    assertMatrix(actual.matrices.nodeScreenCTM, outer)
    assertMatrix(actual.matrices.nodeCTM, multiply(frame.rootCTM, translationMatrix(actual.nodeTransform)))
    assertMatrix(actual.matrices.bodyScreenCTM, multiply(outer, translationMatrix(actual.bodyTransform)))
    assertMatrix(actual.screenCTM, multiply(outer, translationMatrix(actual.contour.attributes.transform)))
    assertMatrix(actual.matrices.bodyCTM, multiply(actual.matrices.nodeCTM, translationMatrix(actual.bodyTransform)))
    assertMatrix(actual.matrices.contourCTM, multiply(actual.matrices.nodeCTM, translationMatrix(actual.contour.attributes.transform)))
  }
  assertOrderedPaths(input.reopened)
  if (xml !== undefined) assertFileLocal(input, xml)
  const zeroAxis = findSignedZeroAxisAssociation(input.reopened, derived)
  return { associations: derived.associations, zeroAxis }
}

export function findSignedZeroAxisAssociation(reopened, association) {
  const zeroBindings = association.associations.filter(({ expectedId }) => expectedId === 'signed-zero-axis')
  assert.equal(zeroBindings.length, 1, 'Pixel replay requires one authenticated standalone zero-axis owner')
  const actuals = reopened.filter(({ domOrdinal }) => domOrdinal === zeroBindings[0].actualDomOrdinal)
  assert.equal(actuals.length, 1, 'The zero-axis binding names one actual native group')
  assertFiniteMatrix(actuals[0].screenCTM)
  return actuals[0]
}

export function assertSignedPointStandaloneGeometry(input, binding = assertSignedPointStandaloneAssociation(input)) {
  for (const association of binding.associations) {
    const actual = input.reopened.find(({ domOrdinal }) => domOrdinal === association.actualDomOrdinal)
    const expected = input.expected[association.expectedIndex]
    assert.equal(expected.id, association.expectedId)
    assert.deepEqual(actual.contour, expected.rendered.contour)
    assert.equal(actual.nodeTransform, expected.rendered.nodeTransform); assert.equal(actual.bodyTransform, expected.rendered.bodyTransform)
  }
  return binding
}
