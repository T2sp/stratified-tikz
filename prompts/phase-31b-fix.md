# Phase 31B Targeted Fix Prompt: Complete blocked browser acceptance and record evidence

## Environment

Work on the current Phase 31B checkout, preserving the implemented
Worker-loading fixes, tests, and any uncommitted user work. Do not reset the
branch or replace the current adapter with an earlier implementation.
In particular, preserve the existing changes in `docs/LABEL_ADAPTER.md`,
`docs/PREVIEW_UI.md`, and `docs/ROADMAP.md`; update their verification evidence
in place only as needed after this follow-up.

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

This follow-up primarily completes verification. Run the existing browser
smoke unchanged before deciding whether any implementation change is needed.
Do not add dependencies, change pinned versions, or redesign the loader merely
because a sandbox prevented the browser check from starting.

Required verification includes the fresh-build browser asset/retry/rendering
smoke, seven focused adapter test files, `npm test`, `npm run build`, targeted
lint, asset-script syntax checks, and `git diff --check`.

## Latest review findings

The latest Phase 31B review reported `needs_changes`: no Critical issues,
exactly one Medium issue, and no Low-priority issues. **No new implementation
defect was confirmed.** The review preserved the existing documentation edits.

### Medium M1: required browser acceptance remains unverified

Running `npm run check:label-assets` against a fresh build passed its static
asset checks, then exited 1 with:

```text
listen EPERM: operation not permitted 127.0.0.1
```

The failure occurred at `listen(0, '127.0.0.1')` in
`scripts/checkLabelAssets.mjs:120`, before Chrome launched. Actual base-path
and additional-font requests, native-import failure/recovery, Worker retirement,
and standalone SVG raster containment were not exercised. The review's
[browser-check log](/private/tmp/stz-31b-review-browser.log) records the static pass
and subsequent bind failure; it contains no browser execution evidence.

Repeating the same command under unchanged localhost restrictions cannot
complete browser acceptance. The remaining work needs an execution environment
that permits this smoke; determine the current session's capabilities instead
of assuming an earlier session's permission policy still applies.

This is an environment-blocked verification gap, not an observed runtime
defect. It leaves the built-asset requirement in
`prompts/phase-31b-implement.md` incomplete. Do not present the earlier
native-import caching issue as an unfixed code defect based only on this
blocked run.

Passing Node tests cannot establish browser loading or recovery:
`src/rendering/labels/mathjaxEngine.ts` uses installed direct modules when
`typeof window === 'undefined'`, while production browser conversion uses
`loadWorkerMathJaxEngine`. Keep this distinction explicit in the verification
and completion report.

The review used `PATH=/opt/homebrew/bin:$PATH` with Node `v26.9.0` and recorded:

| Check | Previous review result |
| --- | --- |
| Full suite | Exit 0; 2,258 passed; no failures or skips |
| Seven focused adapter files | Exit 0; 102 passed; included in the full-suite total |
| Targeted ESLint across 21 implementation/configuration/test/script files | Exit 0 |
| Both asset-script syntax checks | Exit 0 |
| `git diff --check` | Exit 0 |
| Production build | Exit 0; non-failing large-chunk warnings |
| Browser asset/retry/rendering smoke | Exit 1; static assertions passed, browser launch blocked |

Static deployment inspection verified 3 main manifest entries, 43 Worker
chunks, 83 references, and all 40 additional-font modules. Referenced files
exist; observed built paths include
`/stratified-tikz/assets/mathjaxWorker-DfxTIyyr.js` and
`/stratified-tikz/assets/fraktur-0I2mShNq.js`. These are filesystem/build
observations, not browser HTTP requests or raster results.
Resolve current hashed asset filenames from the fresh build's manifests;
do not hard-code filenames from an earlier build.

These are previous results to preserve and recheck, not new results for this
follow-up. The 102 focused tests are included in the 2,258 full-suite tests;
do not add these counts. Run the commands below and record their actual results
separately for this attempt.

## What the review confirmed correct

Preserve the current implementation and regressions:

- real public-adapter fraction/radical conversions return finite metrics, with
  substantive coverage for immutable geometry;
- a valid run followed by an undefined command returns the exact complete
  source, including spaces, tabs, CRLF, and delimiters, without partial geometry;
- conversion state and errors are isolated and scoped;
- work, caches, and Worker lifetime are bounded; results are immutable,
  equivalent requests coalesce, and obsolete generations are retired;
