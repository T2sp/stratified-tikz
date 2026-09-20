# Phase 31C Targeted Fix Prompt: Complete browser coverage for bounds, races, and editor workflows

## Environment

Work on the current Phase 31C checkout. Preserve the implemented free-label
renderer, runtime, layout/picking integration, tests, and any uncommitted user
work. Do not reset the branch or replace the implementation with an earlier
version. Inspect the current checkout before applying the findings below;
review line numbers identify starting points and may have moved.

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

This is a targeted acceptance follow-up. Extend the existing browser harness
to cover the missing behavior, then run it in a permitted browser-capable
environment. No production defect was confirmed by the review; change
production behavior only when a concrete failure demonstrates the need.
Small test seams may be added when necessary to exercise the actual App.
Do not add dependencies or change the pinned MathJax versions.

Required verification includes the extended browser check, focused tests,
`npm test`, `npm run build`, targeted lint, browser-fixture TypeScript checks,
browser-script syntax checks, and `git diff --check`.

## Latest review findings

The latest Phase 31C review reported `needs_changes`: no Critical issues,
exactly one Medium issue, and no Low-priority issues. It found no concrete
production defect by code inspection and modified no source files.

### Medium M1: required browser verification is incomplete

M1 has two distinct parts: the browser run was blocked by the environment,
and the current assertions do not cover all required acceptance cases.
Running the existing harness unchanged successfully would not close M1.

- `scripts/checkFreeLabels.mjs:61` clicks label centers, leaving just-inside
  and just-outside boundary picking unverified.
- Its delayed-result checks around line 255 check source/state/style but not
  resulting bounds and actual pointer selection.
- Its visibility checks around line 222 run after settlement, leaving layer
  locking and autoHide transitions during pending conversion untested.
- `scripts/fixtures/freeLabels.tsx:124` and its mutation/history helpers
  bypass actual App document-load and editor-input paths. Calling those
  helpers alone does not verify App revision invalidation or editing history.
- Native-bounds assertions around fixture line 278 include the transparent
  rectangle generated from the published bounds. An oversized hit rectangle
  can therefore make the assertion pass without matching visible content.

The configured `check:free-labels` command exited 1 before browser assertions:

```text
listen EPERM: operation not permitted 127.0.0.1
```

Computer Use also reported that Chrome access was not approved. These are
execution restrictions, not evidence that a rendering assertion failed.
The additional `check:label-assets` attempt passed static asset checks but
its configured browser stage encountered the same bind restriction; an
earlier unconfigured attempt also lacked the default Playwright import.

The review recorded these historical results:

| Check | Previous review result |
| --- | --- |
| Full suite | Passed; 2,281 tests |
| Production build | Passed; nonblocking chunk-size warning |
| `git diff --check` | Passed |
| Focused ESLint | Passed |
| Browser-fixture TypeScript and browser-script syntax | Passed |
| Required free-label browser acceptance | Unavailable; exit 1 before assertions |
| Repository-wide lint | Skipped; unchanged baseline debt of 10 errors and 4 warnings in App/SvgDiagram confirmed against `HEAD` |

Do not copy these historical results into this follow-up's completion report.
Record new commands, counts, statuses, and evidence separately. Passing Node
helpers or the Phase 31B adapter smoke cannot establish Phase 31C browser
positioning, event behavior, or App workflows.

## What the review confirmed correct

Preserve the implementation supported by code inspection:

- Conversion uses an effect-owned controller with request identity and
  generation checks.
- Rendering and picking share committed layout bounds; anchors use measured
  extents rather than successful formulas' raw source length.
- Pending and failure rendering use the complete latest source as SVG text.
- Immutable geometry is reused without shared DOM nodes; camera, position,
  and paint remain separate from conversion inputs.
- Runtime results stay outside the diagram model, history, and TikZ.
- Current SVG export cloning retains settled formula geometry.
- Inline-node conversion and settled-export waiting remain deferred.

