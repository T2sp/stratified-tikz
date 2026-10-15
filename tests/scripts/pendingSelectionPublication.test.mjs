import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import test from 'node:test'
import { createEvidencePublisher, createEvidenceReportStorage, readEvidenceDocumentSync } from '../../scripts/evidencePublication.mjs'
import { boundedPointDiagnostic, createPointDiagnostics } from '../../scripts/pointCheckDiagnostics.mjs'
import { assertPendingLayoutPreparation, preparePendingLayoutPoint } from '../../scripts/pointLayoutPendingPreparation.mjs'
import { syntheticPendingLayoutPreparation } from './standalonePointDownloadFixture.mjs'
import { awaitPublicationEntry, ownPublication, publicationGate, publicationValue } from './ownedPublicationProgressFixture.mjs'

// Controlled browser measurements exercise the real composed selection and
// publication path. They do not establish native App or pending-download acceptance.
const group = 'point-node-layout-anchors-combined'
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const bytesFor = (value) => Buffer.from(JSON.stringify(value) + '\n')
const json = async (directory, name) => JSON.parse(await readFile(join(directory, name), 'utf8'))

function rejectionGate() {
  let resolve, reject
  const promise = new Promise((fulfill, fail) => { resolve = fulfill; reject = fail })
  // Consume and retain both outcomes immediately. The actual ordinary writer
  // unwraps this owned result; a released rejection still fails its write.
  return { outcome: ownPublication(promise), resolve, reject }
}

const sourceFiles = Array.from({ length: 571 }, (_, index) => {
  const path = `tests/fixtures/point-node-anchors/${index < 173 ? 'cylinder-fitting-scanning' : 'cylinder-export-domain'}/` +
    `separately-authenticated-reference-observation-${String(index).padStart(4, '0')}-source-engine-command-control.json`
  const bytes = bytesFor({ index, raw: `exact source ${index} $\\frac{x_{${index}}}{y}$\t\n`, engine: 'controlled independent fixture' })
  return { path, bytes, hash: sha256(bytes) }
})
const checkout = {
  revision: '6'.repeat(40), trackedDiffSha256: '7'.repeat(64),
  untrackedSha256: Object.fromEntries(sourceFiles.map(({ path, hash }) => [path, hash])),
  fingerprint: sha256(bytesFor(sourceFiles.map(({ path, hash }) => [path, hash]))),
}
assert.equal(Object.keys(checkout.untrackedSha256).length, 571)
assert.ok(bytesFor(checkout).length >= 98_000, 'Fixture exercises the observed complete-checkout metadata size')

