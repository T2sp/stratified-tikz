import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const automationDir = fileURLToPath(new URL('../../scripts/automation/', import.meta.url))
const verifierFile = 'scripts/automation/phase-verification.mjs'
const workerFile = 'scripts/automation/phase-verification-worker.mjs'
const freeLabelGroups = [
  'existing-renderer-regressions', 'independent-oracle-negative-controls', 'boundary-anchor-camera-matrix',
  'inverted-success-and-failure-races', 'pending-lock-and-autohide', 'deletion-and-unmount',
  'real-App-input-JSON-history-reused-ID-load', 'current-SVG-cloning',
]
const inlineLabelGroups = [
  'inline-node-rendering-placement-halo-picking', 'inline-node-lifecycle-path-operations-export',
]
const allLabelGroups = [...freeLabelGroups, ...inlineLabelGroups]
const settledExportGroups = [...allLabelGroups, 'settled-SVG-export-standalone']
const combinedLabelGroups = [...settledExportGroups, 'combined-free-inline-workflows']

function fixture(t, phase = '31B', options = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'stz-runner-test-'))
  const artifacts = new Set()
  t.after(() => {
    rmSync(cwd, { recursive: true, force: true })
    for (const path of artifacts) rmSync(path, { recursive: true, force: true })
  })
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  // The implementation fixture must edit the actual modules used by its live
  // parent. An absolute runner path into the user's checkout hides ESM staleness.
  const localAutomationDir = join(cwd, 'scripts/automation')
  cpSync(automationDir, localAutomationDir, { recursive: true })
  // The verifier independently checks generated post-key paint. Keep its real
  // oracle and transitive helpers in the isolated checkout so both the parent
  // identity import and each fresh verification worker load the same modules.
  for (const file of ['pointPaintOracle.mjs', 'pointCheckDiagnostics.mjs', 'pointResponsiveFraming.mjs']) {
    cpSync(join(automationDir, '..', file), join(cwd, 'scripts', file))
  }
  const runner = join(localAutomationDir, 'run-phase.mjs')
  for (const [file, source] of Object.entries(options.initialFiles ?? {})) {
    writeFileSync(join(cwd, file), source)
  }
  if (options.retainStartupVerifier) {
    const source = readFileSync(runner, 'utf8')
    const replacement = `function runVerification(stage) {
  try {
    return retainedStartupVerification({ phase, cwd: process.cwd(), env, stage });
  } catch (error) {
    console.error(error.message);
    console.error("Verification failed. Not committing or pushing.");
    process.exit(error.exitCode ?? 1);
  }
}
\nfunction implementationVerificationContext`
    const mutant = source.replace(/function runVerification\(stage\) \{[\s\S]*?\nfunction implementationVerificationContext/, replacement)
    assert.notEqual(mutant, source, 'The mutation replaces the real verification boundary')
    writeFileSync(runner, `import { runPhaseVerification as retainedStartupVerification } from './phase-verification.mjs';\n${mutant}`)
  }
  mkdirSync(join(cwd, 'prompts'))
  writeFileSync(join(cwd, '.gitignore'), 'logs/\n')
  writeFileSync(join(cwd, `prompts/phase-${phase.toLowerCase()}-implement.md`), 'IMPLEMENT_FIXTURE')
  writeFileSync(join(cwd, `prompts/phase-${phase.toLowerCase()}-fix.md`), 'FIX_FIXTURE')
  writeFileSync(join(cwd, `prompts/phase-${phase.toLowerCase()}-review.md`), 'REVIEW_FIXTURE')
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({
    private: true,
    scripts: { test: 'node check.cjs test', build: 'node check.cjs build',
      'check:label-assets': 'node check.cjs browser', 'check:free-labels': 'node check.cjs free-browser' },
  }))
  writeFileSync(join(cwd, 'check.cjs'), `
const { mkdirSync, writeFileSync, appendFileSync } = require('node:fs');
const { join } = require('node:path');
const stage = process.argv[2];
mkdirSync('logs', { recursive: true });
appendFileSync('logs/checks.jsonl', JSON.stringify({ stage, artifactDir: process.env.STZ_SMOKE_ARTIFACT_DIR }) + '\\n');
if (stage === process.env.STZ_TEST_FAIL_STAGE) {
  console.error('fixture command failure: ' + stage);
  process.exit(Number(process.env.STZ_TEST_COMMAND_EXIT_CODE || 1));
}
if (stage === 'browser') {
  const dir = process.env.STZ_SMOKE_ARTIFACT_DIR;
  mkdirSync(dir, { recursive: true });
  for (const [file, value] of Object.entries({
    'native-retry-evidence.json': { browser: 'fixture-browser', affectedBrowserRecoveryVerified: true, nativeFailureCaching: { cachesFailedNativeImports: true } },
    'asset-graph-evidence.json': { mainEntries: 3, workerChunks: 43, approvedFontModules: 40 },
    'containment-evidence.json': { fixtures: [], croppedOracle: { geometryInside: false, outsideInkPixels: 1, lostInkPixels: 1 } },
  })) writeFileSync(join(dir, file), JSON.stringify(value));
}
if (stage === 'free-browser') {
  const dir = process.env.STZ_SMOKE_ARTIFACT_DIR;
  mkdirSync(dir, { recursive: true });
  const groups = JSON.parse(process.env.STZ_TEST_FREE_LABEL_GROUPS);
  writeFileSync(join(dir, 'free-labels-evidence.json'), JSON.stringify({
    result: 'passed', stage: 'complete', environment: { browserVersion: 'fixture-browser' },
    completed: groups, incompleteGroups: [], unexecuted: [], pageErrors: [],
    ...JSON.parse(process.env.STZ_TEST_FREE_EVIDENCE_OVERRIDE || '{}'),
  }));
}
`)
  const codex = join(cwd, 'codex-fixture.cjs')
  writeFileSync(codex, `#!${process.execPath}
const { mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const prompt = process.argv.at(-1);
mkdirSync('logs', { recursive: true });
if (prompt.startsWith('REVIEW_FIXTURE')) {
  writeFileSync('logs/review-prompt.txt', prompt);
  if (process.env.STZ_TEST_REVIEW_MUTATES === 'yes') writeFileSync('implemented.txt', 'changed by review');
  if (process.env.STZ_TEST_REVIEW_TAMPERS_GATE === 'yes') {
    const verifierFile = 'scripts/automation/phase-verification.mjs';
    const source = readFileSync(verifierFile, 'utf8');
    writeFileSync(verifierFile, source.replace(
      'export function verificationMatchesCheckout(report, options = {}) {',
      'export function verificationMatchesCheckout(report, options = {}) { return true;',
    ));
    const identity = require('node:child_process').spawnSync(process.execPath, ['--input-type=module', '-e',
      'import { captureCheckoutIdentity } from "./scripts/automation/phase-verification.mjs"; console.log(JSON.stringify(captureCheckoutIdentity()));'
    ], { encoding: 'utf8' });
    if (identity.status !== 0) throw new Error(identity.stderr);
    const summaryPath = /^Summary: (.+)$/m.exec(prompt)[1];
    const report = JSON.parse(readFileSync(summaryPath, 'utf8'));
    report.checkout = JSON.parse(identity.stdout);
    report.checkoutAfter = report.checkout;
    writeFileSync(summaryPath, JSON.stringify(report));
  }
  console.log('REVIEW_JSON_START');
  console.log(JSON.stringify({ summary: 'needs_changes', critical_count: 0, medium_count: 1, low_count: 0,
    ready_to_commit: process.env.STZ_TEST_REVIEW_MUTATES === 'yes' || process.env.STZ_TEST_REVIEW_TAMPERS_GATE === 'yes',
    suggested_fix_prompt: 'Fixture stops before commit.' }));
  console.log('REVIEW_JSON_END');
} else {
  writeFileSync('logs/implementation-prompt.txt', prompt);
  const changes = JSON.parse(process.env.STZ_TEST_IMPLEMENTATION_FILES || '{}');
  const before = Object.fromEntries(Object.keys(changes).map(file => [file, readFileSync(file, 'utf8')]));
  writeFileSync('logs/implementation-module-changes.json', JSON.stringify({ parentPid: process.ppid, before }));
  for (const [file, source] of Object.entries(changes)) {
    if (source === null) rmSync(file);
    else writeFileSync(file, source);
  }
  writeFileSync('implemented.txt', 'implementation from fixture');
  console.log('Implementation fixture complete');
}
`)
  chmodSync(codex, 0o755)
  git('init', '-q')
  git('config', 'user.name', 'Phase Runner Test')
  git('config', 'user.email', 'phase-runner@example.invalid')
  git('add', '.')
  git('-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'Fixture baseline')
  const initialHead = git('rev-parse', 'HEAD')
  const initialBranch = git('branch', '--show-current')
  const run = (mode, extraEnv = {}) => {
    const result = spawnSync(process.execPath, [runner, phase, mode], {
      cwd, encoding: 'utf8', timeout: 60_000,
      env: { ...env, CODEX_BIN: codex, STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(allLabelGroups), ...extraEnv },
    })
    for (const match of (result.stdout + result.stderr).matchAll(/(?:Verification evidence:|evidence:) ([^\n]+\/verification\.json)/g)) {
      artifacts.add(dirname(match[1].trim()))
    }
    for (const match of (result.stdout + result.stderr).matchAll(/Verifier handoff: ([^\n]+)/g)) {
      artifacts.add(dirname(match[1].trim()))
    }
    try {
      const checks = readFileSync(join(cwd, 'logs/checks.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
      for (const check of checks) {
        if (check.artifactDir) {
          // Browser artifacts are a child of the verification directory.
          artifacts.add(join(check.artifactDir, '..', '..'))
        }
      }
    } catch { /* Early usage failures have no check log. */ }
    return result
  }
  return { cwd, git, run, initialHead, initialBranch }
}

function reportFromOutput(result) {
  const summaryPath = /(?:Verification evidence:|evidence:) ([^\n]+\/verification\.json)/.exec(result.stdout + result.stderr)?.[1].trim()
  assert.ok(summaryPath, `Runner retains a concrete verification path:\n${result.stdout}\n${result.stderr}`)
  return JSON.parse(readFileSync(summaryPath, 'utf8'))
}

function assertStoppedBeforeReview({ cwd, git, initialHead }, result) {
  assert.notEqual(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stderr, /Verification failed\. Not committing or pushing/)
  assert.throws(() => readFileSync(join(cwd, 'logs/review-prompt.txt')), { code: 'ENOENT' })
  assert.equal(git('rev-parse', 'HEAD'), initialHead)
  assert.equal(git('rev-list', '--count', 'HEAD'), '1')
  assert.doesNotMatch(result.stdout, /\$ git (?:add|commit|push)\b/)
}

function oldElevenGroupVerifier() {
  const current = readFileSync(join(automationDir, 'phase-verification.mjs'), 'utf8')
  const old = current.replace(
    'const combinedLabelGroups = [...allLabelGroups, "combined-free-inline-workflows"];',
    'const combinedLabelGroups = allLabelGroups;',
  )
  assert.notEqual(old, current, 'The initial fixture has the historical eleven-group policy')
  return { current, old }
}

test('verify mode accepts pending changes and never invokes Codex or changes branches/commits', t => {
  const { cwd, git, run, initialHead, initialBranch } = fixture(t)
  writeFileSync(join(cwd, 'pending.txt'), 'uncommitted work')
  writeFileSync(join(cwd, '.gitignore'), 'logs/\nlocal-build/\n')
  const result = run('verify', { CODEX_BIN: join(cwd, 'must-not-run-codex') })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /Verification passed/)
  assert.equal(git('rev-parse', 'HEAD'), initialHead)
  assert.equal(git('branch', '--show-current'), initialBranch)
  assert.match(git('status', '--short'), /pending\.txt/)
  assert.match(git('status', '--short'), /\.gitignore/)
  assert.throws(() => readFileSync(join(cwd, 'logs/implementation-prompt.txt')), { code: 'ENOENT' })
  assert.throws(() => readFileSync(join(cwd, 'logs/review-prompt.txt')), { code: 'ENOENT' })
  const report = reportFromOutput(result)
  assert.equal(report.checkoutAfter.fingerprint, report.checkout.fingerprint)
  assert.ok(report.checkout.untrackedSha256['pending.txt'])
  const checks = readFileSync(join(cwd, 'logs/checks.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
  assert.deepEqual(checks.map(check => check.stage), ['test', 'build', 'browser'])
})

for (const [phase, groups] of [['31C', freeLabelGroups], ['31C', allLabelGroups], ['31D', allLabelGroups], ['31E', settledExportGroups], ['31F', combinedLabelGroups]]) {
  test(`${phase} verify accepts its complete ${groups.length}-group browser report`, t => {
    const { cwd, git, run, initialHead, initialBranch } = fixture(t, phase)
    writeFileSync(join(cwd, 'pending.txt'), 'uncommitted inline fixture')
    const result = run('verify', {
      CODEX_BIN: join(cwd, 'must-not-run-codex'),
      STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(groups),
    })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.match(result.stdout, /Verification passed/)
    assert.equal(git('rev-parse', 'HEAD'), initialHead)
    assert.equal(git('branch', '--show-current'), initialBranch)
    const checks = readFileSync(join(cwd, 'logs/checks.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
    assert.deepEqual(checks.map(check => check.stage), ['test', 'build', 'browser', 'free-browser'])
  })
}

for (const missing of [inlineLabelGroups, ...inlineLabelGroups.map(group => [group])]) {
  test(`31D verify rejects missing ${missing.join(' and ')} with exit-zero browser command`, t => {
    const { git, run, initialHead, initialBranch } = fixture(t, '31D')
    const result = run('verify', {
      STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(allLabelGroups.filter(group => !missing.includes(group))),
    })
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stderr, /Phase 31D.*10 required groups/)
    assert.match(result.stderr, /Verification failed. Not committing or pushing/)
    assert.equal(git('rev-parse', 'HEAD'), initialHead)
    assert.equal(git('branch', '--show-current'), initialBranch)
  })
}

test('31D implementation with old eight-group evidence stops before review', t => {
  const { cwd, git, run, initialHead } = fixture(t, '31D')
  const result = run('implement', { STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(freeLabelGroups) })
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stderr, /Phase 31D.*10 required groups/)
  assert.throws(() => readFileSync(join(cwd, 'logs/review-prompt.txt')), { code: 'ENOENT' })
  assert.equal(git('rev-parse', 'HEAD'), initialHead)
  assert.equal(git('rev-list', '--count', 'HEAD'), '1')
})

test('31F implementation with old eleven-group evidence stops before review', t => {
  const { cwd, git, run, initialHead } = fixture(t, '31F')
  const result = run('implement', { STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(settledExportGroups) })
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stderr, /Phase 31F.*12 required groups/)
  assert.throws(() => readFileSync(join(cwd, 'logs/review-prompt.txt')), { code: 'ENOENT' })
  assert.equal(git('rev-parse', 'HEAD'), initialHead)
  assert.equal(git('rev-list', '--count', 'HEAD'), '1')
})

for (const mode of ['implement', 'fix']) {
  test(`31F ${mode} reloads the verifier changed from eleven to twelve groups by its live child`, t => {
    const { current, old } = oldElevenGroupVerifier()
    const { cwd, git, run, initialHead } = fixture(t, '31F', { initialFiles: { [verifierFile]: old } })
    const result = run(mode, {
      STZ_TEST_IMPLEMENTATION_FILES: JSON.stringify({ [verifierFile]: current }),
      STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(combinedLabelGroups),
    })
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stderr, /Review found Critical or Medium issues\. Not committing/)
    const changes = JSON.parse(readFileSync(join(cwd, 'logs/implementation-module-changes.json'), 'utf8'))
    assert.equal(changes.parentPid, result.pid, 'The child edits while this same parent is alive')
    assert.equal(changes.before[verifierFile], old)
    assert.equal(readFileSync(join(cwd, verifierFile), 'utf8'), current)
    const reviewPrompt = readFileSync(join(cwd, 'logs/review-prompt.txt'), 'utf8')
    const report = reportFromOutput(result)
    assert.match(reviewPrompt, /check:free-labels: passed, exit 0/)
    assert.ok(reviewPrompt.includes(`Summary: ${report.summaryPath}`))
    assert.ok(reviewPrompt.includes(report.checkout.fingerprint))
    assert.equal(report.phase, '31F')
    assert.equal(report.status, 'passed')
    assert.equal(report.checkout.revision, initialHead)
    assert.equal(report.checkoutAfter.fingerprint, report.checkout.fingerprint)
    const check = report.checks.find(({ name }) => name === 'check:free-labels')
    const browserEvidence = JSON.parse(readFileSync(join(check.artifactDir, 'free-labels-evidence.json'), 'utf8'))
    assert.deepEqual(browserEvidence.completed, combinedLabelGroups)
    assert.equal(git('rev-parse', 'HEAD'), initialHead)
    assert.equal(git('rev-list', '--count', 'HEAD'), '1')
    assert.doesNotMatch(result.stdout, /\$ git (?:add|commit|push)\b/)
  })
}

test('the live-child regression detects the original retained-startup-import defect', t => {
  const { current, old } = oldElevenGroupVerifier()
  const setup = fixture(t, '31F', {
    initialFiles: { [verifierFile]: old }, retainStartupVerifier: true,
  })
  const result = setup.run('implement', {
    STZ_TEST_IMPLEMENTATION_FILES: JSON.stringify({ [verifierFile]: current }),
    STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(combinedLabelGroups),
  })
  assertStoppedBeforeReview(setup, result)
  assert.match(result.stderr, /Phase 31F.*11 required groups/)
  const report = reportFromOutput(result)
  assert.equal(report.status, 'failed')
  assert.equal(report.checks.at(-1).exitCode, 0)
})

test('post-implementation loading refreshes participating verifier dependencies too', t => {
  const { current } = oldElevenGroupVerifier()
  const policyFile = 'scripts/automation/fixture-group-policy.mjs'
  const indirectVerifier = current.replace(
    'const combinedLabelGroups = [...allLabelGroups, "combined-free-inline-workflows"];',
    'import { combinedLabelGroups } from "./fixture-group-policy.mjs";',
  )
  const setup = fixture(t, '31F', { initialFiles: {
    [verifierFile]: indirectVerifier,
    [policyFile]: `export const combinedLabelGroups = ${JSON.stringify(settledExportGroups)};\n`,
  } })
  const result = setup.run('implement', {
    STZ_TEST_IMPLEMENTATION_FILES: JSON.stringify({
      [policyFile]: `export const combinedLabelGroups = ${JSON.stringify(combinedLabelGroups)};\n`,
    }),
    STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(combinedLabelGroups),
  })
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stderr, /Review found Critical or Medium issues\. Not committing/)
  assert.equal(reportFromOutput(result).status, 'passed')
  assert.match(readFileSync(join(setup.cwd, 'logs/review-prompt.txt'), 'utf8'), /check:free-labels: passed, exit 0/)
  assert.equal(readFileSync(join(setup.cwd, verifierFile), 'utf8'), indirectVerifier, 'Only the participating dependency changed')
  assert.equal(setup.git('rev-parse', 'HEAD'), setup.initialHead)
})

