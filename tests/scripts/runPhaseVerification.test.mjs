import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import test from 'node:test'
import {
  browserChecksForPhase,
  pointNodeScenarios,
  pointNodeScenarioArtifacts,
  captureCheckoutIdentity,
  runPhaseVerification,
  verificationMatchesCheckout,
  hasWholePointSvg,
} from '../../scripts/automation/phase-verification.mjs'

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
    const artifactValues = JSON.parse(process.env.STZ_TEST_POINT_ARTIFACT_VALUES || '{}')
    if (process.env.STZ_TEST_POINT_ARTIFACTS === 'yes') {
      for (const entry of pointEvidence.evidence || []) for (const artifact of entry.artifacts) {
        const content = process.env.STZ_TEST_POINT_CORRUPT === 'yes' ? 'broken' : artifact.endsWith('.svg')
          ? '<svg><g><circle r="20"/><g><title>fixture</title><g><g><text x="0" y="0">fixture</text></g></g></g></g></svg>'
          : artifact.endsWith('.png') ? Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1]) : JSON.stringify(artifactValues[artifact] || {})
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

const pointGroups = [...combinedLabelGroups, ...Object.keys(pointNodeScenarios)]
const importRegressionScenarios = [
  'point-paint-local-override-intent', 'point-paint-cross-file-resolution', 'point-paint-unsupported-color-bindings',
]
const correctionScenarios = ['point-paint-unsupported-mutations', 'point-paint-clear-imported-style']
const targetedPaintScenarios = [
  'point-paint-namespace-aliases',
  'point-paint-responsive-circle',
  'point-paint-responsive-triangle',
  'point-paint-responsive-downloads',
  ...importRegressionScenarios, ...correctionScenarios,
]
test('32B preserves its original groups and scenarios and requires namespace and responsive paint evidence', () => {
  assert.equal(pointGroups.length, 16)
  assert.equal(Object.values(pointNodeScenarios).flat().length, 25)
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
function importRegressionEvidence(name) {
  const snapshot = (key, expected, warnings = []) => {
    const colors = Object.entries(expected).filter(([, value]) => typeof value === 'string' && value.startsWith('#'))
    const definitions = colors.map(([channel, value]) => `\\definecolor{${channel}Color}{HTML}{${value.slice(1)}}`).join('\n')
    const options = Object.entries(expected).filter(([, value]) => value !== null)
      .map(([channel, value]) => `${channel}=${value.startsWith('#') ? `${channel}Color` : value}`).join(',')
    const code = `%   \\input{base.sty}\n%   \\input{outer.sty}\n${definitions}\n\\node[${key},${options}] at (0,0) {};`
    return { key, current: { importedTikzStyleReferenceId: 'fixture-reference' }, warnings,
      observation: { contour: { fill: 'rgb(0, 0, 0)' }, leaves: [{ fill: 'rgb(0, 0, 0)' }] },
      state: { json: '{}', history: '{}' }, output: { standalone: code, inlineMath: code } }
  }
  const result = { download: { boundary: 'download', differencePaths: [] }, reload: { boundary: 'reload', differencePaths: [] },
    standalone: { pageErrors: [], observation: { contour: { fill: 'rgb(0, 0, 0)' }, leaves: [{ fill: 'rgb(0, 0, 0)' }] } } }
  if (name === 'point-paint-local-override-intent') {
    for (const boundary of ['untouched', 'reset']) result[boundary] = snapshot('example', { fill: null, text: '#ff0000' })
    for (const boundary of ['away', 'undone']) result[boundary] = snapshot('example', { fill: '#123456', text: '#ff0000' })
    for (const boundary of ['back', 'redone', 'reloaded']) result[boundary] = snapshot('example', { fill: '#000000', text: '#ff0000' })
    result.settingsBefore = snapshot('unknown controls', { fill: null, text: null, draw: null, 'fill opacity': null, 'line width': null })
    result.settingsFocusBlur = snapshot('unknown controls', { fill: null, text: null, draw: null, 'fill opacity': null, 'line width': null })
    result.settingsFocusBlur.current.style = { importedPaint: { overriddenFields: [] } }
    result.settingsFocusBlur.focusBlurControls = ['Fill opacity', 'Border width'].map((name) => ({ name, before: '1', after: '1', focused: true, blurred: true }))
    result.settingsBack = snapshot('unknown controls', { fill: null, text: null, draw: null, 'fill opacity': '1', 'line width': '0.4pt' })
  } else if (name === 'point-paint-cross-file-resolution') {
    for (const boundary of ['crossFile', 'reloaded']) result[boundary] = snapshot('outer', { fill: '#ff0000', text: '#00ff00', draw: '#0000ff' })
    result.priorColor = snapshot('outer', { fill: '#123456', text: '#00ff00', draw: '#0000ff' })
    result.redefined = snapshot('outer', { fill: '#ffff00', text: '#0000ff', draw: '#00ff00' })
    result.missing = snapshot('outer', { fill: null, text: null, draw: '#0000ff' }, ['Unsupported absent base'])
    result.laterUndone = snapshot('outer', { fill: '#000000', text: null })
    for (const boundary of ['later', 'laterRedone', 'laterReloaded']) result[boundary] = snapshot('outer', { fill: '#000000', text: '#00ff00', draw: '#0000ff' })
    result.laterDownload = { boundary: 'download', differencePaths: [] }; result.laterReload = { boundary: 'reload', differencePaths: [] }
  } else if (name === 'point-paint-unsupported-mutations') {
    result.mutation = snapshot('myPoint', { fill: null, text: null, draw: null })
    for (const boundary of ['away', 'undone']) result[boundary] = snapshot('myPoint', { fill: '#123456', text: null, draw: null })
    for (const boundary of ['back', 'redone', 'reloaded']) result[boundary] = snapshot('myPoint', { fill: '#ff0000', text: null, draw: null })
    const source = '\\tikzset{\n  myPoint/.style={fill=red,text=red},\n  myPoint/.append style={fill=blue,text=blue}\n}'
    for (const boundary of ['mutation', 'away', 'back', 'undone', 'redone', 'reloaded']) {
      const entry = result[boundary]
      entry.warnings = ['Unsupported myPoint/.append style']
      entry.modelDiagnostics = { validation: { valid: true }, resolution: { unresolvedFields: ['fillColor', 'textColor'] },
        reference: { previewDiagnostics: entry.warnings } }
      entry.diagram = { externalTikzStyleSources: [{ rawSource: source }] }
      entry.current.style = { paint: { fill: { color: ['away', 'undone'].includes(boundary) ? '#123456' : '#ff0000' } },
        importedPaint: { overriddenFields: boundary === 'mutation' ? [] : ['fill.color'] } }
      entry.observation = { contour: { fill: 'rgb(255, 0, 0)' }, leaves: [{ fill: 'rgb(255, 0, 0)', fillAlpha: 1 }] }
    }
    result.standalone.observation = result.reloaded.observation
  } else {
    result.unsupported = snapshot('myPoint', { fill: null, text: null, draw: '#000000' }, ['Unsupported red'])
    for (const boundary of ['away', 'undone']) result[boundary] = snapshot('myPoint', { fill: '#123456', text: null })
    for (const boundary of ['back', 'redone', 'reloaded']) result[boundary] = snapshot('myPoint', { fill: '#000000', text: null })
  }
  return result
}
function clearRegressionEvidence() {
  const basePaint = { text: { color: '#000000', opacity: 1 }, fill: { enabled: true, color: '#ff0000', opacity: 1 },
    stroke: { enabled: true, color: '#000000', opacity: 1, width: .4, lineStyle: 'solid', dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' } }
  const mixedPaint = { text: { color: '#654321', opacity: .5 }, fill: { enabled: true, color: '#123456', opacity: .25 },
    stroke: { enabled: true, color: '#008000', opacity: .75, width: 3, lineStyle: 'solid', dashPattern: [3, 2], dashPhase: 1, lineCap: 'round', lineJoin: 'bevel' } }
  const expectedObservation = (paint) => {
    const rgb = (hex) => `rgb(${[1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)).join(', ')})`
    return { contour: { fill: rgb(paint.fill.color), fillAlpha: paint.fill.opacity, stroke: rgb(paint.stroke.color),
      strokeAlpha: paint.stroke.opacity, strokeWidth: paint.stroke.width * 1.2, dash: paint.stroke.dashPattern ? '3, 2' : 'none',
      dashOffset: paint.stroke.dashPhase * 1.2, cap: paint.stroke.lineCap, join: paint.stroke.lineJoin },
    leaves: [{ fill: rgb(paint.text.color), fillAlpha: paint.text.opacity }], bodyBounds: { width: 2 }, shapeBounds: { width: 5 } }
  }
  const makeCase = (ids) => {
    const multiple = ids.length === 2, key = multiple ? 'independent point' : 'redpoint'
    const secondPaint = { text: { color: '#ff0000', opacity: .6 }, fill: { enabled: true, color: '#0000ff', opacity: .35 },
      stroke: { enabled: true, color: '#00ff00', opacity: .7, width: 2, lineStyle: 'solid', dashPattern: [3, 2], dashPhase: 1, lineCap: 'round', lineJoin: 'bevel' } }
    const points = ['app-point', 'bulk-point', 'copy-point'].map((id, index) => ({
      current: { id, text: ['Clear target', 'Clear second', 'Control point'][index], stylePresetId: 'preset', importedTikzStyleReferenceId: 'reference',
        style: { opacity: 1, paint: structuredClone(multiple ? index === 0 ? mixedPaint : secondPaint : basePaint), importedPaint: { referenceId: 'reference' } } },
      observation: expectedObservation(multiple ? index === 0 ? mixedPaint : secondPaint : basePaint),
    }))
    const snapshot = (detached) => {
      const current = structuredClone(points)
      if (detached) for (const { current: point } of current) if (ids.includes(point.id)) {
        delete point.stylePresetId; delete point.importedTikzStyleReferenceId; delete point.style.importedPaint
      }
      const diagram = { strata: current.map((point) => point.current), userStylePresets: [{ id: 'preset' }],
        externalTikzStyleSources: [{ id: 'source', rawSource: 'preserved source' }], importedTikzStyleReferences: [{ id: 'reference', key }] }
      const nodes = current.map(({ current: point }, index) => {
        const { paint } = point.style
        const colors = ['fill', 'text', 'stroke'].map((channel) => `\\definecolor{${channel}${index}}{HTML}{${paint[channel].color.slice(1)}}`).join('\n')
        const dash = paint.stroke.dashPattern ? `dash pattern=on 3pt off 2pt` : 'solid'
        return `${colors}\n\\node[${point.importedTikzStyleReferenceId ? `${key},` : ''}fill=fill${index},text=text${index},draw=stroke${index},fill opacity=${paint.fill.opacity},text opacity=${paint.text.opacity},draw opacity=${paint.stroke.opacity},line width=${paint.stroke.width}pt,${dash},dash phase=${paint.stroke.dashPhase}pt,line cap=${paint.stroke.lineCap},line join=${paint.stroke.lineJoin}] at (${index},0) {${point.text}};`
      }).join('\n')
      // Synthetic policy evidence only; these markers are not browser/model observations.
      const beforePresent = { clear: 'before', ids }, afterPresent = { clear: 'after', ids }
      return { points: current, diagram, output: { standalone: nodes, inlineMath: nodes }, modelDiagnostics: { validation: { valid: true } },
        state: { json: JSON.stringify({ diagram }), history: JSON.stringify({
          past: detached ? [{ before: 'retained' }, beforePresent] : [{ before: 'retained' }],
          present: detached ? afterPresent : beforePresent, future: [],
        }) } }
    }
    const entry = { ids, nativeAction: { selector: 'TikZ style selector', action: 'Clear TikZ style' },
      before: snapshot(false), cleared: snapshot(true), undone: snapshot(false), redone: snapshot(true), reloaded: snapshot(true),
      download: { boundary: 'download', differencePaths: [] }, reload: { boundary: 'reload', differencePaths: [] },
      standalone: { pageErrors: [], observation: points[0].observation,
        points: multiple ? [{ id: 'bulk-point', observation: points[1].observation }] : [] } }
    return entry
  }
  return { single: makeCase(['app-point']), multiple: makeCase(['app-point', 'bulk-point']) }
}
function completePointEvidence(fixture) {
  fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(pointGroups)
  fixture.env.STZ_TEST_POINT_ARTIFACTS = 'yes'
  const bodyStructure = (background) => ({ title: 'Scale', expectedBackground: background,
    exportBackground: { markers: background === 'white'
      ? [{ attribute: { namespace: null, name: 'data-stratified-tikz-export-background', value: 'white' } }] : [] },
  })
  const bodySample = (background, shape, variant, scale) => ({ background, shape, variant, scale,
    bodyContractPassed: true, output: { capture: { coordinatesStable: true } },
    bodyObservation: { structure: bodyStructure(background),
      literal: { source: 'Scale', documentUnchanged: true, fontReadiness: { status: 'loaded', checked: true } },
      settling: { documentUnchanged: true, status: 'loaded', leaves: [{ readiness: { status: 'loaded', checked: true } }] } },
  })
  const evidence = { checkout: captureCheckoutIdentity({ cwd: fixture.cwd, env: fixture.env }),
    evidence: Object.entries(pointNodeScenarios).flatMap(([group, names]) => names.map((name) =>
      ({ group, name, result: 'passed', artifacts: pointNodeScenarioArtifacts(name) }))) }
  fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
  fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(Object.fromEntries(targetedPaintScenarios.map((name) => [
    `${name}.json`, { scenario: name, group: 'point-node-paint-import-persistence', result: 'passed',
      ...(name === 'point-paint-clear-imported-style' ? clearRegressionEvidence() : [...importRegressionScenarios, 'point-paint-unsupported-mutations'].includes(name) ? importRegressionEvidence(name) : name === 'point-paint-responsive-downloads' ? {
        cases: ['transparent', 'white'].flatMap((background) => [['circle', 'solid'], ['triangle', 'solid'], ['circle', 'dashed']]
          .map(([shape, variant]) => ({ background, shape, variant,
            baseline: { fixture: { source: 'Scale' }, expectedBackground: background, saved: bodyStructure(background) },
            fileUnchanged: true, documentRestored: true,
            scales: [.5, 2].map((scale) => bodySample(background, shape, variant, scale)),
            returnScale: bodySample(background, shape, variant, .5),
            negativeControls: [['text-mutation', 'foreground content/order'], ['body-displacement', 'body local placement transform'],
              ['font-change', 'text font family']].map(([kind, reason]) =>
              ({ kind, rejected: true, reason: `displayed file: ${reason}`, documentUnchanged: true })),
          }))),
      } : name.startsWith('point-paint-responsive-') ? { cases: [.5, 2].map((scale) => ({ scale, negativeControlRejected: true })) }
        : { cases: ['shadowing', 'missing', 'aliases'].map((name) => ({ name, source: 'fixture style',
          output: { standalone: 'fixture', inlineMath: 'fixture' },
          reloadedOutput: { standalone: 'fixture', inlineMath: 'fixture' },
          editedOutput: { standalone: 'fixture', inlineMath: 'fixture' },
          uneditedDownload: { boundary: 'download', differencePaths: [] }, uneditedReload: { boundary: 'reload', differencePaths: [] },
          editedDownload: { boundary: 'download', differencePaths: [] }, editedReload: { boundary: 'reload', differencePaths: [] },
        })) }),
    },
  ])))
  return evidence
}
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
    assert.equal(verify(t, fixture, phase).status, 'passed')
  })
  test(`${phase} rejects an otherwise successful Phase 31F report`, (t) => {
    const fixture = checkoutFixture(t)
    fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(combinedLabelGroups)
    assert.throws(() => verify(t, fixture, phase), phase === '32A' ? /15 required groups/ : /16 required groups/)
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
    assert.throws(() => verify(t, fixture, phase), /16 required groups/)
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
for (const kind of ['single', 'multiple']) for (const boundary of ['cleared', 'redone', 'reloaded']) {
  for (const fault of ['retained-reference', 'retained-provenance', 'retained-preset', 'changed-paint', 'changed-control', 'false-validity', 'missing-preview', 'wrong-target-output']) {
    test(`32B requires explicit detached native state: ${kind} ${boundary} ${fault}`, (t) => {
      const fixture = checkoutFixture(t)
      completePointEvidence(fixture)
      const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
      const entry = artifacts['point-paint-clear-imported-style.json'][kind][boundary], target = entry.points[0]
      if (fault === 'retained-reference') target.current.importedTikzStyleReferenceId = 'reference'
      if (fault === 'retained-provenance') target.current.style.importedPaint = { referenceId: 'reference' }
      if (fault === 'retained-preset') target.current.stylePresetId = 'preset'
      if (fault === 'changed-paint') target.current.style.paint.stroke.dashPhase = 8
      if (fault === 'changed-control') entry.points[2].current.style.paint.text.color = '#0000ff'
      if (fault === 'false-validity') entry.modelDiagnostics.validation.valid = false
      if (fault === 'missing-preview') delete target.observation
      if (fault === 'wrong-target-output') entry.output.inlineMath = entry.output.inlineMath.replace('text=text0', 'text=fill0')
      fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
      assert.throws(() => verify(t, fixture, '32B'), /evidence is incomplete or invalid/)
    })
  }
}
for (const fault of ['missing-single', 'missing-multi', 'missing-action', 'missing-history', 'extra-history', 'changed-earlier-history', 'undo-lost-reference',
  'missing-reload', 'missing-svg', 'missing-second-svg', 'svg-paint', 'svg-error']) {
  test(`32B rejects incomplete clear workflow evidence: ${fault}`, (t) => {
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
    if (fault === 'missing-reload') delete entry.reload
    if (fault === 'missing-svg') delete entry.standalone
    if (fault === 'missing-second-svg') entry.standalone.points = []
    if (fault === 'svg-paint') entry.standalone.observation.contour.strokeWidth = .4
    if (fault === 'svg-error') entry.standalone.pageErrors.push('page error')
    fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(artifacts)
    assert.throws(() => verify(t, fixture, '32B'), /evidence is incomplete or invalid/)
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

for (const fault of ['claimed-unknown-fill', 'claimed-unknown-text', 'missing-noncolor-return', 'missing-later-import', 'missing-prior-color', 'reversed-hints', 'missing-diagnostic',
  'missing-focus-blur', 'focus-blur-override', 'focus-blur-history', 'missing-focused-control', 'unblurred-control']) {
  test(`32B rejects incomplete import regression boundaries: ${fault}`, (t) => {
    const fixture = checkoutFixture(t)
    completePointEvidence(fixture)
    const artifacts = JSON.parse(fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES)
    const intent = artifacts['point-paint-local-override-intent.json'], cross = artifacts['point-paint-cross-file-resolution.json']
    const unsupported = artifacts['point-paint-unsupported-color-bindings.json']
    if (fault === 'claimed-unknown-fill') intent.untouched.output.inlineMath = intent.back.output.inlineMath
    if (fault === 'claimed-unknown-text') unsupported.back.output.standalone = unsupported.back.output.standalone.replace('myPoint,', 'myPoint,text=black,')
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
