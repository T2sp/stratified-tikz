import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import test from 'node:test'
import { runOwnedRunnerProcess } from './helpers/ownedRunnerProcess.mjs'

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'stz-owned-runner-test-'))
  const cwd = join(directory, 'checkout')
  const logsDirectory = join(directory, 'evidence')
  mkdirSync(cwd)
  t.after(() => {
    const resultPath = join(logsDirectory, 'process-result.json')
    if (existsSync(resultPath) && !JSON.parse(readFileSync(resultPath, 'utf8')).cleanup.complete) {
      t.diagnostic(`Owned-process cleanup incomplete; retaining fixture and evidence: ${directory}`)
      return
    }
    rmSync(directory, { recursive: true, force: true })
  })
  return { directory, cwd, logsDirectory }
}

async function waitForFile(path) {
  const deadline = performance.now() + 10_000
  while (!existsSync(path)) {
    assert.ok(performance.now() < deadline, `Subprocess did not produce handshake: ${path}`)
    await pause(10)
  }
}

function assertGone(pid) {
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' }, `Owned PID ${pid} must have exited`)
}

test('owned runner records successful command context and file-backed streams', async t => {
  const options = fixture(t)
  const args = ['-e', 'console.log("completed stage"); console.error("diagnostic stream")']
  const result = await runOwnedRunnerProcess(process.execPath, args, options)
  assert.equal(result.status, 0)
  assert.equal(result.signal, null)
  assert.equal(result.diagnostic.outcome, 'success')
  assert.equal(result.diagnostic.command, process.execPath)
  assert.deepEqual(result.diagnostic.args, args)
  assert.equal(result.diagnostic.cwd, options.cwd)
  assert.equal(result.diagnostic.timeoutMs, 60_000)
  assert.ok(result.diagnostic.elapsedMs > 0)
  assert.ok(result.diagnostic.wallElapsedMs > 0)
  assert.ok(result.pid > 0)
  assert.equal(result.stdout, 'completed stage\n')
  assert.equal(result.stderr, 'diagnostic stream\n')
  assert.equal(result.diagnostic.cleanup.complete, true)
  assert.deepEqual(JSON.parse(readFileSync(result.resultPath, 'utf8')), result.diagnostic)
})

test('owned runner distinguishes an ordinary nonzero exit from abnormal termination', async t => {
  const result = await runOwnedRunnerProcess(process.execPath, ['-e', 'process.exit(7)'], fixture(t))
  assert.equal(result.status, 7)
  assert.equal(result.signal, null)
  assert.equal(result.error, undefined)
  assert.equal(result.diagnostic.outcome, 'nonzero')
  assert.equal(result.diagnostic.cleanup.complete, true)
})

test('owned runner reports timeout without converting null status to an exit code', async t => {
  const result = await runOwnedRunnerProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    ...fixture(t), timeoutMs: 100,
  })
  assert.equal(result.status, null)
  assert.equal(result.signal, 'SIGTERM')
  assert.equal(result.diagnostic.outcome, 'timeout')
  assert.equal(result.error.code, 'ETIMEDOUT')
  assert.equal(result.diagnostic.error.name, 'Error')
  assert.match(result.diagnostic.error.message, /100 ms/)
  assert.ok(result.diagnostic.elapsedMs >= 100)
  assert.equal(result.diagnostic.cleanup.complete, true)
  assert.deepEqual(result.diagnostic.cleanup.signals.map(entry => entry.signal), ['SIGTERM'])
  assertGone(result.pid)
})

test('owned runner retains self-signal diagnostics and streams after checkout cleanup', async t => {
  const options = fixture(t)
  const result = await runOwnedRunnerProcess(process.execPath, ['-e', `
    require('node:fs').writeSync(1, 'last completed stage\\n');
    require('node:fs').writeSync(2, 'signal evidence\\n');
    process.kill(process.pid, 'SIGTERM');
  `], options)
  assert.equal(result.status, null)
  assert.equal(result.signal, 'SIGTERM')
  assert.equal(result.diagnostic.outcome, 'signal')
  assert.equal(result.diagnostic.cleanup.complete, true)
  rmSync(options.cwd, { recursive: true })
  assert.equal(readFileSync(result.stdoutPath, 'utf8'), 'last completed stage\n')
  assert.equal(readFileSync(result.stderrPath, 'utf8'), 'signal evidence\n')
  assert.equal(JSON.parse(readFileSync(result.resultPath, 'utf8')).signal, 'SIGTERM')
})

test('owned runner records actionable spawn errors without claiming a child completed', async t => {
  const options = fixture(t)
  const command = join(options.cwd, 'missing-executable')
  const result = await runOwnedRunnerProcess(command, ['fixture-argument'], options)
  assert.equal(result.status, null)
  assert.equal(result.signal, null)
  assert.equal(result.pid, null)
  assert.equal(result.diagnostic.outcome, 'spawn-failure')
  assert.equal(result.error.code, 'ENOENT')
  assert.equal(result.diagnostic.error.name, 'Error')
  assert.equal(result.diagnostic.error.path, command)
  assert.deepEqual(result.diagnostic.error.spawnargs, ['fixture-argument'])
  assert.match(result.diagnostic.error.syscall, /spawn/)
  assert.ok(result.diagnostic.error.errno < 0)
  assert.equal(result.diagnostic.cleanup.complete, true)
  assert.equal(JSON.parse(readFileSync(result.resultPath, 'utf8')).error.code, 'ENOENT')
})