These are code-inspection findings, not a substitute for browser observations.

## Goal

Close M1 with independent geometric assertions and real browser interactions
through production rendering, picking, and App editing/loading paths. Retain
reproducible evidence. Fix only demonstrated Phase 31C defects, then update
the completion documentation to match the actual outcome.

Keep Phase 31D inline-node integration, Phase 31E settled-export waiting, and
Phase 31F's combined completion audit deferred.

## Required reading before fixing

Read at least:

- `AGENTS.md`, this prompt, and `prompts/phase-31c-implement.md` and
  `prompts/phase-31c-review.md`;
- the latest review report, or the findings reproduced above;
- `scripts/checkFreeLabels.mjs`, `scripts/fixtures/freeLabels.tsx`, and
  `scripts/fixtures/freeLabels.html`;
- `src/rendering/SvgTexLabel.tsx`, `src/rendering/SvgDiagram.tsx`,
  `src/rendering/labels/svgLabelLayout.ts`,
  `src/rendering/labels/svgLabelRuntime.ts`,
  `src/rendering/svgLabelBounds.ts`, and `src/rendering/svgHitTesting.ts`;
- the shared label service/metrics and the projection, visibility, layer,
  selection, and drag paths used by these components;
- `src/App.tsx`, especially free-label input, document loading/reset,
  `labelDocumentRevision`, and Undo/Redo;
- production serialization, history, TikZ, and current SVG-export paths;
- `tests/rendering/svgLabelLayout.test.ts`,
  `tests/rendering/svgLabelRuntime.test.ts`,
  `tests/rendering/svgLabelPicking.test.ts`, and related existing tests;
- Phase 31 sections of `docs/PREVIEW_UI.md` and `docs/ROADMAP.md`, plus
  `package.json`, `vite.config.ts`, and the fixture type-check setup.

## 1. Measure visible content independently

Replace or supplement the circular native-bounds assertions. Measure actual
painted math/text independently of `data-label-bounds`, runtime layout output,
and transparent picking rectangles. Exclude editor-only overlays and handles.
Retain visible MathJax rectangles and fraction rules; excluding every `rect`
would also remove real formula content from the measurement.
Both the automated script and any retained fixture self-checks must use a
valid oracle; do not leave a misleading self-check labeled as proof of bounds.

Possible approaches include native measurements of the visible descendants
with their real SVG transforms, or raster measurements of an isolated visible
content clone. Do not measure the whole label group when it still contains
the hit rectangle, and do not populate expected dimensions from the same
production layout function being checked.

Compare in a common coordinate system, including nested SVG viewBox transforms
and the canvas-to-client transform. Distinguish glyph ink from logical advance,
font leading, and the established picking tolerance. Exact equality between
ink and the full layout box is not required; document bounded allowances so
arbitrarily inflated bounds cannot pass merely by containing all ink.

Include a negative control showing that the oracle rejects a deliberately
inflated or displaced published/hit box while visible content stays unchanged.
Keep this perturbation local to the test and restore it before other checks.
Save the independent extents, published bounds, transforms, and tolerances in
the evidence so a reviewer can evaluate the comparison.

## 2. Exercise actual boundary picking

Use both a tall nested fraction and a compact formula whose raw TeX source is
substantially longer than its rendered display. Choose supported examples and
record the sources and measured sizes; the compact case must detect reuse of
the old raw-character-count hit width.

For both formulas, exercise center, north, and east anchors:

- in 2D before camera changes;
- after nontrivial 2D pan/zoom;
- in 3D with a changed camera and a nonzero-depth label position.

Retain existing coverage of all nine anchors. Verify projected anchor placement
against independently measured content and the documented layout allowances.

For each required case, send real pointer clicks just inside and outside each
relevant edge. Convert SVG coordinates to browser client coordinates using
the actual transform. Outside probes must lie beyond the applicable picking
tolerance, and both probes must avoid unrelated geometry or drag handles.
Include a point inside the obsolete raw-source estimate but outside the
correct compact-formula hit area.

