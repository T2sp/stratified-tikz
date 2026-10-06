import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { startOwnedViteServer } from '../../scripts/ownedViteServer.mjs'

class Reservation extends EventEmitter {
  listening = false
  calls = []
  constructor(port = 42817, error) { super(); this.port = port; this.error = error }
  address() { return this.listening ? { address: '127.0.0.1', family: 'IPv4', port: this.port } : null }
  listen(options) {
    this.calls.push(['listen', options])
    queueMicrotask(() => {
      if (this.error) this.emit('error', this.error)
      else { this.listening = true; this.emit('listening') }
    })
    return this
  }
  close(callback) {
    this.calls.push(['close']); this.listening = false
    queueMicrotask(() => { this.emit('close'); callback() })
  }
}

function fixture(config, { listenError, actualPort, closeOperation } = {}) {
  const httpServer = new EventEmitter(), watcher = new EventEmitter(), ws = new EventEmitter()
  httpServer.listening = false
  httpServer.address = () => httpServer.listening ? { address: '127.0.0.1', family: 'IPv4', port: actualPort ?? config.server.port } : null
  httpServer.close = (callback) => { httpServer.listening = false; queueMicrotask(() => { httpServer.emit('close'); callback() }) }
  const middleware = [], calls = []
  ws.send = (payload) => calls.push(['send', payload])
  const server = { httpServer, watcher, ws, calls, config: { ...config, root: '/owned/checkout', base: '/stratified-tikz/' },
    middlewares: { use: (handler) => middleware.push(handler) },
    async listen() {
      calls.push(['listen'])
      if (listenError) throw listenError
      httpServer.listening = true; httpServer.emit('listening'); return server
    },
    async close() {
      calls.push(['close']); await closeOperation?.()
      httpServer.listening = false; httpServer.emit('close')
    },
    async restart() { calls.push(['restart']) },
    response() {
      const headers = new Map()
      for (const handler of middleware) handler({}, { setHeader: (name, value) => headers.set(name, value) }, () => {})
      return { url: () => `http://127.0.0.1:${config.server.port}/stratified-tikz/scripts/fixtures/freeLabelsApp.html`,
        headerValue: async (name) => headers.get(name) ?? null }
    },
  }
  config.plugins[0].configureServer(server)
  return server
}

async function setup(t, options = {}) {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-owned-vite-test-'))
  let configured, raw, owner
  t.after(async () => {
    try { await owner?.close() } catch { /* Tests assert deliberate cleanup failures themselves. */ }
    finally { await rm(artifactDir, { recursive: true, force: true }) }
  })
  const reservation = options.reservation ?? new Reservation()
  const dependencies = { artifactDir, timeoutMs: 2000, createReservation: () => reservation,
    captureProcesses: async () => [{ result: 'synthetic', command: 'process-test-control' }],
    createViteServer: async (config) => { configured = config; raw = fixture(config, options); return raw }, ...options }
  const start = async () => { owner = await startOwnedViteServer(dependencies); return owner }
  return { start, reservation, artifactDir, get config() { return configured }, get raw() { return raw } }
}

test('OS port zero allocates a positive port and Vite binds it once with full strict public lifecycle', async (t) => {
  const f = await setup(t), owner = await f.start()
  assert.deepEqual(f.reservation.calls, [['listen', { host: '127.0.0.1', port: 0 }], ['close']])
  assert.deepEqual(f.config.server, { host: '127.0.0.1', port: 42817, strictPort: true })
  assert.deepEqual(f.raw.calls, [['listen']])
  assert.equal(owner.origin, 'http://127.0.0.1:42817')
  assert.equal(owner.address.port, 42817)
  assert.equal(f.config.server.hmr, undefined, 'Native HMR remains enabled')
  await owner.authenticate(f.raw.response())
  await owner.close()
  const saved = JSON.parse(await readFile(owner.lifecyclePath, 'utf8'))
  assert.equal(saved.closed, true)
  assert.equal(saved.instanceId, owner.instanceId)
  assert.equal(saved.instances.length, 1)
  assert.ok(saved.events.some((entry) => entry.event === 'response-authenticated'))
  assert.ok(saved.events.some((entry) => entry.event === 'vite-close-call' && /ownedViteServer/.test(entry.callsite)))
  assert.equal(f.raw.watcher.eventNames().length, 0)
  assert.equal(f.raw.httpServer.eventNames().length, 0)
})