- logical advance is distinct from overflowing ink, and portable SVG
  validation constrains elements, attributes, references, and paint;
- engine and font dependencies are exactly `4.1.3` in declarations, lockfile,
  and installed packages;
- the disposable Worker implementation and native-import regression harness
  already exist;
- model, persistence, history, TikZ, production canvas integration, and export
  lifecycle remain unchanged.

The review separately ran `npx eslint src/rendering/SvgDiagram.tsx`, which
exited 1 for the pre-existing `react-hooks/refs` error at line 942. That file
is unchanged since its earlier commit. Repository-wide lint was not run;
do not confuse this baseline debt with the passing targeted check or perform
repository-wide lint cleanup.

## Goal

Obtain actual browser evidence for the existing Phase 31B implementation in an
environment that permits localhost and Chrome/Chromium. Fix only demonstrated
Phase 31B failures, rerun the applicable checks, and update completion
documentation to match the observed results.

A passing unchanged smoke may require only documentation updates. There is no
requirement to change production code when verification reveals no defect.
Keep Phases 31C–31F deferred.

## Required reading before proceeding

Read at least:

- `AGENTS.md` and this prompt in full;
- `prompts/phase-31b-implement.md` and `prompts/phase-31b-review.md`;
- the latest review report if available; otherwise use the findings above;
- `docs/LABEL_ADAPTER.md`, especially its loading lifecycle, verification,
  artifact, and exit-status documentation;
- the Phase 31 sections of `docs/PREVIEW_UI.md` and `docs/ROADMAP.md`;
- `scripts/checkLabelAssets.mjs`, `scripts/prepareMathjaxAssets.mjs`,
  `vite.config.ts`, and `package.json`;
- the seven focused test files and the adapter/Worker modules they exercise,
  as needed to diagnose an observed failure.

Do not replace the existing assertions with a new, weaker verification path.

## 1. Establish a permitted environment and run the unchanged smoke

First check the active session's permissions and available browser tooling.
If localhost is blocked and the session cannot authorize the required access,
arrange execution in an authorized local session or other permitted environment.
Do not start another implementation rewrite to resolve an operating-environment
restriction.

Build the current checkout there, then execute the existing script unchanged.
Use an available external Playwright installation and Chrome/Chromium; do not
add a project browser-testing dependency.

Use a fresh artifact directory for this attempt so old static files or
screenshots cannot be mistaken for current browser evidence. For this checkout:

```bash
PATH=/opt/homebrew/bin:$PATH npm run build

PATH=/opt/homebrew/bin:$PATH \
STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
STZ_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
STZ_SMOKE_ARTIFACT_DIR=/private/tmp/stz-phase31b-browser-acceptance \
npm run check:label-assets
```

Use actual available paths and a new artifact directory if these differ or
already contain earlier output. Record the full command, execution environment,
Node version, actual launched browser version, exit status, and log location.
Identify the tested revision and any uncommitted code/build changes so results
from another session can be matched to the reviewed implementation. Rebuild in
that environment rather than relying on unrelated or stale `dist` output.

If localhost binding or browser launch is denied by the sandbox, use the
execution environment's supported approval/escalation mechanism when available
and permitted. If the current session prohibits escalation, respect that rule;
do not request a forbidden override. A new session may have different
permissions, which must be checked rather than assumed. The required action is
running this local fresh-build smoke with localhost/browser access, not changing
the application.

If escalation is unavailable or denied, report the exact restriction and keep
acceptance incomplete. Do not bypass the restriction, disable browser security,
change the server merely to evade permissions, or replace this check with a
static-only result. Avoid repeating the same blocked command without a relevant
environment or permission change.

If no permitted execution environment is accessible, provide a concrete
handoff: the exact build/smoke commands above with resolved paths, the target
revision or pending changes, the required localhost/browser capability, and
the expected logs/artifacts listed below. Record what remains unverified and
leave Phase 31B incomplete. A handoff is not a passing browser check.

## 2. Inspect the browser results and saved evidence

Keep all existing smoke assertions active. Confirm the run establishes:

1. The built app mounts under `/stratified-tikz/`; plain-text and
   parser-rejected labels do not eagerly load MathJax or font assets.