function measuredPage({ nativeError, cleanupError, assertionFailure = false } = {}) {
  const fixture = syntheticPendingLayoutPreparation(), template = fixture.pendingPreparation
  let state = structuredClone(template.stateBefore), drawer = true, collapsed = false, clicked = false
  let geometricObserver = false, modifierObserver = false, heldSource = template.source, exportListener = true
  const actions = [], evaluations = []
  const snapshot = ({ click, token }) => {
    const raw = structuredClone(clicked ? template.nativeSelection.after : template.nativeSelection.before)
    raw.selection = structuredClone(state.selection)
    raw.inspector.open = drawer
    raw.toolbar = { ...raw.toolbar, collapsed, floatingCount: Number(!collapsed), expandCount: Number(collapsed),
      collapseCount: Number(!collapsed), quickStyleCount: Number(!collapsed && state.selection !== null) }
    raw.tool.selectPressed = collapsed ? null : 'true'
    raw.requestedClick = structuredClone(click)
    raw.events = clicked && token && geometricObserver ? structuredClone(template.nativeSelection.after.events) : []
    for (const event of raw.events) event.App.selectPressed = collapsed ? null : 'true'
    if (!click) { raw.elementFromPoint = null; raw.elementsFromPoint = [] }
    else if (!collapsed && !clicked) {
      raw.elementFromPoint = { pointId: null, svg: false, canvas: false, drawer: false, creationToolbar: true,
        toolbarOverlay: true, quickStyle: false }
      raw.elementsFromPoint = [structuredClone(raw.elementFromPoint), ...raw.elementsFromPoint]
    }
    return raw
  }
  const page = {
    async evaluate(operation, argument) {
      evaluations.push(operation.name)
      switch (operation.name) {
        case 'observeGeometricSelection': return snapshot(argument)
        case 'observePendingLayoutPreparation': {
          const measurement = structuredClone(template.stages[0].measurement)
          measurement.requestedClick = structuredClone(argument.click ?? template.nativeSelection.requestedClick)
          measurement.hold.released = heldSource === null
          if (!collapsed && !clicked) {
            measurement.elementFromPoint = { tag: 'span', pointId: null, svg: false, canvas: false, drawer: false, toolbar: true }
            measurement.elementsFromPoint.unshift(structuredClone(measurement.elementFromPoint))
            measurement.eligibility = { eligible: false, reasons: ['toolbar-interception', 'wrong-first-hit-stack-owner'] }
          }
          return measurement
        }
        case 'installGeometricSelectionObserver': assert.equal(geometricObserver, false); geometricObserver = true; return
        case 'removeGeometricSelectionObserver': geometricObserver = false; return true
        case 'installPendingModifiers': assert.equal(modifierObserver, false); modifierObserver = true; return
        case 'readPendingModifiers': return modifierObserver ? structuredClone(template.modifiers) : null
        case 'removePendingModifiers':
          modifierObserver = false
          if (cleanupError) throw cleanupError
          return true
        default: throw new Error(`Unexpected browser observation ${operation.name}`)
      }
    },
    locator(selector) {
      return {
        async count() { assert.equal(selector, '#preview-inspector-drawer'); return Number(drawer) },
        async waitFor() {},
        async scrollIntoViewIfNeeded({ timeout }) { assert.equal(selector, 'svg.svg-diagram'); assert.equal(timeout, 5000) },
      }
    },
    getByRole(role, { name, exact }) {
      assert.equal(role, 'button'); assert.equal(exact, true)
      return {
        async count() {
          if (name === 'Close inspector drawer') return Number(drawer)
          if (name === 'Open inspector drawer') return Number(!drawer)
          if (name === 'Expand preview toolbar') return Number(collapsed)
          if (name === 'Collapse preview toolbar') return Number(!collapsed)
          assert.equal(name, 'Select'); return Number(!collapsed)
        },
        async click({ timeout } = {}) {
          assert.equal(timeout, 5000); actions.push(name)
          if (name === 'Close inspector drawer') drawer = false
          else if (name === 'Expand preview toolbar') collapsed = false
          else if (name === 'Collapse preview toolbar') collapsed = true
          else assert.equal(name, 'Select')
        },
        async getAttribute(name) { return name === 'aria-expanded' ? String(drawer) : 'true' },
        async waitFor() {},
      }
    },
    mouse: {
      async click(x, y) {
        assert.equal(clicked, false, 'Fixture owns exactly one ordinary native gesture')
        assert.equal(geometricObserver, true); assert.equal(modifierObserver, true)
        assert.deepEqual({ x, y }, template.nativeSelection.requestedClick)
        actions.push({ click: { x, y } }); clicked = true
        state = { ...state, selection: { kind: 'stratum', id: assertionFailure ? 'layout-trapezium' : 'layout-circle' } }
        if (nativeError) throw nativeError
      },
    },
  }
  return {
    page, template, actions, evaluations, readState: async () => structuredClone(state),
    observePoint: async () => structuredClone(template.nativeSelection.rendered),
    release() { heldSource = null; exportListener = false },
    assertReleased() {
      assert.equal(geometricObserver, false); assert.equal(modifierObserver, false)
      assert.equal(drawer, false); assert.equal(collapsed, false)
      assert.equal(heldSource, null); assert.equal(exportListener, false)
      assert.equal(actions.filter((action) => typeof action === 'object').length, 1)
      assert.deepEqual(actions.filter((action) => typeof action === 'string'),
        ['Close inspector drawer', 'Select', 'Collapse preview toolbar', 'Expand preview toolbar'])
      for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'uiSettings', 'requests']) {
        assert.deepEqual(state[field], template.stateBefore[field], `Composed path preserves ${field}`)
      }
    },
  }
}

