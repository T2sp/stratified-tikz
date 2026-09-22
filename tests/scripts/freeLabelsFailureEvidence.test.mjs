import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../..', import.meta.url))
const primaryMessage = 'Deliberate fixture navigation failure'

// Execute the real harness catch/finally in a strict subprocess. The external
// Playwright replacement fails before browser work; there is no native browser,
// network, server, invented download, or passing acceptance evidence.
const fakePlaywright = `
import { appendFileSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
const log = (entry) => appendFileSync(process.env.STZ_TEST_FAILURE_LOG, JSON.stringify(entry) + '\\n')
const evidencePath = join(process.env.STZ_SMOKE_ARTIFACT_DIR, 'free-labels-evidence.json')
const page = {
  on() {},
  async goto() {
    const error = new Error(${JSON.stringify(primaryMessage)})
    error.code = 'STZ_TEST_NAVIGATION'
    throw error
  },
  async screenshot(options) {
    log({ kind: 'screenshot', options, evidence: JSON.parse(readFileSync(evidencePath, 'utf8')) })
    if (process.env.STZ_TEST_BREAK_EVIDENCE === '1') {
      unlinkSync(evidencePath)
      mkdirSync(evidencePath)
    }
    if (process.env.STZ_TEST_FAIL_SCREENSHOT === '1') throw new Error('Deliberate screenshot failure')
  },
}
export const chromium = {
  async launch() {
    return {
      version: () => 'external failure fixture; no native browser',
      newPage: async () => page,
      async close() {
        log({ kind: 'browser-close' })
        if (process.env.STZ_TEST_FAIL_CLOSE === '1') throw new Error('Deliberate browser cleanup failure')
      },
    }
  },
}
`

function failHarness(t, flags = {}) {
  const temporary = mkdtempSync(join(tmpdir(), 'stz-free-label-failure-test-'))
  t.after(() => rmSync(temporary, { recursive: true, force: true }))
  const artifactDir = join(temporary, 'artifacts')
  const modulePath = join(temporary, 'external-playwright.mjs')
  const logPath = join(temporary, 'calls.jsonl')
  mkdirSync(artifactDir)
  writeFileSync(modulePath, fakePlaywright)
  const child = spawnSync(process.execPath, ['--unhandled-rejections=strict', 'scripts/checkFreeLabels.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      STZ_PLAYWRIGHT_MODULE: modulePath,
      STZ_BROWSER_BASE_URL: 'http://no-server-needed.invalid',
      STZ_SMOKE_ARTIFACT_DIR: artifactDir,
      STZ_TEST_FAILURE_LOG: logPath,
      ...flags,
    },
    encoding: 'utf8',
    timeout: 15_000,
  })
  assert.equal(child.error, undefined, child.error?.message)
  assert.equal(child.signal, null, child.stderr)
  assert.equal(child.status, 1, child.stderr)
  assert.match(child.stderr, new RegExp(`Error: ${primaryMessage}`))
  assert.doesNotMatch(child.stdout, /free-label-browser-check-passed/)
  assert.doesNotMatch(child.stderr, /UnhandledPromiseRejection|triggerUncaughtException\(err, true/)
  const calls = readFileSync(logPath, 'utf8').trim().split('\n').map(JSON.parse)
  const screenshot = calls.find(({ kind }) => kind === 'screenshot')
  assert.ok(screenshot, 'The harness attempted its optional failure screenshot')
  assert.equal(screenshot.evidence.result, 'failed', 'Failed evidence exists before any image work')
  assert.equal(screenshot.evidence.error.message, primaryMessage)
  assert.deepEqual(screenshot.options, { path: join(artifactDir, 'failure.png'), fullPage: false, timeout: 5_000 })
  assert.equal(calls.filter(({ kind }) => kind === 'browser-close').length, 1, 'The owned browser is closed once')
  return { child, artifactDir, screenshot }
}

function assertFailedReport(report) {
  assert.equal(report.result, 'failed')
  assert.equal(report.stage, 'renderer-fixture')
  assert.deepEqual(report.completed, [])
  assert.equal(report.incompleteGroups.length, 15)
  assert.deepEqual(report.unexecuted, report.incompleteGroups)
  assert.equal(report.error.message, primaryMessage)
  assert.equal(report.error.code, 'STZ_TEST_NAVIGATION')
  assert.match(report.error.stack, /external-playwright\.mjs/)
}

test('the actual browser harness persists terminal failed evidence before bounded optional image work', (t) => {
  const { artifactDir } = failHarness(t)
  const report = JSON.parse(readFileSync(join(artifactDir, 'free-labels-evidence.json'), 'utf8'))
  assertFailedReport(report)
  assert.deepEqual(report.diagnostics, [])
})

test('screenshot and browser cleanup failures cannot replace the actual harness scenario failure', (t) => {
  const { artifactDir, child } = failHarness(t, { STZ_TEST_FAIL_SCREENSHOT: '1', STZ_TEST_FAIL_CLOSE: '1' })
  const report = JSON.parse(readFileSync(join(artifactDir, 'free-labels-evidence.json'), 'utf8'))
  assertFailedReport(report)
  assert.deepEqual(report.diagnostics.map(({ name, error }) => [name, error.message]), [
    ['failure-screenshot-failed', 'Deliberate screenshot failure'],
    ['browser-cleanup-failed', 'Deliberate browser cleanup failure'],
  ])
  assert.ok(child.stderr.lastIndexOf(`Error: ${primaryMessage}`) > child.stderr.lastIndexOf('Deliberate browser cleanup failure'),
    'The error thrown out of the harness is the primary scenario failure')
})

test('a later diagnostic write failure still drains browser cleanup and rethrows the primary failure', (t) => {
  const { screenshot, child } = failHarness(t, {
    STZ_TEST_BREAK_EVIDENCE: '1', STZ_TEST_FAIL_SCREENSHOT: '1', STZ_TEST_FAIL_CLOSE: '1',
  })
  assertFailedReport(screenshot.evidence)
  assert.match(child.stderr, /failure-evidence-write-failed/)
  assert.ok(child.stderr.lastIndexOf(`Error: ${primaryMessage}`) > child.stderr.lastIndexOf('failure-evidence-write-failed'))
})
