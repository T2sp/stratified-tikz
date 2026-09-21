# Phase 31C Targeted Fix Prompt: Correct browser font measurement and finish acceptance

## Environment

Work on the current Phase 31C checkout, preserving the free-label renderer,
strengthened browser harness, actual App fixture, tests, documentation, and any
uncommitted user work. Do not reset the branch or restore an earlier version.

The latest review covered `4b25b82` plus working-tree changes, including
then-untracked browser scripts and fixtures. Those files may since have been
committed. Inspect the current revision and pending changes; do not check out
the bare historical commit and accidentally omit the harness improvements.

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

The authorized browser run has now reached an assertion and exposed a confirmed
harness font-measurement defect. Correct that targeted defect, preserve the
strengthened coverage, and run the full check in a permitted environment.
Do not add dependencies, change pinned MathJax versions, or redesign production
rendering/picking without evidence of a separate production defect.

Required verification includes actual browser acceptance, focused tests,
`npm test`, `npm run build`, strict fixture TypeScript, targeted lint, all four
browser-script syntax checks, and `git diff --check`.

## Latest review findings and browser follow-up

The latest review reported `needs_changes`: no Critical issues, exactly one
Medium issue, and no Low-priority issues. **No concrete implementation defect
was found.** No source files were modified by the review.

### Historical review: local-server startup was blocked

`npm run check:free-labels` reached development-server startup in
`scripts/checkFreeLabels.mjs:59`, then exited 1 with:

```text
listen EPERM: operation not permitted 127.0.0.1:5173
```

Chrome never launched and zero browser assertions ran. The recorded evidence
at `/private/tmp/stz-review31c-browser/free-labels-evidence.json` contains:

- `result: "failed"` and `stage: "development-server-listen"`;
- `environment.browserVersion: null`;
- empty `completed` and `evidence` arrays;
- all eight required scenario groups incomplete and unexecuted;
- the `EPERM` error and checkout identity, including pending harness files.

That restriction describes the earlier review environment. The authorized
Terminal attempt below supersedes it as the latest browser outcome; do not
continue reporting the current failure as pre-launch `EPERM`.

### Current M1 follow-up: an incorrect font measurement fails the tab assertion

The user ran the existing harness in an authorized Terminal. Evidence is in
`/private/tmp/stz-phase31c-browser-acceptance.POb7Fz`. It identifies revision
`4b09c181dcea6b7db9f46daf7d82ef322ef4e3ee`, with only this prompt modified,
Node v26.9.0, Chrome `153.0.8010.52`, and a development origin at
`http://127.0.0.1:5174`. The browser command exited 1 at `renderer-fixture`:

```text
AssertionError [ERR_ASSERTION]: Tab advances to a measured four-space stop
scripts/checkFreeLabels.mjs:150:10
```

Chrome launched and initial renderer/source/state/whitespace assertions ran.
The check failed before the first grouped evidence record. `completed: []`
therefore means no complete scenario group, not zero executed assertions.
The current `unexecuted` field is inferred from an empty evidence array and
does not accurately distinguish this partial renderer run from a startup
failure. The later geometry/race/policy/App groups did not run.

A separate permitted diagnostic reproduced the same fallback source and font
through the production fixture. Its script and measurements are retained at
`/private/tmp/stz-phase31c-tab-diagnostic.mjs` and
`/private/tmp/stz-phase31c-tab-diagnostic.json`. These establish the cause:

| Measurement | Observed value |
| --- | --- |
| `getComputedStyle(text).font` | Empty string |
| Canvas font after assigning that shorthand | `10px sans-serif` (unchanged default) |
| Displayed font size | `24.3px` |
| Space advance from incorrect default Canvas font | 2.7783203125 |
| Space advance with explicit displayed font | 5.382659912109375 |
| First fragment's SVG text advance | 212.21875 |
| First fragment's explicit-font Canvas advance | 212.2062225341797 |
| Actual next-fragment x | 215.306396484375 |
| Incorrect shorthand-based expected tab x | 222.265625 |
| Explicit-font Canvas expected tab x | 215.306396484375 |
| Independent SVG-space expected tab x | 215.625 |

The displayed family is `Inter, ui-sans-serif, system-ui, "Segoe UI", Roboto,
sans-serif`, with normal style and weight 400. The diagnostic native SVG space
advance is 5.390625; its expected stop differs from the actual position by
about 0.319, within the existing 0.5-unit assertion tolerance. The production
position matches the explicit-font Canvas computation exactly.

