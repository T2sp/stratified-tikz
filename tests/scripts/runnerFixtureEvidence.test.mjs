import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createRunnerFixtureEvidence } from './helpers/runnerFixtureEvidence.mjs'
import { runOwnedRunnerProcess } from './helpers/ownedRunnerProcess.mjs'

const evidenceModule = new URL('./helpers/runnerFixtureEvidence.mjs', import.meta.url).href

test('failed runner evidence remains readable after the test process exits and cleans its checkout', async t => {
  const driver = mkdtempSync(join(tmpdir(), 'stz-evidence-driver-'))
  t.after(() => rmSync(driver, { recursive: true, force: true }))
  const paths = {
    cwd: mkdtempSync(join(tmpdir(), 'stz-evidence-checkout-')),
    artifact: mkdtempSync(join(tmpdir(), 'stz-phase31f-partial-')),
    handoff: mkdtempSync(join(tmpdir(), 'stz-phase-verifier-partial-')),
    missing: mkdtempSync(join(tmpdir(), 'stz-phase-verifier-missing-')),
    unprinted: mkdtempSync(join(tmpdir(), 'stz-phase31f-unprinted-')),
  }
  rmSync(paths.missing, { recursive: true })
  mkdirSync(join(paths.cwd, 'logs'))
  writeFileSync(join(paths.cwd, 'logs', 'checks.jsonl'), '{"stage":"build"}\n'
    + JSON.stringify({ stage: 'browser', artifactDir: join(paths.unprinted, '04-browser', 'artifacts') }) + '\n{partial')
  writeFileSync(join(paths.unprinted, 'verification.json'), '{"status":"running"}')
  writeFileSync(join(paths.artifact, 'verification.json'), JSON.stringify({ status: 'running', checks: [
    { name: 'npm-build', status: 'passed' }, { name: 'git-diff-check', status: 'running' },
  ] }))
  writeFileSync(join(paths.handoff, 'response.json'), '{truncated')
  const output = `Verifier handoff: ${join(paths.handoff, 'response.json')}\nVerifier handoff: ${join(paths.missing, 'response.json')}\nVerification evidence: ${join(paths.artifact, 'verification.json')}\nVerification passed: npm-build; log: partial\nVerification: git diff --check`
  const signalResult = await runOwnedRunnerProcess(process.execPath, ['-e',
    `console.log(${JSON.stringify(output)}); console.error('primary signal failure'); process.kill(process.pid, 'SIGTERM');`,
  ], { cwd: paths.cwd, logsDirectory: join(paths.cwd, 'logs', 'process'), signal: t.signal })
  assert.equal(signalResult.diagnostic.outcome, 'signal')
  assert.equal(signalResult.diagnostic.cleanup.complete, true)
  writeFileSync(join(driver, 'result.json'), JSON.stringify(signalResult))
  // The subprocess stands in for the failing test callback and its after hook.
  // Its native command already exited, so no detached grandchildren can escape
  // the driver's own bounded process ownership.
  writeFileSync(join(driver, 'driver.mjs'), `
import { readFileSync } from 'node:fs';
import { createRunnerFixtureEvidence } from ${JSON.stringify(evidenceModule)};
const result = JSON.parse(readFileSync(${JSON.stringify(join(driver, 'result.json'))}, 'utf8'));
const evidence = createRunnerFixtureEvidence(${JSON.stringify(paths.cwd)});
evidence.collect(result);
const directory = evidence.preserve(new Error('original test assertion'));
evidence.cleanup();
console.log(JSON.stringify({directory}));
process.exitCode = 1;
`)
  const result = await runOwnedRunnerProcess(process.execPath, [join(driver, 'driver.mjs')], {
    cwd: driver, logsDirectory: join(driver, 'logs'), timeoutMs: 10_000, signal: t.signal,
  })
  assert.equal(result.diagnostic.outcome, 'nonzero', JSON.stringify(result.diagnostic))
  assert.equal(result.status, 1, `${result.error?.message}\n${result.stdout}\n${result.stderr}`)
  paths.directory = JSON.parse(result.stdout.trim()).directory
  // This test intentionally leaves the explicitly printed failure directory for
  // inspection after npm test exits, just like an actual failing runner test.
  t.diagnostic(`Evidence survival regression retained: ${paths.directory}`)
  assert.match(result.stderr, /Runner fixture failure evidence:/)
  for (const path of [paths.cwd, paths.artifact, paths.handoff, paths.unprinted]) assert.equal(existsSync(path), false)
  const retained = JSON.parse(readFileSync(join(paths.directory, 'failure.json'), 'utf8'))
  assert.match(retained.primaryFailure, /original test assertion/)
  assert.equal(retained.runs[0].outcome, 'signal')
  assert.equal(retained.runs[0].signal, 'SIGTERM')
  assert.equal(retained.runs[0].lastCompletedStage, 'npm-build')
  assert.equal(retained.runs[0].lastStartedStage, 'git diff --check')
  assert.deepEqual(retained.runs[0].reportPaths, [join(paths.artifact, 'verification.json')])
  assert.ok(retained.artifacts.find(entry => entry.original === paths.missing).missing)
  const unprintedCopy = retained.artifacts.find(entry => entry.original === paths.unprinted).retained
  assert.deepEqual(retained.runs[0].artifactDirectoriesFromChecks, [paths.unprinted])
  assert.equal(readFileSync(join(unprintedCopy, 'verification.json'), 'utf8'), '{"status":"running"}')
  const artifactCopy = retained.artifacts.find(entry => entry.original === paths.artifact).retained
  const workerCopy = retained.artifacts.find(entry => entry.original === paths.handoff).retained
  assert.equal(JSON.parse(readFileSync(join(artifactCopy, 'verification.json'), 'utf8')).status, 'running')
  assert.equal(readFileSync(join(workerCopy, 'response.json'), 'utf8'), '{truncated')
  assert.match(readFileSync(join(paths.directory, 'fixture', 'logs', 'checks.jsonl'), 'utf8'), /build/)
  assert.match(readFileSync(join(paths.directory, 'fixture', 'logs', 'process', 'stderr.log'), 'utf8'), /primary signal failure/)
})