test('reservation failure retains exact startup restriction and never creates or joins a Vite endpoint', async (t) => {
  const error = Object.assign(new Error('listen EPERM 127.0.0.1:0'), { code: 'EPERM', syscall: 'listen', address: '127.0.0.1', port: 0 })
  const f = await setup(t, { reservation: new Reservation(42817, error) })
  await assert.rejects(f.start(), (actual) => actual === error)
  assert.equal(f.config, undefined)
  const saved = JSON.parse(await readFile(join(f.artifactDir, 'owned-vite-lifecycle.json'), 'utf8'))
  assert.equal(saved.error.code, 'EPERM'); assert.equal(saved.error.port, 0)
  assert.equal(saved.instances.length, 0)
  assert.ok(saved.events.some((entry) => entry.event === 'port-reservation-error'))
})

test('release/rebind collision fails once, preserves first error, and closes only the owned server', async (t) => {
  const primary = Object.assign(new Error('Port 42817 is already in use'), { code: 'EADDRINUSE' })
  const f = await setup(t, { listenError: primary })
  await assert.rejects(f.start(), (error) => error === primary)
  assert.deepEqual(f.raw.calls, [['listen'], ['close']])
  const saved = JSON.parse(await readFile(join(f.artifactDir, 'owned-vite-lifecycle.json'), 'utf8'))
  assert.equal(saved.address.port, 42817)
  assert.equal(saved.error.message, primary.message)
  assert.equal(saved.events.filter((entry) => entry.event === 'vite-listen-call').length, 1)
})

test('actual listen-address mismatch fails ownership and rejects silently moved ports', async (t) => {
  const f = await setup(t, { actualPort: 42818 })
  await assert.rejects(f.start(), /port differs from its OS allocation/)
  assert.deepEqual(f.raw.calls, [['listen'], ['close']])
})

test('server token authentication rejects missing token, unrelated origin, and same-URL instance replacement', async (t) => {
  const f = await setup(t), owner = await f.start(), response = f.raw.response()
  await assert.rejects(owner.authenticate(null), /actual HTTP response/)
  await assert.rejects(owner.authenticate({ ...response, headerValue: async () => null }), /another server instance/)
  await assert.rejects(owner.authenticate({ ...response, headerValue: async () => 'another-owned-instance' }), /another server instance/)
  await assert.rejects(owner.authenticate({ ...response, url: () => 'http://127.0.0.1:5173/stratified-tikz/scripts/fixtures/freeLabelsApp.html' }), /another origin/)
  await owner.authenticate(response)
  // Installed Vite restarts call configureServer for a new instance. Keep the
  // URL identical and prove that the invocation never refreshes its authority.
  const replacement = fixture(f.config)
  assert.equal(replacement.response().url(), response.url())
  await assert.rejects(owner.authenticate(replacement.response()), /restarted before navigation/)
  await assert.rejects(owner.authenticate(response), /restarted before navigation/)
  await owner.close()
  const saved = JSON.parse(await readFile(owner.lifecyclePath, 'utf8'))
  assert.equal(saved.instances.length, 2)
  assert.notEqual(saved.instances[0].instanceId, saved.instances[1].instanceId)
  assert.equal(saved.instanceId, saved.instances[0].instanceId)
})