The failing oracle assigns an empty computed `font` shorthand to a new Canvas
context, silently leaving its default 10px font active. It then combines that
incorrect space width with the actual SVG text advance. This confirms a
**harness defect for this failure**, not a production tab-layout defect.
Do not change production tab positions or widen tolerances to match the bad
oracle. These measurements diagnose one assertion; they do not establish a
passing full browser run or rule out failures in later groups.

The earlier review also found missing coverage. The follow-up has now added
independent content measurements, boundary probes, controlled races, pending
policy checks, and actual App workflows. Preserve these assertions; do not
present the earlier coverage gaps as still-unimplemented work or start another
rewrite without a demonstrated failure.

The latest review used Node v26.9.0 with `/opt/homebrew/bin` first in `PATH`:

| Check | Previous review result |
| --- | --- |
| Full suite | Exit 0; 2,281 passed, none failed or skipped |
| Focused layout/runtime/picking | Exit 0; 23 passed, included in the full-suite total |
| Strict fixture TypeScript | Exit 0 |
| Four browser-script syntax checks | Exit 0 |
| Targeted ESLint | Exit 0 |
| `git diff --check` | Exit 0 |
| Production build | Exit 0; nonblocking chunk-size warning |
| Review's free-label browser check | Exit 1 before browser launch; no assertions executed |

Repository-wide lint was skipped. App/SvgDiagram diagnostics showed 10 errors
and 4 warnings, unchanged against both the review's `HEAD` and pre-31C
`fb8b380`. Keep baseline debt separate from targeted check results.

These are historical results, not new evidence for this attempt. Passing Node
helpers, build/static inspection, or the Phase 31B adapter smoke cannot replace
Phase 31C production-renderer and App browser verification.

## What the review confirmed correct

Preserve the implementation supported by code inspection:

- source/font identity checks and effect-owned generation cleanup reject stale
  results;
- rendering and picking share current measured bounds, nine-anchor placement,
  and the established font scale;
- literal fallback uses React text, and immutable geometry receives current
  color and opacity;
- runtime results remain outside the model and history;
- browser tests now exercise production components and actual App events;
- inline-node conversion and settled-export waiting remain deferred.

These are code-inspection findings, not evidence that browser assertions passed.

## Goal

Correct the confirmed test-only font-measurement defect and obtain complete
Phase 31C browser evidence in an environment permitting the local development
server and Chrome/Chromium. Fix only further demonstrated failures, rerun the
applicable checks, and update documentation to reflect the actual result.

Keep 31D inline nodes, 31E settled-export waiting, and 31F's combined audit
deferred. A production change is not required to fix this diagnosed assertion.

## Required reading before proceeding

Read at least:

- `AGENTS.md`, this prompt, `prompts/phase-31c-implement.md`, and
  `prompts/phase-31c-review.md`;
- the latest review report, or the findings reproduced above;
- the authorized run's `free-labels-evidence.json`, `browser.log`, and
  `failure.png`, plus the separate tab diagnostic described above;
- the free-label verification section of `docs/PREVIEW_UI.md` and Phase 31
  entries in `docs/ROADMAP.md`;
- `scripts/checkFreeLabels.mjs`, `scripts/checkFreeLabelGeometry.mjs`,
  `scripts/checkFreeLabelRaces.mjs`, and `scripts/checkFreeLabelsApp.mjs`;
- `scripts/fixtures/freeLabels.tsx`, `scripts/fixtures/freeLabelsApp.tsx`,
  their HTML entries, `scripts/fixtures/labelBrowserOracle.ts`, and
  `scripts/fixtures/tsconfig.json`;
- `package.json`, `vite.config.ts`, and the focused tests;
- production renderer, runtime/layout/picking helpers, and App input/load/
  revision/history paths as needed to diagnose any observed failure.

Do not replace the existing assertions with a weaker verification path.

## 1. Correct the confirmed font oracle and preserve failure diagnostics

Fix the tab-space measurement in `scripts/checkFreeLabels.mjs:142`. Do not
assume the computed `font` shorthand is nonempty or accepted by Canvas.

Prefer measuring a space through a temporary SVG text clone with the same
displayed font/whitespace properties, cleaning it up in `finally`. Alternatively,
construct a valid Canvas font from explicit computed longhands, check the font
actually accepted by the context, and match kerning/text-rendering properties
using valid Canvas values. Keep the measurement independent of production
layout results; do not read the tab's expected x from its actual placement.
Avoid hard-coded 24.3px fonts or diagnostic widths in the implementation.