test('successful fixture cleanup removes its checkout; incomplete termination keeps originals', t => {
  for (const complete of [true, false]) {
    const cwd = mkdtempSync(join(tmpdir(), 'stz-evidence-cleanup-'))
    t.after(() => rmSync(cwd, { recursive: true, force: true }))
    const messages = []
    const evidence = createRunnerFixtureEvidence(cwd, message => messages.push(message))
    evidence.collect({ stdout: '', stderr: '', resultPath: join(cwd, 'result.json'), diagnostic: { cleanup: { complete } } })
    evidence.cleanup()
    assert.equal(existsSync(cwd), !complete)
    assert.equal(messages.length, complete ? 0 : 1)
  }
})

test('secondary evidence write failure retains originals and never replaces the primary failure', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'stz-evidence-write-failure-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const messages = []
  const evidence = createRunnerFixtureEvidence(cwd, message => messages.push(message))
  evidence.collect({ stdout: '', stderr: '', resultPath: join(cwd, 'missing', 'result.json'), diagnostic: { cleanup: { complete: true } } })
  const retained = evidence.preserve(new Error('primary timeout'))
  t.after(() => rmSync(retained, { recursive: true, force: true }))
  evidence.cleanup()
  assert.equal(existsSync(cwd), true)
  const failure = JSON.parse(readFileSync(join(retained, 'failure.json'), 'utf8'))
  assert.match(failure.primaryFailure, /primary timeout/)
  assert.match(failure.diagnosticErrors[0], /ENOENT/)
  assert.match(messages.at(-1), /originals retained/)
})
