import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import test from 'node:test'
import { browserChecksForPhase, pointNodeScenarios, pointNodeScenarioArtifacts, captureCheckoutIdentity, runPhaseVerification, verificationMatchesCheckout, hasWholePointSvg, validateBrowserEvidence, allPointNodeScenarios } from '../../scripts/automation/phase-verification.mjs'
import { createEvidencePublisher, readEvidenceDocumentSync } from '../../scripts/evidencePublication.mjs'
import { layoutAnchorGroup, assertLayoutStandaloneEvidence, assertLayoutPostClickViewDiagnostic } from '../../scripts/pointLayoutAnchorsContract.mjs'
import { syntheticStandalonePointDownload } from './standalonePointDownloadFixture.mjs'
import { populatePhase32dParentEvidence } from './phase32dParentEvidenceFixture.mjs'
import { syntheticZeroPng } from './signedPointStandaloneFixture.mjs'
import { singularCylinderScenario, singularCylinderWarningPath } from '../../scripts/singularCylinderDiagnosticContract.mjs'
import { pointGroups, importRegressionScenarios, correctionScenarios, continuityScenarios, targetedPaintScenarios, synchronizeClearSnapshot, polygonJoinEvidence, completePointEvidence } from './phase32abParentEvidenceFixture.mjs'

import { dashCapScenario, dashCapArtifacts } from '../../scripts/pointDashCapContract.mjs'
import { dashCapMechanismStem, dashCapMechanismArtifacts } from '../../scripts/pointDashCapMechanismContract.mjs'

import { polygonJoinScenario, polygonJoinArtifacts, assertPolygonJoinEvidence } from '../../scripts/pointPolygonJoinContract.mjs'

const freeLabelGroups = [
  'existing-renderer-regressions',
  'independent-oracle-negative-controls',
  'boundary-anchor-camera-matrix',
  'inverted-success-and-failure-races',
  'pending-lock-and-autohide',
  'deletion-and-unmount',
  'real-App-input-JSON-history-reused-ID-load',
  'current-SVG-cloning',
]
const inlineLabelGroups = [
  'inline-node-rendering-placement-halo-picking',
  'inline-node-lifecycle-path-operations-export',
]
const allLabelGroups = [...freeLabelGroups, ...inlineLabelGroups]
const settledExportGroups = [...allLabelGroups, 'settled-SVG-export-standalone']
const combinedLabelGroups = [...settledExportGroups, 'combined-free-inline-workflows']

// The fake command records observable process boundaries. It never invokes npm,
// Codex, a server, or a browser; the verification helper still executes real git.
const fakeNpm = `#!${process.execPath}
const fs = require('node:fs')
const path = require('node:path')
const args = process.argv.slice(2)
const command = args.join(' ')
const artifacts = process.env.STZ_SMOKE_ARTIFACT_DIR
fs.appendFileSync(process.env.STZ_TEST_COMMAND_LOG, JSON.stringify({
  args,
  cwd: process.cwd(),
  artifacts,
  baseUrl: process.env.STZ_BROWSER_BASE_URL ?? null,
  playwright: process.env.STZ_PLAYWRIGHT_MODULE,
  browser: process.env.STZ_BROWSER_EXECUTABLE,
}) + '\\n')
console.log('fixture stdout: ' + command)
console.error('fixture stderr: ' + command)
if (command === process.env.STZ_TEST_FAIL_COMMAND) {
  process.exit(Number(process.env.STZ_TEST_EXIT_CODE || 1))
}
if (command === 'run build' && process.env.STZ_TEST_CHANGE_CHECKOUT === 'true') {
  fs.appendFileSync('tracked.txt', 'build modified source\\n')
}
if (command.startsWith('run check:')) {
  fs.mkdirSync(artifacts, { recursive: true })
  const save = (name, value) => fs.writeFileSync(path.join(artifacts, name), JSON.stringify(value))
  if (command === 'run check:label-assets') {
    save('asset-graph-evidence.json', { main: 'main.js', workers: ['worker.js'] })
    save('containment-evidence.json', { fixtures: [{ geometryInside: true }] })
    const mode = process.env.STZ_TEST_ASSET_EVIDENCE
    if (mode === 'invalid') {
      fs.writeFileSync(path.join(artifacts, 'native-retry-evidence.json'), '{truncated')
    } else if (mode !== 'missing') {
      save('native-retry-evidence.json', {
        browser: 'fixture Chromium',
        affectedBrowserRecoveryVerified: mode !== 'unverified',
        nativeFailureCaching: { cachesFailedNativeImports: mode !== 'unverified' },
        scenarios: ['runtime-native-import', 'additional-font-native-import', 'transitive-native-import']
          .map(name => ({ name, recovery: { kind: 'success' } })),
      })
    }
  } else if (command === 'run check:free-labels') {
    const groups = JSON.parse(process.env.STZ_TEST_FREE_LABEL_GROUPS)
    const incomplete = process.env.STZ_TEST_FREE_EVIDENCE === 'incomplete'
    const pointEvidence = JSON.parse(process.env.STZ_TEST_POINT_EVIDENCE || '{}')
    const artifactValues = JSON.parse(process.env.STZ_TEST_POINT_ARTIFACT_VALUES_FILE
      ? fs.readFileSync(process.env.STZ_TEST_POINT_ARTIFACT_VALUES_FILE, 'utf8') : process.env.STZ_TEST_POINT_ARTIFACT_VALUES || '{}')
    if (process.env.STZ_TEST_POINT_ARTIFACTS === 'yes') {
      for (const entry of pointEvidence.evidence || []) for (const artifact of entry.artifacts) {
        const content = process.env.STZ_TEST_POINT_CORRUPT === 'yes' ? 'broken' : artifact.endsWith('.svg')
          ? typeof artifactValues[artifact] === 'string' ? artifactValues[artifact] : artifact.endsWith('.input.svg') ? '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 1,0 0,1" fill="none" stroke="black"></polygon></svg>' : '<svg><g><circle r="20"/><g><title>fixture</title><g><g><text x="0" y="0">fixture</text></g></g></g></g></svg>'
          : artifact.endsWith('.png') ? artifactValues[artifact]?.syntheticPngBase64
            ? Buffer.from(artifactValues[artifact].syntheticPngBase64, 'base64')
            : Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1]) : JSON.stringify(artifactValues[artifact] || {})
        fs.writeFileSync(path.join(artifacts, artifact), content)
      }
    }
    save('free-labels-evidence.json', {
      result: 'passed', stage: 'complete', environment: { browserVersion: 'fixture Chromium' },
      completed: incomplete ? groups.slice(0, -1) : groups,
      incompleteGroups: incomplete ? groups.slice(-1) : [],
      unexecuted: [], pageErrors: [], evidence: groups.map(name => ({ name })),
      ...pointEvidence,
      ...JSON.parse(process.env.STZ_TEST_FREE_EVIDENCE_OVERRIDE || '{}'),
    })
  }
}
`

function checkoutFixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'stz-phase-verification-test-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const cwd = join(root, 'checkout')
  const bin = join(root, 'bin')
  const commandLog = join(root, 'commands.jsonl')
  mkdirSync(cwd)
  mkdirSync(bin)
  writeFileSync(join(bin, 'npm'), fakeNpm, { mode: 0o755 })
  const env = {
    ...process.env,
    PATH: `${bin}:${dirname(process.execPath)}:${process.env.PATH ?? ''}`,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    STZ_TEST_COMMAND_LOG: commandLog,
    STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(freeLabelGroups),
    STZ_PLAYWRIGHT_MODULE: join(root, 'external playwright', 'index.mjs'),
    STZ_BROWSER_EXECUTABLE: join(root, 'Chrome Browser'),
  }
  // Full native raster grids exceed OS environment-string limits. Keep the
  // test-facing mutable payload API, but transport its exact JSON through an
  // owned external fixture file rather than truncating audit evidence. Read on
  // demand: cleanup hooks retain this closure until the test file finishes, so
  // caching each multi-megabyte payload here would retain every fixture's JSON.
  const pointArtifactValuesFile = join(root, 'point-artifact-values.json')
  Object.defineProperty(env, 'STZ_TEST_POINT_ARTIFACT_VALUES', {
    enumerable: false,
    get() { return env.STZ_TEST_POINT_ARTIFACT_VALUES_FILE ? readFileSync(pointArtifactValuesFile, 'utf8') : undefined },
    set(value) {
      writeFileSync(pointArtifactValuesFile, value)
      env.STZ_TEST_POINT_ARTIFACT_VALUES_FILE = pointArtifactValuesFile
    },
  })
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout
  }
  git('init', '--quiet')
  git('config', 'user.name', 'Verification Test')
  git('config', 'user.email', 'verification-test@example.invalid')
  writeFileSync(join(cwd, 'tracked.txt'), 'original source\n')
  writeFileSync(join(cwd, '.gitignore'), 'dist/\n')
  git('add', '.')
  git('-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'fixture')
  return {
    cwd,
    env,
    git,
    commands: () => {
      try {
        return readFileSync(commandLog, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
      } catch (error) {
        if (error.code === 'ENOENT') return []
        throw error
      }
    },
  }
}

function verify(t, fixture, phase, options = {}) {
  const registerCleanup = (report) => {
    if (report?.artifactDir) {
      t.after(() => rmSync(report.artifactDir, { recursive: true, force: true }))
    }
  }
  try {
    const report = runPhaseVerification({ phase, cwd: fixture.cwd, env: fixture.env, ...options })
    registerCleanup(report)
    return report
  } catch (error) {
    registerCleanup(error.report)
    throw error
  }
}

function failedVerification(t, fixture, phase, options = {}) {
  try {
    verify(t, fixture, phase, options)
  } catch (error) {
    assert.ok(error.report, 'Failures retain a verification report')
    return error
  }
  assert.fail('Expected verification to fail')
}

function storedReport(report) {
  return JSON.parse(readFileSync(report.summaryPath, 'utf8'))
}

test('point artifact payload uses the owned file as its uncached source', (t) => {
  const fixture = checkoutFixture(t)
  assert.equal(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES, undefined)
  fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = '{"samples":[1,2,3]}'
  const file = fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES_FILE
  assert.equal(readFileSync(file, 'utf8'), '{"samples":[1,2,3]}')
  writeFileSync(file, '{"samples":[3,2,1]}')
  assert.equal(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES, '{"samples":[3,2,1]}')
  assert.equal(Object.keys(fixture.env).includes('STZ_TEST_POINT_ARTIFACT_VALUES'), false)
})

test('browser gates apply to 31B and all subsequent label subphases only', () => {
  assert.deepEqual(browserChecksForPhase('31B'), ['check:label-assets'])
  for (const phase of ['31C', '31D', '31E', '31F', '32A', '32B', '32C', '32D']) {
    assert.deepEqual(browserChecksForPhase(phase), ['check:label-assets', 'check:free-labels'])
  }
  for (const phase of ['30', '31A', '33A']) {
    assert.deepEqual(browserChecksForPhase(phase), [])
  }
})

test('31C builds before browser checks and preserves isolated browser evidence and logs', (t) => {
  const fixture = checkoutFixture(t)
  const inheritedArtifacts = join(fixture.cwd, 'stale-evidence')
  fixture.env.STZ_SMOKE_ARTIFACT_DIR = inheritedArtifacts
  fixture.env.STZ_BROWSER_BASE_URL = 'http://stale-server.invalid/'
  const report = verify(t, fixture, '31C', { stage: 'before-review' })

  assert.equal(report.status, 'passed')
  assert.equal(report.phase, '31C')
  assert.equal(report.stage, 'before-review')
  assert.deepEqual(report.checks.map(({ command, args }) => [command, ...args]), [
    ['npm', 'test'], ['npm', 'run', 'build'], ['git', 'diff', '--check'],
    ['npm', 'run', 'check:label-assets'], ['npm', 'run', 'check:free-labels'],
  ])
  assert.deepEqual(fixture.commands().map(({ args }) => args), [
    ['test'], ['run', 'build'], ['run', 'check:label-assets'], ['run', 'check:free-labels'],
  ])
  const browserCommands = fixture.commands().filter(({ args }) => args[1]?.startsWith('check:'))
  assert.equal(new Set(browserCommands.map(({ artifacts }) => artifacts)).size, 2)
  for (const command of browserCommands) {
    assert.equal(command.cwd, fixture.cwd)
    assert.equal(command.baseUrl, null, 'A server for another checkout must not be reused')
    assert.equal(command.playwright, fixture.env.STZ_PLAYWRIGHT_MODULE)
    assert.equal(command.browser, fixture.env.STZ_BROWSER_EXECUTABLE)
    assert.notEqual(command.artifacts, inheritedArtifacts)
    assert.ok(!relative(report.artifactDir, command.artifacts).startsWith('..'))
  }
  for (const check of report.checks) {
    assert.equal(check.status, 'passed')
    assert.equal(check.exitCode, 0)
    if (check.command === 'npm') {
      const log = readFileSync(check.logPath, 'utf8')
      assert.match(log, /fixture stdout:/)
      assert.match(log, /fixture stderr:/)
    }
  }
  assert.deepEqual(storedReport(report), report)
  assert.equal(verificationMatchesCheckout(report, fixture), true)
})

test('31B runs the asset browser gate without requiring later free-label assertions', (t) => {
  const fixture = checkoutFixture(t)
  const first = verify(t, fixture, '31B')
  const second = verify(t, fixture, '31B')
  assert.notEqual(first.artifactDir, second.artifactDir, 'Each invocation retains its own evidence')
  assert.deepEqual(first.checks.filter(({ name }) => name.startsWith('check:')).map(({ name }) => name), ['check:label-assets'])
  assert.equal(fixture.commands().some(({ args }) => args.includes('check:free-labels')), false)
})

test('other phases run tests, build, and whitespace verification without a browser', (t) => {
  const fixture = checkoutFixture(t)
  const report = verify(t, fixture, '30')
  assert.deepEqual(report.checks.map(({ command, args }) => [command, ...args]), [
    ['npm', 'test'], ['npm', 'run', 'build'], ['git', 'diff', '--check'],
  ])
  assert.deepEqual(fixture.commands().map(({ args }) => args), [['test'], ['run', 'build']])
})

test('an unavailable affected-browser check preserves exit 2 and cannot pass 31B', (t) => {
  const fixture = checkoutFixture(t)
  fixture.env.STZ_TEST_FAIL_COMMAND = 'run check:label-assets'
  fixture.env.STZ_TEST_EXIT_CODE = '2'
  const error = failedVerification(t, fixture, '31B')
  assert.equal(error.exitCode, 2)
  assert.match(error.message, /check:label-assets/)
  assert.equal(error.report.status, 'failed')
  assert.equal(error.report.checks.at(-1).exitCode, 2)
  assert.match(readFileSync(error.report.checks.at(-1).logPath, 'utf8'), /fixture stderr: run check:label-assets/)
  assert.equal(storedReport(error.report).status, 'failed')
  assert.equal(verificationMatchesCheckout(error.report, fixture), false)
})

for (const mode of ['missing', 'invalid', 'unverified']) {
  test(`exit 0 with ${mode} native-browser evidence does not establish acceptance`, (t) => {
    const fixture = checkoutFixture(t)
    fixture.env.STZ_TEST_ASSET_EVIDENCE = mode
    const error = failedVerification(t, fixture, '31C')
    assert.match(error.message, /check:label-assets/)
    assert.notEqual(error.exitCode, 0)
    assert.equal(error.report.status, 'failed')
    assert.equal(fixture.commands().some(({ args }) => args.includes('check:free-labels')), false)
    assert.equal(storedReport(error.report).status, 'failed')
  })
}

test('31C requires every browser scenario group even if the command exits successfully', (t) => {
  const fixture = checkoutFixture(t)
  fixture.env.STZ_TEST_FREE_EVIDENCE = 'incomplete'
  const error = failedVerification(t, fixture, '31C')
  assert.match(error.message, /check:free-labels/)
  assert.equal(error.report.status, 'failed')
  assert.equal(storedReport(error.report).status, 'failed')
})

for (const phase of ['31C', '31D']) {
  test(`${phase} accepts all ten groups from the extended shared harness`, (t) => {
    const fixture = checkoutFixture(t)
    fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(allLabelGroups)
    const report = verify(t, fixture, phase)
    assert.equal(report.status, 'passed')
    assert.equal(report.checks.at(-1).name, 'check:free-labels')
    assert.equal(report.checks.at(-1).exitCode, 0)
    assert.equal(verificationMatchesCheckout(report, fixture), true)
  })
}

for (const phase of ['31C', '31D', '31E']) {
  test(`${phase} accepts all eleven groups including standalone SVG export`, (t) => {
    const fixture = checkoutFixture(t)
    fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(settledExportGroups)
    assert.equal(verify(t, fixture, phase).status, 'passed')
  })
}

for (const phase of ['31E', '31F']) {
  test(`${phase} rejects older passing evidence without standalone SVG save/reopen`, (t) => {
    const fixture = checkoutFixture(t)
    fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(allLabelGroups)
    const error = failedVerification(t, fixture, phase)
    assert.match(error.message, phase === '31F' ? /12 required groups/ : /11 required groups/)
    assert.equal(error.report.checks.at(-1).exitCode, 0)
    assert.equal(error.report.status, 'failed')
  })
}

for (const phase of ['31C', '31D', '31E', '31F']) {
  test(`${phase} accepts all twelve groups including combined free/path workflows`, (t) => {
    const fixture = checkoutFixture(t)
    fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(combinedLabelGroups)
    assert.equal(verify(t, fixture, phase).status, 'passed')
  })
}

test('31F rejects historical standalone evidence without the combined workflow', (t) => {
  const fixture = checkoutFixture(t)
  fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(settledExportGroups)
  const error = failedVerification(t, fixture, '31F')
  assert.match(error.message, /Phase 31F.*12 required groups/)
  assert.equal(error.report.checks.at(-1).exitCode, 0)
  assert.equal(verificationMatchesCheckout(error.report, fixture), false)
})

for (const missing of [inlineLabelGroups, ...inlineLabelGroups.map(group => [group])]) {
  test(`31D rejects exit-zero evidence missing ${missing.join(' and ')}`, (t) => {
    const fixture = checkoutFixture(t)
    fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(allLabelGroups.filter(group => !missing.includes(group)))
    const error = failedVerification(t, fixture, '31D')
    assert.match(error.message, /Phase 31D.*10 required groups/)
    assert.equal(error.report.checks.at(-1).exitCode, 0, 'The command succeeds but its evidence fails')
    assert.equal(error.report.checks.at(-1).status, 'failed')
    assert.equal(verificationMatchesCheckout(error.report, fixture), false)
  })
}

for (const phase of ['31C', '31D']) {
  for (const [name, override] of [
    ['duplicate group', { completed: [...allLabelGroups, allLabelGroups[0]] }],
    ['unsupported group', { completed: [...allLabelGroups, 'unsupported-group'] }],
    ['incomplete group', { incompleteGroups: [inlineLabelGroups[0]] }],
    ['unexecuted group', { unexecuted: [inlineLabelGroups[1]] }],
    ['browser error', { pageErrors: ['Uncaught fixture error'] }],
    ['missing completion list', { completed: null }],
    ['missing browser identity', { environment: { browserVersion: '' } }],
    ['unfinished stage', { stage: 'inline-node-rendering' }],
    ['failed result', { result: 'failed' }],
  ]) {
    test(`${phase} rejects ${name} even when the browser command exits zero`, (t) => {
      const fixture = checkoutFixture(t)
      fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(allLabelGroups)
      fixture.env.STZ_TEST_FREE_EVIDENCE_OVERRIDE = JSON.stringify(override)
      const error = failedVerification(t, fixture, phase)
      assert.match(error.message, /check:free-labels evidence is incomplete or invalid/)
      const check = error.report.checks.at(-1)
      assert.equal(check.status, 'failed')
      assert.equal(check.exitCode, 0)
      assert.equal(readFileSync(check.exitStatusPath, 'utf8'), '0\n')
      assert.equal(storedReport(error.report).status, 'failed')
      assert.equal(verificationMatchesCheckout(error.report, fixture), false)
    })
  }
}

for (const group of inlineLabelGroups) {
  test(`31C rejects a partially executed inline extension containing only ${group}`, (t) => {
    const fixture = checkoutFixture(t)
    fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify([...freeLabelGroups, group])
    const error = failedVerification(t, fixture, '31C')
    assert.match(error.message, /only complete supported group sets/)
    assert.equal(error.report.checks.at(-1).exitCode, 0)
  })
}

test('31D preserves a nonzero browser exit even when earlier checks succeed', (t) => {
  const fixture = checkoutFixture(t)
  fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(allLabelGroups)
  fixture.env.STZ_TEST_FAIL_COMMAND = 'run check:free-labels'
  fixture.env.STZ_TEST_EXIT_CODE = '17'
  const error = failedVerification(t, fixture, '31D')
  assert.equal(error.exitCode, 17)
  assert.equal(error.report.status, 'failed')
  assert.equal(error.report.checks.at(-1).exitCode, 17)
})

for (const command of ['test', 'run build']) {
  test(`${command} failure stops later checks and preserves command diagnostics`, (t) => {
    const fixture = checkoutFixture(t)
    fixture.env.STZ_TEST_FAIL_COMMAND = command
    fixture.env.STZ_TEST_EXIT_CODE = '17'
    const error = failedVerification(t, fixture, '31C')
    assert.equal(error.exitCode, 17)
    assert.equal(error.report.status, 'failed')
    assert.deepEqual(fixture.commands().map(({ args }) => args.join(' ')), command === 'test' ? ['test'] : ['test', 'run build'])
    const failedCheck = error.report.checks.at(-1)
    assert.equal(failedCheck.exitCode, 17)
    assert.match(readFileSync(failedCheck.logPath, 'utf8'), /fixture stderr:/)
  })
}

test('whitespace errors fail before any browser starts', (t) => {
  const fixture = checkoutFixture(t)
  writeFileSync(join(fixture.cwd, 'tracked.txt'), 'bad trailing whitespace  \n')
  const error = failedVerification(t, fixture, '31C')
  assert.equal(error.report.checks.at(-1).name, 'git-diff-check')
  assert.match(readFileSync(error.report.checks.at(-1).logPath, 'utf8'), /trailing whitespace/)
  assert.equal(fixture.commands().some(({ args }) => args[1]?.startsWith('check:')), false)
})

test('checkout identity includes current untracked contents and changes invalidate saved evidence', (t) => {
  const fixture = checkoutFixture(t)
  const untracked = join(fixture.cwd, 'browser fixture 日本語.txt')
  writeFileSync(untracked, 'original fixture\n')
  const report = verify(t, fixture, '31C')
  const initial = captureCheckoutIdentity(fixture)
  assert.equal(verificationMatchesCheckout(report, fixture), true)

  writeFileSync(untracked, 'updated fixture\n')
  assert.notDeepEqual(captureCheckoutIdentity(fixture), initial)
  assert.equal(verificationMatchesCheckout(report, fixture), false, 'Same-name untracked fixture changes invalidate acceptance')
  writeFileSync(untracked, 'original fixture\n')
  assert.equal(verificationMatchesCheckout(report, fixture), true)

  writeFileSync(join(fixture.cwd, 'tracked.txt'), 'updated source\n')
  assert.equal(verificationMatchesCheckout(report, fixture), false)
  fixture.git('add', 'tracked.txt')
  assert.equal(verificationMatchesCheckout(report, fixture), false, 'Staged changes must also invalidate acceptance')
})

for (const phase of ['31B', '31D']) {
  test(`${phase} verification rejects source mutations during the checks`, (t) => {
    const fixture = checkoutFixture(t)
    fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(allLabelGroups)
    fixture.env.STZ_TEST_CHANGE_CHECKOUT = 'true'
    const error = failedVerification(t, fixture, phase)
    assert.match(error.message, /checkout changed/i)
    assert.equal(error.report.status, 'failed')
    assert.equal(storedReport(error.report).status, 'failed')
  })
}

test('32B preserves its original groups and scenarios and requires namespace and responsive paint evidence', () => {
  assert.equal(pointGroups.length, 16)
  assert.equal(Object.values(pointNodeScenarios).flat().length, 29)
  assert.deepEqual(pointNodeScenarios['point-node-paint-import-persistence'], [
    'point-paint-native-inspector-history', 'point-paint-imported-presets-persistence',
    'point-paint-lifecycle-dimming', 'point-paint-pending-transparent-edit',
    'point-paint-pending-white-load', ...targetedPaintScenarios,
  ])
  const namespace = pointNodeScenarioArtifacts('point-paint-namespace-aliases')
  assert.equal(namespace.length, 16)
  assert.equal(namespace[0], 'point-paint-namespace-aliases.json')
  for (const name of ['shadowing', 'missing', 'aliases']) {
    for (const suffix of ['.sty', '-saved.json', '-edited.json', '-standalone.tex', '-inlineMath.tex']) {
      assert.ok(namespace.includes(`point-paint-namespace-${name}${suffix}`))
    }
  }
  for (const shape of ['circle', 'triangle']) {
    const artifacts = pointNodeScenarioArtifacts(`point-paint-responsive-${shape}`)
    assert.equal(artifacts.length, shape === 'circle' ? 31 : 25)
    for (const scale of ['0.5', '2']) {
      for (const variant of ['', '-non-scaling', '-disabled', '-transparent', ...(shape === 'circle' ? ['-dashed'] : [])]) {
        for (const extension of ['json', 'svg', 'png']) {
          assert.ok(artifacts.includes(`point-paint-responsive-${shape}-scale-${scale}${variant}.${extension}`))
        }
      }
    }
  }
  const downloads = pointNodeScenarioArtifacts('point-paint-responsive-downloads')
  assert.equal(downloads.length, 91)
  assert.equal(downloads[0], 'point-paint-responsive-downloads.json')
  for (const background of ['transparent', 'white']) for (const shape of ['', '-triangle', '-dashed']) {
    const stem = `point-paint-responsive-${background}${shape}`
    for (const suffix of ['.svg', '-body-baseline.json', '-body-controls.json']) {
      assert.ok(downloads.includes(`${stem}${suffix}`))
    }
    for (const capture of ['scale-0.5', 'scale-2', 'return-scale-0.5']) for (const suffix of ['.json', '.png', '-full.png', '.raster.svg']) {
      assert.ok(downloads.includes(`${stem}-${capture}${suffix}`))
    }
  }
  for (const name of importRegressionScenarios) {
    const artifacts = pointNodeScenarioArtifacts(name)
    assert.equal(artifacts.length, name === 'point-paint-cross-file-resolution' ? 15 : 10)
    for (const suffix of ['.json', '-saved.json', '.svg', '.png', '-standalone.json', '-standalone.tex', '-inlineMath.tex']) {
      assert.ok(artifacts.includes(`${name}${suffix}`))
    }
  }
})
test('point SVG artifact gate accepts sanitized structure and rejects absent/damaged bodies and contours', () => {
  const body = '<g><title>literal &lt;source&gt;</title><g><g><text x="0" y="0">literal</text></g></g></g>'
  assert.equal(hasWholePointSvg(`<svg><g><circle r="20"/>${body}</g></svg>`), true)
  assert.equal(hasWholePointSvg(`<svg><g><polygon points="0,0 20,0 0,20"/>${body}</g></svg>`), true)
  for (const broken of [
    '<svg><g data-point-node="fixture"><circle data-point-contour="true"/></g></svg>',
    `<svg><g>${body}</g></svg>`, `<svg><circle r="20"/>${body}</svg>`,
    `<svg><g><circle r="20"/>${body}</svg>`, '<svg><g><circle/><g><title>absent ink</title></g></g></svg>',
    `<!-- <g><circle/>${body}</g> --><svg/>`,
  ]) assert.equal(hasWholePointSvg(broken), false, broken)
})
for (const background of ['transparent', 'white']) {
  for (const boundary of ['baseline', 'saved', 'scale-0.5', 'scale-2', 'return-scale-0.5']) {
    for (const fault of ['missing-mode', 'wrong-mode', ...(boundary === 'baseline' ? [] : ['missing-background', 'empty-background'])]) {
      test(`32B requires ${background} background evidence at ${boundary}: ${fault}`, (t) => {
        const fixture = checkoutFixture(t)
        completePointEvidence(fixture)
        const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
        const entry = artifacts['point-paint-responsive-downloads.json'].cases.find((sample) => sample.background === background)
        const target = boundary === 'baseline' ? entry.baseline : boundary === 'saved' ? entry.baseline.saved
          : boundary === 'return-scale-0.5' ? entry.returnScale.bodyObservation.structure
            : entry.scales.find((sample) => `scale-${sample.scale}` === boundary).bodyObservation.structure
        if (fault === 'missing-mode') delete target.expectedBackground
        if (fault === 'wrong-mode') target.expectedBackground = background === 'white' ? 'transparent' : 'white'
        if (fault === 'missing-background') delete target.exportBackground
        if (fault === 'empty-background') target.exportBackground = {}
        fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
        assert.throws(() => verify(t, fixture, '32B'), /evidence is incomplete or invalid/)
      })
    }
  }
}

for (const fault of [
  'missing-baseline', 'empty-baseline', 'missing-baseline-fixture', 'missing-baseline-structure', 'changed-file', 'unrestored-document',
  'missing-body-observation', 'empty-body-observation', 'missing-body-structure', 'unchecked-body',
  'missing-return-scale', 'wrong-return-scale', 'wrong-return-shape', 'unchecked-return-body',
  'missing-return-body-observation', 'extra-original-scale', 'mixed-case-scales',
  'unstable-capture', 'unrestored-literal', 'unready-literal-font', 'unchecked-literal-font',
  'unrestored-settling', 'unsettled-fonts', 'missing-leaf-font', 'unready-leaf-font', 'unchecked-leaf-font',
  'missing-control', 'duplicate-control', 'accepted-control', 'missing-control-reason', 'wrong-control-reason', 'unrestored-control',
]) {
  test(`32B rejects partial responsive body evidence: ${fault}`, (t) => {
    const fixture = checkoutFixture(t)
    completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    const downloads = artifacts['point-paint-responsive-downloads.json']
    const entry = downloads.cases[0]
    if (fault === 'missing-baseline') delete entry.baseline
    if (fault === 'empty-baseline') entry.baseline = {}
    if (fault === 'missing-baseline-fixture') delete entry.baseline.fixture
    if (fault === 'missing-baseline-structure') delete entry.baseline.saved
    if (fault === 'changed-file') entry.fileUnchanged = false
    if (fault === 'unrestored-document') entry.documentRestored = false
    if (fault === 'missing-body-observation') delete entry.scales[0].bodyObservation
    if (fault === 'empty-body-observation') entry.scales[1].bodyObservation = {}
    if (fault === 'missing-body-structure') delete entry.returnScale.bodyObservation.structure
    if (fault === 'unchecked-body') entry.scales[1].bodyContractPassed = false
    if (fault === 'missing-return-scale') delete entry.returnScale
    if (fault === 'wrong-return-scale') entry.returnScale.scale = 2
    if (fault === 'wrong-return-shape') entry.returnScale.shape = 'triangle'
    if (fault === 'unchecked-return-body') entry.returnScale.bodyContractPassed = false
    if (fault === 'missing-return-body-observation') delete entry.returnScale.bodyObservation
    if (fault === 'extra-original-scale') entry.scales.push(entry.returnScale)
    if (fault === 'mixed-case-scales') [entry.scales[0], downloads.cases[1].scales[0]] = [downloads.cases[1].scales[0], entry.scales[0]]
    if (fault === 'unstable-capture') entry.scales[0].output.capture.coordinatesStable = false
    if (fault === 'unrestored-literal') entry.scales[0].bodyObservation.literal.documentUnchanged = false
    if (fault === 'unready-literal-font') entry.scales[1].bodyObservation.literal.fontReadiness.status = 'loading'
    if (fault === 'unchecked-literal-font') entry.returnScale.bodyObservation.literal.fontReadiness.checked = false
    if (fault === 'unrestored-settling') entry.scales[0].bodyObservation.settling.documentUnchanged = false
    if (fault === 'unsettled-fonts') entry.returnScale.bodyObservation.settling.status = 'loading'
    if (fault === 'missing-leaf-font') entry.scales[1].bodyObservation.settling.leaves = []
    if (fault === 'unready-leaf-font') entry.scales[0].bodyObservation.settling.leaves[0].readiness.status = 'loading'
    if (fault === 'unchecked-leaf-font') entry.returnScale.bodyObservation.settling.leaves[0].readiness.checked = false
    if (fault === 'missing-control') entry.negativeControls.pop()
    if (fault === 'duplicate-control') entry.negativeControls[1] = entry.negativeControls[0]
    if (fault === 'accepted-control') entry.negativeControls[0].rejected = false
    if (fault === 'missing-control-reason') entry.negativeControls[1].reason = ''
    if (fault === 'wrong-control-reason') entry.negativeControls[0].reason = entry.negativeControls[2].reason
    if (fault === 'unrestored-control') entry.negativeControls[2].documentUnchanged = false
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    assert.throws(() => verify(t, fixture, '32B'), /evidence is incomplete or invalid/)
  })
}
for (const phase of ['32A', '32B', '32C', '32D']) {
  test(`${phase} requires cumulative implemented point scenarios and accepts complete evidence`, (t) => {
    assert.deepEqual(browserChecksForPhase(phase), ['check:label-assets', 'check:free-labels'])
    const fixture = checkoutFixture(t)
    completePointEvidence(fixture)
    if (phase === '32A' || phase === '32B') assert.equal(verify(t, fixture, phase).status, 'passed')
    else assert.throws(() => verify(t, fixture, phase), phase === '32D' ? /18 required groups/ : /17 required groups/)
  })
  test(`${phase} rejects an otherwise successful Phase 31F report`, (t) => {
    const fixture = checkoutFixture(t)
    fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(combinedLabelGroups)
    assert.throws(() => verify(t, fixture, phase), phase === '32A' ? /15 required groups/ : phase === '32B' ? /16 required groups/ : phase === '32D' ? /18 required groups/ : /17 required groups/)
  })
}
for (const fault of ['scenarios', 'terminal', 'identity', 'artifacts', 'corrupt-artifacts', 'page-error']) {
  test(`32A rejects exit-zero point evidence with missing ${fault}`, (t) => {
    const fixture = checkoutFixture(t)
    const evidence = completePointEvidence(fixture)
    if (fault === 'scenarios') evidence.evidence.shift()
    if (fault === 'terminal') evidence.evidence[0].result = 'started'
    if (fault === 'identity') evidence.checkout.trackedDiffSha256 = 'obsolete'
    if (fault === 'artifacts') fixture.env.STZ_TEST_POINT_ARTIFACTS = 'no'
    if (fault === 'corrupt-artifacts') fixture.env.STZ_TEST_POINT_CORRUPT = 'yes'
    if (fault === 'page-error') evidence.pageErrors = ['unhandled rejection']
    fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
    assert.throws(() => verify(t, fixture, '32A'), /incomplete or invalid/)
  })
}

for (const phase of ['32B', '32C', '32D']) {
  test(`${phase} rejects complete 32A evidence that omits new paint scenarios`, (t) => {
    const fixture = checkoutFixture(t)
    const evidence = completePointEvidence(fixture)
    fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(pointGroups.filter((group) => group !== 'point-node-paint-import-persistence'))
    evidence.evidence = evidence.evidence.filter((entry) => entry.group !== 'point-node-paint-import-persistence')
    fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
    assert.throws(() => verify(t, fixture, phase), phase === '32B' ? /16 required groups/ : phase === '32D' ? /18 required groups/ : /17 required groups/)
  })
}
test('32A continues accepting its complete pre-paint group and scenario set', (t) => {
  const fixture = checkoutFixture(t)
  const evidence = completePointEvidence(fixture)
  fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(pointGroups.filter((group) => group !== 'point-node-paint-import-persistence'))
  evidence.evidence = evidence.evidence.filter((entry) => entry.group !== 'point-node-paint-import-persistence')
  fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
  assert.equal(verify(t, fixture, '32A').status, 'passed')
})
for (const fault of ['missing-scenario', 'started-only', 'checkout', 'missing-artifact', 'page-error']) {
  test(`32B rejects exit-zero paint evidence: ${fault}`, (t) => {
    const fixture = checkoutFixture(t)
    const evidence = completePointEvidence(fixture)
    const index = evidence.evidence.findIndex((entry) => entry.name === 'point-paint-pending-transparent-edit')
    if (fault === 'missing-scenario') evidence.evidence.splice(index, 1)
    if (fault === 'started-only') evidence.evidence[index].result = 'started'
    if (fault === 'checkout') evidence.checkout.untrackedSha256['paint-fixture.ts'] = 'wrong-checkout'
    if (fault === 'missing-artifact') evidence.evidence[index].artifacts = ['point-paint-pending-transparent-edit.json']
    if (fault === 'page-error') evidence.pageErrors = ['paint rejected']
    fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
    assert.throws(() => verify(t, fixture, '32B'), /incomplete or invalid/)
  })
}

test('32A cannot advertise a completed paint extension with missing paint scenarios', (t) => {
  const fixture = checkoutFixture(t)
  const evidence = completePointEvidence(fixture)
  evidence.evidence = evidence.evidence.filter((entry) => entry.group !== 'point-node-paint-import-persistence')
  fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
  assert.throws(() => verify(t, fixture, '32A'), /Missing completed point-node scenario/)
})

test('32B rejects the previously accepted sixteen-scenario paint report after targeted fixes', (t) => {
  const fixture = checkoutFixture(t)
  const evidence = completePointEvidence(fixture)
  evidence.evidence = evidence.evidence.filter((entry) => !targetedPaintScenarios.includes(entry.name))
  fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
  assert.throws(() => verify(t, fixture, '32B'), /Missing completed point-node scenario: point-paint-namespace-aliases/)
})

test('32B rejects the accepted twenty-scenario pre-fix report without all three review reproductions', (t) => {
  const fixture = checkoutFixture(t)
  const evidence = completePointEvidence(fixture)
  evidence.evidence = evidence.evidence.filter((entry) => !importRegressionScenarios.includes(entry.name))
  fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
  assert.throws(() => verify(t, fixture, '32B'), /Missing completed point-node scenario: point-paint-local-override-intent/)
})

test('32B rejects accepted 23-scenario evidence lacking both new defect checks', (t) => {
  const fixture = checkoutFixture(t), evidence = completePointEvidence(fixture)
  evidence.evidence = evidence.evidence.filter((entry) => !correctionScenarios.includes(entry.name))
  fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
  assert.throws(() => verify(t, fixture, '32B'), /Missing completed point-node scenario: point-paint-unsupported-mutations/)
})

test('32B rejects historical 25-scenario evidence without directory uncertainty and App continuity', (t) => {
  const fixture = checkoutFixture(t), evidence = completePointEvidence(fixture)
  evidence.evidence = evidence.evidence.filter((entry) => !continuityScenarios.includes(entry.name))
  fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
  assert.throws(() => verify(t, fixture, '32B'), /Missing completed point-node scenario: point-paint-mutation-directory-uncertainty/)
})

for (const fault of ['false-green', 'missing-inline', 'missing-unresolved', 'lost-source', 'lost-warning', 'lost-reference-warning',
  'invalid-model', 'lost-local-intent', 'changed-reference', 'affected-independent', 'lost-history', 'changed-redo', 'missing-source-artifact']) {
  test(`32B rejects incomplete runtime-directory mutation evidence: ${fault}`, (t) => {
    const fixture = checkoutFixture(t), evidence = completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    const entry = artifacts['point-paint-mutation-directory-uncertainty.json']
    if (fault === 'false-green') entry.directory.output.standalone = entry.directory.output.standalone.replace('outer,', 'outer,text=green,')
    if (fault === 'missing-inline') delete entry.reloaded.output.inlineMath
    if (fault === 'missing-unresolved') entry.reloaded.modelDiagnostics.resolution.unresolvedFields = []
    if (fault === 'lost-source') entry.back.diagram.externalTikzStyleSources = []
    if (fault === 'lost-warning') entry.directory.warnings = []
    if (fault === 'lost-reference-warning') entry.directory.modelDiagnostics.reference.previewDiagnostics = []
    if (fault === 'invalid-model') entry.redone.modelDiagnostics.validation.valid = false
    if (fault === 'lost-local-intent') entry.back.current.style.importedPaint.overriddenFields = []
    if (fault === 'changed-reference') entry.reloaded.current.importedTikzStyleReferenceId = 'replacement'
    if (fault === 'affected-independent') entry.independent.modelDiagnostics.resolution.unresolvedFields = ['textColor']
    if (fault === 'lost-history') entry.back.state.history = entry.away.state.history
    if (fault === 'changed-redo') entry.redone.current.style.paint.text.color = '#000000'
    if (fault === 'missing-source-artifact') {
      const record = evidence.evidence.find((item) => item.name === entry.scenario)
      record.artifacts = record.artifacts.filter((name) => !name.endsWith('-directory-mutation.sty'))
      fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
    }
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    assert.throws(() => verify(t, fixture, '32B'), /incomplete or invalid/)
  })
}

for (const fault of ['missing-transition', 'wrong-owner', 'new-document', 'missing-api', 'changed-history', 'lost-helper-model',
  'lost-after-controls', 'unclosed-svg', 'missing-lifecycle', 'missing-control', 'wrong-failure-owner', 'unbounded-dom',
  'wrong-screenshot', 'same-generation-reload', 'missing-api-control-artifact']) {
  test(`32B rejects incomplete owned App continuity evidence: ${fault}`, (t) => {
    const fixture = checkoutFixture(t), evidence = completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    const entry = artifacts['point-paint-app-continuity.json']
    if (fault === 'missing-transition') entry.transitions.pop()
    if (fault === 'wrong-owner') entry.transitions[0].after.pageId = 'renderer-page'
    if (fault === 'new-document') entry.transitions[0].after.document.generation = 'new-generation'
    if (fault === 'missing-api') entry.helperReturn.document.api.type = 'undefined'
    if (fault === 'changed-history') entry.transitions[0].after.state.history = '{"reset":true}'
    if (fault === 'lost-helper-model') entry.helperReturn.state.runtimeDiagramJson = '{"reset":true}'
    if (fault === 'lost-after-controls') delete entry.afterControls
    if (fault === 'unclosed-svg') entry.transitions[0].standalonePages[0].closed = false
    if (fault === 'missing-lifecycle') artifacts['point-paint-app-lifecycle.json'].events = []
    if (fault === 'missing-control') entry.controls.pop()
    if (fault === 'wrong-failure-owner') entry.controls[0].evidence.snapshot.pageId = 'renderer-page'
    if (fault === 'unbounded-dom') entry.controls[0].evidence.snapshot.document.dom.bytes = 1_000_000
    if (fault === 'wrong-screenshot') entry.controls[0].evidence.screenshot = 'failure.png'
    if (fault === 'same-generation-reload') entry.controls[2].evidence.snapshot.document.generation = entry.controls[2].before.document.generation
    if (fault === 'missing-api-control-artifact') {
      const record = evidence.evidence.find((item) => item.name === entry.scenario)
      record.artifacts = record.artifacts.filter((name) => !name.endsWith('control-missing-api-failure.png'))
      fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
    }
    // Keep redundant records consistent, so ownership/content checks (rather
    // than only an equality comparison of two files) must reject the fault.
    artifacts['point-paint-app-transitions.json'].transitions = entry.transitions
    artifacts['point-paint-app-controls.json'].controls = entry.controls
    for (const control of entry.controls) artifacts[`point-paint-app-control-${control.fault}-failure.json`] = control.evidence
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    assert.throws(() => verify(t, fixture, '32B'), /incomplete or invalid/)
  })
}

for (const boundary of ['mutation', 'away', 'back', 'undone', 'redone', 'reloaded']) {
  for (const fault of ['missing-reference', 'missing-diagnostic', 'missing-unresolved', 'missing-source', 'false-validity', 'claimed-text', 'missing-inline']) {
    test(`32B requires retained unsupported mutation uncertainty: ${boundary} ${fault}`, (t) => {
      const fixture = checkoutFixture(t)
      completePointEvidence(fixture)
      const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
      const entry = artifacts['point-paint-unsupported-mutations.json'][boundary]
      if (fault === 'missing-reference') delete entry.current.importedTikzStyleReferenceId
      if (fault === 'missing-diagnostic') entry.modelDiagnostics.reference.previewDiagnostics = []
      if (fault === 'missing-unresolved') entry.modelDiagnostics.resolution.unresolvedFields = ['fillColor']
      if (fault === 'missing-source') entry.diagram.externalTikzStyleSources = []
      if (fault === 'false-validity') entry.modelDiagnostics.validation.valid = false
      if (fault === 'claimed-text') entry.output.standalone = entry.output.standalone.replace('myPoint,', 'myPoint,text=red,')
      if (fault === 'missing-inline') delete entry.output.inlineMath
      fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
      assert.throws(() => verify(t, fixture, '32B'), /evidence is incomplete or invalid/)
    })
  }
}
test('32B synthetic Clear policy preserves explicit layout and restores imported provenance on undo', (t) => {
  const fixture = checkoutFixture(t)
  completePointEvidence(fixture)
  const clear = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)['point-paint-clear-imported-style.json']
  assert.equal(clear.evidenceKind, 'synthetic-policy')
  for (const kind of ['single', 'multiple']) {
    const entry = clear[kind]
    assert.equal(entry.evidenceKind, 'synthetic-policy')
    for (const { current: original } of entry.before.points) {
      const { layout, importedLayout } = original.style
      assert.ok(layout.innerXSep > importedLayout.baseline.innerXSep, 'Fixture contains a deliberate local axis override')
      assert.deepEqual(importedLayout.overriddenFields, ['innerXSep'])
      assert.equal(importedLayout.referenceId, original.importedTikzStyleReferenceId)
      assert.equal(layout.units.innerXSep.unit, 'em')
      assert.equal(layout.units.innerYSep.unit, 'ex')
      assert.notDeepEqual(layout.units.innerXSep.fontContext, layout.units.innerYSep.fontContext)
      for (const boundary of ['cleared', 'redone', 'reloaded']) {
        const actual = entry[boundary].points.find((point) => point.current.id === original.id).current
        assert.deepEqual(actual.style.layout, layout, `Explicit layout survives ${kind} ${boundary}`)
        if (entry.ids.includes(original.id)) assert.equal(Object.hasOwn(actual.style, 'importedLayout'), false)
        else assert.deepEqual(actual, original, 'Unselected layout and provenance remain exact')
      }
      assert.deepEqual(entry.undone.points.find((point) => point.current.id === original.id).current, original,
        'Undo restores the exact original layout baseline and override metadata')
    }
  }
  assert.equal(verify(t, fixture, '32B').status, 'passed')
})

