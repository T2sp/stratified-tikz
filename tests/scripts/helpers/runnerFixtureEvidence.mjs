import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

// Test-only evidence ownership. Never scan or delete other fixtures' temp dirs.
export function createRunnerFixtureEvidence(cwd, report = console.error) {
  const artifacts = new Set()
  const runs = []
  let failureDirectory
  let primaryFailure
  const diagnosticErrors = []
  function ownArtifactDirectory(directory) {
    if (resolve(dirname(directory)) === resolve(tmpdir()) && /^stz-phase[\w-]+$/.test(basename(directory))) {
      artifacts.add(directory)
      return true
    }
    return false
  }
  function collect(result) {
    const output = result.stdout + result.stderr
    const reportPaths = [...output.matchAll(/(?:Verification evidence:|[Ee]vidence:) ([^\n]+\/verification\.json)/g)]
      .map(match => match[1].trim())
    const handoffPaths = [...output.matchAll(/Verifier handoff: ([^\n]+)/g)].map(match => match[1].trim())
    for (const path of [...reportPaths, ...handoffPaths]) {
      const directory = dirname(path)
      // Paths printed by the real worker, including partial responses, are the
      // only external artifact directories owned by this fixture.
      ownArtifactDirectory(directory)
    }
    const artifactDirectoriesFromChecks = []
    try {
      // A terminated worker may leave a partial console line. Discover only
      // directories actually recorded by this fixture's synthetic commands.
      for (const line of readFileSync(join(cwd, 'logs/checks.jsonl'), 'utf8').split('\n')) {
        let check
        try { check = JSON.parse(line) } catch { continue }
        if (typeof check?.artifactDir !== 'string') continue
        const directory = resolve(check.artifactDir, '..', '..')
        if (ownArtifactDirectory(directory)) artifactDirectoriesFromChecks.push(directory)
      }
    } catch (error) {
      if (error.code !== 'ENOENT') diagnosticErrors.push(`Reading fixture stages: ${error.message}`)
    }
    result.diagnostic.reportPaths = reportPaths
    result.diagnostic.handoffPaths = handoffPaths
    result.diagnostic.artifactDirectoriesFromChecks = [...new Set(artifactDirectoriesFromChecks)]
    result.diagnostic.lastCompletedStage = [...output.matchAll(/Verification passed: ([^;\n]+)/g)].at(-1)?.[1] ?? null
    result.diagnostic.lastStartedStage = [...output.matchAll(/Verification: ([^\n]+)/g)].at(-1)?.[1] ?? null
    runs.push(result)
    try { writeFileSync(result.resultPath, JSON.stringify(result.diagnostic, null, 2) + '\n') }
    catch (error) { diagnosticErrors.push(`Process diagnostic: ${error.message}`) }
  }
  function preserve(error) {
    primaryFailure ??= error?.stack ?? error?.message ?? String(error)
    try {
      failureDirectory ??= mkdtempSync(join(tmpdir(), 'stz-runner-failure-'))
      cpSync(cwd, join(failureDirectory, 'fixture'), { recursive: true })
      const retained = []
      for (const path of artifacts) {
        const destination = join(failureDirectory, 'artifacts', basename(path))
        if (existsSync(path)) {
          mkdirSync(dirname(destination), { recursive: true })
          try { cpSync(path, destination, { recursive: true }); retained.push({ original: path, retained: destination }) }
          catch (error) { diagnosticErrors.push(`Retaining ${path}: ${error.message}`) }
        } else retained.push({ original: path, missing: true })
      }
      writeFileSync(join(failureDirectory, 'failure.json'), JSON.stringify({
        primaryFailure, fixtureCwd: cwd, retainedFixtureCwd: join(failureDirectory, 'fixture'),
        runs: runs.map(run => run.diagnostic), artifacts: retained, diagnosticErrors,
      }, null, 2) + '\n')
      report(`Runner fixture failure evidence: ${failureDirectory}`)
    } catch (error) {
      diagnosticErrors.push(error.message)
      // Retention must never replace the assertion/process error. Keep originals
      // if copying is incomplete, and explicitly report that fallback.
      report(`Runner fixture evidence capture failed: ${error.message}; originals retained at ${cwd}; ${[...artifacts].join(', ')}`)
    }
    return failureDirectory
  }
  function cleanup() {
    if (primaryFailure && !failureDirectory) preserve(primaryFailure)
    const complete = runs.every(run => run.diagnostic.cleanup.complete)
    if (!complete || diagnosticErrors.length) {
      report(`Runner fixture cleanup incomplete; originals retained at ${cwd}; ${[...artifacts].join(', ')}`)
      return
    }
    rmSync(cwd, { recursive: true, force: true })
    for (const path of artifacts) rmSync(path, { recursive: true, force: true })
  }
  return { collect, preserve, cleanup }
}

export function runnerDiagnostics(result) {
  return `${JSON.stringify(result.diagnostic, null, 2)}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
}