test('a live child updates the policy and old eleven-group evidence fails with command exit zero', t => {
  const { current, old } = oldElevenGroupVerifier()
  const setup = fixture(t, '31F', { initialFiles: { [verifierFile]: old } })
  const result = setup.run('implement', {
    STZ_TEST_IMPLEMENTATION_FILES: JSON.stringify({ [verifierFile]: current }),
    STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(settledExportGroups),
  })
  assertStoppedBeforeReview(setup, result)
  assert.match(result.stderr, /Phase 31F.*12 required groups/)
  const report = reportFromOutput(result)
  assert.equal(report.status, 'failed')
  assert.equal(report.failedCheck, 'check:free-labels')
  const check = report.checks.at(-1)
  assert.equal(check.status, 'failed')
  assert.equal(check.exitCode, 0, 'Evidence rejection does not rewrite the successful command exit')
  assert.equal(readFileSync(check.exitStatusPath, 'utf8'), '0\n')
  assert.match(check.error, /Phase 31F.*12 required groups/)
  assert.ok(result.stdout.includes(check.logPath), 'The browser command log remains actionable')
})

test('fresh verifier command failure keeps its actual exit, error, report and log before review', t => {
  const setup = fixture(t, '31F')
  const result = setup.run('implement', {
    STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(combinedLabelGroups),
    STZ_TEST_FAIL_STAGE: 'free-browser', STZ_TEST_COMMAND_EXIT_CODE: '17',
  })
  assertStoppedBeforeReview(setup, result)
  assert.equal(result.status, 17, result.stdout + result.stderr)
  assert.match(result.stderr, /check:free-labels failed: exit 17/)
  const report = reportFromOutput(result)
  assert.equal(report.status, 'failed')
  assert.equal(report.failedCheck, 'check:free-labels')
  const check = report.checks.at(-1)
  assert.equal(check.exitCode, 17)
  assert.equal(check.status, 'failed')
  assert.equal(readFileSync(check.exitStatusPath, 'utf8'), '17\n')
  assert.match(readFileSync(check.logPath, 'utf8'), /fixture command failure: free-browser/)
  assert.ok(result.stdout.includes(check.logPath))
})