Audit the same assumption in `scripts/fixtures/labelBrowserOracle.ts:67`,
which measures leading/trailing whitespace using the computed shorthand.
Correct that test-only measurement consistently without weakening the alpha-
pixel oracle, its negative controls, or its finite whitespace allowances.
Retain visible fraction rules and other painted rectangles.

Add meaningful browser regression evidence for the empty/unusable shorthand
case using the displayed non-default font. Cover tab advance and literal edge
whitespace, verify current font properties are used, and show that measuring
with the unrelated default 10px font is not accepted as a valid oracle.
Preserve the existing 0.5-unit tab tolerance; the diagnostic native SVG result
already satisfies it. Keep CRLF-as-one-line-break and complete-source checks.

Persist fragment text, x/y, SVG advance, computed font longhands/shorthand,
effective measurement font or SVG clone properties, measured space width,
expected stop, actual x, and delta before the assertion can throw. Distinguish
diagnostic observations from a passing scenario record. Record the current
checkpoint or started groups so partial renderer execution is not reported as
zero browser assertions merely because no group completed. Keep incomplete
groups and overall failure status accurate; do not mark a group complete early.

The production calculation in `labelMetrics.ts` and placement in
`SvgTexLabel.tsx` are consistent with the measured correct font. Leave them
unchanged unless a further independent browser failure demonstrates a defect.

## 2. Establish a permitted environment and run the corrected check

Check the active session's permissions and available tools. Use the supported
approval/escalation mechanism for local-server/browser execution when available
and permitted; do not assume an earlier session's `never` policy applies now.
If escalation is prohibited or approval is denied, respect that restriction
and use an authorized Terminal or CI environment for the handoff.

Do not repeatedly run the same command under unchanged restrictions, disable
browser security, or silently change persistent runner/sandbox settings.
Changing a port to evade a permission denial does not complete acceptance.

Use the existing external Playwright and Chrome/Chromium arrangement. Resolve
actual tool paths and retain the complete current checkout, including any
still-untracked scripts/fixtures. If moving to another environment, transfer
the pending changes and files; the historical base commit alone is insufficient.

Use a fresh artifact directory. The following block runs from this repository
on the current machine and preserves the browser process's exit status:

```bash
(
  cd /Users/takamatoshinori/Desktop/stratified-tikz || exit 1
  export PATH=/opt/homebrew/bin:$PATH
  STZ_31C_EVIDENCE_DIR="$(mktemp -d /private/tmp/stz-phase31c-browser-acceptance.XXXXXX)" || exit 1
  printf 'Evidence directory: %s\n' "$STZ_31C_EVIDENCE_DIR"

  node scripts/prepareMathjaxAssets.mjs >"$STZ_31C_EVIDENCE_DIR/prepare.log" 2>&1
  STZ_31C_PREPARE_STATUS=$?
  printf '%s\n' "$STZ_31C_PREPARE_STATUS" >"$STZ_31C_EVIDENCE_DIR/prepare.exit-status"
  if [ "$STZ_31C_PREPARE_STATUS" -ne 0 ]; then
    cat "$STZ_31C_EVIDENCE_DIR/prepare.log"
    exit "$STZ_31C_PREPARE_STATUS"
  fi

  STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
  STZ_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  STZ_SMOKE_ARTIFACT_DIR="$STZ_31C_EVIDENCE_DIR" \
  npm run check:free-labels >"$STZ_31C_EVIDENCE_DIR/browser.log" 2>&1
  STZ_31C_BROWSER_STATUS=$?
  printf '%s\n' "$STZ_31C_BROWSER_STATUS" >"$STZ_31C_EVIDENCE_DIR/browser.exit-status"
  printf 'Browser exit status: %s\n' "$STZ_31C_BROWSER_STATUS"
  if [ "$STZ_31C_BROWSER_STATUS" -ne 0 ]; then
    tail -n 60 "$STZ_31C_EVIDENCE_DIR/browser.log"
  fi
  exit "$STZ_31C_BROWSER_STATUS"
)
```

This check starts a **Vite development server** and loads development fixtures
using the production renderer and actual App. It is not a `dist` asset smoke.
An explicitly configured `STZ_BROWSER_BASE_URL` must point to a permitted
development server serving this exact checkout and its fixtures. A production
build alone does not serve them. Check for a stale inherited base URL before
running; use the default local server when no external origin is intended.

