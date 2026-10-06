/** Invocation-owned Vite resources and bounded, read-only lifecycle evidence.
 * Vite's installed startServer treats port 0 as its default port. Allocate a
 * positive OS port first, then require Vite to bind that port once, strictly.
 * A reservation/rebind collision rejects; it never accepts another server. */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { createServer as createReservationServer } from 'node:net'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { createLogger, createServer } from 'vite'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'
import { observeOwnedSocketTransport } from './ownedSocketTransport.mjs'

const exec = promisify(execFile)
const headerName = 'x-stz-owned-vite'
const clipped = (value, limit = 2000) => String(value ?? '').slice(0, limit)
const errorDetails = (error) => ({ message: clipped(error.message, 4000), code: error.code,
  syscall: error.syscall, address: error.address, port: error.port,
  stack: clipped(error.stack, 12000) })
const stamp = () => ({ wallTime: new Date().toISOString(), monotonicMs: performance.now(),
  timeOrigin: performance.timeOrigin })
const requestPath = (url) => { try { return new URL(url, 'http://owned.invalid').pathname } catch { return clipped(url) } }

/** The snapshot excludes command arguments and environment variables. A host
 * that restricts process inspection retains that restriction as diagnostics. */
export async function captureOwnedViteProcesses() {
  const observations = []
  for (const [command, args] of [
    ['ps', ['-axo', 'pid,ppid,lstart,comm']],
    ['lsof', ['-nP', '-iTCP', '-sTCP:LISTEN']],
  ]) {
    try {
      const result = await exec(command, args, { timeout: 1500, maxBuffer: 128_000 })
      observations.push({ command, args, result: 'observed', stdout: clipped(result.stdout, 32_000),
        stderr: clipped(result.stderr, 4000), ...stamp() })
    } catch (error) {
      observations.push({ command, args, result: 'unavailable', error: errorDetails(error),
        stdout: clipped(error.stdout, 32_000), stderr: clipped(error.stderr, 4000), ...stamp() })
    }
  }
  return observations
}

function closeReservation(server) {
  if (!server?.listening) return Promise.resolve()
  return new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()))
}