async function composition(t, { history = 256, nativeError, cleanupError, assertionFailure, controlledClock = false } = {}) {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-pending-publication-composition-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  const browser = measuredPage({ nativeError, cleanupError, assertionFailure })
  const writerRecords = [], publicationRecords = [], requests = [], gates = []
  let currentPublication, scheduled, activeGate, clockMs = 0
  const publisher = createEvidencePublisher({ artifactDir, checkout, write: async (path, bytes) => {
    const record = { name: basename(path), bytes: bytes.length, publication: currentPublication, enteredMs: performance.now() }
    writerRecords.push(record)
    if (activeGate && !activeGate.used && activeGate.match(currentPublication, path)) {
      activeGate.used = true; activeGate.entered.resolve(record)
      try { publicationValue(await activeGate.release.outcome); await writeFile(path, bytes) }
      finally { activeGate.drained.resolve() }
    } else await writeFile(path, bytes)
  } })
  const originalPublish = publisher.publish
  publisher.publish = (name, raw, options = {}) => {
    const request = { name, stage: options.stage, operationOwner: options.operation?.owner,
      operationToken: options.operation?.token, disposition: options.disposition, requestedMs: performance.now() }
    requests.push(request)
    const pending = originalPublish(name, raw, options)
    const authorityOperation = publisher.metrics.progress.findLast(({ phase }) => phase === 'operation-start')
    request.publicationTimeoutMs = authorityOperation.timeoutMs
    request.publicationDeadlineMs = authorityOperation.deadlineMs
    return pending.then((document) => {
      request.completedMs = performance.now(); request.sequence = document.identity.sequence
      return document
    })
  }
  const storage = createEvidenceReportStorage({ artifactDir, checkout, publisher })
  const report = { result: 'running', stage: 'point-node-layout-anchors', checkout, started: [group], completed: [],
    unexecuted: ['final-standalone'], pageErrors: [], diagnostics: [], evidence: [], checkpoints: [] }
  const shared = publisher.capture({ nativeSelection: browser.template.nativeSelection,
    measurement: browser.template.stages[0].measurement, source: browser.template.source })
  // Fixture construction precedes the scoped final diagnostic's deadline.
  for (let index = 0; index < 4761; index++) report.diagnostics.push(storage.capture({ name: `historical-diagnostic-${index}`, ordinal: index, raw: shared }))
  const expectedHistory = []
  for (let index = 0; index < history; index++) {
    const name = `historical-proof-${String(index).padStart(4, '0')}.json`, raw = { result: 'observed', ordinal: index, raw: shared }
    await publisher.publish(name, raw, { stage: `historical-observation-${index}` })
    expectedHistory.push({ name, raw })
  }
  await storage.save(report)
  const publish = async (name, raw, options) => {
    const entry = { name, boundary: raw.boundary, operation: options.operation, disposition: options.disposition,
      startedMs: performance.now(), expected: structuredClone(raw) }
    publicationRecords.push(entry); currentPublication = entry
    const value = await publisher.publish(name, raw, options)
    entry.completedMs = performance.now(); entry.document = value
    return value
  }
  const observe = async (name, details, options = {}) => {
    options.operation?.assertActive('fixture-report-checkpoint-start')
    report.checkpoints.push({ group, name })
    report.diagnostics.push(storage.capture({ name, ...details }, options))
    await storage.save(report, options)
  }
  const diagnostic = createPointDiagnostics({ artifactDir, observe, publish, artifactPrefix: 'point-layout-selection' })
  const secondaryErrors = []
  const diagnose = async (details, options = {}) => {
    await diagnostic(group, browser.template.scenario, details, options)
    if (details.pendingPreparation) await publish(`${browser.template.scenario}-preparation.json`,
      { scenario: browser.template.scenario, group, result: 'observed', pendingPreparation: details.pendingPreparation },
      { ...options, stage: browser.template.scenario })
  }
  const scheduleDiagnosticDeadline = (expire, timeoutMs, operation) => {
    assert.equal(operation.name, 'Geometric selection final evidence')
    assert.equal(timeoutMs, 2000); assert.equal(operation.deadlineMs, operation.startMs + 2000)
    scheduled = { expire, operation, timeoutMs, cancelled: false }
    return () => { scheduled.cancelled = true }
  }
  if (controlledClock) scheduleDiagnosticDeadline.monotonicNow = () => clockMs
  const run = () => preparePendingLayoutPoint({ page: browser.page, readState: browser.readState, observePoint: browser.observePoint,
    diagnose, secondaryErrors, scenario: browser.template.scenario, sequence: browser.template.sequence,
    fixture: browser.template.fixture, source: browser.template.source, scheduleDiagnosticDeadline })
  const gate = (match) => {
    const owned = { entered: publicationGate(), release: rejectionGate(), drained: publicationGate(), match, used: false }
    gates.push(owned); activeGate = owned; return owned
  }
  t.after(async () => {
    for (const owned of gates) owned.release.resolve()
    await Promise.all(gates.filter(({ used }) => used).map(({ drained }) => drained.promise))
    await Promise.all(gates.map(({ release }) => release.outcome))
  })
  const finishFailure = async (error) => {
    // Mirrors the outer owned failure/cleanup boundary: release resources and
    // retain failed authority without borrowing the expired success operation.
    await boundedPointDiagnostic(() => browser.release(), 'Composition failure resource cleanup')
    const primary = publisher.fail(error)
    report.result = 'failed'; report.stage = 'point-node-layout-anchors-failed'
    report.error = { message: primary.message, stack: primary.stack, code: primary.code }
    await storage.save(report)
    return primary
  }
  return { artifactDir, checkout, publisher, storage, report, browser, writerRecords, publicationRecords, requests, expectedHistory,
    run, gate, finishFailure, secondaryErrors, setClock: (value) => { clockMs = value }, get scheduled() { return scheduled } }
}

