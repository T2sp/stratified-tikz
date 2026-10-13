import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { lstatSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'

const documentSchema = 'stz-evidence-document-v1'
const boundarySchema = 'stz-evidence-boundary-v1'
const packSchema = 'stz-evidence-pack-v1'
const indexSchema = 'stz-evidence-publication-index-v1'
const indexName = 'evidence-publication-index.json'
const immutable = new WeakSet()
export function freezeEvidenceObservation(value) {
  if (value && typeof value === 'object' && !immutable.has(value)) {
    for (const child of Object.values(value)) freezeEvidenceObservation(child)
    Object.freeze(value); immutable.add(value)
  }
  return value
}
const sameTree = (value) => Object.fromEntries(['revision', 'trackedDiffSha256', 'untrackedSha256', 'fingerprint'].map((key) => [key, value[key]]))
const jsonBytes = (value) => Buffer.from(JSON.stringify(value) + '\n')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const errorRecord = (error) => ({ message: error.message, stack: error.stack, code: error.code })
const fileName = (name) => {
  assert.equal(basename(name), name, 'Evidence path must be a file in the artifact directory')
  assert.ok(name !== '.' && name !== '..' && name.length > 0, 'Evidence path is nonempty')
  return name
}

/** Only immutable bytes reach an asynchronous sink. A synchronous, small atomic
 * pointer commit cannot still be pending when its deadline fires. Late ordinary
 * writers can leave orphan packs/manifests, but never change current authority.
 * The optional deadline scheduler scopes deterministic writer-gate controls to
 * one publisher; ordinary production persistence keeps the 5,000ms scheduler. */
export function createEvidencePublisher({ artifactDir, checkout, write = writeFile, timeoutMs = 5000, scheduleDeadline }) {
  assert.ok(checkout && typeof checkout === 'object', 'Evidence publication requires its current checkout')
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0)
  const owner = randomUUID(), tree = freezeEvidenceObservation(structuredClone(checkout))
  const nodes = new Map(), contents = new Map(), committedNodes = new Set(), packs = []
  const immutableRoots = new WeakMap(), capturedRoots = new WeakMap()
  const documents = {}, history = [], metrics = { boundaries: 0, uniqueNodes: 0, uniqueNodeBytes: 0,
    packWrites: 0, manifestWrites: 0, pointerWrites: 0, pointerBytes: 0, pointerMs: 0,
    indexWrites: 0, indexBytes: 0, indexMs: 0, authenticationReads: 0, authenticationBytes: 0, authenticationMs: 0,
    retainedBytes: 0, encodeMs: 0, writeMs: 0, operations: [] }
  let sequence = 0, generation = 0, primary, terminal = false, tail = Promise.resolve(), latestSequence = 0
  const atomic = (name, bytes) => {
    const started = performance.now()
    const temporary = resolve(artifactDir, `.evidence-${owner}-${name}.tmp`)
    writeFileSync(temporary, bytes)
    renameSync(temporary, resolve(artifactDir, name))
    const durationMs = performance.now() - started
    if (name === indexName) { metrics.indexWrites++; metrics.indexBytes += bytes.length; metrics.indexMs += durationMs }
    else { metrics.pointerWrites++; metrics.pointerBytes += bytes.length; metrics.pointerMs += durationMs }
    metrics.operations.push({ kind: name === indexName ? 'index' : 'pointer', path: name, bytes: bytes.length, durationMs, outcome: 'committed' })
  }
  const index = () => ({ schema: indexSchema, owner, checkout: tree, sequence: latestSequence,
    disposition: primary ? 'failed' : terminal ? 'passed' : 'running', primary: primary && errorRecord(primary), documents, history,
    metrics: { ...metrics, operations: metrics.operations.slice(-128) } })
  const fail = (error) => {
    if (!primary) { primary = error; generation++ }
    // Failure authority does not wait behind an uncancellable sink. Preserve
    // the original Error even if this small best-effort pointer itself fails.
    try { atomic(indexName, jsonBytes(index())) } catch (secondary) {
      metrics.operations.push({ kind: 'failure-index', outcome: 'failed', message: secondary.message })
    }
    return primary
  }
  const assertActive = () => { if (primary) throw primary; assert.equal(terminal, false, 'Evidence publication is already terminal') }
  const intern = (encoded) => {
    const key = JSON.stringify(encoded)
    if (key.length < 128) return encoded
    let id = contents.get(key)
    if (!id) {
      id = `n${nodes.size + 1}`; contents.set(key, id); nodes.set(id, encoded)
      metrics.uniqueNodes++; metrics.uniqueNodeBytes += Buffer.byteLength(key)
    }
    return ['r', id]
  }
  const strings = new Map()
  const encode = (value, ancestors = new Set()) => {
    if (value && typeof value === 'object') {
      if (capturedRoots.has(value)) return capturedRoots.get(value)
      if (immutableRoots.has(value)) return immutableRoots.get(value)
    }
    if (typeof value === 'string') {
      if (value.length < 128) return value
      let encoded = strings.get(value)
      if (!encoded) { encoded = intern(['s', value]); strings.set(value, encoded) }
      return encoded
    }
    if (value === undefined) return ['u']
    if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) return ['n', String(value === 0 ? '-0' : value)]
    if (value === null || ['boolean', 'number'].includes(typeof value)) return value
    assert.equal(typeof value, 'object', 'Evidence contains only data values')
    assert.ok(!ancestors.has(value), 'Evidence data cannot contain cycles')
    ancestors.add(value)
    let encoded
    if (Array.isArray(value)) {
      const items = Array.from(value, (item) => encode(item, ancestors))
      // Fixed lossless chunks keep append-only report arrays from rewriting
      // unchanged thousands of checkpoint/diagnostic entries on each boundary.
      encoded = items.length <= 64 ? ['a', items] : ['c', Array.from({ length: Math.ceil(items.length / 64) },
        (_, index) => intern(['a', items.slice(index * 64, (index + 1) * 64)]))]
    }
    else {
      assert.ok(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 'Evidence contains plain objects')
      encoded = ['o', Object.entries(value).map(([key, item]) => [key, encode(item, ancestors)])]
    }
    ancestors.delete(value)
    const result = intern(encoded)
    if (immutable.has(value)) immutableRoots.set(value, result)
    return result
  }
  const reachable = (root) => {
    const ids = new Set()
    const visit = (value) => {
      if (!Array.isArray(value)) return
      if (value[0] === 'r') {
        if (ids.has(value[1])) return
        ids.add(value[1]); visit(nodes.get(value[1]))
      } else if (value[0] === 'a' || value[0] === 'c') for (const child of value[1]) visit(child)
      else if (value[0] === 'o') for (const [, child] of value[1]) visit(child)
    }
    visit(root); return ids
  }
  const ordinary = async (name, bytes, kind, identity) => {
    const started = performance.now(), expectedHash = hash(bytes)
    let outcome = 'written'
    try { await write(resolve(artifactDir, name), bytes) }
    catch (error) { outcome = 'failed'; throw error }
    finally {
      const durationMs = performance.now() - started
      metrics.writeMs += durationMs
      metrics.operations.push({ kind, path: name, sequence: identity.sequence, bytes: bytes.length, durationMs, outcome })
    }
    const authenticationStarted = performance.now()
    let authenticated = false
    try {
      const path = resolve(artifactDir, name)
      assert.ok(lstatSync(path).isFile(), 'Publication retains an ordinary raw file before committing its reference')
      const retained = readFileSync(path)
      assert.equal(retained.length, bytes.length, 'Publication authenticates retained byte length before continuing')
      assert.equal(hash(retained), expectedHash, 'Publication authenticates retained SHA256 before continuing')
      authenticated = true
    } finally {
      const durationMs = performance.now() - authenticationStarted
      metrics.authenticationReads++; metrics.authenticationBytes += bytes.length; metrics.authenticationMs += durationMs
      metrics.operations.push({ kind: 'authentication', path: name, sequence: identity.sequence,
        bytes: bytes.length, durationMs, outcome: authenticated ? 'authenticated' : 'failed' })
    }
  }
  const publish = (name, value, { stage = name, disposition = 'running' } = {}) => {
    fileName(name)
    assert.ok(typeof stage === 'string' && stage.length > 0, 'Publication owns an explicit stage identity')
    assert.ok(['running', 'failed', 'passed'].includes(disposition), 'Known publication disposition')
    if (disposition !== 'failed') assertActive()
    const started = performance.now(), root = encode(value), ids = reachable(root)
    const encodeMs = performance.now() - started
    metrics.encodeMs += encodeMs
    const identity = { owner, checkout: tree, sequence: ++sequence, name, stage, disposition }
    const token = generation
    let alive = true
    const valid = () => alive && token === generation && identity.sequence > latestSequence
      && (disposition === 'failed' || (!primary && !terminal))
    const guard = () => { if (!valid()) throw primary ?? new Error('Evidence publication owner expired') }
    const operation = async () => {
      guard()
      const newNodes = [...ids].filter((id) => !committedNodes.has(id)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
      let packRef
      if (newNodes.length) {
        const path = `evidence-${owner}-${identity.sequence}.pack.json`
        const bytes = jsonBytes({ schema: packSchema, identity: { owner, checkout: tree, sequence: identity.sequence, stage },
          nodes: newNodes.map((id) => [id, nodes.get(id)]) })
        packRef = { path, bytes: bytes.length, sha256: hash(bytes), sequence: identity.sequence, stage }
        await ordinary(path, bytes, 'pack', identity); guard()
        metrics.packWrites++; metrics.retainedBytes += bytes.length
      }
      // Packs are append-only lossless tables. Include their full dependency
      // closure, so replay authenticates even definitions alongside this root.
      const requiredPacks = packs.map(({ ref }) => ref)
      if (packRef) requiredPacks.push(packRef)
      const path = `evidence-${owner}-${identity.sequence}.boundary.json`
      const publication = { encodeMs, newNodes: newNodes.length, packBytes: packRef?.bytes ?? 0 }
      const bytes = jsonBytes({ schema: boundarySchema, identity, root, packs: requiredPacks, publication })
      const artifact = { path, bytes: bytes.length, sha256: hash(bytes) }
      await ordinary(path, bytes, 'boundary', identity); guard()
      const document = { schema: documentSchema, identity, artifact }
      // No await between authority checks and pointer commits. Failed writers
      // never write these paths; immutable bytes above are the only async I/O.
      atomic(name, jsonBytes(document))
      if (packRef) { packs.push({ ref: packRef, ids: newNodes }); for (const id of newNodes) committedNodes.add(id) }
      documents[name] = document; latestSequence = identity.sequence
      history.push({ sequence: identity.sequence, name, stage, disposition, artifact })
      if (disposition === 'passed') terminal = true
      metrics.boundaries++; metrics.manifestWrites++
      metrics.retainedBytes += bytes.length
      atomic(indexName, jsonBytes({ ...index(), disposition: primary ? 'failed' : disposition }))
      return document
    }
    // Failed publication is independent of a stalled predecessor. Its new pack
    // includes every uncommitted node needed by its frozen root.
    const previous = disposition === 'failed' ? Promise.resolve() : tail
    const pending = boundedPointDiagnostic(async () => { await previous; return operation() }, `evidence publication ${stage}`, timeoutMs, scheduleDeadline)
      .catch((error) => { alive = false; fail(error); throw error })
    tail = pending.then(() => undefined, () => undefined)
    return pending
  }
  const capture = (value) => {
    assertActive()
    const root = encode(value), snapshot = { ...value }
    capturedRoots.set(snapshot, root)
    return snapshot
  }
  return { publish, capture, fail, assertActive, metrics, identity: { owner, checkout: tree }, get primary() { return primary } }
}