Check normal clicks and production Alt-click/cycling behavior. Reset selection
between probes so an outside click cannot pass because an earlier selection
remained. Assert the actual selected target and callback/event behavior;
calling a pure hit-test helper or assigning selection directly is insufficient.
Preserve overlapping compiled/fallback label cycling and the single-event
policy for internal formula paths. Verify conversion invocation counts stay
unchanged for camera, position, paint, and selection-only changes.

## 3. Verify bounds and picking after asynchronous races

Use deterministic held completions, not arbitrary sleeps. Wait until the
intended request is actually pending before changing state or releasing it.
Use visibly different sizes for old and new inputs so stale bounds are
observable, rather than two similarly sized identifiers.

For two successive edits, release the newer request first and the older
request last. Cover both obsolete success and obsolete failure. At the current
pending state, after the newer completion, and after the obsolete completion:

- verify the complete current source and visible pending/ready/fallback output;
- independently inspect current visible extents and revision-matched bounds;
- probe actual selection at current boundaries and at a point that would
  have selected only the stale larger layout;
- verify the current position, font size/anchor, color, opacity, and selection
  are not restored from obsolete request state;
- verify JSON, history, and both TikZ outputs are unchanged by completion alone.

Retain valid-invalid-valid, deletion, and unmount checks, including no
resurrected DOM or selectable stale geometry. Assert observations after React
has committed each release; disappearance of a DOM pending marker alone does
not prove that a hidden, deleted, or unmounted request finished.

Repeat the reused-ID scenario through the actual App document replacement
path: start a held request in document A, load document B with the same label
ID and different content/layout through production loading, then complete A.
Verify B's source, independently measured bounds, pointer selection, and
history remain correct. A second `fixture.mount()` that manually increments
its own revision does not establish App load/reset behavior.

## 4. Exercise visibility and locking while pending

Hold a fresh conversion and establish that it is still pending. While it is
pending, lock its layer and exercise the production 3D autoHide policy.
Use production controls or visibility/layer props rather than merely changing
DOM styles. Assert policy behavior before and after releasing the request.

- Locked labels remain unselectable and cannot start a drag through either
  normal pointer handling or Alt-click/cycling.
- Auto-hidden labels expose no selectable geometry. Completing their held
  conversion must not make them visible or selectable while autoHide applies.
- Unlocking or restoring visibility uses the latest source and bounds, with
  the normal interaction behavior restored.
- Preserve existing hidden/filtered-layer and autoDim checks; dimmed labels
  keep the established opacity and picking policy.

Verify pending status using request instrumentation when the rendered label
is hidden or unmounted. Do not let the test silently become a settled-state
check or treat absence of a DOM pending marker as proof of completion.

## 5. Verify actual App input, JSON loading, and editing history

Keep the focused production-renderer fixture, but add coverage that mounts
the real App or drives the application page. Use real label editor input,
production JSON load/save controls, and Undo/Redo controls or shortcuts.
Do not satisfy these cases solely through fixture `mutateLabel`, `mount`,
`undo`, or direct model/history assignment.

A small development-only seam may control adapter completion or expose
read-only diagnostics. It must not replace App input handlers, document
revision changes, serialization, or history transitions with fixture copies.
Keep test controls out of normal product flows and production build entries.

Verify:

1. The label editor retains authoritative raw source through valid, invalid,
   and valid-again edits; pending/failure displays the latest complete source.
2. Saved JSON and reloaded labels preserve delimiters, backslashes, Unicode,
   spacing, and supported physical newlines without runtime results/metrics.
   Exercise exact CRLF preservation through JSON import/export where native
   textarea newline normalization would otherwise obscure the distinction.
3. Normal editing follows the existing history commit/coalescing semantics.
   Undo returns to the expected preceding edit and Redo reapplies it; arriving
   conversions add no history step and do not clear an existing redo branch.