Record the exact command, Node version, actually launched browser version,
exit status, and artifact path. The harness records the current revision,
tracked diff/hash, and complete untracked contents/hashes. Match these to the
reviewed code; preserve later compatible commits rather than forcing the old
revision name.

If no permitted environment is accessible, provide this concrete command with
resolved paths and the final checkout identity/pending-file handoff. State
which assertions did not run and keep acceptance incomplete. A handoff is not
a browser pass, and an installed browser version is not a launched-browser
observation.

## 3. Inspect all browser scenarios and saved evidence

Keep the current assertions active and inspect their actual results:

1. Existing renderer regressions: real MathJax, mixed Japanese/text/math,
   physical lines, complete current-source fallback and whitespace, finite
   dimensions, nine anchors, paint, duplicate immutable geometry, click/cycling/
   drag behavior, and conversion reuse.
2. Independent content oracle: alpha-pixel/native content measurements exclude
   transparent hit boxes and overlays but retain painted formula rules.
   Inflated/displaced bounds negative controls must be rejected. Preserve
   documented finite ink/advance/leading allowances and coordinate transforms.
3. Boundary matrix: tall and compact formulas across center/north/east in 2D,
   after pan/zoom, and under a changed 3D camera. All 18 cases must run, with
   real normal/Alt probes, selected targets, callback counts, and obsolete
   raw-source-width probes for compact formulas.
4. Controlled races: source, independent bounds, and actual picking agree at
   pending, newer-completed, and obsolete-completed stages. Obsolete success
   and failure both run; current placement/style/selection and model/history/
   both TikZ modes remain unaffected by stale completion.
5. Pending policy: locking removes interaction/drag access while a request is
   held; autoHide stays hidden and unselectable after delivery. Unlocking,
   restored visibility, hidden/filtered layers, and autoDim preserve policy.
6. Deletion/unmount: held request instrumentation proves delivery even when
   DOM pending markers disappear; stale results cannot resurrect content.
7. Actual App: textarea edits, valid-invalid-valid, JSON download/import/reload
   with raw source and CRLF, Undo/Redo while held, preserved redo branches, and
   real loads reusing label IDs and advancing document revisions. Preserve
   both TikZ modes and revision-correct picking.
8. Current SVG cloning: transparent/white export retains settled geometry and
   current literal fallback and removes overlays. Do not require or introduce
   31E waiting for settlement.

Inspect `free-labels-evidence.json`, `browser.log`, `browser.exit-status`,
`checkout.diff`, and `checkout-untracked.json`, plus `geometry-*.png`, race/
policy screenshots, `app-*.png`, downloaded App JSON, and `settled-export.png`.
Screenshots alone do not replace assertions or measured/pointer evidence.

### Interpret completion accurately

Require all of the following:

- browser command exit 0;
- evidence `result: "passed"`, `stage: "complete"`, and a real
  `environment.browserVersion`;
- all eight scenario groups present in `completed`;
- empty `incompleteGroups` and `unexecuted`, and no uncaught `pageErrors`;
- per-scenario geometry/pointer/race/App observations and corresponding
  artifacts for this exact implementation.

The eight group names are:

```text
existing-renderer-regressions
independent-oracle-negative-controls
boundary-anchor-camera-matrix
inverted-success-and-failure-races
pending-lock-and-autohide
deletion-and-unmount
real-App-input-JSON-history-reused-ID-load
current-SVG-cloning
```

A failed run can still save checkout metadata, partial evidence, and a failure
screenshot if it reached a page. Report the failing stage and incomplete groups.
Do not label a pre-launch failure, partial run, or skipped scenario as a pass.
Do not import Phase 31B's special exit-2 interpretation into this script.

## 4. Fix only further demonstrated Phase 31C failures

After correcting the confirmed oracle defect, retain evidence for any further
assertion failure and diagnose whether it is in the product or test setup.
Make the smallest justified fix, add focused regressions where appropriate,
and rerun affected browser coverage and required checks. Do not infer that
fixing the first assertion completes the previously unexecuted groups.

Do not weaken independent measurement, widen tolerances without measured
justification, replace pointer probes with direct selection, bypass App
handlers with fixture state assignment, skip race/pending cases, suppress
unexpected browser errors, or force completion flags to obtain a pass.