for (const kind of ['single', 'multiple']) for (const boundary of ['cleared', 'redone', 'reloaded']) {
  for (const fault of ['retained-reference', 'retained-provenance', 'retained-layout-provenance', 'retained-preset',
    'changed-paint', 'changed-control', 'changed-layout', 'dropped-layout', 'changed-layout-units', 'changed-layout-context',
    'changed-control-layout', 'changed-control-layout-provenance', 'false-validity', 'missing-preview', 'wrong-target-output']) {
    test(`32B synthetic policy requires explicit detached state: ${kind} ${boundary} ${fault}`, (t) => {
      const fixture = checkoutFixture(t)
      completePointEvidence(fixture)
      const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
      const regression = artifacts['point-paint-clear-imported-style.json'][kind]
      const entry = regression[boundary], target = entry.points[0]
      if (fault === 'retained-reference') target.current.importedTikzStyleReferenceId = 'reference'
      if (fault === 'retained-provenance') target.current.style.importedPaint = { referenceId: 'reference' }
      if (fault === 'retained-layout-provenance') target.current.style.importedLayout = structuredClone(regression.before.points[0].current.style.importedLayout)
      if (fault === 'retained-preset') target.current.stylePresetId = 'preset'
      if (fault === 'changed-paint') target.current.style.paint.stroke.dashPhase = 8
      if (fault === 'changed-control') entry.points[2].current.style.paint.text.color = '#0000ff'
      if (fault === 'changed-layout') target.current.style.layout.innerXSep += 1
      if (fault === 'dropped-layout') delete target.current.style.layout
      if (fault === 'changed-layout-units') target.current.style.layout.units.innerXSep.source = '2em'
      if (fault === 'changed-layout-context') target.current.style.layout.units.innerYSep.fontContext.xHeightPt += 1
      if (fault === 'changed-control-layout') entry.points[2].current.style.layout.anchor = 'north east'
      if (fault === 'changed-control-layout-provenance') entry.points[2].current.style.importedLayout.overriddenFields = []
      if (fault === 'false-validity') entry.modelDiagnostics.validation.valid = false
      if (fault === 'missing-preview') delete target.observation
      if (fault === 'wrong-target-output') entry.output.inlineMath = entry.output.inlineMath.replace('text=text0', 'text=fill0')
      synchronizeClearSnapshot(entry)
      fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
      const expectedFailure = fault === 'retained-layout-provenance' ? /Clear removes imported layout provenance/
        : fault.includes('layout') ? /Clear preserves explicit point data and unselected controls/
          : /evidence is incomplete or invalid/
      assert.throws(() => verify(t, fixture, '32B'), expectedFailure)
    })
  }
}
for (const fault of ['missing-single', 'missing-multi', 'missing-action', 'missing-history', 'extra-history', 'changed-earlier-history', 'undo-lost-reference',
  'undo-lost-layout-provenance', 'missing-reload', 'missing-svg', 'missing-second-svg', 'svg-paint', 'svg-error']) {
  test(`32B synthetic policy rejects incomplete clear workflow evidence: ${fault}`, (t) => {
    const fixture = checkoutFixture(t)
    completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    const clear = artifacts['point-paint-clear-imported-style.json'], entry = clear.multiple
    if (fault === 'missing-single') delete clear.single
    if (fault === 'missing-multi') delete clear.multiple
    if (fault === 'missing-action') delete entry.nativeAction
    if (fault === 'missing-history') delete entry.cleared.state.history
    if (fault === 'extra-history') entry.cleared.state.history = JSON.stringify({ past: [{}, {}, {}] })
    if (fault === 'changed-earlier-history') entry.cleared.state.history = JSON.stringify({ past: [{ changed: true }, {}] })
    if (fault === 'undo-lost-reference') delete entry.undone.points[0].current.importedTikzStyleReferenceId
    if (fault === 'undo-lost-layout-provenance') delete entry.undone.points[0].current.style.importedLayout
    if (fault.startsWith('undo-')) synchronizeClearSnapshot(entry.undone)
    if (fault === 'missing-reload') delete entry.reload
    if (fault === 'missing-svg') delete entry.standalone
    if (fault === 'missing-second-svg') entry.standalone.points = []
    if (fault === 'svg-paint') entry.standalone.observation.contour.strokeWidth = .4
    if (fault === 'svg-error') entry.standalone.pageErrors.push('page error')
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    assert.throws(() => verify(t, fixture, '32B'), fault === 'undo-lost-layout-provenance'
      ? /Native undo restores imported points/ : /evidence is incomplete or invalid/)
  })
}