2. The real production Worker executes. Runtime, shared dependencies, and
   additional font data load from the configured same-origin build graph.
   Keep the smoke's external-access blocking enabled: conversion must succeed
   using local assets and must not attempt external requests. Preserve its
   existing handling of the blocked pre-existing application analytics request.
3. Fractions, radicals, matrices, multiline labels, and exact complete-source
   fallback work through the built public service.
4. The native-cache capability probe actually fails a module request with
   HTTP 503, restores its exact URL, and measures whether the browser retains
   the failed import.
5. Independent runtime, additional-font, and shared/transitive-import scenarios
   actually fail the intended cold module requests. They return bounded
   `resource-error` fallback with the exact mixed source, including CRLF,
   and no partial geometry.
6. After access is restored, `invalidate()` enables the same public service
   in the same page to request the same failed URL successfully with HTTP 200.
   Old Workers terminate; recovered results are immutable and coalesced;
   subsequent math and plain labels remain usable.
7. Standalone SVG paint, native ink containment, composed bounds, zero-advance
   placement, and enlarged-viewport raster containment pass. The deliberately
   cropped glyph still fails the independent containment oracles.

Do not reload or replace the page, browser context, public service, or browser
cache between failure and recovery. The internal Worker replacement performed
by the production loader is the behavior being verified.

Inspect the artifacts emitted by the existing script:

- `asset-graph-evidence.json`: static main/Worker graph and approved font set;
- `native-retry-evidence.json`: actual browser version, native-cache behavior,
  failed/restored URLs, fallback, same-service recovery, and Worker lifecycle;
- `containment-evidence.json`: native/raster containment and cropped-oracle
  sensitivity results;
- `label-standalone.svg`, `label-standalone.png`, and the fixture
  SVG/PNG/reference PNG files: portable output and raster evidence;
- the smoke's output log: base-path/font requests and overall result.

The static `asset-graph-evidence.json` is written before the localhost bind,
so even a blocked run can produce it. An artifact's presence alone does not
establish success. Check its contents, the current run's final status, and
whether all required assertions completed.

### Interpret exit statuses accurately

- **Exit 0 / `passed`:** all assertions completed and the native-cache probe
  verified recovery on a browser that caches failed native imports.
- **Exit 2 / `functional-checks-passed-affected-browser-unverified`:** functional
  checks passed, but this browser retries failed imports itself. Acceptance
  for affected browsers remains unverified.
- **Exit 1:** inspect the actual error. A bind/launch denial is an environment
  block; an assertion after browser execution may demonstrate an implementation
  or harness defect. Do not conflate them.

For exit 2, use an available supported browser exhibiting cached failures to
complete the remaining gate. Do not remove the capability check, convert exit 2
to success, or silently narrow browser support. Browser version alone is not
proof of its observed native-import behavior.

## 3. Fix only demonstrated Phase 31B failures

If a runnable smoke exposes a failure:

- preserve the command, failing assertion, and relevant request/render evidence;
- distinguish adapter behavior, deployment configuration, and a demonstrably
  incorrect test harness before choosing a fix;
- make the smallest correction in the responsible Phase 31B code;
- add a focused regression when needed to retain the demonstrated behavior;
- rebuild if code or build configuration changes, then rerun the full existing
  browser smoke and the required checks against the final checkout.

Change the smoke itself only to correct a demonstrated harness defect, with
equivalent or stronger assertions and an explanation of the original failure.
Do not suppress unexpected errors, skip failure-injection scenarios, weaken
same-origin checks, replace real native imports with mocks, or loosen the
containment oracle just to obtain a pass.

Preserve exact-source fallback, Worker retirement, finite retry/storage/work
limits, isolated state, immutable cache reuse, ink/advance correctness, local
lazy assets, and the exact dependency pins. Do not reopen the loading or
geometry architecture without evidence that the existing implementation fails.

## Documentation

Update `docs/LABEL_ADAPTER.md` with the actual command, environment/browser
version, exit status, request/recovery evidence, artifact paths, and remaining
limitations. Separate static deployment checks, deterministic tests, and real
browser observations.

Keep `docs/PREVIEW_UI.md` and `docs/ROADMAP.md` consistent. If every Phase 31B
gate passes, replace the current blocked status with the verified adapter
completion status. If execution remains blocked or exits 2, retain the precise
outstanding gate. Do not state that historical browser assertions ran when they
did not, or that production canvas integration is now enabled.