4. Undo/Redo while conversion is held cannot let an obsolete result overwrite
   the restored source, bounds, or current pointer behavior.
5. The actual load/reset route with reused IDs satisfies section 3. Verify
   the production document-revision lifecycle rather than assuming it from
   a fixture-provided counter.
6. Both TikZ export modes remain determined by the model and existing
   formatting policy; result arrival does not alter their output.

Retain current SVG-cloning checks for settled formulas and pending literal
fallback. Do not introduce waiting for settled labels; that belongs to 31E.

## 6. Run the strengthened check in a permitted environment

Use an available external Playwright installation and Chrome/Chromium, as the
existing harness does. Resolve actual paths before execution and create a
fresh evidence directory. For the current machine, the documented setup is:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/prepareMathjaxAssets.mjs
STZ_31C_EVIDENCE_DIR="$(mktemp -d /private/tmp/stz-phase31c-browser-acceptance.XXXXXX)" || exit 1

PATH=/opt/homebrew/bin:$PATH \
STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
STZ_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
STZ_SMOKE_ARTIFACT_DIR="$STZ_31C_EVIDENCE_DIR" \
npm run check:free-labels >"$STZ_31C_EVIDENCE_DIR/browser.log" 2>&1
STZ_31C_BROWSER_STATUS=$?
printf '%s\n' "$STZ_31C_BROWSER_STATUS" >"$STZ_31C_EVIDENCE_DIR/browser.exit-status"
printf 'Evidence directory: %s\nBrowser exit status: %s\n' "$STZ_31C_EVIDENCE_DIR" "$STZ_31C_BROWSER_STATUS"
test "$STZ_31C_BROWSER_STATUS" -eq 0
```

The script currently starts a Vite development server and loads the fixture;
do not describe this as a built-asset browser test. An explicitly configured
`STZ_BROWSER_BASE_URL` must point to a permitted server serving this checkout
and its development fixtures. A production build alone does not serve them.

Check the active session's actual permissions. If localhost/browser access
is blocked, use the supported approval/escalation mechanism when available
and permitted. Do not infer that this session has the previous session's
policy. Do not repeatedly rerun the same blocked command without a relevant
environment change, disable browser security, or silently change persistent
sandbox/runner settings.

Complete the harness improvements and independent checks even when browser
execution needs a separate authorized Terminal or CI run. If no permitted
browser environment is accessible, provide a concrete handoff with the final
commands, resolved paths, tested revision/pending diff, and expected artifacts.
Keep browser acceptance incomplete; neither a handoff nor static-only success
counts as a passing run.

Retain `free-labels-evidence.json`, browser logs/exit status, and screenshots
covering the required cases, not just the final page. Extend evidence with
scenario names, sources, anchors/cameras, independent and published bounds,
pointer coordinates and selected targets, completion order, pending policy
transitions, App actions, and history observations. Record Node/browser versions
and the checkout revision plus any uncommitted changes. Record failures and
unexecuted scenarios accurately; do not emit an overall pass after a skip.

The Phase 31B asset smoke is separate. Rerun it when adapter/loading/build
changes warrant it, using a fresh build and configured external browser tools.
Preserve its existing assertions and report its static and browser stages
separately; it cannot substitute for the extended free-label check.

## Verification

Run the focused layout/runtime/picking tests and the full suite/build:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/prepareMathjaxAssets.mjs
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/rendering/svgLabelLayout.test.ts \
  tests/rendering/svgLabelRuntime.test.ts \
  tests/rendering/svgLabelPicking.test.ts

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

PATH=/opt/homebrew/bin:$PATH node --check scripts/checkFreeLabels.mjs
PATH=/opt/homebrew/bin:$PATH node node_modules/eslint/bin/eslint.js \
  scripts/checkFreeLabels.mjs \
  scripts/fixtures/freeLabels.tsx \
  src/rendering/SvgTexLabel.tsx \
  src/rendering/labels/svgLabelLayout.ts \
  src/rendering/labels/svgLabelRuntime.ts \
  src/rendering/svgLabelBounds.ts \
  src/rendering/svgHitTesting.ts \
  tests/rendering/svgLabelLayout.test.ts \
  tests/rendering/svgLabelRuntime.test.ts \
  tests/rendering/svgLabelPicking.test.ts

git diff --check
```