test('owned runner cancellation before spawn creates readable evidence without a PID', async t => {
  const controller = new AbortController()
  controller.abort()
  const result = await runOwnedRunnerProcess(process.execPath, ['-e', 'process.exit(0)'], {
    ...fixture(t), signal: controller.signal,
  })
  assert.equal(result.status, null)
  assert.equal(result.pid, null)
  assert.equal(result.diagnostic.outcome, 'cancelled')
  assert.equal(result.error.code, 'ABORT_ERR')
  assert.equal(result.diagnostic.cleanup.complete, true)
  assert.equal(JSON.parse(readFileSync(result.resultPath, 'utf8')).outcome, 'cancelled')
})

test('owned runner preserves synchronous spawn failure and persists its evidence', async t => {
  const options = fixture(t)
  const result = await runOwnedRunnerProcess('', ['fixture-argument'], options)
  assert.equal(result.status, null)
  assert.equal(result.signal, null)
  assert.equal(result.pid, null)
  assert.equal(result.diagnostic.outcome, 'spawn-failure')
  assert.equal(result.error.code, 'ERR_INVALID_ARG_VALUE')
  assert.equal(result.diagnostic.error.name, 'TypeError')
  assert.match(result.error.message, /file.*cannot be empty/)
  assert.equal(result.diagnostic.cleanup.complete, true)
  assert.deepEqual(result.diagnostic.cleanup.signals, [])
  rmSync(options.cwd, { recursive: true })
  assert.equal(readFileSync(result.stdoutPath, 'utf8'), '')
  assert.equal(readFileSync(result.stderrPath, 'utf8'), '')
  assert.equal(JSON.parse(readFileSync(result.resultPath, 'utf8')).error.code, 'ERR_INVALID_ARG_VALUE')
})

test('owned runner cancellation kills its TERM-ignoring runner worker and command only', async t => {
  const options = fixture(t)
  const controller = new AbortController()
  const childSource = `
    const { spawn } = require('node:child_process');
    const { appendFileSync, writeFileSync } = require('node:fs');
    const depth = Number(process.argv[2]);
    process.on('SIGTERM', () => {});
    appendFileSync('pids.jsonl', JSON.stringify(process.pid) + '\\n');
    if (depth > 0) {
      const child = spawn(process.execPath, [__filename, String(depth - 1)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      child.once('message', () => {
        if (process.send) process.send('ready');
        else writeFileSync('ready', 'ready');
      });
    } else process.send('ready');
    setInterval(() => {}, 1000);
  `
  writeFileSync(join(options.cwd, 'chain.cjs'), childSource)
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' })
  const unrelatedExited = new Promise(resolve => unrelated.once('exit', resolve))
  t.after(async () => { unrelated.kill('SIGKILL'); await unrelatedExited })
  const running = runOwnedRunnerProcess(process.execPath, ['chain.cjs', '2'], {
    ...options, signal: controller.signal, termGraceMs: 50,
  })
  let handshakeError
  try { await waitForFile(join(options.cwd, 'ready')) } catch (error) { handshakeError = error } finally { controller.abort() }
  const result = await running
  if (handshakeError) throw handshakeError
  const pids = readFileSync(join(options.cwd, 'pids.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
  assert.equal(pids.length, 3)
  assert.equal(result.diagnostic.outcome, 'cancelled')
  assert.equal(result.error.code, 'ABORT_ERR')
  assert.equal(result.status, null)
  assert.equal(result.signal, 'SIGKILL')
  assert.deepEqual(result.diagnostic.cleanup.signals.map(entry => entry.signal), ['SIGTERM', 'SIGKILL'])
  assert.equal(result.diagnostic.cleanup.complete, true)
  for (const pid of pids) assertGone(pid)
  assert.equal(process.kill(unrelated.pid, 0), true, 'Unrelated detached process is still alive')
})

for (const leaderStatus of [0, 7]) test(`owned runner rejects leaking leader status ${leaderStatus} and collects late failure without inherited pipe waits`, async t => {
  const options = fixture(t)
  writeFileSync(join(options.cwd, 'child.cjs'), `
    process.on('SIGTERM', () => {
      require('node:fs').writeSync(2, 'late owned command failure\\n');
      process.exit(9);
    });
    process.send('ready');
    setInterval(() => {}, 1000);
  `)
  writeFileSync(join(options.cwd, 'leader.cjs'), `
    const child = require('node:child_process').spawn(process.execPath, ['child.cjs'], {
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    child.once('message', () => {
      require('node:fs').writeFileSync('child.pid', String(child.pid));
      console.log('leader completed');
      process.exit(${leaderStatus});
    });
  `)
  const result = await runOwnedRunnerProcess(process.execPath, ['leader.cjs'], options)
  assert.equal(result.status, leaderStatus, 'Actual leader status is preserved')
  assert.equal(result.diagnostic.outcome, 'cleanup-failure', 'A live descendant cannot count as successful verification')
  assert.equal(result.error.code, 'EOWNEDPROCESSLEAK')
  assert.equal(result.diagnostic.cleanup.liveAtCleanup, true)
  assert.equal(result.diagnostic.cleanup.complete, true)
  assert.equal(result.stdout, 'leader completed\n')
  assert.equal(result.stderr, 'late owned command failure\n')
  assertGone(Number(readFileSync(join(options.cwd, 'child.pid'), 'utf8')))
})

test('owned runner rejects an unbounded timeout configuration', async t => {
  await assert.rejects(runOwnedRunnerProcess(process.execPath, [], { ...fixture(t), timeoutMs: Infinity }), /finite and positive/)
})