test('bounded server evidence correlates watcher, restart, reload, WebSocket loss and ping upgrade without suppressing them', async (t) => {
  const f = await setup(t), owner = await f.start(), socket = new EventEmitter()
  f.raw.watcher.emit('change', '/owned/checkout/vite.config.ts')
  f.raw.ws.emit('connection', socket, { url: '/stratified-tikz/?token=must-not-retain' })
  f.raw.httpServer.emit('upgrade', { url: '/stratified-tikz/?token=must-not-retain', headers: { 'sec-websocket-protocol': 'vite-ping' } },
    { localAddress: '127.0.0.1', localPort: 42817, remoteAddress: '127.0.0.1', remotePort: 45501 })
  f.raw.ws.send({ type: 'full-reload', path: '/scripts/fixtures/freeLabelsApp.html' })
  socket.emit('close', 1006, Buffer.from('transport lost'))
  await f.raw.restart()
  await owner.flush('App:document-b-ready:release:after')
  await owner.close()
  const savedText = await readFile(owner.lifecyclePath, 'utf8'), saved = JSON.parse(savedText)
  assert.ok(!savedText.includes('must-not-retain'))
  for (const event of ['watcher-change', 'ws-connection', 'http-upgrade', 'ws-send', 'ws-close', 'vite-restart-call', 'vite-restart-returned']) {
    assert.ok(saved.events.some((entry) => entry.event === event), event)
  }
  assert.equal(saved.events.find((entry) => entry.event === 'http-upgrade').protocol, 'vite-ping')
  assert.equal(saved.events.find((entry) => entry.event === 'ws-close').code, 1006)
  assert.ok(saved.events.some((entry) => entry.event === 'host-process-observation' && entry.boundary === 'App:document-b-ready:release:after'))
  assert.ok(f.raw.calls.some(([kind, payload]) => kind === 'send' && payload.type === 'full-reload'), 'Reload still reaches the real transport')
  assert.equal(socket.eventNames().length, 0)
})

test('diagnostic write failure cannot replace an action; otherwise successful cleanup rejects missing required evidence', async (t) => {
  let fail = false, lastBody
  const f = await setup(t, { writeEvidence: async (_path, body) => { lastBody = body; if (fail) throw new Error('controlled disk failure') } })
  const owner = await f.start()
  fail = true
  const diagnostic = await owner.flush('App:document-b-ready:primary-failure')
  assert.equal(diagnostic.result, 'failed')
  fail = false
  await assert.rejects(owner.close(), /required lifecycle evidence was incomplete/)
  const saved = JSON.parse(lastBody)
  assert.ok(saved.secondary.some((entry) => /controlled disk failure/.test(entry.error.message)))
  assert.equal(saved.closed, true)
})

test('late Vite creation after a bounded startup failure remains owned and is closed without masking the deadline', async (t) => {
  let resolveCreated, config
  let savedLateClose
  const lateClosePersisted = new Promise((resolve) => { savedLateClose = resolve })
  const f = await setup(t, { timeoutMs: 20,
    writeEvidence: async (path, body) => {
      await writeFile(path, body)
      if (JSON.parse(body).boundary === 'vite-close-returned') savedLateClose()
    }, createViteServer: (input) => {
    config = input; return new Promise((resolve) => { resolveCreated = resolve })
  } })
  await assert.rejects(f.start(), /Timed out after 20ms during owned Vite creation/)
  const raw = fixture(config)
  resolveCreated(raw)
  await lateClosePersisted
  assert.deepEqual(raw.calls, [['close']])
  assert.equal(raw.watcher.eventNames().length, 0)
  assert.equal(raw.httpServer.eventNames().length, 0)
})