const handoffFaults = [
  ['worker startup', () => ({ [workerFile]: null })],
  ['verifier import', () => ({
    [verifierFile]: `import './missing-verifier-dependency.mjs';\n${readFileSync(join(automationDir, 'phase-verification.mjs'), 'utf8')}`,
  })],
  ['missing worker response', () => ({ [workerFile]: 'process.exit(0);\n' })],
  ['malformed worker response', () => ({
    [workerFile]: `import { writeFileSync } from 'node:fs';\nwriteFileSync(process.argv[4], '{truncated');\n`,
  })],
  ['malformed report', () => ({
    [workerFile]: `import { writeFileSync } from 'node:fs';\nwriteFileSync(process.argv[4], JSON.stringify({ report: { status: 'passed' } }));\n`,
  })],
]

for (const [name, changedFiles] of handoffFaults) {
  test(`${name} after implementation cannot reuse an earlier success or enter review`, t => {
    const setup = fixture(t, '31F')
    const groups = { STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(combinedLabelGroups) }
    const prior = setup.run('verify', groups)
    assert.equal(prior.status, 0, prior.stdout + prior.stderr)
    const priorReport = reportFromOutput(prior)
    assert.equal(priorReport.status, 'passed')
    const result = setup.run('implement', {
      ...groups, STZ_TEST_IMPLEMENTATION_FILES: JSON.stringify(changedFiles()),
    })
    assertStoppedBeforeReview(setup, result)
    assert.ok(readFileSync(join(setup.cwd, 'logs/implementation-prompt.txt'), 'utf8'))
    assert.equal(JSON.parse(readFileSync(priorReport.summaryPath, 'utf8')).status, 'passed', 'Historical evidence is preserved')
    assert.doesNotMatch(result.stdout, /Verification passed/)
  })
}