test('large exact checkout and accumulated history complete all five final publications through the real pending selection composition', async (t) => {
  const input = await composition(t, { history: 859 })
  const held = input.gate((entry) => entry?.boundary === 'selection-finished')
  const outcome = ownPublication(input.run())
  await awaitPublicationEntry(held.entered, outcome)
  const operation = input.scheduled.operation
  const mutable = { native: structuredClone(input.browser.template.nativeSelection), measurement: structuredClone(input.browser.template.stages[0].measurement) }
  const expected = structuredClone(mutable)
  const queued = ownPublication(input.publisher.publish('queued-frozen-final-proof.json', mutable,
    { stage: 'queued-during-final-evidence', operation }))
  mutable.native.after.layout.source = 'changed after enqueue'; mutable.measurement.points[0].source = 'changed after enqueue'
  held.release.resolve()
  const rendered = publicationValue(await outcome)
  publicationValue(await queued); await held.drained.promise
  assertPendingLayoutPreparation(rendered.pendingPreparation)
  assert.equal(rendered.pendingPreparation.result, 'passed')
  assert.equal(rendered.pendingPreparation.finalSelectionOperation.state, 'completed')
  assert.equal(rendered.pendingPreparation.finalSelectionOperation.owner, operation.owner)
  assert.equal(operation.state, 'completed'); assert.equal(input.scheduled.cancelled, true)
  const finalPublications = input.publicationRecords.filter((entry) => entry.operation === operation)
  assert.equal(finalPublications.length, 3, 'Raw final selection, raw pending preparation and named preparation all publish under one owner')
  assert.ok(finalPublications.every(({ completedMs }) => Number.isFinite(completedMs)), 'Required final artifacts resolve before return')
  const finalRequests = input.requests.filter(({ operationOwner, name }) => operationOwner === operation.owner && name !== 'queued-frozen-final-proof.json')
  assert.deepEqual(finalRequests.map(({ name }) => name), [finalPublications[0].name, 'free-labels-evidence.json',
    finalPublications[1].name, 'free-labels-evidence.json', finalPublications[2].name],
  'Caller diagnostic/report and pending retain diagnostic/report/named preparation remain five ordered mandatory publications')
  assert.ok(finalRequests.every(({ completedMs, sequence, operationToken }) => Number.isFinite(completedMs)
    && Number.isSafeInteger(sequence) && operationToken === operation.token), 'All five publications fully complete under their exact final owner before helper return')
  assert.ok(finalRequests.every(({ publicationTimeoutMs }) => publicationTimeoutMs === 5000), 'Production publication deadline stays 5,000ms')
  for (const { name } of finalPublications) {
    const latest = input.publicationRecords.findLast((entry) => entry.name === name)
    assert.deepEqual(readEvidenceDocumentSync(input.artifactDir, name, { checkout }), latest.expected)
  }
  assert.deepEqual(readEvidenceDocumentSync(input.artifactDir, 'queued-frozen-final-proof.json', { checkout }), expected)
  await input.storage.save(input.report)
  assert.deepEqual(readEvidenceDocumentSync(input.artifactDir, 'free-labels-evidence.json', { checkout }), input.report)
  for (const { name, raw } of input.expectedHistory) {
    assert.deepEqual(readEvidenceDocumentSync(input.artifactDir, name, { checkout }), raw)
  }
  const index = await json(input.artifactDir, 'evidence-publication-index.json')
  assert.deepEqual(index.history.slice(0, 859).map(({ name, stage, disposition, sequence }) => ({ name, stage, disposition, sequence })),
    input.expectedHistory.map(({ name }, ordinal) => ({ name, stage: `historical-observation-${ordinal}`, disposition: 'running', sequence: ordinal + 1 })))
  assert.ok(index.history.length > 859); assert.ok(Object.keys(index.documents).length > 859)
  const indexBytes = (await readFile(join(input.artifactDir, 'evidence-publication-index.json'))).length
  assert.ok(indexBytes < 2_000_000, 'Frequently rewritten authority does not repeat the 98KB checkout per document')
  assert.ok(input.publisher.metrics.indexBytes < 1_500_000_000, 'Regression never recreates the historical 125GB metadata writes')
  assert.ok(input.publisher.metrics.identityBytes >= bytesFor(checkout).length)
  assert.ok(input.publisher.metrics.identityBytes < bytesFor(checkout).length * 2, 'Complete canonical checkout is retained once')
  assert.ok(input.publisher.metrics.referenceBytes < 2_000_000, 'Ordered immutable pack references grow linearly')
  assert.ok(input.publisher.metrics.indexSerializeMs >= 0 && input.publisher.metrics.hashMs >= 0 && input.publisher.metrics.queueWaitMs >= 0)
  assert.ok(input.publisher.metrics.progress.some((entry) => entry.operationOwner === operation.owner && entry.sequence > 859), 'Authority timing is associated with the final producer owner')
  const summary = { checkoutEntries: 571, checkoutBytes: bytesFor(checkout).length, seededDocuments: 859, historicalDiagnostics: 4761,
    documents: Object.keys(index.documents).length, boundaries: index.history.length, indexBytes,
    identityBytes: input.publisher.metrics.identityBytes, referenceBytes: input.publisher.metrics.referenceBytes,
    indexWrites: input.publisher.metrics.indexWrites, indexWriteBytes: input.publisher.metrics.indexBytes, indexSerializeMs: input.publisher.metrics.indexSerializeMs,
    hashMs: input.publisher.metrics.hashMs, queueWaitMs: input.publisher.metrics.queueWaitMs,
    finalRequiredPublications: finalRequests.map(({ name, sequence, publicationTimeoutMs }) => ({ name, sequence, publicationTimeoutMs })),
    finalDiagnostic: { owner: operation.owner, token: operation.token, timeoutMs: operation.timeoutMs,
      startMs: operation.startMs, deadlineMs: operation.deadlineMs,
      completedMs: operation.progress.at(-1).atMs, durationMs: operation.progress.at(-1).atMs - operation.startMs } }
  if (process.env.STZ_PENDING_PUBLICATION_METRICS) await writeFile(process.env.STZ_PENDING_PUBLICATION_METRICS, bytesFor(summary))
  t.diagnostic(JSON.stringify(summary))
  input.browser.release(); input.browser.assertReleased()
})