// Exercise the verification policy with synthetic histories at the production
// capacity. This fake-npm fixture does not claim native undo/redo acceptance.
function boundedClearHistories(entry, pastCount) {
  const before = { past: Array.from({ length: pastCount }, (_, index) => ({ retained: index })),
    present: { clear: 'before', ids: entry.ids }, future: [{ discarded: 'redo branch' }] }
  const committed = { past: [...before.past, before.present].slice(-100),
    present: { clear: 'after', ids: entry.ids }, future: [] }
  entry.before.state.history = JSON.stringify(before)
  entry.cleared.state.history = JSON.stringify(committed)
  return { before, committed }
}

for (const pastCount of [99, 100]) {
  test(`32B policy accepts one native clear at ${pastCount} prior snapshots using synthetic evidence`, (t) => {
    const fixture = checkoutFixture(t)
    completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    const clear = artifacts['point-paint-clear-imported-style.json']
    for (const kind of ['single', 'multiple']) boundedClearHistories(clear[kind], pastCount)
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    assert.equal(verify(t, fixture, '32B').status, 'passed')
  })

  for (const fault of ['no-op', 'extra-commit', 'changed-retained-snapshot', 'missing-previous-present',
    'wrong-previous-present', 'missing-before-present', 'missing-after-present', 'retained-future']) {
    test(`32B policy rejects ${fault} at ${pastCount} prior clear snapshots`, (t) => {
      const fixture = checkoutFixture(t)
      completePointEvidence(fixture)
      const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
      const entry = artifacts['point-paint-clear-imported-style.json'].multiple
      const { before, committed } = boundedClearHistories(entry, pastCount)
      if (fault === 'no-op') committed.present = structuredClone(before.present)
      if (fault === 'extra-commit') committed.past = [...before.past, before.present, { extra: 'commit' }].slice(-100)
      if (fault === 'changed-retained-snapshot') committed.past[0] = { changed: 'retained snapshot' }
      if (fault === 'missing-previous-present') committed.past.pop()
      if (fault === 'wrong-previous-present') committed.past[committed.past.length - 1] = { wrong: 'previous present' }
      if (fault === 'missing-before-present') delete before.present
      if (fault === 'missing-after-present') delete committed.present
      if (fault === 'retained-future') committed.future = structuredClone(before.future)
      entry.before.state.history = JSON.stringify(before)
      entry.cleared.state.history = JSON.stringify(committed)
      fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
      assert.throws(() => verify(t, fixture, '32B'), /evidence is incomplete or invalid/)
    })
  }
}

