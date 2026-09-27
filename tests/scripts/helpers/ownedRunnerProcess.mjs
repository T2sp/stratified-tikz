import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function errorFields(error) {
  if (!error) return null
  return Object.fromEntries(['name', 'code', 'message', 'errno', 'syscall', 'path', 'spawnargs', 'stack']
    .filter(field => error[field] !== undefined).map(field => [field, error[field]]))
}

function processError(message, code) {
  return Object.assign(new Error(message), { code })
}

// Only the new detached child's process group is probed/signalled. In particular,
// do not search by executable names or target the caller's process group.
async function cleanOwnedGroup(pid, { termGraceMs, killGraceMs }) {
  const cleanup = { processGroup: pid ?? null, complete: pid === undefined, termGraceMs, killGraceMs,
    signals: [], errors: [], liveAtCleanup: false }
  if (pid === undefined) return cleanup
  const live = () => {
    try { process.kill(-pid, 0); return true } catch (error) {
      if (error.code === 'ESRCH') return false
      cleanup.errors.push(errorFields(error))
      return true
    }
  }
  const send = signal => {
    try {
      process.kill(-pid, signal)
      cleanup.signals.push({ signal, at: new Date().toISOString() })
    } catch (error) {
      if (error.code !== 'ESRCH') cleanup.errors.push(errorFields(error))
    }
  }
  const waitForExit = async budget => {
    const deadline = performance.now() + budget
    while (live()) {
      const remaining = deadline - performance.now()
      if (remaining <= 0) return false
      await pause(Math.min(20, remaining))
    }
    return true
  }
  cleanup.liveAtCleanup = live()
  if (!cleanup.liveAtCleanup) { cleanup.complete = true; return cleanup }
  send('SIGTERM')
  cleanup.complete = await waitForExit(termGraceMs)
  if (!cleanup.complete) {
    send('SIGKILL')
    cleanup.complete = await waitForExit(killGraceMs)
  }
  return cleanup
}

/**
 * Test-fixture runner with a finite deadline and an owned POSIX process group.
 * File-backed stdio means a descendant cannot keep a captured pipe open after
 * the leader exits. The actual leader status remains distinct from cleanup and
 * timeout outcomes; callers must require diagnostic.outcome === 'success'.
 */