test('a worker replaying an earlier passed report cannot approve the implemented checkout', t => {
  const setup = fixture(t, '31F')
  const groups = { STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(combinedLabelGroups) }
  const prior = setup.run('verify', groups)
  assert.equal(prior.status, 0, prior.stdout + prior.stderr)
  const priorReport = reportFromOutput(prior)
  const replayWorker = `import { writeFileSync } from 'node:fs';
writeFileSync(process.argv[4], JSON.stringify(${JSON.stringify({
    report: priorReport, requiredChecks: priorReport.checks.map(({ name }) => name),
  })}));
`
  const result = setup.run('implement', {
    ...groups, STZ_TEST_IMPLEMENTATION_FILES: JSON.stringify({ [workerFile]: replayWorker }),
  })
  assertStoppedBeforeReview(setup, result)
  assert.equal(JSON.parse(readFileSync(priorReport.summaryPath, 'utf8')).status, 'passed')
})

test('parent browser evidence is handed to the review while child Codex remains sandboxed', t => {
  const { cwd, git, run, initialHead } = fixture(t)
  const result = run('implement')
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stderr, /Not committing/)
  const prompt = readFileSync(join(cwd, 'logs/review-prompt.txt'), 'utf8')
  assert.match(prompt, /Verification evidence from the parent runner/)
  assert.match(prompt, /check:label-assets: passed, exit 0/)
  assert.match(prompt, /do not need to repeat those browser commands/)
  const summaryPath = /^Summary: (.+)$/m.exec(prompt)?.[1]
  assert.ok(summaryPath, 'Review receives a concrete report path')
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
  assert.equal(summary.status, 'passed')
  assert.equal(summary.checkout.revision, initialHead)
  assert.ok(summary.checkout.untrackedSha256['implemented.txt'])
  assert.match(readFileSync(join(cwd, 'logs/codex/31B-review.log'), 'utf8'), /"--sandbox" "workspace-write"/)
  assert.match(readFileSync(join(cwd, 'logs/implementation-prompt.txt'), 'utf8'), /Parent-runner verification/)
  assert.equal(git('rev-parse', 'HEAD'), initialHead)
})