for (const late of ['fulfillment', 'rejection']) test(`controlled final diagnostic expiry consumes late ${late} and preserves frozen historical observation and failed cleanup authority`, async (t) => {
  const input = await composition(t)
  const unhandled = [], onUnhandled = (error) => unhandled.push(error)
  process.on('unhandledRejection', onUnhandled); t.after(() => process.off('unhandledRejection', onUnhandled))
  const held = input.gate((entry) => entry?.operation?.name === 'Geometric selection final evidence'
    && entry.name.endsWith('-preparation.json'))
  const outcome = ownPublication(input.run())
  await awaitPublicationEntry(held.entered, outcome)
  const finalOwner = input.scheduled.operation
  const beforeExpiry = input.publicationRecords.filter((entry) => entry.operation === finalOwner && entry.completedMs)
  assert.equal(beforeExpiry.length, 2, 'The raw selection and pending snapshots commit before the fifth ordered publication is held')
  const native = beforeExpiry.find(({ boundary }) => boundary === 'selection-finished')
  assert.deepEqual(native.expected.observation.secondaryErrors, []); assert.equal(native.expected.primary, undefined)
  input.scheduled.expire()
  const result = await outcome
  assert.equal(result.ok, false); assert.ok(result.error instanceof AggregateError)
  assert.ok(result.error.errors.some(({ message }) => /Timed out after 2000ms during Geometric selection final evidence/.test(message)))
  const primary = await input.finishFailure(result.error)
  assert.equal(finalOwner.state, 'expired')
  assert.ok(input.secondaryErrors.some((message) => /Geometric selection final evidence/.test(message)))
  const failedBytes = await readFile(join(input.artifactDir, 'free-labels-evidence.json'))
  const failedIndex = await readFile(join(input.artifactDir, 'evidence-publication-index.json'))
  const snapshots = input.publicationRecords.filter((entry) => entry.operation === finalOwner).map(({ name, completedMs }) => ({ name, completedMs }))
  const lateError = new Error('controlled late final ordinary writer rejection')
  if (late === 'fulfillment') held.release.resolve()
  else held.release.reject(lateError)
  await held.drained.promise
  const released = await held.release.outcome
  assert.equal(released.ok, late === 'fulfillment')
  if (!released.ok) assert.equal(released.error, lateError)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(sha256(await readFile(join(input.artifactDir, 'free-labels-evidence.json'))), sha256(failedBytes))
  assert.equal(sha256(await readFile(join(input.artifactDir, 'evidence-publication-index.json'))), sha256(failedIndex), 'Late writer cannot rewrite failed authority')
  assert.equal(input.publisher.primary, primary)
  assert.deepEqual(input.publicationRecords.filter((entry) => entry.operation === finalOwner).map(({ name, completedMs }) => ({ name, completedMs })), snapshots)
  assert.deepEqual(readEvidenceDocumentSync(input.artifactDir, native.name, { checkout }), native.expected)
  const failure = readEvidenceDocumentSync(input.artifactDir, 'free-labels-evidence.json', { checkout })
  assert.equal(failure.result, 'failed'); assert.deepEqual(failure.pageErrors, [])
  const preparations = input.publicationRecords.filter(({ expected: raw }) => raw.pendingPreparation)
  assert.ok(preparations.some(({ expected: raw }) => raw.pendingPreparation.error?.message === result.error.message))
  assert.ok(preparations.every(({ expected: raw }) => raw.pendingPreparation.result === 'observed'))
  assert.ok(preparations.every(({ expected: raw }) => !raw.pendingPreparation.stages.some(({ boundary }) => boundary === 'after-native-selection')))
  const failedPreparation = preparations.findLast(({ expected: raw }) => raw.pendingPreparation.error)
  assert.equal(failedPreparation.expected.pendingPreparation.finalSelectionOperation.state, 'expired')
  assert.equal(failedPreparation.expected.pendingPreparation.finalSelectionOperation.owner, finalOwner.owner)
  assert.ok(failedPreparation.expected.pendingPreparation.selectionDiagnosticErrors.some(({ message }) => message === finalOwner.error.message))
  assert.deepEqual(unhandled, [])
  input.browser.assertReleased()
})