Include all additional changed files in targeted checks. Register any new Node
test files explicitly in `npm test`. Type-check all development TS/TSX fixtures
with strict settings: the current application build includes `src` and does
not include `scripts/fixtures`. Use a reproducible fixture tsconfig with the
app's compiler options, `strict: true`, Vite/DOM types, and the fixture entry
files. Do not rely on a previous session's `/private/tmp` config still existing.

If touching App/SvgDiagram, compare their lint diagnostics against the baseline
and introduce no new failures. Keep the review's unchanged 10 errors and
4 warnings distinct from targeted check results; do not perform unrelated
lint cleanup. Run repository-wide lint only if the repository is lint-clean.

Run the strengthened browser command on the final implementation. Report
actual results and counts, with focused tests identified as a subset of the
full suite. A successful browser run does not need repeating for subsequent
documentation-only changes. Nonblocking build-size warnings are not failures.

## Documentation

Update the Phase 31C verification section in `docs/PREVIEW_UI.md` with actual
coverage, reproducible commands, environment, exit status, artifact locations,
and any remaining limitations. Correct claims based on the old circular
bounds assertion or fixture-only App coverage.

Keep `docs/ROADMAP.md` consistent: mark 31C complete only after all required
browser cases actually pass. Keep historical blocked attempts identifiable
as historical. Preserve Phase 31B's verified evidence and leave 31D/31E/31F
deferred. Do not rewrite unrelated documentation.

## Scope and preservation requirements

Limit changes to the acceptance harness, focused regressions, necessary small
test seams, completion documentation, and any demonstrated Phase 31C defect.
Do not proactively redesign the adapter, lifecycle, or picking architecture.

Preserve raw-source authority, JSON schema, coordinates, history semantics,
both TikZ modes, 2D/3D interactions, layer and occlusion policy, immutable
conversion reuse, exact-source fallback, and current SVG export behavior.
Use strict TypeScript without `any`. Keep derived results out of persistence
and history. Do not add inline-node typesetting, new stratum-label uses,
settled-export waiting, dependencies, or unrelated cleanup.

## Acceptance criteria

Phase 31C can be called complete only when:

- independent content measurement detects incorrect bounds without using
  the transparent hit rectangle as its own oracle;
- tall/compact formulas pass center/north/east boundary picking in 2D,
  after pan/zoom, and in 3D through production pointer/event paths;
- current bounds and selection remain correct after inverted completions,
  obsolete failure, and actual App document loads reusing label IDs;
- lock/autoHide behavior is verified while pending and after completion;
- actual App input, JSON, and Undo/Redo preserve source and history, with
  no conversion-derived history entries or stale restored layouts;
- the extended browser check passes with saved, reviewable evidence and no
  omitted required cases;
- relevant tests, build, fixture type-check, targeted lint, syntax, and diff
  checks pass, and documentation accurately reports their scope;
- no Critical or Medium issue remains and later subphases stay deferred.

Environment restrictions or unexecuted browser assertions leave M1 open.
Passing pure helpers or the old harness alone cannot close it.

## Report after implementation

Report files changed and why; how each M1 coverage gap is now tested; any
demonstrated production defect and its minimal fix; exact commands, exit
statuses, Node/browser versions, revision/diff identity, and separate
focused/full test counts; browser artifact paths and measured/pointer/race/App
evidence; baseline lint debt and nonblocking warnings; documentation status;
and any remaining blocked check with its exact cause and concrete handoff.
State explicitly whether every Phase 31C acceptance gate passed.