test('a review that changes verified content cannot commit even when it returns ready_to_commit', t => {
  const { git, run, initialHead } = fixture(t)
  const result = run('implement', { STZ_TEST_REVIEW_MUTATES: 'yes' })
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stderr, /Checkout changed during review/)
  assert.equal(git('rev-parse', 'HEAD'), initialHead)
  assert.equal(git('rev-list', '--count', 'HEAD'), '1')
})

test('a review cannot redefine the identity gate or rewrite the verified report to approve its edits', t => {
  const { cwd, git, run, initialHead } = fixture(t)
  const result = run('implement', { STZ_TEST_REVIEW_TAMPERS_GATE: 'yes' })
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stderr, /Checkout changed during review/)
  assert.match(readFileSync(join(cwd, verifierFile), 'utf8'), /verificationMatchesCheckout\(report, options = \{\}\) \{ return true;/)
  const summary = JSON.parse(readFileSync(join(cwd, 'logs/codex/31B-review-summary.json'), 'utf8'))
  assert.equal(summary.ready_to_commit, true, 'The review attempted to authorize a commit')
  assert.equal(git('rev-parse', 'HEAD'), initialHead)
  assert.equal(git('rev-list', '--count', 'HEAD'), '1')
  assert.doesNotMatch(result.stdout, /\$ git (?:add|commit|push)\b/)
})