Keep test seams development-gated and preserve source ownership, generation
cleanup, anchors, picking policy, immutable reuse, 2D/3D interactions, layer/
occlusion behavior, and SVG cloning. Runtime results stay outside model JSON,
history, and TikZ.

## Documentation

Update `docs/PREVIEW_UI.md` with actual commands, execution environment,
Node/launched-browser versions, exit status, checkout identity, observations,
artifact paths, and remaining limitations. Distinguish implemented tests from
executed tests. Keep historical blocked attempts identified as historical.
Record the authorized Chrome run's tab assertion separately from historical
`EPERM` attempts and from the subsequent font diagnostic. Do not describe the
current state as solely a browser-startup restriction or claim full acceptance
from the targeted diagnostic.

Keep `docs/ROADMAP.md` consistent. Mark 31C acceptance complete only after all
required groups pass. Preserve Phase 31B's verified evidence and keep 31D–31F
deferred. If the run remains blocked or fails, retain the precise open gate.

## Verification

Run focused tests, full suite, build, strict fixture TypeScript, and script
checks with the required Node PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
node scripts/prepareMathjaxAssets.mjs
node --test \
  tests/rendering/svgLabelLayout.test.ts \
  tests/rendering/svgLabelRuntime.test.ts \
  tests/rendering/svgLabelPicking.test.ts
npm test
npm run build
node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.json --noEmit
node --check scripts/checkFreeLabels.mjs
node --check scripts/checkFreeLabelGeometry.mjs
node --check scripts/checkFreeLabelRaces.mjs
node --check scripts/checkFreeLabelsApp.mjs
node node_modules/eslint/bin/eslint.js \
  scripts/checkFreeLabels.mjs scripts/checkFreeLabelGeometry.mjs \
  scripts/checkFreeLabelRaces.mjs scripts/checkFreeLabelsApp.mjs \
  scripts/fixtures/freeLabels.tsx scripts/fixtures/freeLabelsApp.tsx \
  scripts/fixtures/labelBrowserOracle.ts \
  src/rendering/SvgTexLabel.tsx src/rendering/labels/svgLabelLayout.ts \
  src/rendering/labels/svgLabelRuntime.ts src/rendering/svgLabelBounds.ts \
  src/rendering/svgHitTesting.ts tests/rendering/svgLabelLayout.test.ts \
  tests/rendering/svgLabelRuntime.test.ts tests/rendering/svgLabelPicking.test.ts
git diff --check
```

Run the browser command above on the final corrected harness. A successful run
need not be repeated for later documentation-only changes. Include additional
modified files in targeted checks and register new Node tests explicitly in
`npm test`. Record actual results; focused counts are included in the full
suite and must not be added to its total.

If touching App/SvgDiagram, compare diagnostics against the baseline and
introduce no new failures. Run repository-wide lint only if lint-clean; avoid
unrelated baseline cleanup. Report nonblocking chunk-size warnings separately.

The Phase 31B asset/browser smoke is separate. Rerun it if adapter/loading/build
changes warrant it, with a fresh build and configured browser tools; its
success does not replace Phase 31C interaction evidence.

## Scope and preservation requirements

Limit changes to the confirmed test-oracle fix, related diagnostic/regression
coverage, completion documentation, and any further demonstrated Phase 31C
product or harness defect. Use strict TypeScript without `any`.

Preserve raw-source authority, JSON schema, coordinates, history semantics,
both TikZ modes, free-label behavior, existing user changes, and dependencies.
Do not implement inline-node conversion, new stratum-label uses, settled-export
waiting, or unrelated cleanup.

## Acceptance criteria

Phase 31C can be called complete only when the font oracle uses actual displayed
font metrics without relaxing the existing tolerance, the strengthened check
passes all eight groups on the identified current implementation, saved
evidence supports every required observation, any demonstrated defects are
fixed, required non-browser checks pass, and documentation matches the result.
No Critical or Medium issue may remain; 31D–31F remain deferred.

An environment block, partial run, or unexecuted browser assertion leaves M1
open. Node tests and static inspection alone cannot close it.

## Report after implementation

Report the confirmed font-oracle defect and fix, its independent regression
evidence, further observed failures and minimal fixes; files modified;
exact commands, versions, exit statuses,
revision/pending-file identity, and focused/full counts; scenario evidence,
logs and artifact paths; documentation status; and remaining blocked checks,
exact restrictions, and a concrete permitted-environment handoff if needed.
State explicitly whether every Phase 31C acceptance gate passed.
