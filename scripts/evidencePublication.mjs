import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { lstatSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { boundedPointDiagnostic, createPointDiagnosticOperation } from './pointCheckDiagnostics.mjs'

const documentSchema = 'stz-evidence-document-v2'
const checkoutSchema = 'stz-evidence-checkout-v2'
const referencesSchema = 'stz-evidence-pack-references-v2'
const boundarySchema = 'stz-evidence-boundary-v2'
const packSchema = 'stz-evidence-pack-v2'
const indexSchema = 'stz-evidence-publication-index-v2'
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
  const deadlineNow = scheduleDeadline?.monotonicNow ?? (() => performance.now())
  const owner = randomUUID(), checkoutCloneStartMs = performance.now()
  const tree = freezeEvidenceObservation(structuredClone(checkout)), checkoutCloneMs = performance.now() - checkoutCloneStartMs
  const nodes = new Map(), contents = new Map(), committedNodes = new Set(), packs = []
  const immutableRoots = new WeakMap(), capturedRoots = new WeakMap()
  const documents = {}, history = [], metrics = { boundaries: 0, uniqueNodes: 0, uniqueNodeBytes: 0,
    packWrites: 0, manifestWrites: 0, pointerWrites: 0, pointerBytes: 0, pointerMs: 0,
    indexWrites: 0, indexBytes: 0, indexMs: 0, authenticationReads: 0, authenticationBytes: 0, authenticationMs: 0,
    identityBytes: 0, referenceBytes: 0, referenceWrites: 0,
    cloneMs: checkoutCloneMs, serializeMs: 0, hashMs: 0, queueWaitMs: 0, indexSerializeMs: 0, indexSerializeBytes: 0,
    retainedBytes: 0, encodeMs: 0, writeMs: 0, operations: [], progress: [] }
  let sequence = 0, generation = 0, primary, terminal = false, tail = Promise.resolve(), failureTail = Promise.resolve(), latestSequence = 0
  let checkoutRetained = false, references = null
  const progress = (phase, identity, operation, details = {}) => {
    const record = { phase, atMs: performance.now(), owner, token: identity?.token ?? generation, generation,
      sequence: identity?.sequence ?? latestSequence, operationOwner: operation?.owner, operationToken: operation?.token,
      operationGeneration: operation?.generation, ...details }
    metrics.progress.push(record)
    if (metrics.progress.length > 512) metrics.progress.shift()
    operation?.mark(`publication:${phase}`, { publicationOwner: owner, sequence: record.sequence, ...details })
  }
  const serialize = (value, kind, identity, operation) => {
    const startedMs = performance.now(); progress(`${kind}-serialization-start`, identity, operation)
    const bytes = jsonBytes(value), durationMs = performance.now() - startedMs
    metrics.serializeMs += durationMs
    if (kind === 'index') { metrics.indexSerializeMs += durationMs; metrics.indexSerializeBytes += bytes.length }
    progress(`${kind}-serialization-complete`, identity, operation, { startedMs, durationMs, bytes: bytes.length })
    return bytes
  }
  const digest = (bytes, kind, identity, operation) => {
    const startedMs = performance.now(); progress(`${kind}-hash-start`, identity, operation)
    const result = hash(bytes), durationMs = performance.now() - startedMs
    metrics.hashMs += durationMs
    progress(`${kind}-hash-complete`, identity, operation, { startedMs, durationMs, bytes: bytes.length })
    return result
  }
  progress('checkout-clone-complete', undefined, undefined, { startedMs: checkoutCloneStartMs, durationMs: checkoutCloneMs })
  const checkoutBytes = serialize({ schema: checkoutSchema, owner, checkout: tree }, 'checkout')
  const checkoutRef = { path: `evidence-${owner}.checkout.json`, bytes: checkoutBytes.length, sha256: digest(checkoutBytes, 'checkout') }
  const atomic = (name, bytes, guard, identity, operation) => {
    const started = performance.now()
    progress(`${name === indexName ? 'index' : 'pointer'}-write-start`, identity, operation, { bytes: bytes.length })
    const temporary = resolve(artifactDir, `.evidence-${owner}-${name}.tmp`)
    let failure
    try {
      writeFileSync(temporary, bytes)
      guard?.(); renameSync(temporary, resolve(artifactDir, name))
    } catch (error) { failure = error }
    try { unlinkSync(temporary) } catch (error) {
      if (error.code !== 'ENOENT') {
        if (failure) metrics.operations.push({ kind: 'temporary-cleanup', outcome: 'failed', message: error.message })
        else failure = error
      }
    }
    if (failure) throw failure
    const durationMs = performance.now() - started
    if (name === indexName) { metrics.indexWrites++; metrics.indexBytes += bytes.length; metrics.indexMs += durationMs }
    else { metrics.pointerWrites++; metrics.pointerBytes += bytes.length; metrics.pointerMs += durationMs }
    metrics.operations.push({ kind: name === indexName ? 'index' : 'pointer', path: name, bytes: bytes.length, durationMs, outcome: 'committed' })
    progress(`${name === indexName ? 'index' : 'pointer'}-write-complete`, identity, operation, { durationMs, bytes: bytes.length })
  }
  const index = () => ({ schema: indexSchema, owner, checkout: checkoutRef, sequence: latestSequence,
    disposition: primary ? 'failed' : terminal ? 'passed' : 'running', primary: primary && errorRecord(primary), documents, history,
    metrics: { ...metrics, operations: metrics.operations.slice(-128), progress: metrics.progress.slice(-128) } })
  const fail = (error, { operation } = {}) => {
    operation?.assertActive('failure-authority-entry')
    if (primary) return primary
    // Direct failure persistence owns a fresh absolute publication budget.
    // A caller-bound failure instead stays within that caller's active budget.
    // Both are synchronous: only a checked rename can install authority.
    const failureOperation = operation ?? createPointDiagnosticOperation('evidence failure authority', 5000, deadlineNow)
    const guard = () => failureOperation.assertActive('failure-authority-transition')
    guard()
    progress('failure-authority-start', undefined, failureOperation, { timeoutMs: failureOperation.timeoutMs,
      startedMs: failureOperation.startMs, deadlineMs: failureOperation.deadlineMs })
    primary = error; generation++
    // Failure authority does not wait behind an uncancellable sink. Preserve
    // the original Error even if this small best-effort pointer itself fails.
    try {
      const bytes = serialize(index(), 'index', undefined, failureOperation)
      guard()
      atomic(indexName, bytes, guard, undefined, failureOperation)
      failureOperation.assertActive('failure-authority-completed')
      progress('failure-authority-completion', undefined, failureOperation)
      if (!operation) failureOperation.settle()
    } catch (secondary) {
      metrics.operations.push({ kind: 'failure-index', outcome: 'failed', message: secondary.message })
      progress('failure-authority-failure', undefined, failureOperation, { message: secondary.message })
      if (!operation) failureOperation.settle(secondary)
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
  const ordinary = async (name, bytes, kind, identity, operation, guard, expectedHash) => {
    guard()
    const started = performance.now()
    progress(`${kind}-write-start`, identity, operation, { bytes: bytes.length })
    let outcome = 'written'
    try { await write(resolve(artifactDir, name), bytes) }
    catch (error) { outcome = 'failed'; throw error }
    finally {
      const durationMs = performance.now() - started
      metrics.writeMs += durationMs
      metrics.operations.push({ kind, path: name, sequence: identity.sequence, bytes: bytes.length, durationMs, outcome })
      progress(`${kind}-write-complete`, identity, operation, { durationMs, bytes: bytes.length, outcome })
    }
    guard()
    const authenticationStarted = performance.now()
    progress(`${kind}-authentication-start`, identity, operation)
    let authenticated = false
    try {
      const path = resolve(artifactDir, name)
      assert.ok(lstatSync(path).isFile(), 'Publication retains an ordinary raw file before committing its reference')
      const retained = readFileSync(path)
      assert.equal(retained.length, bytes.length, 'Publication authenticates retained byte length before continuing')
      assert.equal(digest(retained, 'authentication', identity, operation), expectedHash, 'Publication authenticates retained SHA256 before continuing')
      authenticated = true
    } finally {
      const durationMs = performance.now() - authenticationStarted
      metrics.authenticationReads++; metrics.authenticationBytes += bytes.length; metrics.authenticationMs += durationMs
      metrics.operations.push({ kind: 'authentication', path: name, sequence: identity.sequence,
        bytes: bytes.length, durationMs, outcome: authenticated ? 'authenticated' : 'failed' })
      progress(`${kind}-authentication-complete`, identity, operation, { durationMs, bytes: bytes.length, authenticated })
    }
    guard()
  }
  const publish = (name, value, { stage = name, disposition = 'running', operation: producer, primary: publicationPrimary } = {}) => {
    fileName(name)
    assert.ok(typeof stage === 'string' && stage.length > 0, 'Publication owns an explicit stage identity')
    assert.ok(['running', 'failed', 'passed'].includes(disposition), 'Known publication disposition')
    producer?.assertActive('publication:entry')
    if (disposition === 'failed' && publicationPrimary) fail(publicationPrimary, { operation: producer })
    if (disposition !== 'failed') assertActive()
    const started = performance.now(), deadlineStartMs = deadlineNow(), deadlineMs = deadlineStartMs + timeoutMs
    const timeoutError = new Error(`Timed out after ${timeoutMs}ms during evidence publication ${stage}`)
    const token = generation
    const identity = { owner, checkout: checkoutRef, sequence: ++sequence, name, stage, disposition }
    const timingIdentity = { ...identity, token }
    const checkProducer = (phase) => { producer?.assertActive(`publication:${phase}`) }
    checkProducer('snapshot')
    progress('operation-start', timingIdentity, producer, { startedMs: started, deadlineStartMs, deadlineMs, timeoutMs })
    progress('encode-start', timingIdentity, producer)
    const root = encode(value), ids = reachable(root)
    const encodeMs = performance.now() - started
    metrics.encodeMs += encodeMs
    progress('encode-complete', timingIdentity, producer, { durationMs: encodeMs })
    let alive = true
    const valid = () => alive && token === generation && identity.sequence > latestSequence
      && (disposition === 'failed' || (!primary && !terminal))
    const guard = () => {
      checkProducer('authority-check')
      if (deadlineNow() >= deadlineMs) { alive = false; progress('operation-expiry', timingIdentity, producer); throw timeoutError }
      if (!valid()) throw primary ?? new Error('Evidence publication owner expired')
    }
    const operation = async () => {
      guard()
      if (!checkoutRetained) {
        await ordinary(checkoutRef.path, checkoutBytes, 'checkout', timingIdentity, producer, guard, checkoutRef.sha256)
        guard(); checkoutRetained = true; metrics.identityBytes = checkoutBytes.length
      }
      const newNodes = [...ids].filter((id) => !committedNodes.has(id)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
      let packRef
      if (newNodes.length) {
        const path = `evidence-${owner}-${identity.sequence}.pack.json`
        const bytes = serialize({ schema: packSchema, identity: { owner, checkout: checkoutRef, sequence: identity.sequence, stage },
          nodes: newNodes.map((id) => [id, nodes.get(id)]) }, 'pack', timingIdentity, producer)
        packRef = { path, bytes: bytes.length, sha256: digest(bytes, 'pack', timingIdentity, producer), sequence: identity.sequence, stage }
        await ordinary(path, bytes, 'pack', timingIdentity, producer, guard, packRef.sha256); guard()
        metrics.packWrites++; metrics.retainedBytes += bytes.length
      }
      // Authenticated immutable links share the exact ordered dependency prefix.
      // Every old pack remains reachable without serializing the prefix again.
      let nextReferences = references
      if (packRef) {
        const path = `evidence-${owner}-${identity.sequence}.references.json`
        const bytes = serialize({ schema: referencesSchema, identity: { owner, checkout: checkoutRef, sequence: identity.sequence, stage },
          previous: references, packs: [packRef] }, 'references', timingIdentity, producer)
        nextReferences = { path, bytes: bytes.length, sha256: digest(bytes, 'references', timingIdentity, producer) }
        await ordinary(path, bytes, 'references', timingIdentity, producer, guard, nextReferences.sha256)
        metrics.referenceWrites++; metrics.referenceBytes += bytes.length
      }
      const path = `evidence-${owner}-${identity.sequence}.boundary.json`
      const publication = { encodeMs, newNodes: newNodes.length, packBytes: packRef?.bytes ?? 0 }
      const bytes = serialize({ schema: boundarySchema, identity, root, packReferences: nextReferences,
        packCount: packs.length + (packRef ? 1 : 0), publication }, 'boundary', timingIdentity, producer)
      const artifact = { path, bytes: bytes.length, sha256: digest(bytes, 'boundary', timingIdentity, producer) }
      await ordinary(path, bytes, 'boundary', timingIdentity, producer, guard, artifact.sha256); guard()
      const document = { schema: documentSchema, identity, artifact }
      // No await between authority checks and pointer commits. Failed writers
      // never write these paths; immutable bytes above are the only async I/O.
      const entry = { sequence: identity.sequence, name, stage, disposition, artifact }
      const pointerBytes = serialize(document, 'pointer', timingIdentity, producer)
      const nextIndex = { ...index(), documents: { ...documents, [name]: document }, history: [...history, entry],
        sequence: identity.sequence, disposition: primary ? 'failed' : disposition }
      const indexBytes = serialize(nextIndex, 'index', timingIdentity, producer)
      guard()
      const previousDocument = documents[name]
      let pointerCommitted = false
      try {
        atomic(name, pointerBytes, guard, timingIdentity, producer); pointerCommitted = true
        atomic(indexName, indexBytes, guard, timingIdentity, producer)
      } catch (error) {
        // If expiry crosses the two synchronous renames, restore the previous
        // pointer before independent failure authority records the real error.
        if (pointerCommitted) try {
          if (previousDocument) atomic(name, jsonBytes(previousDocument))
          else unlinkSync(resolve(artifactDir, name))
        } catch (secondary) { metrics.operations.push({ kind: 'pointer-restoration', outcome: 'failed', message: secondary.message }) }
        throw error
      }
      if (packRef) { packs.push({ ref: packRef, ids: newNodes }); for (const id of newNodes) committedNodes.add(id) }
      references = nextReferences
      documents[name] = document; latestSequence = identity.sequence
      history.push(entry)
      if (disposition === 'passed') terminal = true
      metrics.boundaries++; metrics.manifestWrites++
      metrics.retainedBytes += bytes.length
      progress('document-authority-commit', timingIdentity, producer, { disposition })
      progress('operation-completion', timingIdentity, producer, { durationMs: performance.now() - started })
      return document
    }
    // Failed publication is independent of a stalled predecessor. Its new pack
    // includes every uncommitted node needed by its frozen root.
    const previous = disposition === 'failed' ? failureTail : tail
    const queuedMs = performance.now()
    progress('queue-entry', timingIdentity, producer)
    const pending = boundedPointDiagnostic(async () => {
      await previous
      const durationMs = performance.now() - queuedMs; metrics.queueWaitMs += durationMs
      progress('queue-release', timingIdentity, producer, { durationMs }); guard()
      return operation()
    }, `evidence publication ${stage}`, timeoutMs, scheduleDeadline)
      .catch((error) => {
        alive = false; progress('operation-failure', timingIdentity, producer, { message: error.message })
        // The composed caller owns its diagnostic expiry and final Aggregate.
        // Its independently owned failure publication installs that primary;
        // this expired nested success operation cannot install a different one.
        if (producer) {
          // Rejection can arrive after the absolute producer deadline before
          // timer delivery changes its state. Check time before installing any
          // primary or authority, just as on the fulfillment path.
          producer.assertActive('publication:failure-disposition')
          // The composed caller installs its actual Aggregate/native primary
          // through separately owned failure persistence. Reject this producer
          // immediately so already queued siblings cannot publish success.
          producer.settle(error)
        } else fail(error)
        throw error
      })
    tail = pending.then(() => undefined, () => undefined)
    if (disposition === 'failed') failureTail = tail
    return pending
  }
  const capture = (value, { operation, disposition = 'running' } = {}) => {
    operation?.assertActive('publication:capture')
    if (disposition !== 'failed') assertActive()
    progress('capture-start', undefined, operation)
    const root = encode(value), snapshot = { ...value }
    operation?.assertActive('publication:capture-complete')
    progress('capture-complete', undefined, operation)
    capturedRoots.set(snapshot, root)
    return snapshot
  }
  return { publish, capture, fail, assertActive, metrics, identity: { owner, checkout: tree }, get primary() { return primary } }
}

/** Activate only for the scoped 32D group. Earlier report behavior is retained.
 * The same publisher owns raw records and cumulative ordered report roots. */
export function createEvidenceReportStorage({ artifactDir, checkout, publisher = createEvidencePublisher({ artifactDir, checkout }), write = writeFile }) {
  let scoped = false
  return { publisher, capture: (value, options) => scoped ? publisher.capture(value, options) : value,
    save(report, { operation, disposition, primary } = {}) {
      operation?.assertActive('report-checkpoint-start')
      operation?.mark('report-checkpoint-start', { stage: report.stage })
      const publicationDisposition = disposition ?? (report.result === 'failed' ? 'failed' : report.result === 'passed' ? 'passed' : 'running')
      if (!scoped && report.started?.includes('point-node-layout-anchors-combined') === true) {
        scoped = true
        for (const records of [report.diagnostics, report.evidence]) if (records) {
          for (let index = 0; index < records.length; index++) records[index] = publisher.capture(records[index], { operation, disposition: publicationDisposition })
        }
      }
      if (!scoped) return write(resolve(artifactDir, 'free-labels-evidence.json'), JSON.stringify(report, null, 2) + '\n')
      return publisher.publish('free-labels-evidence.json', report, { stage: report.stage, operation, primary,
        disposition: publicationDisposition })
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
  const parse = (path) => {
    const retained = resolve(artifactDir, fileName(path))
    assert.ok(lstatSync(retained).isFile(), 'Evidence documents and authority retain ordinary regular files')
    return JSON.parse(readFileSync(retained, 'utf8'))
  }
  const document = parse(name)
  const compact = document?.schema === documentSchema
  const currentDocumentSchema = compact ? documentSchema : 'stz-evidence-document-v1'
  const currentBoundarySchema = compact ? boundarySchema : 'stz-evidence-boundary-v1'
  const currentPackSchema = compact ? packSchema : 'stz-evidence-pack-v1'
  const currentIndexSchema = compact ? indexSchema : 'stz-evidence-publication-index-v1'
  if (document?.schema !== currentDocumentSchema) {
    assert.ok(!(typeof document?.schema === 'string' && document.schema.startsWith('stz-evidence-')), 'Known referenced evidence schema')
    return document
  }
  const { identity } = document
  if (compact) {
    assert.deepEqual(Object.keys(document).sort(), ['artifact', 'identity', 'schema'], 'Document preserves its exact compact envelope')
    assert.deepEqual(Object.keys(identity).sort(), ['checkout', 'disposition', 'name', 'owner', 'sequence', 'stage'], 'Document identity has exact authenticated fields')
  }
  assert.equal(identity.name, name, 'Evidence document identity matches its requested path')
  assert.ok(typeof identity.owner === 'string' && identity.owner.length > 0)
  assert.ok(Number.isSafeInteger(identity.sequence) && identity.sequence > 0)
  assert.ok(typeof identity.stage === 'string' && identity.stage.length > 0)
  assert.ok(['running', 'failed', 'passed'].includes(identity.disposition))
  const index = parse(indexName)
  assert.equal(index.schema, currentIndexSchema); assert.equal(index.owner, identity.owner)
  assert.deepEqual(index.checkout, identity.checkout)
  assert.ok(Number.isSafeInteger(index.sequence) && index.sequence > 0, 'Publication index has an exact finite ordinal')
  assert.ok(['running', 'failed', 'passed'].includes(index.disposition), 'Known authoritative disposition')
  assert.ok(index.sequence >= identity.sequence, 'Publication index covers the boundary sequence')
  assert.deepEqual(index.documents[name], document, 'Only the current committed document is authoritative')
  if (identity.disposition === 'passed') assert.notEqual(index.disposition, 'failed', 'Failed publication cannot establish terminal acceptance')
  const artifactCache = new Map()
  const authenticated = (ref) => {
    assert.ok(ref && typeof ref === 'object', 'Authenticated identity or artifact reference is present')
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
  if (compact) {
    assert.deepEqual(Object.keys(identity.checkout).sort(), ['bytes', 'path', 'sha256'], 'Complete compact checkout reference has exact fields')
    const canonical = authenticated(identity.checkout)
    assert.deepEqual(Object.keys(canonical).sort(), ['checkout', 'owner', 'schema'], 'Canonical identity retains its exact envelope')
    assert.equal(canonical.schema, checkoutSchema); assert.equal(canonical.owner, identity.owner, 'Canonical identity belongs to the publisher')
    assert.ok(canonical.checkout && typeof canonical.checkout === 'object', 'Canonical complete checkout identity is retained')
    const checkoutKeys = ['fingerprint', 'revision', 'trackedDiffSha256', 'untrackedSha256']
    if (Object.hasOwn(canonical.checkout, 'status')) {
      assert.equal(typeof canonical.checkout.status, 'string', 'Recorded browser checkout status is exact text')
      checkoutKeys.push('status'); checkoutKeys.sort()
    }
    assert.deepEqual(Object.keys(canonical.checkout).sort(), checkoutKeys,
      'Canonical checkout retains revision, tracked diff, all untracked hashes and fingerprint')
    assert.match(canonical.checkout.revision, /^[a-f0-9]{40}$/)
    assert.match(canonical.checkout.fingerprint, /^[a-f0-9]{64}$/)
    assert.match(canonical.checkout.trackedDiffSha256, /^[a-f0-9]{64}$/)
    assert.ok(canonical.checkout.untrackedSha256 && typeof canonical.checkout.untrackedSha256 === 'object' && !Array.isArray(canonical.checkout.untrackedSha256),
      'Canonical checkout retains every filename to exact hash association')
    for (const [path, sha256] of Object.entries(canonical.checkout.untrackedSha256)) {
      assert.ok(path.length > 0 && !path.startsWith('/') && !path.split('/').includes('..'), 'Checkout identity filenames are relative')
      assert.match(sha256, /^[a-f0-9]{64}$/)
    }
    if (checkout) assert.deepEqual(sameTree(canonical.checkout), sameTree(checkout), 'Referenced evidence authenticates the complete current tree')
  } else if (checkout) assert.deepEqual(sameTree(identity.checkout), sameTree(checkout), 'Referenced evidence authenticates the current tree')
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
    assert.deepEqual(index.documents[path], { schema: currentDocumentSchema,
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
      assert.equal(retained.schema, currentBoundarySchema)
      assert.deepEqual(retained.identity, { owner: index.owner, checkout: index.checkout,
        sequence: entry.sequence, name: entry.name, stage: entry.stage, disposition: entry.disposition },
        'Historical boundary identity is exact')
      historical.push(retained)
    }
    for (const path of latest.keys()) assert.deepEqual(parse(path), index.documents[path], 'Every indexed raw document retains its committed pointer')
  }
  const boundary = authenticated(document.artifact)
  assert.equal(boundary.schema, currentBoundarySchema); assert.deepEqual(boundary.identity, identity)
  let requiredPacks
  if (compact) {
    for (const retained of [...historical, boundary]) assert.deepEqual(Object.keys(retained).sort(),
      ['identity', 'packCount', 'packReferences', 'publication', 'root', 'schema'], 'Boundary preserves the full declared compact representation')
    assert.ok(Number.isSafeInteger(boundary.packCount) && boundary.packCount >= 0, 'Boundary retains its exact pack prefix count')
    const chunks = [], paths = new Set()
    let next = boundary.packReferences
    while (next !== null) {
      assert.ok(next && typeof next === 'object', 'Complete pack-reference chunk is present')
      assert.deepEqual(Object.keys(next).sort(), ['bytes', 'path', 'sha256'], 'Reference chunk has exact authenticated reference fields')
      assert.ok(!paths.has(next.path), 'Ordered pack-reference chunks are acyclic and unique'); paths.add(next.path)
      const chunk = authenticated(next)
      assert.deepEqual(Object.keys(chunk).sort(), ['identity', 'packs', 'previous', 'schema'], 'Reference chunk retains exact ordered metadata')
      assert.equal(chunk.schema, referencesSchema)
      assert.deepEqual(Object.keys(chunk.identity).sort(), ['checkout', 'owner', 'sequence', 'stage'])
      assert.equal(chunk.identity.owner, identity.owner, 'Reference chunk owner is exact')
      assert.deepEqual(chunk.identity.checkout, identity.checkout, 'Reference chunk has the exact authenticated checkout')
      assert.ok(Array.isArray(chunk.packs) && chunk.packs.length > 0 && chunk.packs.length <= 64, 'Reference chunks retain nonempty ordered packs')
      assert.equal(chunk.identity.sequence, chunk.packs.at(-1).sequence, 'Reference chunk sequence matches its last pack')
      assert.equal(chunk.identity.stage, chunk.packs.at(-1).stage, 'Reference chunk stage matches its last pack')
      chunks.push({ ref: next, chunk }); next = chunk.previous
    }
    chunks.reverse()
    requiredPacks = chunks.flatMap(({ chunk }) => chunk.packs)
    assert.equal(boundary.packCount, requiredPacks.length, 'Boundary retains complete raw-pack coverage')
    for (const retained of historical) {
      const prefix = requiredPacks.filter((ref) => ref.sequence <= retained.identity.sequence)
      assert.equal(retained.packCount, prefix.length, 'Historical boundary preserves complete pack prefix count')
      const prefixChunks = chunks.filter(({ chunk }) => chunk.identity.sequence <= retained.identity.sequence)
      assert.deepEqual(retained.packReferences, prefixChunks.at(-1)?.ref ?? null, 'Historical boundary preserves the exact ordered authenticated reference prefix')
    }
  } else {
    assert.ok(Array.isArray(boundary.packs)); requiredPacks = boundary.packs
    for (const retained of historical) assert.deepEqual(retained.packs,
      requiredPacks.filter((ref) => ref.sequence <= retained.identity.sequence), 'Historical boundaries retain complete ordered raw-pack coverage')
  }
  const nodes = new Map(), packPaths = new Set()
  let previous = 0
  for (const ref of requiredPacks) {
    assert.ok(Number.isSafeInteger(ref.sequence) && ref.sequence > 0 && typeof ref.stage === 'string' && ref.stage.length > 0,
      'Referenced pack has an exact ordinal and stage')
    assert.ok(ref.sequence > previous && ref.sequence <= identity.sequence, 'Referenced packs preserve publication order')
    previous = ref.sequence
    assert.ok(!packPaths.has(ref.path), 'Referenced pack paths are unique'); packPaths.add(ref.path)
    const pack = authenticated(ref)
    assert.equal(pack.schema, currentPackSchema)
    if (compact) assert.deepEqual(Object.keys(pack).sort(), ['identity', 'nodes', 'schema'], 'Pack retains its exact envelope')
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