## Verification

Prepare local generated assets and run the seven focused files:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/prepareMathjaxAssets.mjs
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/rendering/labelMetrics.test.ts \
  tests/rendering/labelSvg.test.ts \
  tests/rendering/labelService.test.ts \
  tests/rendering/labelServiceLifecycle.test.ts \
  tests/rendering/mathjaxAdapter.test.ts \
  tests/rendering/mathjaxErrors.test.ts \
  tests/rendering/mathjaxLoader.test.ts
```

Run the full suite and production build:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

Run targeted lint and script checks:

```bash
PATH=/opt/homebrew/bin:$PATH npx eslint \
  src/rendering/labels/labelSvg.ts \
  src/rendering/labels/labelMetrics.ts \
  src/rendering/labels/labelInkBounds.ts \
  src/rendering/labels/labelService.ts \
  src/rendering/labels/mathjaxConfig.ts \
  src/rendering/labels/mathjaxEngine.ts \
  src/rendering/labels/mathjaxRuntime.ts \
  src/rendering/labels/mathjaxShared.ts \
  src/rendering/labels/mathjaxWorker.ts \
  src/rendering/labels/mathjaxWorkerClient.ts \
  src/rendering/labels/mathjaxWorkerProtocol.ts \
  vite.config.ts \
  tests/rendering/labelMetrics.test.ts \
  tests/rendering/labelSvg.test.ts \
  tests/rendering/labelService.test.ts \
  tests/rendering/labelServiceLifecycle.test.ts \
  tests/rendering/mathjaxAdapter.test.ts \
  tests/rendering/mathjaxErrors.test.ts \
  tests/rendering/mathjaxLoader.test.ts \
  scripts/prepareMathjaxAssets.mjs \
  scripts/checkLabelAssets.mjs

PATH=/opt/homebrew/bin:$PATH node --check scripts/prepareMathjaxAssets.mjs
PATH=/opt/homebrew/bin:$PATH node --check scripts/checkLabelAssets.mjs

git diff --check
```

Run the browser command above against the successful fresh build. A successful
run on the same final code/build need not be repeated just because documentation
was updated. Include any additional changed files in targeted checks, and
register new unit test files in the explicitly enumerated `npm test` script.

Report actual counts and statuses rather than copying review results. Keep
focused and full-suite totals separate because the focused files are a subset
of the full suite. Node results exercise their own loading branch and must not
be described as production browser Worker verification. Separate
non-failing large-chunk warnings and unchanged global lint debt from new errors.

## Scope and preservation requirements

Limit changes to completion documentation and demonstrated Phase 31B defects.
No production change is required merely to close a verification-only review.

Do not implement Phases 31C–31F: canvas/React/picking integration, path labels,
export lifecycle waiting, or later integration work. Do not change diagram
schema, saved labels, coordinates, history, TikZ generation, or existing
production label rendering. Keep strict TypeScript without `any` and avoid
unrelated cleanup.

## Acceptance criteria

Phase 31B can be called complete only when:

- the fresh-build browser smoke completes with exit 0 and actual evidence for
  base-path deployment, Worker execution, additional-font requests, native
  failure/recovery, and standalone SVG containment;
- same-page/same-service recovery is verified on an affected browser, with
  no skipped scenarios or weakened assertions;
- any demonstrated Phase 31B defect is corrected and regression coverage passes;
- focused/full tests, build, targeted lint, syntax, and diff checks pass;
- documentation matches the observed final implementation and verification;
- no Critical or Medium issue remains, and Phases 31C–31F remain deferred.

An environment block or exit 2 leaves acceptance incomplete. Passing static
inspection and unit tests alone cannot close this review.

## Report after implementation

Report:

- whether the existing smoke passed unchanged, and any demonstrated defect
  that required a code or harness change;
- files changed and the reason for each change;
- exact commands, execution environment, Node/browser versions, exit statuses,
  tested revision/changes, and separate focused/full test counts;
- actual failed/restored module requests, same-service recovery, Worker
  retirement, base-path/font loading, and standalone containment evidence;
- artifact and log paths, with static and browser evidence distinguished;
- documentation updates and whether every Phase 31B gate now passes;
- any remaining blocked check, its exact cause, and the assertions that did
  not run; include the concrete permitted-environment handoff if needed,
  without claiming completion of Phase 31B or later work while its gate is open.