for (const phase of ['32A', '32B', '32C', '32D']) {
  test(`${phase} runner rejects old Phase 31F evidence before review or commit`, (t) => {
    const { cwd, git, run, initialHead } = fixture(t, phase)
    const result = run('implement', { STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(combinedLabelGroups) })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, phase === '32A' ? /15 required groups/ : /16 required groups/)
    assert.equal(git('rev-parse', 'HEAD'), initialHead)
    assert.throws(() => readFileSync(join(cwd, 'logs/review-prompt.txt')), { code: 'ENOENT' })
    assert.doesNotMatch(result.stdout, /\$ git (?:add|commit|push)\b/)
  })
}
test('32A running parent refreshes point browser policy after its implementation child', (t) => {
  const current = readFileSync(join(automationDir, 'phase-verification.mjs'), 'utf8')
  const obsolete = current.replace('if (["31C", "31D", "31E", "31F", ...Object.keys(phase32Groups)].includes(normalized))',
    'if (["31C", "31D", "31E", "31F"].includes(normalized))')
  assert.notEqual(obsolete, current)
  const { cwd, git, run, initialHead } = fixture(t, '32A', { initialFiles: { [verifierFile]: obsolete } })
  const result = run('implement', { STZ_TEST_IMPLEMENTATION_FILES: JSON.stringify({ [verifierFile]: current }),
    STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(combinedLabelGroups) })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /15 required groups/)
  assert.equal(git('rev-parse', 'HEAD'), initialHead)
  assert.throws(() => readFileSync(join(cwd, 'logs/review-prompt.txt')), { code: 'ENOENT' })
})

test('32B live parent reloads newly required paint evidence before review and commit', (t) => {
  const current = readFileSync(join(automationDir, 'phase-verification.mjs'), 'utf8')
  const obsolete = current.replace('"32B": pointNodeGroups', '"32B": pointNodeMathGroups')
  assert.notEqual(obsolete, current)
  const { cwd, git, run, initialHead } = fixture(t, '32B', { initialFiles: { [verifierFile]: obsolete } })
  const pointMathGroups = [...combinedLabelGroups, 'point-node-body-layout-lifecycle', 'point-node-picking-visibility', 'point-node-settled-export']
  const result = run('implement', { STZ_TEST_IMPLEMENTATION_FILES: JSON.stringify({ [verifierFile]: current }),
    STZ_TEST_FREE_LABEL_GROUPS: JSON.stringify(pointMathGroups) })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /16 required groups/)
  assert.equal(git('rev-parse', 'HEAD'), initialHead)
  assert.throws(() => readFileSync(join(cwd, 'logs/review-prompt.txt')), { code: 'ENOENT' })
  assert.doesNotMatch(result.stdout, /\$ git (?:add|commit|push)\b/)
})