export async function runOwnedRunnerProcess(command, args, {
  cwd, env = process.env, timeoutMs = 60_000, logsDirectory, signal,
  termGraceMs = 250, killGraceMs = 1_000,
} = {}) {
  for (const [name, value] of Object.entries({ timeoutMs, termGraceMs, killGraceMs })) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be finite and positive`)
  }
  if (!logsDirectory) throw new TypeError('logsDirectory is required')
  const started = performance.now()
  const wallStarted = Date.now()
  const stdoutPath = join(logsDirectory, 'stdout.log')
  const stderrPath = join(logsDirectory, 'stderr.log')
  const resultPath = join(logsDirectory, 'process-result.json')
  const diagnostic = {
    command, args: [...args], cwd, timeoutMs, startedAt: new Date().toISOString(),
    elapsedMs: 0, pid: null, status: null, signal: null, outcome: null, error: null,
    stdoutPath, stderrPath, resultPath, diagnosticErrors: [],
  }
  let child
  let primaryError
  let leaderResult
  let stoppedBy
  let stdoutDescriptor
  let stderrDescriptor
  let timer
  let abortListener
  let leaderFinished
  let resolveLeader
  try {
    mkdirSync(logsDirectory, { recursive: true })
    stdoutDescriptor = openSync(stdoutPath, 'w')
    stderrDescriptor = openSync(stderrPath, 'w')
    if (process.platform === 'win32') throw processError('Owned runner fixtures require POSIX process groups', 'ENOTSUP')
    if (signal?.aborted) {
      stoppedBy = 'cancelled'
      primaryError = processError('Runner fixture cancelled before spawn', 'ABORT_ERR')
    } else {
      child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', stdoutDescriptor, stderrDescriptor] })
      leaderFinished = new Promise(resolve => { resolveLeader = resolve })
      diagnostic.pid = child.pid ?? null
      child.once('error', error => { primaryError ??= error; resolveLeader({ status: null, signal: null, spawnFailed: true }) })
      child.once('exit', (status, exitSignal) => { resolveLeader({ status, signal: exitSignal, spawnFailed: false }) })
      const stopped = new Promise(resolve => {
        timer = setTimeout(() => resolve({ stoppedBy: 'timeout' }), timeoutMs)
        abortListener = () => resolve({ stoppedBy: 'cancelled' })
        signal?.addEventListener('abort', abortListener, { once: true })
        if (signal?.aborted) abortListener()
      })
      const first = await Promise.race([leaderFinished, stopped])
      diagnostic.processWaitMs = performance.now() - started
      stoppedBy = first.stoppedBy
      if (!stoppedBy) leaderResult = first
      else primaryError = processError(
        stoppedBy === 'timeout' ? `Runner fixture exceeded ${timeoutMs} ms` : 'Runner fixture cancelled',
        stoppedBy === 'timeout' ? 'ETIMEDOUT' : 'ABORT_ERR',
      )
    }
  } catch (error) {
    primaryError ??= error
  } finally {
    clearTimeout(timer)
    if (abortListener) signal?.removeEventListener('abort', abortListener)
    for (const descriptor of [stdoutDescriptor, stderrDescriptor]) {
      if (descriptor === undefined) continue
      try { closeSync(descriptor) } catch (error) { diagnostic.diagnosticErrors.push(errorFields(error)) }
    }
  }

  diagnostic.cleanup = await cleanOwnedGroup(child?.pid, { termGraceMs, killGraceMs })
  if (!leaderResult && child && leaderFinished) {
    // Group disappearance normally precedes delivery of the child's exit event.
    // Never let an unreported exit or an unkillable child introduce another wait.
    let exitTimer
    leaderResult = await Promise.race([leaderFinished, new Promise(resolve => {
      exitTimer = setTimeout(() => resolve(undefined), killGraceMs)
    })])
    clearTimeout(exitTimer)
    if (!leaderResult) child.unref()
  }
  diagnostic.status = leaderResult?.status ?? null
  diagnostic.signal = leaderResult?.signal ?? null
  const orphaned = Boolean(leaderResult && !stoppedBy && diagnostic.cleanup.liveAtCleanup)
  diagnostic.outcome = stoppedBy ?? (primaryError ? 'spawn-failure'
    : diagnostic.signal ? 'signal'
      : orphaned || !diagnostic.cleanup.complete ? 'cleanup-failure'
        : diagnostic.status !== 0 ? 'nonzero' : 'success')
  if (!primaryError && (orphaned || !diagnostic.cleanup.complete)) {
    primaryError = processError('Runner leader left live owned processes', 'EOWNEDPROCESSLEAK')
  }
  diagnostic.error = errorFields(primaryError)
  let stdout = ''
  let stderr = ''
  for (const [field, path] of [['stdout', stdoutPath], ['stderr', stderrPath]]) {
    try {
      const content = readFileSync(path, 'utf8')
      if (field === 'stdout') stdout = content
      else stderr = content
    } catch (error) { diagnostic.diagnosticErrors.push(errorFields(error)) }
  }
  diagnostic.elapsedMs = performance.now() - started
  diagnostic.wallElapsedMs = Date.now() - wallStarted
  diagnostic.finishedAt = new Date().toISOString()
  try { writeFileSync(resultPath, JSON.stringify(diagnostic, null, 2) + '\n') } catch (error) {
    diagnostic.diagnosticErrors.push(errorFields(error))
  }
  return { status: diagnostic.status, signal: diagnostic.signal, error: primaryError, pid: diagnostic.pid,
    stdout, stderr, diagnostic, stdoutPath, stderrPath, resultPath }
}