/** Activate only for the scoped 32D group. Earlier report behavior is retained.
 * The same publisher owns raw records and cumulative ordered report roots. */
export function createEvidenceReportStorage({ artifactDir, checkout, publisher = createEvidencePublisher({ artifactDir, checkout }), write = writeFile }) {
  let scoped = false
  return { publisher, capture: (value) => scoped ? publisher.capture(value) : value,
    save(report) {
      if (!scoped && report.started?.includes('point-node-layout-anchors-combined') === true) {
        scoped = true
        for (const records of [report.diagnostics, report.evidence]) if (records) {
          for (let index = 0; index < records.length; index++) records[index] = publisher.capture(records[index])
        }
      }
      if (!scoped) return write(resolve(artifactDir, 'free-labels-evidence.json'), JSON.stringify(report, null, 2) + '\n')
      return publisher.publish('free-labels-evidence.json', report, { stage: report.stage,
        disposition: report.result === 'failed' ? 'failed' : report.result === 'passed' ? 'passed' : 'running' })
    },
  }
}

/** Actual retainLive -> observe -> save path. Full native/live values remain
 * available through graph roots; shared measurements are written only once. */
export function createLiveEvidenceRetainer({ publisher, stem, scenario, group, zeroAxisCase, polygonalCases, observe }) {
  const retain = async (boundary, live, primary) => {
    if (primary) publisher.fail(primary)
    else publisher.assertActive()
    if (live.pixels) zeroAxisCase.livePaint = live.pixels
    const disposition = primary ? 'failed' : 'running'
    await publisher.publish(`${stem}-live-capture.json`, live, { stage: boundary, disposition })
    await publisher.publish(`${stem}-native.json`, { scenario, group, result: 'observed', polygonalCases, zeroAxisCase }, { stage: boundary, disposition })
    if (!primary) {
      publisher.assertActive()
      await observe(`${stem}-live-paint-${boundary}`, { group, result: 'observed',
        artifact: `${stem}-live-capture.json`, nativeArtifact: `${stem}-native.json`, image: structuredClone(live.capture.image) })
    }
  }
  retain.fail = publisher.fail
  return retain
}