export async function startOwnedViteServer({ artifactDir, prefix = 'owned-vite', timeoutMs = 30_000,
  createViteServer = createServer, createReservation = createReservationServer,
  captureProcesses = captureOwnedViteProcesses, writeEvidence = writeFile } = {}) {
  assert.equal(typeof artifactDir, 'string', 'Owned Vite artifacts require an explicit directory')
  assert.match(prefix, /^[a-z0-9][a-z0-9-]{0,80}$/i, 'Owned Vite evidence prefix must be bounded and path-free')
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60_000, 'Owned Vite startup deadline must be finite and bounded')
  const lifecyclePath = resolve(artifactDir, `${prefix}-lifecycle.json`)
  const ownerId = randomUUID(), started = stamp(), events = [], instances = [], releases = [], secondary = []
  const pendingDiagnostics = new Set()
  let sequence = 0, droppedEvents = 0, reservation, server, address, origin, instanceId, primary, closed = false
  let abandoned = false, writes = Promise.resolve(), closePromise, processSnapshots = 0
  let observedSockets = 0, omittedSocketObservers = 0, dirtyEventBoundary, eventFlush
  const note = (event, details = {}) => {
    events.push({ sequence: ++sequence, ...stamp(), event, ownerId, pid: process.pid, ...details })
    if (events.length > 1024) { events.shift(); droppedEvents++ }
  }
  const diagnose = (name, error) => {
    secondary.push({ name, error: errorDetails(error), ...stamp() })
    if (secondary.length > 32) secondary.shift()
  }
  const snapshot = (boundary) => ({ schema: 1, boundary, scope: 'Owned server diagnostics; not browser acceptance',
    ownerId, instanceId, pid: process.pid, parentPid: process.ppid, nodeVersion: process.version,
    started, observed: stamp(), address, origin, closed, droppedEvents, instances, events, secondary,
    limits: { events: 1024, instances: 16, secondary: 32, processSnapshots: 16, socketObservers: 128,
      automaticPersistenceJobs: 1 }, processSnapshots, observedSockets, omittedSocketObservers,
    error: primary ? errorDetails(primary) : undefined })
  const persist = (boundary) => {
    const write = writes.then(async () => {
      const body = JSON.stringify(snapshot(boundary), null, 2) + '\n'
      assert.ok(Buffer.byteLength(body) <= 4_000_000, 'Owned Vite lifecycle exceeds its evidence budget')
      await writeEvidence(lifecyclePath, body)
    })
    // The queue follows the actual write, including after a host deadline. A
    // late write cannot race a newer write and replace newer lifetime evidence.
    writes = write.catch((error) => { diagnose(`evidence:${boundary}`, error) })
    return boundedPointDiagnostic(() => write, `owned Vite evidence (${boundary})`, 2000)
      .catch((error) => { diagnose(`evidence-deadline:${boundary}`, error); return { result: 'failed', error: errorDetails(error) } })
  }
  const observeProcesses = async (boundary) => {
    if (processSnapshots >= 16) {
      note('host-process-observation-limit', { boundary, limit: 16 }); return
    }
    processSnapshots++
    try {
      const observations = await boundedPointDiagnostic(captureProcesses, `owned Vite processes (${boundary})`, 4000)
      note('host-process-observation', { boundary, observations })
    } catch (error) { diagnose(`processes:${boundary}`, error) }
  }
  const flush = async (boundary = 'checkpoint') => {
    if (/App:document-[ab][^:]*:release:(before|after)$|primary-failure|startup-failed|^ws-close$/.test(boundary)) await observeProcesses(boundary)
    return persist(boundary)
  }
  const persistEvent = (boundary) => {
    dirtyEventBoundary = boundary
    if (eventFlush) return
    // Event bursts retain every bounded raw event but schedule at most one
    // writer, with one dirty latest snapshot. No watcher burst grows a queue.
    eventFlush = (async () => {
      while (dirtyEventBoundary) {
        const current = dirtyEventBoundary; dirtyEventBoundary = undefined
        await flush(current)
      }
    })()
    const pending = eventFlush
    pendingDiagnostics.add(pending)
    void pending.catch((error) => diagnose('automatic event evidence', error)).finally(() => {
      pendingDiagnostics.delete(pending); eventFlush = undefined
    })
  }
  const on = (target, event, listener) => {
    target.on(event, listener); releases.push(() => target.off(event, listener))
  }
  const observeInstance = (vite) => {
    const id = randomUUID()
    instanceId ??= id
    instances.push({ instanceId: id, configured: stamp(), config: { root: clipped(vite.config.root),
      base: clipped(vite.config.base), host: vite.config.server.host, port: vite.config.server.port,
      strictPort: vite.config.server.strictPort, hmr: vite.config.server.hmr !== false } })
    assert.ok(instances.length <= 16, 'Owned Vite restart instance budget exceeded')
    note('vite-instance-created', { instanceId: id })
    note('http-timeout-configuration', { instanceId: id,
      timeout: vite.httpServer.timeout, keepAliveTimeout: vite.httpServer.keepAliveTimeout,
      headersTimeout: vite.httpServer.headersTimeout, requestTimeout: vite.httpServer.requestTimeout })
    vite.middlewares.use((_request, response, next) => { response.setHeader(headerName, id); next() })
    for (const method of ['close', 'restart']) {
      const original = vite[method]
      const observed = async (...args) => {
        note(`vite-${method}-call`, { instanceId: id, callsite: clipped(new Error().stack, 8000) })
        persistEvent(`vite-${method}-call`)
        try {
          const result = await original.apply(vite, args)
          note(`vite-${method}-returned`, { instanceId: id }); persistEvent(`vite-${method}-returned`)
          return result
        } catch (error) {
          note(`vite-${method}-failed`, { instanceId: id, error: errorDetails(error) })
          persistEvent(`vite-${method}-failed`); throw error
        }
      }
      vite[method] = observed
      releases.push(() => { if (vite[method] === observed) vite[method] = original })
    }
    const http = vite.httpServer
    for (const event of ['listening', 'close', 'error', 'clientError']) on(http, event, (error) => {
      note(`http-${event}`, { instanceId: id, address: http.address(), listening: http.listening,
        ...(error instanceof Error ? { error: errorDetails(error) } : {}) })
      if (event !== 'listening') persistEvent(`http-${event}`)
    })
    on(http, 'request', (request) => {
      const path = requestPath(request.url)
      if (/freeLabelsApp|@vite\/client/.test(path)) note('http-request', { instanceId: id,
        path, method: request.method, listening: http.listening })
    })
    on(http, 'upgrade', (request, socket) => note('http-upgrade', { instanceId: id,
      path: requestPath(request.url), protocol: clipped(request.headers['sec-websocket-protocol']),
      localAddress: socket.localAddress, localPort: socket.localPort,
      remoteAddress: socket.remoteAddress, remotePort: socket.remotePort }))
    on(vite.ws, 'connection', (socket, request) => {
      const socketId = randomUUID()
      note('ws-connection', { instanceId: id, socketId, path: requestPath(request?.url) })
      if (observedSockets >= 128) {
        omittedSocketObservers++; note('ws-observer-limit', { instanceId: id, socketId, limit: 128 }); return
      }
      observedSockets++
      releases.push(observeOwnedSocketTransport({ socket: request?.socket, instanceId: id, socketId,
        note, on, persist: persistEvent }))
      on(socket, 'close', (code, reason) => {
        note('ws-close', { instanceId: id, socketId, code, reason: clipped(reason) }); persistEvent('ws-close')
      })
      on(socket, 'error', (error) => {
        note('ws-error', { instanceId: id, socketId, error: errorDetails(error) }); persistEvent('ws-error')
      })
    })
    on(vite.ws, 'error', (error) => { note('ws-server-error', { instanceId: id, error: errorDetails(error) }); persistEvent('ws-server-error') })
    const send = vite.ws.send
    const observedSend = (...args) => {
      const payload = args[0]
      if (payload && typeof payload === 'object' && ['full-reload', 'update', 'error'].includes(payload.type)) {
        note('ws-send', { instanceId: id, type: payload.type, path: clipped(payload.path),
          updates: Array.isArray(payload.updates) ? payload.updates.slice(0, 32).map((entry) => ({ type: entry.type, path: clipped(entry.path) })) : undefined })
        persistEvent('ws-send')
      }
      return send.apply(vite.ws, args)
    }
    vite.ws.send = observedSend
    releases.push(() => { if (vite.ws.send === observedSend) vite.ws.send = send })
    for (const event of ['change', 'add', 'unlink', 'error']) on(vite.watcher, event, (value) => {
      note(`watcher-${event}`, { instanceId: id,
        ...(value instanceof Error ? { error: errorDetails(value) } : { path: clipped(value) }) })
      persistEvent(`watcher-${event}`)
    })
  }
  const logger = createLogger('error', { allowClearScreen: false })
  const customLogger = { ...logger }
  Object.defineProperty(customLogger, 'hasWarned', { get: () => logger.hasWarned })
  for (const method of ['info', 'warn', 'warnOnce', 'error']) customLogger[method] = (...args) => {
    note(`vite-log-${method}`, { message: clipped(args[0], 4000),
      ...(args[1]?.error instanceof Error ? { error: errorDetails(args[1].error) } : {}) })
    if (/restart|reload|error|connection/i.test(String(args[0]))) persistEvent(`vite-log-${method}`)
    return logger[method](...args)
  }
  const processSnapshot = async (boundary) => {
    await observeProcesses(boundary)
    await persist(`processes:${boundary}`)
  }
  const cleanup = async () => {
    let first
    for (const [name, operation] of [
      ['reservation close', () => closeReservation(reservation)],
      ['server close', () => server?.close()],
    ]) {
      try { await boundedPointDiagnostic(operation, `owned Vite ${name}`, 5000) }
      catch (error) { first ??= error; diagnose(name, error) }
    }
    closed = true
    note('owner-cleanup-finished')
    try { await boundedPointDiagnostic(() => Promise.allSettled([...pendingDiagnostics]), 'owned Vite event diagnostics drain', 5000) }
    catch (error) { first ??= error; diagnose('evidence event drain', error) }
    await flush('cleanup-finished')
    try { await boundedPointDiagnostic(() => writes, 'owned Vite evidence drain', 5000) }
    catch (error) { first ??= error; diagnose('evidence drain', error) }
    for (const release of releases) release()
    if (!first && secondary.some((entry) => entry.name.startsWith('evidence'))) {
      first = new Error('Owned Vite required lifecycle evidence was incomplete; see retained diagnostic failures')
    }
    if (first) throw first
  }
  note('owner-created')
  try {
    await flush('created')
    reservation = createReservation()
    note('port-reservation-created', { requested: { address: '127.0.0.1', port: 0 } })
    await boundedPointDiagnostic(() => new Promise((resolveListen, reject) => {
      const allocationError = (error) => { note('port-reservation-error', { error: errorDetails(error) }); reject(error) }
      reservation.once('error', allocationError)
      reservation.once('listening', () => {
        reservation.off('error', allocationError)
        if (abandoned) {
          void boundedPointDiagnostic(() => closeReservation(reservation), 'late owned port reservation close', 5000)
            .catch((error) => {
              diagnose('late reservation close', error); persistEvent('late-port-reservation-close-failed')
            })
        }
        resolveListen()
      })
      reservation.listen({ host: '127.0.0.1', port: 0 })
    }), 'owned Vite OS port allocation', timeoutMs)
    address = reservation.address()
    assert.ok(address && typeof address !== 'string' && Number.isInteger(address.port) && address.port > 0,
      'OS port allocation must supply a positive numeric port')
    note('port-reserved', { address })
    const allocatedPort = address.port
    await boundedPointDiagnostic(() => closeReservation(reservation), 'owned Vite port reservation release', 5000)
    note('port-reservation-released', { address })
    const creating = Promise.resolve().then(() => createViteServer({
      server: { host: '127.0.0.1', port: allocatedPort, strictPort: true }, logLevel: 'error', customLogger,
      plugins: [{ name: 'stz-owned-browser-server', configureServer: observeInstance }],
    })).then((created) => {
      if (abandoned) {
        // Do not publish the late resource to concurrent startup cleanup: this
        // branch alone owns its close and releases its newly installed hooks.
        void boundedPointDiagnostic(async () => {
          try { await created.close() }
          finally { for (const release of releases) release() }
        }, 'late owned Vite creation close', 5000)
          .catch((error) => {
            diagnose('late Vite creation close', error); persistEvent('late-created-vite-close-failed')
          })
      } else server = created
      return created
    })
    await boundedPointDiagnostic(() => creating, 'owned Vite creation', timeoutMs)
    note('vite-listen-call', { requested: { address: '127.0.0.1', port: allocatedPort, strictPort: true } })
    const listenHttp = server.httpServer
    let lateHttpClose
    const closeLateHttp = () => {
      lateHttpClose ??= boundedPointDiagnostic(async () => {
        note('late-http-listen-cleanup', { address: listenHttp.address(), listening: listenHttp.listening })
        if (listenHttp.listening) await new Promise((resolveClose, reject) => {
          listenHttp.close((error) => error ? reject(error) : resolveClose())
        })
        note('late-http-listen-closed', { listening: listenHttp.listening })
        await persist('late-http-listen-closed')
      }, 'late owned HTTP listen close', 5000).catch((error) => {
        diagnose('late HTTP listen close', error); persistEvent('late-http-listen-close-failed')
      })
      return lateHttpClose
    }
    // Vite awaits asynchronous initialization before binding. Its close() can
    // cache a successful pre-listening close and then leave that later bind
    // alive. Hold this one owned native listener until the actual listen
    // operation settles and close the actual HTTP server after abandonment.
    const lateListening = () => { if (abandoned) void closeLateHttp() }
    listenHttp.once('listening', lateListening)
    const listening = Promise.resolve().then(() => server.listen()).then(async (value) => {
      if (abandoned) await closeLateHttp()
      return value
    }, (error) => {
      if (abandoned) {
        note('late-vite-listen-failed', { error: errorDetails(error) }); persistEvent('late-vite-listen-failed')
      }
      throw error
    }).finally(() => listenHttp.off('listening', lateListening))
    await boundedPointDiagnostic(() => listening, 'owned Vite listen', timeoutMs)
    address = server.httpServer.address()
    assert.ok(address && typeof address !== 'string', 'Owned Vite requires a numeric listen address')
    assert.equal(address.address, '127.0.0.1', 'Owned Vite listen host differs from its request')
    assert.equal(address.port, allocatedPort, 'Owned Vite listen port differs from its OS allocation')
    assert.equal(typeof instanceId, 'string', 'Owned Vite configureServer ownership was installed')
    origin = `http://127.0.0.1:${address.port}`
    note('vite-listen-returned', { address, origin, instanceId })
    await processSnapshot('after-listen')
    await flush('listening')
  } catch (error) {
    primary = error; abandoned = true
    note('owner-startup-failed', { error: errorDetails(error) })
    try { await flush('startup-failed') } catch { /* Retained separately; startup remains primary. */ }
    try { await cleanup() } catch (cleanupError) {
      diagnose('startup cleanup', cleanupError); await persist('startup-cleanup-failed')
    }
    throw error
  }
  return {
    server, origin, address, instanceId, ownerId, lifecyclePath, flush, processSnapshot,
    record: note,
    async authenticate(response) {
      try {
        assert.equal(closed, false, 'Owned Vite navigation used a closed invocation')
        assert.equal(server.httpServer.listening, true, 'Owned Vite navigation used a stopped server')
        assert.equal(instances.at(-1)?.instanceId, instanceId, 'Owned Vite invocation restarted before navigation')
        assert.ok(response, 'Owned Vite navigation requires an actual HTTP response')
        assert.equal(new URL(response.url()).origin, origin, 'Owned Vite navigation reached another origin')
        const actual = await boundedPointDiagnostic(() => response.headerValue(headerName), 'owned Vite response ownership', 2000)
        assert.equal(actual, instanceId, 'Owned Vite navigation reached another server instance')
        note('response-authenticated', { responseUrl: clipped(response.url()), instanceId: actual })
        await flush('response-authenticated')
        return { ownerId, instanceId, origin, address }
      } catch (error) {
        note('response-authentication-failed', { error: errorDetails(error) })
        try { await flush('response-authentication-failed') } catch { /* Preserve authentication failure. */ }
        throw error
      }
    },
    close() { closePromise ??= cleanup(); return closePromise },
  }
}