test('late reservation-close deadline is saved after initial cleanup without replacing startup or leaving a late rejection unowned', async (t) => {
  const reservation = new Reservation()
  reservation.listen = (options) => { reservation.calls.push(['listen', options]); return reservation }
  let rejectLateClose, closeEntered, failedSaved, callbackSettled
  const entered = new Promise((resolve) => { closeEntered = resolve })
  const failedPersisted = new Promise((resolve) => { failedSaved = resolve })
  const settled = new Promise((resolve) => { callbackSettled = resolve })
  reservation.close = (callback) => {
    reservation.calls.push(['close']); closeEntered()
    rejectLateClose = (error) => { reservation.listening = false; callback(error); callbackSettled() }
  }
  const f = await setup(t, { timeoutMs: 20, reservation,
    writeEvidence: async (path, body) => {
      await writeFile(path, body)
      if (JSON.parse(body).boundary === 'late-port-reservation-close-failed') failedSaved()
    } })
  await assert.rejects(f.start(), /Timed out after 20ms during owned Vite OS port allocation/)
  assert.equal(f.config, undefined)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  reservation.listening = true; reservation.emit('listening')
  await entered
  t.mock.timers.tick(5000)
  await failedPersisted
  const saved = JSON.parse(await readFile(join(f.artifactDir, 'owned-vite-lifecycle.json'), 'utf8'))
  assert.match(saved.error.message, /Timed out after 20ms during owned Vite OS port allocation/)
  assert.ok(saved.secondary.some((entry) => entry.name === 'late reservation close'
    && /Timed out after 5000ms during late owned port reservation close/.test(entry.error.message)))
  assert.ok(saved.events.some((entry) => entry.event === 'owner-cleanup-finished'))
  assert.equal(saved.secondary.filter((entry) => entry.name.startsWith('evidence')).length, 0)
  rejectLateClose(new Error('controlled late reservation cancellation'))
  await settled
  assert.equal(reservation.listening, false)
  assert.equal(reservation.listenerCount('listening'), 0)
  assert.deepEqual(reservation.calls, [['listen', { host: '127.0.0.1', port: 0 }], ['close']])
})

test('late created-Vite close deadline and subsequent rejected close are saved with startup primary and released listeners', async (t) => {
  let config, resolveCreated, rejectClose, closeEntered, callSaved, failedSaved, terminalSaved
  const entered = new Promise((resolve) => { closeEntered = resolve })
  const callPersisted = new Promise((resolve) => { callSaved = resolve })
  const failedPersisted = new Promise((resolve) => { failedSaved = resolve })
  const terminalPersisted = new Promise((resolve) => { terminalSaved = resolve })
  const f = await setup(t, { timeoutMs: 20,
    createViteServer: (input) => { config = input; return new Promise((resolve) => { resolveCreated = resolve }) },
    writeEvidence: async (path, body) => {
      await writeFile(path, body)
      const boundary = JSON.parse(body).boundary
      if (boundary === 'vite-close-call') callSaved()
      if (boundary === 'late-created-vite-close-failed') failedSaved()
      if (boundary === 'vite-close-failed') terminalSaved()
    } })
  await assert.rejects(f.start(), /Timed out after 20ms during owned Vite creation/)
  const raw = fixture(config, { closeOperation: () => new Promise((_resolve, reject) => {
    rejectClose = reject; closeEntered()
  }) })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  resolveCreated(raw)
  await entered; await callPersisted
  // Only drain resolved Promise continuations after the actual disk latch,
  // before advancing the deliberately hanging close's local deadline clock.
  await new Promise((resolve) => setImmediate(resolve))
  t.mock.timers.tick(5000)
  await failedPersisted
  const saved = JSON.parse(await readFile(join(f.artifactDir, 'owned-vite-lifecycle.json'), 'utf8'))
  assert.match(saved.error.message, /Timed out after 20ms during owned Vite creation/)
  assert.ok(saved.secondary.some((entry) => entry.name === 'late Vite creation close'
    && /Timed out after 5000ms during late owned Vite creation close/.test(entry.error.message)))
  assert.equal(saved.secondary.filter((entry) => entry.name.startsWith('evidence')).length, 0)
  rejectClose(new Error('controlled late Vite close rejection'))
  await terminalPersisted
  const terminal = JSON.parse(await readFile(join(f.artifactDir, 'owned-vite-lifecycle.json'), 'utf8'))
  assert.match(terminal.error.message, /Timed out after 20ms during owned Vite creation/)
  assert.ok(terminal.events.some((entry) => entry.event === 'vite-close-failed'
    && entry.error.message === 'controlled late Vite close rejection'))
  assert.deepEqual(raw.calls, [['close']])
  assert.equal(raw.httpServer.listening, false)
  assert.equal(raw.httpServer.eventNames().length, 0)
  assert.equal(raw.watcher.eventNames().length, 0)
  assert.equal(raw.ws.eventNames().length, 0)
})