for (const name of importRegressionScenarios) {
  for (const fault of ['missing-observation', 'missing-inline', 'wrong-final-paint', 'missing-history', 'missing-reload', 'page-error']) {
    test(`32B requires actual import defect evidence: ${name} ${fault}`, (t) => {
      const fixture = checkoutFixture(t)
      completePointEvidence(fixture)
      const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES), entry = artifacts[`${name}.json`]
      if (fault === 'missing-observation') delete entry.reloaded.observation
      if (fault === 'missing-inline') delete entry.reloaded.output.inlineMath
      if (fault === 'wrong-final-paint') entry.reloaded.output.standalone = entry.reloaded.output.standalone.replace(/\\definecolor\{fillColor\}\{HTML\}\{[^}]+\}/, '\\definecolor{fillColor}{HTML}{654321}')
      if (fault === 'missing-history') delete entry.reloaded.state.history
      if (fault === 'missing-reload') delete entry.reload
      if (fault === 'page-error') entry.standalone.pageErrors.push('SVG error')
      fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
      assert.throws(() => verify(t, fixture, '32B'), /evidence is incomplete or invalid/)
    })
  }
}

for (const boundary of ['untouched', 'away', 'back', 'undone', 'redone', 'reloaded', 'reset', 'settingsBefore', 'settingsFocusBlur', 'settingsBack']) {
  for (const fault of ['stale-red-after-key', 'missing-execution', 'missing-unresolved', 'missing-diagnostic', 'lost-reference-diagnostic', 'invented-text-intent']) {
    test(`32B executable value intent rejects ${boundary} ${fault}`, (t) => {
      const fixture = checkoutFixture(t)
      completePointEvidence(fixture)
      const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
      const entry = artifacts['point-paint-local-override-intent.json'][boundary]
      if (fault === 'stale-red-after-key') entry.output.inlineMath = '\\definecolor{staleRed}{HTML}{FF0000}\n'
        + entry.output.inlineMath.replace(`${entry.key},`, `${entry.key},text=staleRed,`)
      if (fault === 'missing-execution') delete entry.modelDiagnostics.resolution.executionUncertain
      if (fault === 'missing-unresolved') entry.modelDiagnostics.resolution.unresolvedFields = ['fillColor', 'lineWidth']
      if (fault === 'missing-diagnostic') entry.modelDiagnostics.resolution.diagnostics = []
      if (fault === 'lost-reference-diagnostic') entry.modelDiagnostics.reference.previewDiagnostics = []
      if (fault === 'invented-text-intent') entry.current.style.importedPaint.overriddenFields.push('text.color')
      fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
      assert.throws(() => verify(t, fixture, '32B'), /evidence is incomplete or invalid/)
    })
  }
}

for (const field of ['fillColor', 'fillEnabled', 'drawColor', 'drawEnabled', 'textColor', 'fillOpacity', 'drawOpacity',
  'textOpacity', 'lineWidth', 'dashPattern', 'dashPhase', 'lineCap', 'lineJoin']) {
  test(`32B executable value intent rejects reloaded certainty for ${field}`, (t) => {
    const fixture = checkoutFixture(t)
    completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    const resolution = artifacts['point-paint-local-override-intent.json'].reloaded.modelDiagnostics.resolution
    resolution.unresolvedFields = resolution.unresolvedFields.filter((value) => value !== field)
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    assert.throws(() => verify(t, fixture, '32B'), /evidence is incomplete or invalid/)
  })
}

for (const fault of ['claimed-unknown-fill', 'claimed-unknown-text', 'claimed-unknown-handler-paint', 'missing-runtime-uncertainty', 'missing-noncolor-return', 'missing-later-import', 'missing-prior-color', 'reversed-hints', 'missing-diagnostic',
  'missing-focus-blur', 'focus-blur-override', 'focus-blur-history', 'missing-focused-control', 'unblurred-control']) {
  test(`32B rejects incomplete import regression boundaries: ${fault}`, (t) => {
    const fixture = checkoutFixture(t)
    completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    const intent = artifacts['point-paint-local-override-intent.json'], cross = artifacts['point-paint-cross-file-resolution.json']
    const unsupported = artifacts['point-paint-unsupported-color-bindings.json']
    if (fault === 'claimed-unknown-fill') intent.untouched.output.inlineMath = intent.back.output.inlineMath
    if (fault === 'claimed-unknown-text') unsupported.back.output.standalone = unsupported.back.output.standalone.replace('myPoint,', 'myPoint,text=black,')
    if (fault === 'claimed-unknown-handler-paint') cross.missing.output.inlineMath = cross.missing.output.inlineMath.replace('outer,', 'outer,draw=blue,')
    if (fault === 'missing-runtime-uncertainty') delete cross.missing.modelDiagnostics.resolution.executionUncertain
    if (fault === 'missing-noncolor-return') delete intent.settingsBack
    if (fault === 'missing-later-import') delete cross.later
    if (fault === 'missing-prior-color') delete cross.priorColor
    if (fault === 'reversed-hints') cross.crossFile.output.standalone = cross.crossFile.output.standalone.replace('base.sty', 'temp.sty').replace('outer.sty', 'base.sty').replace('temp.sty', 'outer.sty')
    if (fault === 'missing-diagnostic') unsupported.unsupported.warnings = []
    if (fault === 'missing-focus-blur') delete intent.settingsFocusBlur
    if (fault === 'focus-blur-override') intent.settingsFocusBlur.current.style.importedPaint.overriddenFields = ['stroke.width']
    if (fault === 'focus-blur-history') intent.settingsFocusBlur.state.history = '{"past":[{}]}'
    if (fault === 'missing-focused-control') intent.settingsFocusBlur.focusBlurControls.pop()
    if (fault === 'unblurred-control') intent.settingsFocusBlur.focusBlurControls[0].blurred = false
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    assert.throws(() => verify(t, fixture, '32B'), /evidence is incomplete or invalid/)
  })
}

for (const name of targetedPaintScenarios) {
  for (const fault of ['missing-scenario', 'started-only', 'duplicate-scenario', 'missing-artifact']) {
    test(`32B rejects exit-zero targeted paint evidence: ${name} ${fault}`, (t) => {
      const fixture = checkoutFixture(t)
      const evidence = completePointEvidence(fixture)
      const index = evidence.evidence.findIndex((entry) => entry.name === name)
      if (fault === 'missing-scenario') evidence.evidence.splice(index, 1)
      if (fault === 'started-only') evidence.evidence[index].result = 'started'
      if (fault === 'duplicate-scenario') evidence.evidence.push(evidence.evidence[index])
      if (fault === 'missing-artifact') evidence.evidence[index].artifacts.pop()
      fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
      assert.throws(() => verify(t, fixture, '32B'), new RegExp(`Missing completed point-node scenario: ${name}`))
    })
  }
}

for (const fault of ['empty-json', 'started-json', 'missing-scale', 'duplicate-scale', 'accepted-negative-control', 'missing-download-background', 'missing-download-shape', 'missing-namespace-case', 'missing-namespace-reload', 'missing-namespace-inline-output']) {
  test(`32B rejects incomplete targeted JSON even with all named artifacts: ${fault}`, (t) => {
    const fixture = checkoutFixture(t)
    completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    const circle = artifacts['point-paint-responsive-circle.json']
    const downloads = artifacts['point-paint-responsive-downloads.json']
    const namespace = artifacts['point-paint-namespace-aliases.json']
    if (fault === 'empty-json') artifacts['point-paint-namespace-aliases.json'] = {}
    if (fault === 'started-json') circle.result = 'started'
    if (fault === 'missing-scale') circle.cases.pop()
    if (fault === 'duplicate-scale') circle.cases[1] = circle.cases[0]
    if (fault === 'accepted-negative-control') circle.cases[0].negativeControlRejected = false
    if (fault === 'missing-download-background') downloads.cases = downloads.cases.filter(({ background }) => background !== 'white')
    if (fault === 'missing-download-shape') downloads.cases = downloads.cases.filter(({ shape }) => shape !== 'triangle')
    if (fault === 'missing-namespace-case') namespace.cases.pop()
    if (fault === 'missing-namespace-reload') delete namespace.cases[0].editedReload
    if (fault === 'missing-namespace-inline-output') delete namespace.cases[1].reloadedOutput.inlineMath
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    assert.throws(() => verify(t, fixture, '32B'), /evidence is incomplete or invalid/)
  })
}


test('32B requires independent polygon join raster and native candidate/cycling evidence', (t) => {
  assert.equal(polygonJoinArtifacts().length, 105)
  assertPolygonJoinEvidence(polygonJoinEvidence())
  for (const [name, damage] of [
    ['nonempty body', (e) => { e.cases[0].observation.source = 'wide' }],
    ['pending body only', (e) => { e.cases[0].observation.bodyStatus = 'pending' }],
    ['changed point size', (e) => { e.cases[0].specification.size = 30 }],
    ['changed point shape', (e) => { e.cases[0].specification.shape = 'circle' }],
    ['convex control replaces concave star', (e) => { e.cases[4].observation.vertices.length = 3 }],
    ['convex decagon replaces concave star', (e) => { e.cases[4].observation.vertices = Array.from({ length: 10 }, (_, index) => ({ x: 10 * Math.cos(index * Math.PI / 5), y: 10 * Math.sin(index * Math.PI / 5) })) }],
    ['nonfinite vertices', (e) => { e.cases[0].observation.vertices[0].x = null }],
    ['missing exact probe', (e) => { e.cases[0].probes = e.cases[0].probes.filter((p) => p.kind !== 'exact') }],
    ['stale spurious candidate', (e) => { e.cases[0].probes.find((p) => p.kind === 'exact').actions[0].candidates.push('p') }],
    ['omitted ordinary click', (e) => { e.cases[0].probes[0].actions[0].alt = true }],
    ['incorrect native transform', (e) => { e.cases[0].probes[0].transform.ctm.e += 2 }],
    ['untrusted click', (e) => { e.cases[0].probes[0].actions[0].trusted = false }],
    ['missing concave case', (e) => { e.cases = e.cases.filter((c) => c.key !== 'star-bevel-wide') }],
    ['easy outside miss', (e) => { e.cases[0].probes.find((p) => p.kind === 'outside').rasterDistance = 12 }],
    ['missing actual miter tip', (e) => { e.cases[0].probes = e.cases[0].probes.filter((p) => p.kind !== 'miter-tip') }],
    ['missing actual bevel edge', (e) => { e.cases[2].probes = e.cases[2].probes.filter((p) => p.kind !== 'bevel-edge') }],
    ['ordinary miss hidden by Alt', (e) => { e.cases[0].probes.find((p) => p.kind === 'exact').actions[0].selection.id = 'p' }],
    ['forged bounds assertion', (e) => { e.cases[0].observation.declaredBounds[3] = 30 }],
    ['missing native raster bounds', (e) => { e.cases[0].observation.boundsMatch = false }],
  ]) {
    const fixture = checkoutFixture(t); completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    damage(artifacts[`${polygonJoinScenario}.json`])
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    const error = failedVerification(t, fixture, '32B')
    assert.equal(error.report.status, 'failed', name)
  }
})