for (const late of ['fulfillment', 'rejection']) test(`absolute final diagnostic deadline owns ${late} when the scoped timer callback has not been delivered`, async (t) => {
  const input = await composition(t, { controlledClock: true })
  const held = input.gate((entry) => entry?.operation?.name === 'Geometric selection final evidence'
    && entry.name.endsWith('-preparation.json'))
  const outcome = ownPublication(input.run())
  let cleaned = false
  try {
    await awaitPublicationEntry(held.entered, outcome)
    const operation = input.scheduled.operation
    assert.equal(operation.startMs, 0); assert.equal(operation.deadlineMs, 2000)
    input.setClock(2000)
    const lateError = new Error('ordinary final writer rejected beyond its undelivered diagnostic deadline')
    if (late === 'fulfillment') held.release.resolve()
    else held.release.reject(lateError)
    const result = await outcome
    await held.drained.promise
    assert.equal(result.ok, false); assert.ok(result.error instanceof AggregateError)
    assert.equal(operation.state, 'expired')
    assert.ok(result.error.errors.includes(operation.error))
    assert.equal(operation.error.message, 'Timed out after 2000ms during Geometric selection final evidence')
    assert.ok(!result.error.errors.includes(lateError), 'A late ordinary rejection cannot replace the owned timeout')
    const unpublished = input.publicationRecords.find(({ operation: owner, name }) => owner === operation && name.endsWith('-preparation.json'))
    assert.equal(unpublished.completedMs, undefined, 'Exact monotonic expiry prevents the held success authority from committing')
    await input.finishFailure(result.error); cleaned = true
    assert.equal(input.publisher.primary, result.error, 'The composed failure owns index and report authority')
    const report = readEvidenceDocumentSync(input.artifactDir, 'free-labels-evidence.json', { checkout })
    assert.equal(report.result, 'failed'); assert.equal(report.error.message, result.error.message)
    assert.deepEqual(report.pageErrors, [])
    const failedIndex = await readFile(join(input.artifactDir, 'evidence-publication-index.json'))
    const failedReport = await readFile(join(input.artifactDir, 'free-labels-evidence.json'))
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(await readFile(join(input.artifactDir, 'evidence-publication-index.json')), failedIndex)
    assert.deepEqual(await readFile(join(input.artifactDir, 'free-labels-evidence.json')), failedReport)
    assert.equal(Object.keys(lateError).length, 0)
    input.browser.assertReleased()
  } finally {
    held.release.resolve()
    if (held.used) await held.drained.promise
    await outcome
    if (!cleaned) await boundedPointDiagnostic(() => input.browser.release(), 'Composition test resource cleanup')
  }
})

