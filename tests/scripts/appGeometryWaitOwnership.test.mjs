import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { browserDocument } from './appGeometryWaitFixture.mjs'
import { appGeometryLimits, cancelAppGeometryWait, createAppGeometryDiagnostics,
  waitForStableAppGeometry } from '../../scripts/appGeometryDiagnostics.mjs'
import { runAppChecksWithGeometryControls } from '../../scripts/checkFreeLabelsAppFocused.mjs'

const flush = () => new Promise((resolve) => setImmediate(resolve))
function deferred() {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function hostClock(start = 100) {
  let now = start
  const entries = []
  const schedule = (expire, timeoutMs, operation) => {
    const entry = { expire, timeoutMs, operation, cancelled: false }
    entries.push(entry)
    return () => { entry.cancelled = true }
  }
  schedule.monotonicNow = () => now
  return { schedule, entries, set: (value) => { now = value }, get now() { return now },
    expire(name) {
      const entry = entries.findLast((item) => item.operation.name === name)
      assert.ok(entry, `Entered owned operation ${name}`)
      now = entry.operation.deadlineMs
      entry.expire()
      return entry
    } }
}
async function setup(context) {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-app-composed-wait-'))
  const browser = browserDocument(), clock = hostClock(), observed = []
  let evaluationEntry = deferred(), activeOutcome
  const releaseEvaluationListener = browser.page.onEvaluate(({ name }) => {
    if (name === 'waitForAppGeometryInDocument') evaluationEntry.resolve()
  })
  const diagnostics = createAppGeometryDiagnostics({ page: browser.page, artifactDir })
  await diagnostics.install()
  context.after(async () => {
    releaseEvaluationListener()
    await diagnostics.dispose()
    await browser.page.close()
    await rm(artifactDir, { recursive: true, force: true })
  })
  const details = { stage: { name: 'valid-again-pending', source: browser.label.attributes['data-label-source'], status: 'pending' },
    probe: { kind: 'pointer', phase: 'before-click', edge: 'west', location: 'inside', alt: false, point: { x: 20, y: 30 } } }
  const options = { scheduleDeadline: clock.schedule, cancellationScheduleDeadline: clock.schedule,
    observeWait: (record) => observed.push(record), identity: { generation: 'original-document', url: 'http://localhost/app' }, context: details }
  const start = () => {
    evaluationEntry = deferred()
    activeOutcome = diagnostics.wait('stable', details, options).then((value) => ({ value }), (error) => ({ error }))
    return activeOutcome
  }
  const entered = async () => {
    assert.ok(activeOutcome, 'App wait was requested before awaiting its evaluation entry')
    await Promise.race([evaluationEntry.promise, activeOutcome.then(({ error }) => {
      throw error ?? new Error('App wait completed before entering its browser evaluation')
    })])
  }
  const index = async () => JSON.parse(await readFile(join(artifactDir, 'app-geometry-index.json'), 'utf8'))
  const record = async () => {
    const value = await index()
    assert.equal(value.waitIndex.length, 1)
    return JSON.parse(await readFile(join(artifactDir, value.waitIndex[0].artifact), 'utf8'))
  }
  return { ...browser, browser, artifactDir, diagnostics, clock, observed, details, options, start, entered, index, record }
}
function assertNoWaitWork(fixture) {
  assert.equal(fixture.window.__stzAppGeometryWaits?.size ?? 0, 0, 'No active browser wait token')
  assert.equal([...fixture.timers.values()].filter(({ delay }) => delay === 2000).length, 0, 'No browser wait deadline timer')
  assert.equal(fixture.frames.size, fixture.window.__stzAppGeometryDiagnostics.snapshot().frames.stopped ? 0 : 1,
    'Only the existing observer frame may remain')
}
async function assertDisposed(fixture) {
  await fixture.diagnostics.dispose()
  assert.equal(fixture.frames.size, 0)
  assert.equal(fixture.timers.size, 0)
  assert.equal(fixture.document.listeners.size, 0)
  assert.equal(fixture.window.listeners.size, 0)
  assert.equal(fixture.page.listenerCount('pageerror'), 0)
  assert.equal(fixture.window.__stzAppGeometryWaits?.size ?? 0, 0)
}

test('composed App caller accepts only the third exact stable frame and retains stage/probe timing', async (context) => {
  const fixture = await setup(context), continuation = []
  const caller = runAppChecksWithGeometryControls({}, async () => {
    const { value, error } = await fixture.start()
    if (error) throw error
    continuation.push('App workflow completed')
    assert.equal(value.frames, 3)
    assert.equal(value.stableFrames, 3)
    assert.equal(value.samples.length, 3)
    assert.equal(value.snapshot.labelSource, fixture.details.stage.source)
    assert.ok(value.timing, 'Browser wait has its own clock record')
  }, async () => { continuation.push('native geometry controls completed') })
  await fixture.entered()
  assert.deepEqual(continuation, [])
  await fixture.frame(); await fixture.frame()
  assert.deepEqual(continuation, [], 'Two equal frames do not complete the App group')
  await fixture.frame(); await caller
  assert.deepEqual(continuation, ['App workflow completed', 'native geometry controls completed'])
  const record = await fixture.record()
  assert.equal(record.result, 'passed')
  assert.deepEqual(record.context, fixture.details)
  assert.equal(fixture.clock.entries[0].timeoutMs, 2100)
  assert.ok(fixture.clock.entries.every(({ cancelled }) => cancelled))
  assertNoWaitWork(fixture)
  await assertDisposed(fixture)
})

for (const [name, change] of [
  ['rectangle', (fixture) => { fixture.svg.bounds.x++ }],
  ['node identity', (fixture) => { fixture.replaceLabel() }],
  ['source', (fixture) => { fixture.label.attributes['data-label-source'] = '$j$' }],
  ['request', (fixture) => { fixture.label.attributes['data-label-request'] = '["$j$",2,16.2]' }],
  ['status', (fixture) => { fixture.label.attributes['data-label-state'] = 'ready' }],
  ['bounds', (fixture) => { fixture.label.attributes['data-label-bounds'] = '0 0 12 12' }],
  ['transform', (fixture) => { fixture.label.transform.e++ }],
  ['ancestor layout', (fixture) => { fixture.ancestor.style.overflowY = 'scroll' }],
  ['scroll', (fixture) => { fixture.window.scrollY = 200 }],
  ['viewport', (fixture) => { fixture.window.innerWidth++ }],
  ['viewBox', (fixture) => { fixture.svg.attributes.viewBox = '0 0 101 100' }],
  ['Inspector', (fixture) => { fixture.openInspector() }],
  ['camera controls', (fixture) => { fixture.expandCamera() }],
]) test(`composed exact stable acceptance resets after changing ${name}`, async (context) => {
  const fixture = await setup(context), outcome = fixture.start()
  await fixture.entered(); await fixture.frame(); await fixture.frame()
  change(fixture); await fixture.frame(); await fixture.frame(); await fixture.frame()
  const { value, error } = await outcome
  assert.equal(error, undefined)
  assert.equal(value.frames, 5)
  assert.equal(value.stableFrames, 3)
  assert.equal(value.samples.length, 3)
  assertNoWaitWork(fixture)
})

for (const [name, change, pattern] of [
  ['missing label', (fixture) => { fixture.document.querySelector = () => null }, /Missing or nonfinite/],
  ['disconnected target', (fixture) => { fixture.svg.isConnected = false }, /Missing or nonfinite/],
  ['nonfinite rect', (fixture) => { fixture.svg.bounds.width = Infinity }, /Missing or nonfinite/],
  ['nonfinite CTM', (fixture) => { fixture.label.transform.e = NaN }, /Missing or nonfinite/],
  ['missing CTM', (fixture) => { fixture.label.transform = null }, /Missing App client transform/],
  ['URL loss', (fixture) => { fixture.location.href += '/replacement' }, /continuity lost/],
  ['API loss', (fixture) => { fixture.window.stzAppLabels = { state() {} } }, /continuity lost/],
  ['generation loss', (fixture) => { fixture.window.__stzOwnedAppDocument.generation = 'replacement' }, /continuity lost/],
  ['stopped observer', (fixture) => { fixture.window.__stzAppGeometryDiagnostics.stop() }, /observer stopped/],
  ['oversized source', (fixture) => { fixture.label.attributes['data-label-source'] = 'x'.repeat(appGeometryLimits.string + 1) }, /source\/request exceeds/],
]) test(`composed App wait rejects ${name}, retains first failure and cleans its exact token`, async (context) => {
  const fixture = await setup(context), outcome = fixture.start()
  await fixture.entered(); change(fixture); await fixture.frame()
  const { error } = await outcome
  assert.match(error.message, pattern)
  await fixture.diagnostics.failure(error, fixture.details)
  const index = await fixture.index()
  assert.equal(index.failure.error.message, error.message)
  assert.equal((await fixture.record()).result, 'failed')
  assertNoWaitWork(fixture)
  await assertDisposed(fixture)
})

test('no browser frames reaches inner deadline before host backstop and drains timer/frame/token', async (context) => {
  const fixture = await setup(context), outcome = fixture.start()
  await fixture.entered(); fixture.advance(2000); await fixture.deliverTimers()
  const { error } = await outcome
  assert.match(error.message, /App geometry never stabilized within 2000ms/)
  assert.equal(fixture.clock.now, 100, 'Browser clock cannot silently advance host ownership')
  assertNoWaitWork(fixture)
  await assertDisposed(fixture)
})

test('changing geometry hits the existing 600-frame budget with the three-sample ring bounded', async (context) => {
  const fixture = await setup(context), outcome = fixture.start()
  await fixture.entered()
  for (let i = 0; i < 600; i++) { fixture.svg.bounds.x++; await fixture.frame(1) }
  const { error } = await outcome
  assert.match(error.message, /600-frame budget/)
  const records = fixture.window.__stzAppGeometryWaitRecords
  assert.ok(records.size <= 8)
  const record = [...records.values()][0]
  assert.equal(record.frames, 600)
  assert.equal(record.stableFrames, 1)
  assert.equal(record.samples.length, 16)
  assert.ok(record.droppedSamples > 0)
  assertNoWaitWork(fixture)
})

test('existing eight-token browser map rejects a ninth composed wait without changing predecessors', async (context) => {
  const fixture = await setup(context), inherited = new Map(Array.from({ length: 8 }, (_, index) => [String(index), { cancel() {} }]))
  fixture.window.__stzAppGeometryWaits = inherited
  const { error } = await fixture.start()
  assert.match(error.message, /wait budget exceeded/)
  assert.equal(inherited.size, 8)
  inherited.clear()
  await assertDisposed(fixture)
})

test('host absolute expiry with responsive cancellation prevents App group completion and records cleanup', async (context) => {
  const fixture = await setup(context), passes = []
  const outcome = runAppChecksWithGeometryControls({}, async () => {
    const { error } = await fixture.start()
    if (error) throw error
    passes.push('App group pass')
  }, async () => { passes.push('native controls pass') }).then(() => ({}), (error) => ({ error }))
  await fixture.entered()
  fixture.clock.expire('App stable frame wait')
  const { error } = await outcome
  assert.equal(error.message, 'Timed out after 2100ms during App stable frame wait')
  assert.deepEqual(passes, [])
  const cancellation = fixture.observed.find(({ event }) => event === 'cancellation-returned')
  assert.ok(cancellation, 'Responsive cancellation outcome is recorded')
  assert.deepEqual(structuredClone(cancellation.cancellation.cleanup), { framePending: false, timerPending: false, mapHasToken: false })
  assert.equal((await fixture.record()).result, 'failed')
  assertNoWaitWork(fixture)
  await assertDisposed(fixture)
})

test('stalled cancellation has its own unchanged 250ms bound and late rejection cannot replace primary', async (context) => {
  const fixture = await setup(context), cancellation = deferred(), entered = deferred()
  fixture.page.overrides.set('cancelAppGeometryWait', () => { entered.resolve(); return cancellation.promise })
  const outcome = fixture.start()
  await fixture.entered(); fixture.clock.expire('App stable frame wait'); await entered.promise
  const bound = fixture.clock.expire('App frame cancellation')
  assert.equal(bound.timeoutMs, 250)
  const { error } = await outcome
  assert.equal(error.message, 'Timed out after 2100ms during App stable frame wait')
  cancellation.reject(new Error('late cancellation transport rejection')); await flush()
  fixture.page.overrides.delete('cancelAppGeometryWait')
  await fixture.diagnostics.failure(error, fixture.details)
  await assertDisposed(fixture)
  assert.equal((await fixture.index()).failure.error.message, error.message)
})

for (const late of ['fulfillment', 'rejection']) test(`withheld cancellation timer classifies late ${late} by its absolute deadline`, async (context) => {
  const fixture = await setup(context), entered = deferred(), release = deferred()
  fixture.page.overrides.set('cancelAppGeometryWait', async (callback, argument) => {
    entered.resolve(); await release.promise
    if (late === 'rejection') throw new Error('cancellation transport rejection after deadline')
    return fixture.page.execute(callback, argument)
  })
  const outcome = fixture.start(); await fixture.entered()
  fixture.clock.expire('App stable frame wait'); await entered.promise
  const cancel = fixture.clock.entries.findLast(({ operation }) => operation.name === 'App frame cancellation')
  assert.equal(cancel.timeoutMs, 250)
  fixture.clock.set(cancel.operation.deadlineMs)
  release.resolve()
  const { error } = await outcome
  assert.equal(error.message, 'Timed out after 2100ms during App stable frame wait')
  assert.ok(fixture.observed.some(({ event }) => event === `late-cancellation-${late}`))
  assert.equal(fixture.observed.some(({ event }) => event === 'cancellation-evaluation-returned'), false)
  const failure = fixture.observed.find(({ event }) => event === 'cancellation-rejected')
  assert.match(failure.error.message, /Timed out after 250ms during App frame cancellation/)
  await assertDisposed(fixture)
  assertNoWaitWork(fixture)
})

for (const late of ['fulfillment', 'rejection']) test(`expired host owns browser transport late ${late} without stale pass`, async (context) => {
  const fixture = await setup(context), transport = deferred(), entered = deferred(), unhandled = []
  const onUnhandled = (error) => unhandled.push(error)
  process.on('unhandledRejection', onUnhandled)
  fixture.page.overrides.set('waitForAppGeometryInDocument', (callback, argument) => {
    const browserOutcome = Promise.resolve(fixture.page.execute(callback, argument)).then((value) => ({ value }), (error) => ({ error }))
    entered.resolve()
    return transport.promise.then(async () => {
      const result = await browserOutcome
      if (result.error) throw result.error
      return result.value
    })
  })
  try {
    const outcome = fixture.start(); await entered.promise
    if (late === 'fulfillment') { await fixture.frame(); await fixture.frame(); await fixture.frame() }
    fixture.clock.expire('App stable frame wait')
    const { error } = await outcome
    assert.equal(error.message, 'Timed out after 2100ms during App stable frame wait')
    if (late === 'fulfillment') transport.resolve(); else transport.reject(new Error('late wait transport rejection'))
    await flush()
    await fixture.diagnostics.drain()
    const record = await fixture.record()
    assert.equal(record.result, 'failed')
    assert.equal(record.error.message, error.message)
    assert.ok(record.events.some(({ event }) => event === `late-${late}`), 'Owned late event is retained after drain')
    assert.ok(fixture.observed.some(({ event }) => event === `late-${late}`))
    assert.deepEqual(unhandled, [])
    assertNoWaitWork(fixture)
    await assertDisposed(fixture)
  } finally { transport.resolve(); await flush(); process.off('unhandledRejection', onUnhandled) }
})

test('cancellation before evaluation registration tombstones only its token; late registration cannot schedule work', async (context) => {
  const fixture = await setup(context), registration = deferred(), entered = deferred()
  fixture.page.overrides.set('waitForAppGeometryInDocument', async (callback, argument) => {
    entered.resolve(); await registration.promise
    return fixture.page.execute(callback, argument)
  })
  const outcome = fixture.start(); await entered.promise
  fixture.clock.expire('App stable frame wait')
  const { error } = await outcome
  assert.equal(error.message, 'Timed out after 2100ms during App stable frame wait')
  assert.equal(fixture.window.__stzAppGeometryCancelledWaits.size, 1)
  const frameCount = fixture.frames.size, timerCount = fixture.timers.size
  registration.resolve(); await flush()
  assert.equal(fixture.frames.size, frameCount)
  assert.equal(fixture.timers.size, timerCount)
  assert.equal(fixture.window.__stzAppGeometryWaits.size, 0)
  assert.ok(fixture.observed.some(({ event }) => event === 'late-rejection'))
  await assertDisposed(fixture)
})

test('exact original document cancellation refuses a replacement and does not revive stopped observer', async (context) => {
  const fixture = await setup(context), outcome = fixture.start()
  await fixture.entered()
  const token = fixture.page.calls.find(({ name }) => name === 'waitForAppGeometryInDocument').argument.token
  fixture.location.href = 'http://localhost/replacement'
  await assert.rejects(fixture.page.evaluate(cancelAppGeometryWait,
    { token, identity: fixture.options.identity }), /continuity lost|original|identity/)
  assert.equal(fixture.window.__stzAppGeometryWaits.size, 1, 'Replacement document cannot consume original wait token')
  fixture.location.href = 'http://localhost/app'
  fixture.window.__stzAppGeometryDiagnostics.stop()
  await fixture.frame()
  const { error } = await outcome
  assert.match(error.message, /observer stopped/)
  assertNoWaitWork(fixture)
  await assertDisposed(fixture)
})

test('withheld browser timer cannot authorize three late frames across the absolute inner deadline', async (context) => {
  const fixture = await setup(context), outcome = fixture.start()
  await fixture.entered(); await fixture.frame(); await fixture.frame()
  fixture.advance(2000)
  await fixture.frame()
  const { error } = await outcome
  assert.match(error.message, /within 2000ms/)
  assert.equal((await fixture.record()).result, 'failed')
  assertNoWaitWork(fixture)
})

test('withheld host timer rejects browser success delivered beyond host absolute deadline', async (context) => {
  const fixture = await setup(context), transport = deferred(), entered = deferred()
  fixture.page.overrides.set('waitForAppGeometryInDocument', (callback, argument) => {
    const value = Promise.resolve(fixture.page.execute(callback, argument)); value.catch(() => {})
    entered.resolve(); return transport.promise.then(() => value)
  })
  const outcome = fixture.start(); await entered.promise
  await fixture.frame(); await fixture.frame(); await fixture.frame()
  fixture.clock.set(2200); transport.resolve()
  const { error } = await outcome
  assert.equal(error.message, 'Timed out after 2100ms during App stable frame wait')
  assert.equal((await fixture.record()).result, 'failed')
  assertNoWaitWork(fixture)
})

test('late host callback entry expires before browser evaluation and separately clocks the cancellation', async (context) => {
  const fixture = await setup(context)
  const schedule = (expire, timeoutMs, operation) => {
    const cancel = fixture.clock.schedule(expire, timeoutMs, operation)
    fixture.clock.set(operation.deadlineMs)
    return cancel
  }
  schedule.monotonicNow = fixture.clock.schedule.monotonicNow
  const { error } = await fixture.diagnostics.wait('stable', fixture.details,
    { ...fixture.options, scheduleDeadline: schedule }).then((value) => ({ value }), (failure) => ({ error: failure }))
  assert.equal(error.message, 'Timed out after 2100ms during App stable frame wait')
  assert.equal(fixture.page.calls.filter(({ name }) => name === 'waitForAppGeometryInDocument').length, 0)
  assert.equal(fixture.clock.entries.find(({ operation }) => operation.name === 'App frame cancellation').timeoutMs, 250)
  assertNoWaitWork(fixture)
})

test('browser wall discontinuity is recorded independently while monotonic acceptance and host budget remain strict', async (context) => {
  const fixture = await setup(context), outcome = fixture.start()
  await fixture.entered(); await fixture.frame(); await fixture.frame()
  fixture.advance(0, 1_448_062)
  await fixture.frame()
  const { value, error } = await outcome
  assert.equal(error, undefined)
  assert.equal(value.frames, 3)
  assert.ok(value.timing)
  assert.equal(fixture.clock.now, 100)
  assert.equal(fixture.browser.monotonic, 548)
  assert.equal(fixture.browser.wall, 1_700_001_448_110)
  assertNoWaitWork(fixture)
})

test('earlier native Error survives wait failure evidence, disposal failure and owned resource closure', async (context) => {
  const fixture = await setup(context), native = new Error('original native source assertion'), cleanup = []
  fixture.page.overrides.set('stopAppGeometryObserver', () => { throw new Error('secondary observer stop failure') })
  const caller = async () => {
    let primary
    try {
      const outcome = fixture.start(); await fixture.entered(); await fixture.frame(); await fixture.frame(); await fixture.frame()
      const result = await outcome; if (result.error) throw result.error
      throw native
    } catch (error) { primary = error; await fixture.diagnostics.failure(error, fixture.details) }
    finally {
      await fixture.diagnostics.dispose(); cleanup.push('diagnostics')
      await fixture.page.close(); cleanup.push('page')
      cleanup.push('browser', 'server')
    }
    if (primary) throw primary
  }
  await assert.rejects(caller(), (error) => error === native)
  const index = await fixture.index()
  assert.equal(index.failure.error.message, native.message)
  assert.deepEqual(cleanup, ['diagnostics', 'page', 'browser', 'server'])
  assert.equal(fixture.page.listenerCount('pageerror'), 0)
  fixture.page.overrides.delete('stopAppGeometryObserver')
  fixture.window.__stzAppGeometryDiagnostics.stop()
  await assertDisposed(fixture)
})

test('direct actual host/browser composition retains an earlier browser rejection Error object', async (context) => {
  const fixture = await setup(context), primary = new Error('native assertion before wait registration')
  fixture.page.overrides.set('waitForAppGeometryInDocument', () => { throw primary })
  await assert.rejects(waitForStableAppGeometry(fixture.page, fixture.options), (error) => error === primary)
  assert.ok(fixture.clock.entries.every(({ cancelled }) => cancelled))
  assertNoWaitWork(fixture)
})

test('later failure diagnostics retain the first App native Error and exact responsive observer cleanup', async (context) => {
  const fixture = await setup(context), primary = new Error('first native assertion')
  await fixture.diagnostics.failure(primary, fixture.details)
  await fixture.diagnostics.failure(new Error('later cancellation diagnostic error'), { secondary: true })
  await assertDisposed(fixture)
  const index = await fixture.index()
  assert.equal(index.failure.error.message, primary.message)
  assert.equal(index.failure.error.stack, primary.stack)
  assert.deepEqual(index.failure.details, fixture.details)
  const cleanup = index.events.find(({ event }) => event === 'observer-stop-returned').details
  assert.equal(cleanup.waits, 0)
  assert.equal(cleanup.cancelledTokens, 0)
  assert.deepEqual(cleanup.identity.cleanup, { observerFramePending: false, observerTimerPending: false, listeners: 0 })
})

test('wait entry/probe file is retained before producer entry without observer captures inside the stable deadline', async (context) => {
  const fixture = await setup(context), entry = deferred(), release = deferred()
  fixture.page.overrides.set('waitForAppGeometryInDocument', async (callback, argument) => {
    const retained = JSON.parse(await readFile(join(fixture.artifactDir, 'app-geometry-wait-0001-entry.json'), 'utf8'))
    assert.equal(retained.result, 'running')
    assert.deepEqual(retained.context, fixture.details)
    assert.equal(retained.sequence, 1)
    assert.equal(retained.token, argument.token)
    assert.deepEqual(retained.identity, fixture.options.identity)
    entry.resolve(); await release.promise
    return fixture.page.execute(callback, argument)
  })
  const outcome = fixture.start(); await entry.promise
  fixture.clock.expire('App stable frame wait')
  const { error } = await outcome
  assert.equal(error.message, 'Timed out after 2100ms during App stable frame wait')
  assert.equal(fixture.page.calls.filter(({ name }) => name === 'readAppGeometryObserver').length, 0)
  release.resolve(); await flush(); await fixture.diagnostics.drain()
  const terminal = await fixture.record()
  assert.equal(terminal.result, 'failed')
  assert.equal(terminal.drain.status, 'available')
  assert.equal(terminal.browser.result, 'cancelled-before-registration')
  assert.equal(terminal.browser.token, terminal.token)
  assert.ok(Number.isFinite(terminal.browser.entry))
  assert.ok(Number.isFinite(terminal.browser.settlement))
  const retained = JSON.parse(await readFile(join(fixture.artifactDir, terminal.entryArtifact), 'utf8'))
  assert.equal(retained.result, 'running')
  assert.equal(retained.token, terminal.token)
  assert.equal(retained.sequence, terminal.sequence)
  assert.deepEqual(retained.context, terminal.context)
  assertNoWaitWork(fixture)
})

test('browser cancellation fences and completed records have explicit eight-token caps', async (context) => {
  const fixture = await setup(context)
  for (let index = 0; index < 8; index++) {
    const result = await fixture.page.evaluate(cancelAppGeometryWait,
      { token: `before-registration-${index}`, identity: fixture.options.identity })
    assert.equal(result.tombstoned, true)
  }
  await assert.rejects(fixture.page.evaluate(cancelAppGeometryWait,
    { token: 'ninth-before-registration', identity: fixture.options.identity }), /cancellation token budget exceeded/)
  assert.equal(fixture.window.__stzAppGeometryCancelledWaits.size, 8)
  for (let index = 0; index < 10; index++) {
    const entered = deferred()
    fixture.page.overrides.set('waitForAppGeometryInDocument', (callback, argument) => {
      entered.resolve(); return fixture.page.execute(callback, argument)
    })
    const outcome = fixture.start(); await entered.promise
    await fixture.frame(); await fixture.frame(); await fixture.frame()
    const { value, error } = await outcome
    assert.equal(error, undefined)
    assert.equal(value.stableFrames, 3)
  }
  assert.equal(fixture.window.__stzAppGeometryWaitRecords.size, 8)
  await assertDisposed(fixture)
  assert.equal(fixture.window.__stzAppGeometryCancelledWaits.size, 0)
})

test('late registration after diagnostics disposal cannot restart stopped observer ownership', async (context) => {
  const fixture = await setup(context), entered = deferred(), release = deferred()
  fixture.page.overrides.set('waitForAppGeometryInDocument', async (callback, argument) => {
    entered.resolve(); await release.promise
    return fixture.page.execute(callback, argument)
  })
  const outcome = fixture.start(); await entered.promise
  fixture.clock.expire('App stable frame wait')
  const { error } = await outcome
  await assertDisposed(fixture)
  release.resolve(); await flush(); await fixture.diagnostics.drain()
  assert.equal(fixture.frames.size, 0)
  assert.equal(fixture.timers.size, 0)
  assert.equal(fixture.window.__stzAppGeometryWaits.size, 0)
  const record = await fixture.record()
  assert.equal(record.result, 'failed')
  assert.equal(record.error.message, error.message)
  assert.ok(record.events.some(({ event }) => event === 'late-rejection'))
})

test('a snapshot producer crossing the inner absolute deadline cannot return its third equal snapshot', async (context) => {
  const fixture = await setup(context), outcome = fixture.start()
  await fixture.entered(); await fixture.frame(); await fixture.frame()
  const ordinary = fixture.svg.getBoundingClientRect
  fixture.svg.getBoundingClientRect = function () { fixture.advance(2000); return ordinary.call(this) }
  await fixture.frame()
  const { error } = await outcome
  assert.match(error.message, /within 2000ms/)
  assert.equal((await fixture.record()).result, 'failed')
  assertNoWaitWork(fixture)
})

test('withheld host timer owns a late browser rejection as timeout while browser and host clocks remain separate', async (context) => {
  const fixture = await setup(context), entered = deferred(), rejection = deferred(), primary = new Error('late browser transport failure')
  fixture.page.overrides.set('waitForAppGeometryInDocument', () => { entered.resolve(); return rejection.promise })
  const outcome = fixture.start(); await entered.promise
  fixture.clock.set(2200); rejection.reject(primary)
  const { error } = await outcome
  assert.notEqual(error, primary)
  assert.equal(error.message, 'Timed out after 2100ms during App stable frame wait')
  assert.equal(fixture.browser.monotonic, 500)
  assert.equal((await fixture.record()).result, 'failed')
  assertNoWaitWork(fixture)
})