test('32B retains previous 386 artifacts and requires the independent dash-cap native scenario', (t) => {
  assert.equal(Object.values(pointNodeScenarios).flat().flatMap(pointNodeScenarioArtifacts).length, 386 + dashCapArtifacts().length + dashCapMechanismArtifacts().length)
  const fixture = checkoutFixture(t); completePointEvidence(fixture)
  const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
  artifacts[`${dashCapScenario}.json`].cases[0].probes[0].actions[0].candidates = ['control']
  fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
  assert.equal(failedVerification(t, fixture, '32B').report.status, 'failed')
})


for (const fault of ['missing-grid', 'hidden-phantom', 'mismatched-audit-file']) {
  test(`32B native dash engine audit rejects ${fault}`, (t) => {
    const fixture = checkoutFixture(t); completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    const entry = artifacts[`${dashCapScenario}.json`].cases.find((entry) => entry.key === 'square-later-zero-phase-10')
    if (fault === 'missing-grid') entry.observation.engineAudit.samples.pop()
    if (fault === 'hidden-phantom') {
      entry.observation.engineAudit.samples.find((sample) => sample.expected === 'miss').candidates = ['p']
      entry.observation.engineAudit.mismatches = []
    }
    if (fault === 'mismatched-audit-file') artifacts[`${dashCapScenario}-${entry.key}-scale-${entry.scale}-engine-audit.json`].samples.pop()
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    assert.equal(failedVerification(t, fixture, '32B').report.status, 'failed')
  })
}

for (const fault of ['missing-matrix', 'unpassed-case', 'omitted-grid-cell', 'mismatched-case-file', 'rounded-source-file', 'changed-pattern-file', 'zero-cap-distance-mismatch', 'changed-connected-contour-hash']) {
  test(`32B cumulative native mechanism policy rejects ${fault}`, (t) => {
    const fixture = checkoutFixture(t); completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    const evidence = artifacts[`${dashCapMechanismStem}.json`], entry = evidence.cases[0]
    if (fault === 'missing-matrix') delete artifacts[`${dashCapMechanismStem}.json`]
    if (fault === 'unpassed-case') entry.result = 'observed'
    if (fault === 'omitted-grid-cell') entry.samples.pop()
    if (fault === 'mismatched-case-file') artifacts[`${dashCapMechanismStem}-${entry.key}.json`].samples.pop()
    if (fault === 'rounded-source-file') artifacts[`${dashCapMechanismStem}-${entry.key}.input.svg`] = '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="5,-5 -5,-5 -5,5 5,5"></polygon></svg>'
    if (fault === 'changed-pattern-file') artifacts[`${dashCapMechanismStem}-${entry.key}.input.svg`] = artifacts[`${dashCapMechanismStem}-${entry.key}.input.svg`].replace('stroke-dasharray="0 10"', 'stroke-dasharray="none"')
    if (fault === 'zero-cap-distance-mismatch') entry.samples.find((sample) => sample[9] === 'hit')[11] += 1
    if (fault === 'changed-connected-contour-hash') {
      const hash = '0'.repeat(64)
      entry.livePaint.contourSha256 = hash; entry.sameSettingScaleComparison.contourSha256 = hash
      for (const capture of entry.livePaint.captures) capture.contourSha256 = hash
      for (const capture of entry.sameSettingScaleComparison.captures) capture.contourSha256 = hash
      artifacts[`${dashCapMechanismStem}-${entry.key}.json`] = structuredClone(entry)
    }
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    assert.equal(failedVerification(t, fixture, '32B').report.status, 'failed')
  })
}

test('32B synthetic complete endpoint evidence includes new App witnesses and independently bound live captures', (t) => {
  const fixture = checkoutFixture(t); completePointEvidence(fixture)
  const report = verify(t, fixture, '32B')
  assert.equal(report.status, 'passed')
  assert.equal(Object.values(pointNodeScenarios).flat().flatMap(pointNodeScenarioArtifacts).length,
    386 + dashCapArtifacts().length + dashCapMechanismArtifacts().length)
})

for (const fault of ['missing-zero-off-App', 'missing-App-live', 'stale-App-live-PNG', 'missing-mechanism-live', 'stale-mechanism-live-PNG', 'stale-live-SVG', 'fabricated-live-calibration']) {
  test(`32B synthetic endpoint policy rejects ${fault}`, (t) => {
    const fixture = checkoutFixture(t); completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    const app = artifacts[`${dashCapScenario}.json`]
    const appEntry = app.cases.find((entry) => entry.key === 'square-zero-off')
    const mechanism = artifacts[`${dashCapMechanismStem}.json`]
    const mechanismEntry = mechanism.cases.find((entry) => entry.key === 'zero-off-continuous')
    if (fault === 'missing-zero-off-App') app.cases = app.cases.filter((entry) => entry !== appEntry)
    if (fault === 'missing-App-live') delete appEntry.observation.livePaint
    if (fault === 'stale-App-live-PNG') {
      const file = appEntry.observation.livePaint.captures[0].screenshot
      const bytes = Buffer.from(artifacts[file].syntheticPngBase64, 'base64'); bytes[24] ^= 1
      artifacts[file].syntheticPngBase64 = bytes.toString('base64')
    }
    if (fault === 'missing-mechanism-live') delete mechanismEntry.livePaint
    if (fault === 'stale-mechanism-live-PNG') {
      const file = mechanismEntry.livePaint.captures[0].file
      const bytes = Buffer.from(artifacts[file].syntheticPngBase64, 'base64'); bytes[24] ^= 1
      artifacts[file].syntheticPngBase64 = bytes.toString('base64')
    }
    if (fault === 'stale-live-SVG') {
      const file = mechanismEntry.livePaint.sourceFile
      artifacts[file] = artifacts[file].replace('stroke-width="36"', 'stroke-width="35"')
    }
    if (fault === 'fabricated-live-calibration') {
      mechanismEntry.livePaint.captures[1].pixelDistances.boundaryPixelCount += 1
      artifacts[`${dashCapMechanismStem}-${mechanismEntry.key}.json`] = structuredClone(mechanismEntry)
    }
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    assert.equal(failedVerification(t, fixture, '32B').report.status, 'failed')
  })
}

for (const target of ['named-full-closed-limitation', 'unrelated-App-failure']) {
  test(`32B strict policy rejects unadopted profile disposition for ${target}`, (t) => {
    const fixture = checkoutFixture(t); completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    const evidence = artifacts[`${target === 'named-full-closed-limitation' ? dashCapMechanismStem : dashCapScenario}.json`]
    const entry = target === 'named-full-closed-limitation'
      ? evidence.cases.find(({ key }) => key === 'positive-full-closed-control') : evidence.cases[0]
    entry.result = 'failed'
    evidence.acceptanceDisposition = { profile: 'stz-32b-core-v1', result: 'core acceptance passed with named limitations', limitations: ['supplemental-positive-full-closed-triangle'] }
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    assert.equal(failedVerification(t, fixture, '32B').report.status, 'failed')
  })
}

function referencedParentFixture(t) {
  const artifactDir = realpathSync(mkdtempSync(join(tmpdir(), 'stz-parent-publication-')))
  t.after(() => rmSync(artifactDir, { recursive: true, force: true }))
  const checkout = { revision: 'current-revision', trackedDiffSha256: 'current-tracked-bytes',
    untrackedSha256: { 'current-observation.mjs': 'current-untracked-bytes' }, fingerprint: 'current-tree' }
  const publisher = createEvidencePublisher({ artifactDir, checkout: { ...checkout, status: ' M current-observation.mjs\n' } })
  const report = { result: 'passed', stage: 'complete', environment: { browserVersion: 'controlled parent-policy fixture' },
    checkout: { ...checkout, status: ' M current-observation.mjs\n' },
    started: [...combinedLabelGroups, ...Object.keys(allPointNodeScenarios)],
    completed: [...combinedLabelGroups, ...Object.keys(allPointNodeScenarios)],
    incompleteGroups: [], unexecuted: [], pageErrors: [], evidence: [],
    diagnostics: [{ name: 'preserved-observation', group: layoutAnchorGroup, result: 'observed',
      state: { history: 'exact-history-'.repeat(20), source: 'exact raw $x$ source', owner: '["point-node",17,"current-point"]' } }] }
  return { artifactDir, checkout, publisher, report }
}

async function publishParentReport(fixture, disposition = 'passed') {
  const { artifactDir, publisher, report } = fixture
  await publisher.publish('preserved-observation.json', report.diagnostics[0], { stage: 'before-current-report' })
  await publisher.publish('free-labels-evidence.json', report, { stage: 'complete', disposition })
  return JSON.parse(readFileSync(join(artifactDir, 'free-labels-evidence.json'), 'utf8'))
}

function replaceParentPointer(artifactDir, document) {
  writeFileSync(join(artifactDir, 'free-labels-evidence.json'), JSON.stringify(document) + '\n')
  const indexPath = join(artifactDir, 'evidence-publication-index.json')
  const index = JSON.parse(readFileSync(indexPath, 'utf8'))
  index.documents['free-labels-evidence.json'] = document
  writeFileSync(indexPath, JSON.stringify(index) + '\n')
}

function replaceParentBoundary(artifactDir, document, boundary) {
  const bytes = Buffer.from(JSON.stringify(boundary) + '\n')
  writeFileSync(join(artifactDir, document.artifact.path), bytes)
  document.artifact.bytes = bytes.length
  document.artifact.sha256 = createHash('sha256').update(bytes).digest('hex')
  replaceParentPointer(artifactDir, document)
}

test('32D parent resolves current-tree report references without accepting a complete group count alone', async t => {
  const fixture = referencedParentFixture(t)
  await publishParentReport(fixture)
  assert.deepEqual(readEvidenceDocumentSync(fixture.artifactDir, 'free-labels-evidence.json', { checkout: fixture.checkout }), fixture.report,
    'Browser-only git status provenance does not change the authenticated tree identity')
  assert.throws(() => validateBrowserEvidence('check:free-labels', fixture.artifactDir, '32D', fixture.checkout),
    /Missing completed point-node scenario/, 'All 18 groups still require terminal named scenarios and raw artifact replay')
})

test('32D parent rejects a referenced complete predecessor report before review', async t => {
  const fixture = referencedParentFixture(t)
  fixture.report.completed = fixture.report.completed.filter(group => group !== layoutAnchorGroup)
  fixture.report.started = [...fixture.report.completed]
  await publishParentReport(fixture)
  assert.throws(() => validateBrowserEvidence('check:free-labels', fixture.artifactDir, '32D', fixture.checkout), /18 required groups/)
})

for (const fault of ['running-document', 'running-index', 'wrong-terminal-stage']) {
  test(`parent rejects compact complete flags without matching terminal publication: ${fault}`, async t => {
    const fixture = referencedParentFixture(t), { artifactDir, publisher, report, checkout } = fixture
    report.completed = [...combinedLabelGroups]
    report.started = [...combinedLabelGroups]
    await publisher.publish('free-labels-evidence.json', report, {
      stage: fault === 'wrong-terminal-stage' ? 'uncompleted-stage' : 'complete',
      disposition: fault === 'running-document' ? 'running' : 'passed',
    })
    if (fault === 'running-index') {
      const path = join(artifactDir, 'evidence-publication-index.json'), index = JSON.parse(readFileSync(path, 'utf8'))
      index.disposition = 'running'
      writeFileSync(path, JSON.stringify(index) + '\n')
    }
    assert.throws(() => validateBrowserEvidence('check:free-labels', artifactDir, '31F', checkout),
      'A complete raw body must agree with durable terminal document and index authority')
  })
}

for (const fault of ['missing-boundary', 'missing-pack', 'truncated-pack', 'wrong-hash', 'wrong-length',
  'wrong-owner', 'wrong-stage', 'wrong-pack-order', 'untracked-tree', 'stale-current-pointer']) {
  test(`32D parent rejects unauthenticated referenced report: ${fault}`, async t => {
    const fixture = referencedParentFixture(t), { artifactDir, checkout, publisher, report } = fixture
    const document = await publishParentReport(fixture, fault === 'stale-current-pointer' ? 'running' : 'passed')
    const boundary = JSON.parse(readFileSync(join(artifactDir, document.artifact.path), 'utf8'))
    assert.ok(boundary.packs.length >= 2, 'The control includes retained shared data and current report data')
    if (fault === 'missing-boundary') unlinkSync(join(artifactDir, document.artifact.path))
    if (fault === 'missing-pack') unlinkSync(join(artifactDir, boundary.packs[0].path))
    if (fault === 'truncated-pack') {
      const path = join(artifactDir, boundary.packs[0].path), bytes = readFileSync(path)
      writeFileSync(path, bytes.subarray(0, bytes.length - 1))
    }
    if (fault === 'wrong-hash') { document.artifact.sha256 = '0'.repeat(64); replaceParentPointer(artifactDir, document) }
    if (fault === 'wrong-length') { document.artifact.bytes++; replaceParentPointer(artifactDir, document) }
    if (fault === 'wrong-owner') { document.identity.owner = 'foreign-publisher'; replaceParentPointer(artifactDir, document) }
    if (fault === 'wrong-stage') { boundary.identity.stage = 'unexecuted-stage'; replaceParentBoundary(artifactDir, document, boundary) }
    if (fault === 'wrong-pack-order') { boundary.packs.reverse(); replaceParentBoundary(artifactDir, document, boundary) }
    if (fault === 'untracked-tree') checkout.untrackedSha256['current-observation.mjs'] = 'stale-untracked-bytes'
    if (fault === 'stale-current-pointer') {
      report.diagnostics.push({ name: 'new-terminal-observation', group: layoutAnchorGroup, result: 'observed' })
      await publisher.publish('free-labels-evidence.json', report, { stage: report.stage, disposition: 'passed' })
      writeFileSync(join(artifactDir, 'free-labels-evidence.json'), JSON.stringify(document) + '\n')
    }
    assert.throws(() => validateBrowserEvidence('check:free-labels', artifactDir, '32D', checkout),
      error => !/Missing completed point-node scenario/.test(error.message), 'Reference authentication fails before summary or scenario acceptance')
  })
}