test('watcher bursts and repeated WebSocket connections retain bounded diagnostics without changing transports', async (t) => {
  let writes = 0
  const f = await setup(t, { writeEvidence: async () => { writes++ } }), owner = await f.start()
  const before = writes, sockets = []
  for (let index = 0; index < 130; index++) {
    const socket = new EventEmitter(); sockets.push(socket)
    f.raw.ws.emit('connection', socket, { url: '/stratified-tikz/' })
  }
  for (let index = 0; index < 2000; index++) f.raw.watcher.emit('change', `/owned/checkout/raw-${index}.txt`)
  await owner.flush('after-burst')
  const intermediate = writes - before
  assert.ok(intermediate <= 4, `Event bursts coalesce physical writes (${intermediate})`)
  assert.equal(sockets[127].listenerCount('close'), 1)
  assert.equal(sockets[128].listenerCount('close'), 0)
  await owner.close()
  assert.ok(sockets.every((socket) => socket.eventNames().length === 0))
})

test('timed-out asynchronous Vite initialization cannot leave a later HTTP bind alive behind cached pre-listening close', async (t) => {
  let finishInit, raw, nativeCloses = 0, cachedClose
  let savedLateCleanup
  const lateCleanupPersisted = new Promise((resolve) => { savedLateCleanup = resolve })
  const f = await setup(t, { timeoutMs: 20,
    writeEvidence: async (path, body) => {
      await writeFile(path, body)
      if (JSON.parse(body).boundary === 'late-http-listen-closed') savedLateCleanup()
    }, createViteServer: async (config) => {
    raw = fixture(config)
    raw.httpServer.close = (callback) => {
      nativeCloses++; raw.httpServer.listening = false
      queueMicrotask(() => { raw.httpServer.emit('close'); callback() })
    }
    raw.listen = async () => {
      raw.calls.push(['listen'])
      await new Promise((resolve) => { finishInit = resolve })
      raw.httpServer.listening = true
      raw.httpServer.emit('listening')
      return raw
    }
    raw.close = () => {
      // Reproduce installed Vite's cached close before it has ever listened.
      if (!cachedClose) {
        raw.calls.push(['close'])
        cachedClose = raw.httpServer.listening ? new Promise((resolve) => raw.httpServer.close(resolve)) : Promise.resolve()
      }
      return cachedClose
    }
    return raw
  } })
  await assert.rejects(f.start(), /Timed out after 20ms during owned Vite listen/)
  assert.equal(raw.httpServer.listening, false)
  assert.equal(nativeCloses, 0, 'Cached Vite close had no native listener to close yet')
  finishInit()
  // Await the actual durable late-cleanup observation. One host turn does not
  // establish completion of the serialized real filesystem write.
  await lateCleanupPersisted
  await raw.close()
  assert.equal(nativeCloses, 1, 'Late completion closes the actual owned HTTP listener directly')
  assert.equal(raw.httpServer.listening, false)
  assert.equal(raw.httpServer.listenerCount('listening'), 0)
  const saved = JSON.parse(await readFile(join(f.artifactDir, 'owned-vite-lifecycle.json'), 'utf8'))
  assert.match(saved.error.message, /Timed out after 20ms during owned Vite listen/)
  assert.ok(saved.events.some((entry) => entry.event === 'late-http-listen-closed'))
})

test('serialized evidence retains later events after a timed-out write finishes, rather than allowing stale concurrent writes', async (t) => {
  let stall = false, release, writing = false, completed = []
  const f = await setup(t, { writeEvidence: async (_path, body) => {
    assert.equal(writing, false, 'Only one physical write runs at a time')
    writing = true
    if (stall) { stall = false; await new Promise((resolve) => { release = resolve }) }
    completed.push(JSON.parse(body).boundary); writing = false
  } })
  const owner = await f.start()
  stall = true
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const first = owner.flush('stalled-evidence')
  await new Promise((resolve) => setImmediate(resolve))
  t.mock.timers.tick(2000)
  assert.equal((await first).result, 'failed')
  owner.record('newer-action-retained')
  const second = owner.flush('newer-evidence')
  release()
  await second
  assert.deepEqual(completed.slice(-2), ['stalled-evidence', 'newer-evidence'])
  await assert.rejects(owner.close(), /required lifecycle evidence was incomplete/)
})