export function readEvidenceDocumentSync(artifactDir, name, { checkout } = {}) {
  const parse = (path) => JSON.parse(readFileSync(resolve(artifactDir, fileName(path)), 'utf8'))
  const document = parse(name)
  if (document?.schema !== documentSchema) {
    assert.ok(!(typeof document?.schema === 'string' && document.schema.startsWith('stz-evidence-')), 'Known referenced evidence schema')
    return document
  }
  const { identity } = document
  assert.equal(identity.name, name, 'Evidence document identity matches its requested path')
  assert.ok(typeof identity.owner === 'string' && identity.owner.length > 0)
  assert.ok(Number.isSafeInteger(identity.sequence) && identity.sequence > 0)
  assert.ok(typeof identity.stage === 'string' && identity.stage.length > 0)
  assert.ok(['running', 'failed', 'passed'].includes(identity.disposition))
  if (checkout) assert.deepEqual(sameTree(identity.checkout), sameTree(checkout), 'Referenced evidence authenticates the current tree')
  const index = parse(indexName)
  assert.equal(index.schema, indexSchema); assert.equal(index.owner, identity.owner)
  assert.deepEqual(index.checkout, identity.checkout)
  assert.ok(Number.isSafeInteger(index.sequence) && index.sequence > 0, 'Publication index has an exact finite ordinal')
  assert.ok(['running', 'failed', 'passed'].includes(index.disposition), 'Known authoritative disposition')
  assert.ok(index.sequence >= identity.sequence, 'Publication index covers the boundary sequence')
  assert.deepEqual(index.documents[name], document, 'Only the current committed document is authoritative')
  if (identity.disposition === 'passed') assert.notEqual(index.disposition, 'failed', 'Failed publication cannot establish terminal acceptance')
  const artifactCache = new Map()
  const authenticated = (ref) => {
    assert.ok(Number.isSafeInteger(ref.bytes) && ref.bytes > 0)
    assert.match(ref.sha256, /^[a-f0-9]{64}$/)
    const key = JSON.stringify(ref)
    if (artifactCache.has(key)) return artifactCache.get(key)
    const path = resolve(artifactDir, fileName(ref.path))
    assert.ok(lstatSync(path).isFile(), 'Referenced evidence is a retained regular file')
    const bytes = readFileSync(path)
    assert.equal(bytes.length, ref.bytes, 'Referenced artifact exact byte length')
    assert.equal(hash(bytes), ref.sha256, 'Referenced artifact exact SHA256')
    const result = JSON.parse(bytes.toString('utf8')); artifactCache.set(key, result); return result
  }
  assert.ok(Array.isArray(index.history) && index.history.length > 0, 'Publication retains committed ordered boundary history')
  const latest = new Map()
  let lastSequence = 0
  for (const entry of index.history) {
    assert.ok(Number.isSafeInteger(entry.sequence) && entry.sequence > lastSequence, 'Committed boundary history preserves exact publication order')
    lastSequence = entry.sequence
    fileName(entry.name)
    assert.ok(typeof entry.stage === 'string' && entry.stage.length > 0)
    assert.ok(['running', 'failed', 'passed'].includes(entry.disposition))
    latest.set(entry.name, entry)
  }
  assert.equal(lastSequence, index.sequence, 'Current authority equals the last committed boundary')
  assert.deepEqual(Object.keys(index.documents).sort(), [...latest.keys()].sort(), 'Every committed document remains indexed')
  for (const [path, entry] of latest) {
    assert.deepEqual(index.documents[path], { schema: documentSchema,
      identity: { owner: index.owner, checkout: index.checkout, sequence: entry.sequence, name: path, stage: entry.stage, disposition: entry.disposition }, artifact: entry.artifact },
    'The authoritative document matches its ordered committed boundary')
  }
  const historical = []
  if (name === 'free-labels-evidence.json') {
    // The parent begins with this cumulative root. Authenticate every historical
    // committed manifest and all declared raw documents, including diagnostic
    // artifacts outside terminal scenario inventories. Orphans are excluded.
    assert.equal(identity.sequence, index.sequence, 'Cumulative report is the current publication boundary')
    for (const entry of index.history) {
      const retained = authenticated(entry.artifact)
      assert.equal(retained.schema, boundarySchema)
      assert.deepEqual(retained.identity, { owner: index.owner, checkout: index.checkout,
        sequence: entry.sequence, name: entry.name, stage: entry.stage, disposition: entry.disposition },
        'Historical boundary identity is exact')
      historical.push(retained)
    }
    for (const path of latest.keys()) assert.deepEqual(parse(path), index.documents[path], 'Every indexed raw document retains its committed pointer')
  }
  const boundary = authenticated(document.artifact)
  assert.equal(boundary.schema, boundarySchema); assert.deepEqual(boundary.identity, identity)
  assert.ok(Array.isArray(boundary.packs))
  for (const retained of historical) assert.deepEqual(retained.packs,
    boundary.packs.filter((ref) => ref.sequence <= retained.identity.sequence), 'Historical boundaries retain complete ordered raw-pack coverage')
  const nodes = new Map(), packPaths = new Set()
  let previous = 0
  for (const ref of boundary.packs) {
    assert.ok(Number.isSafeInteger(ref.sequence) && ref.sequence > 0 && typeof ref.stage === 'string' && ref.stage.length > 0,
      'Referenced pack has an exact ordinal and stage')
    assert.ok(ref.sequence > previous && ref.sequence <= identity.sequence, 'Referenced packs preserve publication order')
    previous = ref.sequence
    assert.ok(!packPaths.has(ref.path), 'Referenced pack paths are unique'); packPaths.add(ref.path)
    const pack = authenticated(ref)
    assert.equal(pack.schema, packSchema)
    assert.deepEqual(pack.identity, { owner: identity.owner, checkout: identity.checkout, sequence: ref.sequence, stage: ref.stage })
    assert.ok(Array.isArray(pack.nodes) && pack.nodes.length > 0)
    let lastNode = 0
    for (const [id, value] of pack.nodes) {
      assert.match(id, /^n[1-9][0-9]*$/)
      assert.ok(Number(id.slice(1)) > lastNode, 'Pack nodes have their original intern order'); lastNode = Number(id.slice(1))
      assert.ok(!nodes.has(id), 'Conflicting or duplicate referenced node'); nodes.set(id, value)
    }
  }
  const resolved = new Map(), resolving = new Set()
  const decode = (value) => {
    if (!Array.isArray(value)) { assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value)); return value }
    const [tag, content] = value
    if (tag === 'r') {
      assert.equal(value.length, 2); assert.ok(nodes.has(content), 'Every evidence reference resolves to retained proof')
      assert.ok(!resolving.has(content), 'Evidence references are acyclic')
      if (!resolved.has(content)) { resolving.add(content); resolved.set(content, decode(nodes.get(content))); resolving.delete(content) }
      return resolved.get(content)
    }
    if (tag === 'u') { assert.equal(value.length, 1); return undefined }
    assert.equal(value.length, 2)
    if (tag === 's') { assert.equal(typeof content, 'string'); return content }
    if (tag === 'n') { assert.ok(['NaN', 'Infinity', '-Infinity', '-0'].includes(content)); return Number(content) }
    if (tag === 'a') { assert.ok(Array.isArray(content)); return content.map(decode) }
    if (tag === 'c') {
      assert.ok(Array.isArray(content) && content.length > 1, 'Chunked evidence arrays retain ordered chunks')
      return content.flatMap((child, index) => {
        const chunk = decode(child)
        assert.ok(Array.isArray(chunk) && chunk.length > 0 && chunk.length <= 64)
        if (index < content.length - 1) assert.equal(chunk.length, 64, 'All earlier evidence chunks are complete')
        return chunk
      })
    }
    assert.equal(tag, 'o', 'Known lossless evidence graph tag'); assert.ok(Array.isArray(content))
    const result = {}, keys = new Set()
    for (const pair of content) {
      assert.ok(Array.isArray(pair) && pair.length === 2 && typeof pair[0] === 'string')
      const [key, child] = pair; assert.ok(!keys.has(key), 'Evidence object keys are unique'); keys.add(key)
      Object.defineProperty(result, key, { value: decode(child), enumerable: true, writable: true, configurable: true })
    }
    return result
  }
  // Authenticate and validate every packed node, including shared definitions
  // retained alongside the required root, before applying public assertions.
  for (const id of nodes.keys()) decode(['r', id])
  for (const retained of historical) decode(retained.root)
  const result = decode(boundary.root)
  if (name === 'free-labels-evidence.json') {
    assert.equal(identity.stage, result.stage, 'Cumulative boundary retains its exact current stage')
    if (result.result === 'passed') {
      assert.equal(identity.disposition, 'passed', 'Cumulative acceptance requires terminal publication')
      assert.equal(index.disposition, 'passed', 'Cumulative acceptance requires terminal authority')
    }
    if (result.result === 'failed') {
      assert.equal(identity.disposition, 'failed'); assert.equal(index.disposition, 'failed')
      assert.equal(result.error.message, index.primary.message, 'Failed report preserves the authoritative primary error')
      assert.equal(result.error.stack, index.primary.stack)
    }
  }
  return result
}