test('32D parent pending file replay and ordered post-click prefixes consume resolved original observations', async t => {
  const { artifactDir, checkout, publisher } = referencedParentFixture(t)
  const scenario = 'point-layout-pending-transparent-edit', { evidence, raw } = syntheticStandalonePointDownload(artifactDir, scenario)
  for (const suffix of ['preparation', 'post-click-view']) {
    const name = `${scenario}-${suffix}.json`, value = JSON.parse(readFileSync(join(artifactDir, name), 'utf8'))
    await publisher.publish(name, value, { stage: suffix })
  }
  const common = { name: `${scenario}-post-click-view`, group: layoutAnchorGroup, result: 'observed' }
  const diagnostics = [0, 1, 2, 3].map(count => ({ ...common, postClickView: { ...structuredClone(evidence.postClickView),
    result: 'observed', stages: structuredClone(evidence.postClickView.stages.slice(0, count)) } }))
    .concat({ ...common, postClickView: structuredClone(evidence.postClickView) })
  await publisher.publish(`${scenario}.json`, evidence, { stage: 'terminal-scenario' })
  await publisher.publish(`${scenario}-standalone.json`, raw, { stage: 'reopened-file' })
  await publisher.publish('ordered-post-click-diagnostics.json', { diagnostics }, { stage: 'ordered-post-click-diagnostics' })
  const terminal = readEvidenceDocumentSync(artifactDir, `${scenario}.json`, { checkout })
  const standalone = readEvidenceDocumentSync(artifactDir, `${scenario}-standalone.json`, { checkout })
  const resolved = readEvidenceDocumentSync(artifactDir, 'ordered-post-click-diagnostics.json', { checkout })
  assert.deepEqual(terminal, evidence); assert.deepEqual(standalone, raw); assert.deepEqual(resolved.diagnostics, diagnostics)
  assertLayoutStandaloneEvidence(terminal, standalone, artifactDir, { checkout })
  assertLayoutPostClickViewDiagnostic(terminal, resolved.diagnostics)
  resolved.diagnostics.splice(2, 1)
  assert.throws(() => assertLayoutPostClickViewDiagnostic(terminal, resolved.diagnostics), /immediate-input/,
    'Lossless references preserve mandatory raw stage prefixes instead of replacing them with terminal flags')
})

function completePhase32dParentFixture(t) {
  const earlier = checkoutFixture(t)
  const base = completePointEvidence(earlier)
  const artifactDir = realpathSync(mkdtempSync(join(tmpdir(), 'stz-authenticated-empty-parent-')))
  t.after(() => rmSync(artifactDir, { recursive: true, force: true }))
  return populatePhase32dParentEvidence(artifactDir, base.checkout,
    JSON.parse(earlier.env.STZ_TEST_POINT_ARTIFACT_VALUES), combinedLabelGroups)
}

test('32D real complete parent artifact loop accepts seven native empty-source bodies in both dimensions', t => {
  const fixture = completePhase32dParentFixture(t)
  assert.equal(fixture.report.completed.length, 18)
  for (const { raw } of fixture.signed) {
    assert.deepEqual(raw.expected.map(({ id }) => id), ['signed-regular-polygon', 'signed-square', 'signed-triangle', 'signed-star',
      'signed-isosceles-triangle', 'signed-dart', 'signed-zero-axis'])
    assert.deepEqual(raw.preExport.points.map(({ id }) => id), ['signed-dart', 'signed-isosceles-triangle', 'signed-regular-polygon',
      'signed-square', 'signed-star', 'signed-triangle', 'signed-zero-axis'])
    assert.equal((raw.xml.match(/<title\/>/gu) ?? []).length, 7)
    assert.equal(/<text|<use|data-|aria-/u.test(raw.xml), false)
    assert.equal(hasWholePointSvg(raw.xml), false, 'Legacy painted-body envelope keeps its default rejection')
  }
  validateBrowserEvidence('check:free-labels', fixture.artifactDir, '32D', fixture.checkout)
})

test('32D real complete parent dispatch accepts explicitly closed empty titles and authenticated raw publications', async t => {
  const fixture = completePhase32dParentFixture(t)
  const publisher = createEvidencePublisher({ artifactDir: fixture.artifactDir, checkout: fixture.checkout })
  for (const entry of fixture.signed) {
    entry.raw.xml = entry.raw.xml.replaceAll('<title/>', '<title></title>')
    writeFileSync(entry.svgPath, entry.raw.xml)
    fixture.save(`${entry.download.scenario}-standalone.json`, entry.raw)
  }
  for (const name of [
    'point-layout-signed-polygonal-zero-axis.json',
    ...fixture.signed.flatMap(({ download }) => ['native', 'live-capture', 'standalone'].map(suffix => `${download.scenario}-${suffix}.json`)),
  ]) await publisher.publish(name, fixture.readJson(name), { stage: 'observed-exact-artifact' })
  await publisher.publish('free-labels-evidence.json', fixture.report, { stage: 'complete', disposition: 'passed' })
  assert.equal(JSON.parse(readFileSync(join(fixture.artifactDir, 'free-labels-evidence.json'), 'utf8')).schema, 'stz-evidence-document-v1')
  assert.deepEqual(readEvidenceDocumentSync(fixture.artifactDir, 'free-labels-evidence.json', { checkout: fixture.checkout }), fixture.report)
  validateBrowserEvidence('check:free-labels', fixture.artifactDir, '32D', fixture.checkout)
})

