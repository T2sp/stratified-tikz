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
const targetedPaintScenarios = [
  'point-paint-namespace-aliases',
  'point-paint-responsive-circle',
  'point-paint-responsive-triangle',
  'point-paint-responsive-downloads',
]
test('32B preserves its original groups and scenarios and requires namespace and responsive paint evidence', () => {
  assert.equal(pointGroups.length, 16)
  assert.equal(Object.values(pointNodeScenarios).flat().length, 20)
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
  assert.equal(downloads.length, 43)
  assert.equal(downloads[0], 'point-paint-responsive-downloads.json')
  for (const background of ['transparent', 'white']) for (const shape of ['', '-triangle', '-dashed']) {
    assert.ok(downloads.includes(`point-paint-responsive-${background}${shape}.svg`))
    for (const scale of ['0.5', '2']) for (const extension of ['json', 'png', 'raster.svg']) {
      assert.ok(downloads.includes(`point-paint-responsive-${background}${shape}-scale-${scale}.${extension}`))
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
function completePointEvidence(fixture) {
  fixture.env.STZ_TEST_FREE_LABEL_GROUPS = JSON.stringify(pointGroups)
  fixture.env.STZ_TEST_POINT_ARTIFACTS = 'yes'
  const evidence = { checkout: captureCheckoutIdentity({ cwd: fixture.cwd, env: fixture.env }),
    evidence: Object.entries(pointNodeScenarios).flatMap(([group, names]) => names.map((name) =>
      ({ group, name, result: 'passed', artifacts: pointNodeScenarioArtifacts(name) }))) }
  fixture.env.STZ_TEST_POINT_EVIDENCE = JSON.stringify(evidence)
  fixture.env.STZ_TEST_POINT_ARTIFACT_VALUES = JSON.stringify(Object.fromEntries(targetedPaintScenarios.map((name) => [
    `${name}.json`, { scenario: name, group: 'point-node-paint-import-persistence', result: 'passed',
      ...(name === 'point-paint-responsive-downloads' ? {
        cases: ['transparent', 'white'].flatMap((background) => [['circle', 'solid'], ['triangle', 'solid'], ['circle', 'dashed']]
          .map(([shape, variant]) => ({ background, shape, variant,
            scales: [.5, 2].map((scale) => ({ background, shape, variant, scale })) }))),
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