test('ordinary final writer rejection before its diagnostic deadline gives the composed AggregateError consistent failed authority', async (t) => {
  const input = await composition(t, { controlledClock: true })
  const held = input.gate((entry) => entry?.operation?.name === 'Geometric selection final evidence'
    && entry.name.endsWith('-preparation.json'))
  const outcome = ownPublication(input.run())
  let cleaned = false
  try {
    await awaitPublicationEntry(held.entered, outcome)
    const operation = input.scheduled.operation, writerError = new Error('ordinary final writer rejected before its diagnostic deadline')
    assert.equal(operation.deadlineMs, 2000)
    input.setClock(1999); held.release.reject(writerError)
    const result = await outcome
    await held.drained.promise
    assert.equal(result.ok, false); assert.ok(result.error instanceof AggregateError)
    assert.equal(operation.state, 'rejected'); assert.equal(operation.error, writerError)
    assert.deepEqual(result.error.errors, [writerError], 'The exact original write error remains the diagnostic cause')
    await input.finishFailure(result.error); cleaned = true
    assert.equal(input.publisher.primary, result.error, 'Nested persistence must not install a conflicting primary before its composed caller')
    const report = readEvidenceDocumentSync(input.artifactDir, 'free-labels-evidence.json', { checkout })
    const index = await json(input.artifactDir, 'evidence-publication-index.json')
    assert.equal(report.result, 'failed'); assert.deepEqual(report.pageErrors, [])
    assert.equal(index.primary.message, result.error.message); assert.equal(index.primary.stack, result.error.stack)
    assert.equal(report.error.message, index.primary.message); assert.equal(report.error.stack, index.primary.stack)
    assert.ok(input.publicationRecords.some(({ expected: raw }) => raw.pendingPreparation?.selectionDiagnosticErrors?.some(({ message }) => message === writerError.message)))
    assert.equal(Object.keys(writerError).length, 0, 'Composition preserves the original Error without mutating it')
    input.browser.assertReleased()
  } finally {
    held.release.resolve()
    if (held.used) await held.drained.promise
    await outcome
    if (!cleaned) await boundedPointDiagnostic(() => input.browser.release(), 'Composition test resource cleanup')
  }
})