const emptyParentFaults = [
  ['missing-scenario', f => f.report(report => { report.evidence = report.evidence.filter(entry => entry.name !== f.scenario) })],
  ['wrong-scenario-group', f => f.report(report => { report.evidence.find(entry => entry.name === f.scenario).group = 'point-node-settled-export' })],
  ['missing-exact-artifact', f => f.report(report => { const record = report.evidence.find(entry => entry.name === f.scenario); record.artifacts = record.artifacts.filter(name => name !== `${f.stem}.svg`) })],
  ['foreign-artifact', f => { f.write('foreign-empty.svg', f.raw().xml); f.report(report => report.evidence.find(entry => entry.name === f.scenario).artifacts.push('foreign-empty.svg')) }],
  ['legacy-reuse', f => { const record = f.fixture.report.evidence.find(entry => entry.group === 'point-node-settled-export');
    f.write('legacy-empty.svg', f.raw().xml); f.report(report => report.evidence.find(entry => entry.name === record.name).artifacts.push('legacy-empty.svg')) }],
  ['wrong-raw-scenario', f => f.json(`${f.stem}-standalone.json`, raw => { raw.scenario += '-foreign' })],
  ['nonempty-source', f => f.json(`${f.scenario}.json`, evidence => { evidence.downloads[0].expected[0].source = 'invented' })],
  ['wrong-saved-source', f => f.json(`${f.stem}-standalone.json`, raw => { const saved = JSON.parse(raw.savedJson); saved.diagram.strata[0].text = 'foreign'; raw.savedJson = JSON.stringify(saved) })],
  ['wrong-click-source', f => f.json(`${f.scenario}.json`, evidence => { evidence.downloads[0].click.snapshot.points[0].source = 'foreign' })],
  ['wrong-native-record', f => f.json(`${f.stem}-native.json`, native => { native.polygonalCases[0].state.json += 'corrupt' })],
  ['missing-owner', f => f.json(`${f.stem}-standalone.json`, raw => { delete raw.preExport.points[0].owner })],
  ['duplicate-owner', f => f.json(`${f.stem}-standalone.json`, raw => { raw.preExport.points[1].owner = raw.preExport.points[0].owner })],
  ['foreign-owner', f => f.json(`${f.stem}-standalone.json`, raw => { raw.preExport.points[0].owner = '["point-node",100,"foreign"]' })],
  ['missing-title', f => f.xml(xml => xml.replace('<title/>', ''))],
  ['duplicate-title', f => f.xml(xml => xml.replace('<title/>', '<title/><title/>'))],
  ['foreign-title-attribute', f => f.xml(xml => xml.replace('<title/>', '<title class="foreign"/>'))],
  ['foreign-title', f => f.xml(xml => xml.replace('<title/>', '<title>foreign</title>'))],
  ['missing-body', f => f.xml(xml => xml.replace(/<g transform="[^"]*"><title\/><g transform="translate\(0 0\)"[^>]*><g\/><\/g><\/g>/u, ''))],
  ['duplicate-body', f => f.xml(xml => xml.replace(/(<g transform="[^"]*"><title\/><g transform="translate\(0 0\)"[^>]*><g\/><\/g><\/g>)/u, '$1$1'))],
  ['missing-ink', f => f.xml(xml => xml.replace(/<g transform="translate\(0 0\)"[^>]*><g\/><\/g>/u, ''))],
  ['duplicate-ink', f => f.xml(xml => xml.replace(/(<g transform="translate\(0 0\)"[^>]*><g\/><\/g>)/u, '$1$1'))],
  ['duplicate-content', f => f.xml(xml => xml.replace('<g/></g></g>', '<g/><g/></g></g>'))],
  ['missing-content', f => f.xml(xml => xml.replace('<g/></g></g>', '</g></g>'))],
  ['ink-stray-text', f => f.xml(xml => xml.replace('<g/></g></g>', 'foreign<g/></g></g>'))],
  ['content-stray-text', f => f.xml(xml => xml.replace('<g/></g></g>', '<g>foreign</g></g></g>'))],
  ['foreign-content-attribute', f => f.xml(xml => xml.replace('<g/></g></g>', '<g transform="translate(1 0)"/></g></g>'))],
  ['nested-wrong-shell', f => f.xml(xml => xml.replace('<g/></g></g>', '<g><g/></g></g></g>'))],
  ['missing-contour', f => f.xml(xml => xml.replace(/<path [^>]*\/>/u, ''))],
  ['duplicate-contour', f => f.xml(xml => xml.replace(/(<path [^>]*\/>)/u, '$1$1'))],
  ['extra-node', f => f.xml(xml => xml.replace('</svg>', '<g><path d="M 0 0 L 1 1"/></g></svg>'))],
  ['reordered-native-nodes', f => f.json(`${f.stem}-standalone.json`, raw => raw.preExport.points.reverse())],
  ['reordered-file-nodes', f => f.xml(xml => { const pattern = /<g><g transform="[^"]*"><path [^>]*\/><g transform="[^"]*"><title\/><g[^>]*><g\/><\/g><\/g><\/g><\/g>/gu;
    const nodes = [...xml.matchAll(pattern)].map(match => match[0]); assert.equal(nodes.length, 7); let ordinal = 0;
    return xml.replace(pattern, () => nodes[[1, 0, 2, 3, 4, 5, 6][ordinal++]]) })],
  ['wrong-body-owner', f => f.json(`${f.stem}-standalone.json`, raw => { raw.reopened[0].structure.bodyPath = raw.reopened[1].structure.bodyPath })],
  ['wrong-namespace', f => f.xml(xml => xml.replace('http://www.w3.org/2000/svg', 'http://foreign.invalid/svg'))],
  ['nested-root', f => f.xml(xml => xml.replace('</svg>', '<svg/></svg>'))],
  ['wrong-closing-tag', f => f.xml(xml => xml.replace('</svg>', '</g></svg>'))],
  ['comment-only-root', f => f.xml(xml => `<!-- ${xml} -->`)],
  ['changed-ink-paint', f => f.xml(xml => xml.replace('opacity="1" fill=', 'opacity="0.5" fill='))],
  ['changed-ink-color', f => f.xml(xml => xml.replace('color="#000000"', 'color="#ff0000"'))],
  ['changed-ink-transform', f => f.xml(xml => xml.replace('<g transform="translate(0 0)" opacity=', '<g transform="translate(1 0)" opacity='))],
  ['changed-contour-paint', f => f.xml(xml => xml.replace('fill="#d8ecff"', 'fill="#00ff00"'))],
  ['changed-placement', f => f.xml(xml => xml.replace(/<g transform="translate\([^)]*\)">/u, '<g transform="translate(0 0)">'))],
  ['changed-reopened-CTM', f => f.json(`${f.stem}-standalone.json`, raw => { raw.reopened[0].matrices.nodeCTM.e += 1 })],
  ['blank-PNG', f => f.write(`${f.stem}.png`, syntheticZeroPng(f.fixture.signed[0].zeroAxis.screenCTM, false))],
  ['short-PNG', f => f.write(`${f.stem}.png`, f.fixture.signed[0].png.subarray(0, 33))],
  ['mismatched-PNG', f => f.write(`${f.stem}.png`, f.fixture.signed[0].livePng)],
  ['changed-TikZ', f => f.write(`${f.stem}-inlineMath.tex`, '\\node {foreign};')],
  ['changed-saved-file', f => f.write(`${f.stem}-saved.json`, '{}')],
]

test('32D real parent contextual empty-body failures reach mandatory full replay with exact-file mutations', async t => {
  const fixture = completePhase32dParentFixture(t)
  const scenario = 'point-layout-signed-polygonal-zero-axis', stem = `${scenario}-2d`
  // Share the unchanged cumulative predecessor bytes and complete PNGs. Each
  // independent control restores only its own changed files before the next.
  for (const [fault, mutate] of emptyParentFaults) await t.test(fault, () => {
    const originals = new Map()
    const write = (name, value) => {
      if (!originals.has(name)) { try { originals.set(name, readFileSync(join(fixture.artifactDir, name))) } catch (error) { if (error.code !== 'ENOENT') throw error; originals.set(name, null) } }
      writeFileSync(join(fixture.artifactDir, name), value)
    }
    const json = (name, change) => { const value = fixture.readJson(name); change(value); write(name, JSON.stringify(value)) }
    const controls = { fixture, scenario, stem, write, json, raw: () => fixture.readJson(`${stem}-standalone.json`),
      report: change => json('free-labels-evidence.json', change),
      xml: change => { const raw = fixture.readJson(`${stem}-standalone.json`); raw.xml = change(raw.xml);
        write(`${stem}.svg`, raw.xml); write(`${stem}-standalone.json`, JSON.stringify(raw)) } }
    try {
      mutate(controls)
      assert.ok(originals.size > 0)
      assert.throws(() => validateBrowserEvidence('check:free-labels', fixture.artifactDir, '32D', fixture.checkout),
        error => ['foreign-artifact', 'legacy-reuse'].includes(fault) || !/Invalid whole-point SVG artifact/.test(error.message),
        `Mandatory targeted replay rejects ${fault}; the generic painted-body envelope cannot mask the rejection`)
    } finally {
      for (const [name, bytes] of originals) if (bytes === null) unlinkSync(join(fixture.artifactDir, name)); else writeFileSync(join(fixture.artifactDir, name), bytes)
    }
  })
})

test('32D real parent empty-body route retains current scenario/native/live/standalone publication authority', async t => {
  const fixture = completePhase32dParentFixture(t), scenario = 'point-layout-signed-polygonal-zero-axis', stem = `${scenario}-2d`
  const publisher = createEvidencePublisher({ artifactDir: fixture.artifactDir, checkout: fixture.checkout })
  const names = [`${scenario}.json`, `${stem}-native.json`, `${stem}-live-capture.json`, `${stem}-standalone.json`]
  const stale = {}
  for (const name of names) {
    const value = fixture.readJson(name)
    await publisher.publish(name, value, { stage: 'first-exact-raw' })
    stale[name] = readFileSync(join(fixture.artifactDir, name))
    await publisher.publish(name, value, { stage: 'current-exact-raw' })
  }
  await publisher.publish('free-labels-evidence.json', fixture.report, { stage: 'complete', disposition: 'passed' })
  validateBrowserEvidence('check:free-labels', fixture.artifactDir, '32D', fixture.checkout)
  const controls = [
    ...names.map(name => [`missing-${name}`, ({ remove }) => remove(name)]),
    ...names.map(name => [`stale-${name}`, ({ write }) => write(name, stale[name])]),
    ['corrupt-native-boundary', ({ write }) => { const doc = JSON.parse(readFileSync(join(fixture.artifactDir, `${stem}-native.json`), 'utf8')); write(doc.artifact.path, '{corrupt') }],
    ['wrong-live-hash', ({ write }) => { const name = `${stem}-live-capture.json`, doc = JSON.parse(readFileSync(join(fixture.artifactDir, name), 'utf8')); doc.artifact.sha256 = '0'.repeat(64); write(name, JSON.stringify(doc)) }],
    ['wrong-standalone-file-binding', ({ write }) => write(`${stem}-standalone.json`, readFileSync(join(fixture.artifactDir, `${stem}-native.json`)))],
    ['wrong-current-checkout', controls => { controls.checkout = { ...fixture.checkout, trackedDiffSha256: 'f'.repeat(64) } }],
  ]
  for (const [fault, change] of controls) await t.test(fault, () => {
    const originals = new Map()
    const retain = name => { if (!originals.has(name)) originals.set(name, readFileSync(join(fixture.artifactDir, name))) }
    const controls = { checkout: fixture.checkout,
      write: (name, bytes) => { retain(name); writeFileSync(join(fixture.artifactDir, name), bytes) },
      remove: name => { retain(name); unlinkSync(join(fixture.artifactDir, name)) } }
    try {
      change(controls)
      assert.throws(() => validateBrowserEvidence('check:free-labels', fixture.artifactDir, '32D', controls.checkout),
        error => !/Invalid whole-point SVG artifact/.test(error.message), 'Authentication must fail before an empty body can be accepted')
    } finally { for (const [name, bytes] of originals) writeFileSync(join(fixture.artifactDir, name), bytes) }
  })
})

test('32D complete parent dispatch authenticates separate warning-only cylinder files in both dimensions', t => {
  const fixture = completePhase32dParentFixture(t)
  assert.equal(fixture.report.completed.length, 18)
  assert.equal(fixture.report.evidence.filter(({ group }) => group === layoutAnchorGroup).length, 10)
  for (const { raw } of fixture.singular) {
    assert.equal(hasWholePointSvg(raw.xml), false, 'Legacy glyph/contour envelope still rejects a warning-only file')
    assert.ok(raw.xml.includes(singularCylinderWarningPath))
    assert.equal((raw.xml.match(/<path\b/gu) ?? []).length, 1)
  }
  validateBrowserEvidence('check:free-labels', fixture.artifactDir, '32D', fixture.checkout)
})

test('32D parent diagnostic context rejects missing or damaged proof before legacy classification', async t => {
  const fixture = completePhase32dParentFixture(t), scenario = singularCylinderScenario, stem = `${scenario}-2d`
  const faults = [
    ['missing-scenario', f => f.json('free-labels-evidence.json', report => { report.evidence = report.evidence.filter(({ name }) => name !== scenario) })],
    ['missing-exact-file', f => f.json('free-labels-evidence.json', report => { const record = report.evidence.find(({ name }) => name === scenario); record.artifacts = record.artifacts.filter(name => name !== `${stem}.svg`) })],
    ['foreign-file', f => { f.write('foreign-cylinder.svg', f.raw().xml); f.json('free-labels-evidence.json', report => report.evidence.find(({ name }) => name === scenario).artifacts.push('foreign-cylinder.svg')) }],
    ['wrong-case-source', f => f.json(`${scenario}.json`, evidence => { evidence.downloads[0].expected[0].source = 'foreign' })],
    ['wrong-owner', f => f.json(`${scenario}.json`, evidence => { evidence.downloads[0].click.snapshot.points[0].owner = '["point-node",100,"foreign"]' })],
    ['wrong-request', f => f.json(`${scenario}.json`, evidence => { evidence.downloads[0].click.snapshot.points[0].pointRequest = 'foreign' })],
    ['wrong-revision', f => f.json(`${scenario}.json`, evidence => { evidence.downloads[0].click.snapshot.runtime.documentRevision += 1 })],
    ['wrong-file-context', f => f.json(`${stem}-standalone.json`, raw => { raw.svgPath = join(fixture.artifactDir, 'foreign-cylinder.svg') })],
    ['missing-warning', f => f.xml(xml => xml.replace(/<path\b[^>]*>[\s\S]*?<\/path>/u, ''))],
    ['damaged-warning-path', f => f.xml(xml => xml.replace(singularCylinderWarningPath, 'M 0 0 L 1 1'))],
    ['damaged-warning-title', f => f.xml(xml => xml.replace('Shape preview unavailable:', 'Foreign diagnostic:'))],
    ['missing-empty-title', f => f.xml(xml => xml.replace(/<title\s*\/>|<title><\/title>/u, ''))],
    ['invented-cylinder-contour', f => f.xml(xml => xml.replace('</svg>', '<path d="M 0 0 L 10 10"/></svg>'))],
    ['invented-custom-region', f => f.xml(xml => xml.replace('</svg>', '<g><path d="M 0 0 Z" fill="#00FF00"/></g></svg>'))],
    ['changed-warning-paint', f => f.xml(xml => xml.replace('#B45309', '#00FF00'))],
    ['changed-placement', f => f.xml(xml => xml.replace(/translate\([^)]*\)/u, 'translate(0 0)'))],
    ['missing-native-record', f => f.remove(`${stem}-native.json`)],
    ['wrong-native-warning-owner', f => f.json(`${stem}-native.json`, native => { native.case.native.clicks[1].observation.owner = '["point-node",100,"foreign"]' })],
    ['wrong-png-bytes', f => f.write(`${stem}.png`, fixture.signed[0].png)],
    ['lost-authored-tikz', f => f.write(`${stem}-standalone.tex`, '\\node at (0,0) {};')],
    ['coherent-wrong-tikz-coordinate', f => f.tikz(source => {
      assert.ok(source.includes('at (3,3)'))
      return source.replaceAll('at (3,3)', 'at (4,3)')
    })],
  ]
  for (const [fault, mutate] of faults) await t.test(fault, () => {
    const originals = new Map()
    const remember = name => {
      if (!originals.has(name)) { try { originals.set(name, readFileSync(join(fixture.artifactDir, name))) }
        catch (error) { if (error.code !== 'ENOENT') throw error; originals.set(name, null) } }
    }
    const write = (name, bytes) => { remember(name); writeFileSync(join(fixture.artifactDir, name), bytes) }
    const json = (name, change) => { const value = fixture.readJson(name); change(value); write(name, JSON.stringify(value)) }
    const controls = { write, json, raw: () => fixture.readJson(`${stem}-standalone.json`),
      remove: name => { remember(name); unlinkSync(join(fixture.artifactDir, name)) },
      tikz: change => {
        const raw = fixture.readJson(`${stem}-standalone.json`), value = fixture.readJson(`${scenario}.json`)
        for (const mode of ['standalone', 'inlineMath']) {
          raw.outputs[mode] = change(raw.outputs[mode])
          value.downloads[0].outputs[mode] = raw.outputs[mode]
          write(`${stem}-${mode}.tex`, raw.outputs[mode])
        }
        write(`${stem}-standalone.json`, JSON.stringify(raw)); write(`${scenario}.json`, JSON.stringify(value))
      },
      xml: change => { const raw = fixture.readJson(`${stem}-standalone.json`); raw.xml = change(raw.xml);
        write(`${stem}.svg`, raw.xml); write(`${stem}-standalone.json`, JSON.stringify(raw)) } }
    try {
      mutate(controls)
      assert.ok(originals.size > 0)
      assert.throws(() => validateBrowserEvidence('check:free-labels', fixture.artifactDir, '32D', fixture.checkout),
        error => fault === 'foreign-file' || !/Invalid whole-point SVG artifact/.test(error.message),
        'Exact diagnostic replay rejects damaged context before the legacy glyph envelope')
    } finally {
      for (const [name, bytes] of originals) if (bytes === null) unlinkSync(join(fixture.artifactDir, name)); else writeFileSync(join(fixture.artifactDir, name), bytes)
    }
  })
})

test('32D diagnostic files require current authenticated native and standalone references', async t => {
  const fixture = completePhase32dParentFixture(t), stem = `${singularCylinderScenario}-2d`
  const publisher = createEvidencePublisher({ artifactDir: fixture.artifactDir, checkout: fixture.checkout })
  const names = [`${singularCylinderScenario}.json`, `${stem}-native.json`, `${stem}-standalone.json`], stale = {}
  for (const name of names) {
    const value = fixture.readJson(name)
    await publisher.publish(name, value, { stage: 'observed-diagnostic' })
    stale[name] = readFileSync(join(fixture.artifactDir, name))
    await publisher.publish(name, value, { stage: 'current-diagnostic' })
  }
  await publisher.publish('free-labels-evidence.json', fixture.report, { stage: 'complete', disposition: 'passed' })
  validateBrowserEvidence('check:free-labels', fixture.artifactDir, '32D', fixture.checkout)
  for (const name of names) await t.test(`stale ${name}`, () => {
    const current = readFileSync(join(fixture.artifactDir, name))
    try {
      writeFileSync(join(fixture.artifactDir, name), stale[name])
      assert.throws(() => validateBrowserEvidence('check:free-labels', fixture.artifactDir, '32D', fixture.checkout),
        error => !/Invalid whole-point SVG artifact/.test(error.message))
    } finally { writeFileSync(join(fixture.artifactDir, name), current) }
  })
})