for (const fault of ['native', 'assertion', 'cleanup']) test(`real composed publication preserves the earlier ${fault} failure through all mandatory cleanup`, async (t) => {
  const primary = new Error(`controlled earlier ${fault} failure`), secondary = new Error('controlled pending modifier cleanup failure')
  const input = await composition(t, { nativeError: fault === 'native' ? primary : undefined,
    cleanupError: fault === 'native' || fault === 'cleanup' ? secondary : undefined, assertionFailure: fault === 'assertion' })
  const outcome = await ownPublication(input.run())
  assert.equal(outcome.ok, false)
  if (fault === 'native') assert.equal(outcome.error, primary)
  else if (fault === 'cleanup') assert.equal(outcome.error, secondary)
  else assert.match(outcome.error.message, /Native contour click selects its point/)
  const established = await input.finishFailure(outcome.error)
  assert.equal(established, outcome.error)
  const failure = readEvidenceDocumentSync(input.artifactDir, 'free-labels-evidence.json', { checkout })
  assert.equal(failure.result, 'failed'); assert.equal(failure.error.message, outcome.error.message)
  assert.deepEqual(failure.pageErrors, [])
  assert.ok(input.publicationRecords.some(({ expected: raw }) => raw.pendingPreparation?.error?.message === outcome.error.message))
  assert.equal(Object.keys(primary).length, 0, 'No evidence disposition mutates the exact primary Error')
  input.browser.assertReleased()
})

test('strict cumulative replay rejects substitution of any complete checkout entry instead of accepting its unchanged fingerprint', async (t) => {
  const input = await composition(t)
  const rendered = await input.run(); assertPendingLayoutPreparation(rendered.pendingPreparation)
  await input.storage.save(input.report)
  const wrong = structuredClone(checkout)
  wrong.untrackedSha256[sourceFiles[570].path] = '0'.repeat(64)
  assert.equal(wrong.fingerprint, checkout.fingerprint)
  assert.throws(() => readEvidenceDocumentSync(input.artifactDir, 'free-labels-evidence.json', { checkout: wrong }), /current tree|checkout|identity|deep-equal/)
  for (const fault of ['missing-identity', 'wrong-identity-hash', 'wrong-owner', 'wrong-sequence', 'missing-reference-chunk']) {
    const destination = await mkdtemp(join(tmpdir(), 'stz-pending-strict-corruption-'))
    t.after(() => rm(destination, { recursive: true, force: true }))
    await cp(input.artifactDir, destination, { recursive: true })
    const pointer = await json(destination, 'free-labels-evidence.json')
    if (fault === 'missing-identity') await rm(join(destination, pointer.identity.checkout.path))
    if (fault === 'wrong-identity-hash') {
      pointer.identity.checkout.sha256 = '0'.repeat(64)
      await writeFile(join(destination, 'free-labels-evidence.json'), bytesFor(pointer))
    }
    if (fault === 'wrong-owner') {
      pointer.identity.owner = 'foreign-operation-owner'
      await writeFile(join(destination, 'free-labels-evidence.json'), bytesFor(pointer))
    }
    if (fault === 'wrong-sequence') {
      pointer.identity.sequence--
      await writeFile(join(destination, 'free-labels-evidence.json'), bytesFor(pointer))
    }
    if (fault === 'missing-reference-chunk') {
      const boundary = await json(destination, pointer.artifact.path)
      await rm(join(destination, boundary.packReferences.path))
    }
    assert.throws(() => readEvidenceDocumentSync(destination, 'free-labels-evidence.json', { checkout }),
      /ENOENT|SHA256|owner|ordinal|sequence|current committed|deep-equal|equal/)
  }
  const inventory = await readdir(input.artifactDir)
  assert.ok(inventory.some((name) => name.endsWith('.pack.json')))
  input.browser.release(); input.browser.assertReleased()
})
