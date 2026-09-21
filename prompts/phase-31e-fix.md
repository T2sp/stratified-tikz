# Phase 31E Targeted Fix Prompt: Compare standalone opacity across numeric representations

## Environment

Work on the current `phase/31e-tex-label-svg-export` checkout. Preserve the
pending Phase 31E implementation, fixtures, tests, documentation and all user
changes, including untracked files. Inspect current status first; do not reset
the branch, restore a historical base, or rerun implementation from scratch.

The latest failed parent verification used
`d1b72b3240177dfa368b43255ca07fd5738e3920` plus five modified tracked files:
`docs/PREVIEW_UI.md`, `docs/ROADMAP.md`, `scripts/checkSettledSvgExports.mjs`,
`src/ui/svgSettledExport.ts`, and `tests/ui/svgSettledExport.test.ts`.
`scripts/fixtures/settledSvgBoundaryFixture.ts` was untracked. Preserve these
production boundary corrections and regressions. Files may since have changed
or been committed; the recorded snapshot is evidence, not a checkout to restore.

Preserve the completed bounded screenshot helper/tests, independent page
ownership, pre-capture diagnostics, settlement observations, exact-source
oracles and negative controls. Preserve the runner's parent verification/review
gates and Phase 31D's merged candidate-cycle correction and recovery coverage.

The default shell may select Node v16.17.0 at `/usr/local/bin/node`, whereas
this project requires Node >=22.12.0. Use:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Keep strict TypeScript, avoid `any`, and add no dependencies. Preserve pinned
MathJax, shared parser/adapter/cache/rendering semantics and authoritative raw
model text. Limit work to the opacity comparison and further demonstrated 31E
regressions. Phase 31F's combined audit and unrelated lint cleanup remain out
of scope. Settled export is required in this phase, not deferred to 31F.

## Latest execution findings

This is a **new parent verification failure before independent 31E review**.
The previous React title-hoisting defect has been corrected, and the parent
now reopens autoDim with its foreground geometry intact. Do not reimplement
the SVG-context correction as if it were still missing, or treat this as the
historical screenshot timeout, child sandbox restriction or ownership error.
Do not invent severity counts, `REVIEW_JSON` or approval.

### Current failure: strict equality across attribute and computed-style opacity

Parent evidence directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31e-before-review-t7U6g3
```

Read `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json`, `checkout.diff`, `checkout-untracked.json`;
- `settled-export-autoDim-completed.json` and its referenced capture/live SVGs;
- `settled-export-autoDim-completed-label-2-before-sanitize.svg`;
- `settled-export-autoDim-completed-detachedBeforeSanitization.svg` and
  `settled-export-autoDim-completed-serialized.svg`;
- `settled-export-autoDim-standalone.json` and
  `settled-export-autoDim-standalone.png`;
- corresponding autoHide completion/standalone evidence and autoDim failure
  diagnostics.

The checkout was unchanged during verification. Its fingerprint was
`8eaf530b72fe06ff821eeb4e173e6abff5559bdfaa52f59aba68870189ad235b`.
The run used Node v26.9.0, Chrome `153.0.8010.52`, the external Playwright
runtime, and the Vite fixture at `http://127.0.0.1:5174`.

`check:free-labels` exited 1 at `settled-SVG-export-standalone`, near
`scripts/checkSettledSvgExports.mjs:660`:

```text
assert.equal(reopened.opacity, capture.opacity)
actual:   0.245
expected: 0.24499999999999997
```

| Saved observation | Latest result |
| --- | --- |
| Policy / source | autoDim / `$\frac{autoDim}{x}$` |
| Captured labels | 1, pending at capture |
| Captured effective opacity | `0.24499999999999997` |
| Detached and serialized opacity attribute | `0.24499999999999997` |
| Reopened computed effective opacity | `0.245` |
| Absolute difference | `2.7755575615628914e-17` |
| Settlement outcome / elapsed / budget | `success`, `ready` / 148 ms / 10,050 ms |
| Reopened root / label / foreground namespace | All SVG |
| Reopened foreground paths | 8 |
| Reopened foreground bounds | Finite, positive; approximately 73.556 × 29.881 |
| Serialized file | 6,176 bytes; complete label group and formula geometry |
| Screenshot | Saved 1100 × 850 PNG, 6,541 bytes, complete root coverage |
| External requests / browser errors | None / none |

The capture path computes effective opacity from numeric SVG attributes.
The reopened path multiplies `Number(getComputedStyle(current).opacity)` over
foreground ancestors. The captured example is `0.7 * 0.35`, whose JavaScript
value is `0.24499999999999997`; the browser's computed-style representation
produces `0.245`. The raw attribute survives detached rendering, sanitization
and XML serialization without being changed to that rounded representation.

The current failure is a brittle browser-test comparison across these numeric
representations. The difference does not demonstrate a production dimming
error. Do not change production opacity arithmetic, model values, capture
semantics or serialization to force bit-for-bit equality with CSSOM output.
Keep the native computed-style observation: it checks actual standalone
rendering rather than only the stored attribute.

### Implemented corrections to preserve

The child handoff at `/private/tmp/stz-31e-svg-boundary/handoff.json` records
130 focused tests within 2,405 full tests, fixture TypeScript, targeted lint,
eight syntax checks, build and diff validation. Its Chrome startup failed with
SIGABRT/cleanup EPERM. That restriction applies to the child attempt; the parent
subsequently ran Chrome and reached the numeric assertion above.

The current implementation contains:

- `renderSettledSvgLabelDocument()`, which gives React an actual `<svg>` parent
  before server rendering;
- `extractSettledSvgLabel()`, which validates the single direct owning group,
  captured identity/source and renderer structure before replacement;
- two Node regressions and a native preparation fixture covering render, XML
  parse, extraction, replacement, sanitization and serialization, including an
  old title-only boundary control;
- stronger detached foreground checks and preserved bounded standalone capture.

The saved autoDim SVG and reopened paths demonstrate that the old title-only
loss is repaired for this executed case. The entire native boundary regression
has not yet run: `runSettledSvgBoundaryChecks()` is called after all four
visibility policies and invalid-viewport retry, near line 726. The actual App
download/reopen workflow runs after the visibility function. Do not report
these later checks as passed merely because they are implemented or type-check.

### What passed, and what remains incomplete

| Check | Latest parent result |
| --- | --- |
| `npm test` | Exit 0; 2,405 passed, none failed or skipped |
| `npm run build` | Exit 0; existing nonblocking chunk-size warning |
| `git diff --check` | Exit 0 |
| `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at autoDim computed-opacity equality |
| Independent 31E review | Not reached |

There are 120 passing scenario records, ten completed groups and no reported
`pageErrors`. AutoHide passed. AutoDim reached and passed standalone source,
namespace, foreground-path and finite-bounds assertions before the opacity
comparison failed. Later detached/oracle assertions in that iteration did not
run, even though their diagnostic observations were saved.

The eleventh group started but remains incomplete; `unexecuted: []` tracks
groups, not individual checks. Remaining policies, invalid-viewport retry,
native boundary regression and actual App download/reopen acceptance remain
unexecuted in this run. The earlier Qku3Ld title-only failure and its screenshot
handoff are historical evidence, not current implementation status.

## Goal

Correct the browser opacity comparison with a justified numerical tolerance,
retain checks that detect real dimming defects, and finish all remaining native
31E acceptance scenarios with fresh matching parent evidence and independent
review. This follow-up does not require another production rendering rewrite.

## Required reading before fixing

Read at least:

- `AGENTS.md`, this prompt, `prompts/phase-31e-implement.md`, and
  `prompts/phase-31e-review.md`;
- the latest parent evidence above and `/private/tmp/stz-31e-svg-boundary/handoff.json`;
- `scripts/checkSettledSvgExports.mjs`, especially capture, standalone
  computed-opacity measurement, raw-attribute assertions, native boundary
  invocation order and actual App downloads;
- `scripts/fixtures/settledSvgExportOracle.ts`, its registered tests,
  `scripts/fixtures/settledSvgBoundaryFixture.ts`, and fixture TypeScript settings;
- `src/model/visibility.ts`, `src/ui/svgSettledExport.ts`,
  `src/ui/svgPreviewExport.ts`, `src/rendering/svgLabelExportRegistry.ts`,
  `src/rendering/svgLabelView.ts`, and the related export tests;
- `scripts/standaloneSvgCapture.mjs`, its tests, `scripts/checkFreeLabels.mjs`,
  and the free-label/App fixtures;
- `package.json`, relevant preview/roadmap documentation,
  `scripts/automation/phase-verification.mjs`, `run-phase.mjs`, and their tests.

## 1. Correct the numeric comparison at the browser boundary

Confirm the measurement path using the saved captured/detached/serialized and
standalone values. Apply a small harness correction where computed-style
opacity is compared with captured numeric opacity. Validate finite numbers in
the valid opacity range before applying an explicit, documented tolerance.
Do not coerce missing/null/non-numeric observations to zero or treat NaN as a
successful comparison.

Choose a tight absolute tolerance appropriate to opacity in [0, 1] and the
actual CSSOM serialization/arithmetic used by these fixtures. The observed
error is approximately 2.8e-17; a tolerance such as 1e-12 handles this specific
case. If other supported fixtures require a different bound, establish and
record their computed-style precision and ancestor multiplication rather than
arbitrarily relaxing the threshold until the run passes. Keep the chosen bound
small enough to reject missing dimming, extra dimming and meaningful drift.

Retain the captured value as the independent expectation. Keep the native
ancestor computed-style product as the observed rendered value; replacing it
with an attribute-only observation would miss CSS/style effects. If needed,
persist the relevant raw opacity attributes, computed-style strings and
ancestor product once in the existing diagnostic record, with absolute error
and tolerance for a failing comparison. Do not redesign diagnostics.

Review analogous comparisons in this export harness for the same crossing of
numeric representations, and change only those with the same demonstrated
problem. The detached/serialized attribute checks near lines 685 and 692,
attribute-based comparisons in the native boundary fixture, and App attribute
comparisons can remain exact when both sides preserve the same raw values.
Do not globally replace exact assertions with approximate ones. Source text,
identity, counts, namespaces and other discrete contracts remain exact.

Do not round the model or capture, quantize production SVG opacity, weaken
source/geometry/namespace checks, drop computed-opacity verification, add
sleeps/retries, or alter conversion/capture deadlines to address this failure.
A later material opacity mismatch must be investigated as a separate failure,
not absorbed into a larger tolerance.

## 2. Prove the comparison still detects real opacity defects

Add focused regression coverage for any shared numeric assertion/helper.
Keep it small and scoped to the test harness. Register a new Node test file in
`package.json` if one is introduced; existing registered tests may be extended.

Require acceptance of this exact reported pair and correct equal values,
including zero and one. Require rejection of missing/non-numeric/non-finite
values, out-of-range opacity, and representative actual defects:

- captured `0.7 * 0.35` versus `0.7` or `1` when dimming is missing;
- captured `0.7 * 0.35` versus approximately `0.08575` when the 0.35 dimming
  factor is applied twice;
- zero versus a materially nonzero opacity, and a small but meaningful opacity
  drift exceeding the justified tolerance.

Use separate opacity controls; the existing exact-source geometry oracle is
not an opacity oracle. Preserve its negative controls and ensure they operate
on an actual valid foreground target, with `missingControlTarget: false`.
Neither halo-only paths nor unrelated diagram paths establish successful math.

Retain the existing production boundary fixture and execute it after resolving
this blocker. It must still demonstrate that the old renderer string can
contain paths while its extracted first child is only a title, and that the
new preparation path preserves complete free/inline label subtrees. Preserve
ready math, Unicode, malformed/resource fallback, whitespace/markup-like input,
inline halos, reused owner-local IDs, repeated formulas, empty source and
zero-label cases, invalid structure rejection and live/model/history invariants.
Do not substitute new comparator unit tests for that native regression.

## 3. Preserve screenshot and evidence handling

Keep `captureStandaloneSvg()` in visibility and actual download/reopen paths:
`fullPage: false`, explicit 5-second timeout, measured full-root coverage,
finite viewport expansion and verified PNG dimensions. Preserve independent
page ownership and cleanup, DOM/geometry/raster/request observations before
capture, and bounded failure handling without a second screenshot attempt.
Saved-image claims still require a successful write and an existing PNG.

Retain policy-specific captured/live/detached/serialized SVGs, exact-source
request/settlement observations and standalone reopen measurements. Preserve
the original error when diagnostics or cleanup fail. Keep observations separate
from passed scenario records until every assertion for the scenario completes.
Do not wrap exported files in HTML, disable font waiting, patch dependencies,
or alter production timeouts or sandbox settings.

## 4. Finish visibility, native boundary and actual download acceptance

Run the full existing sequence after the numerical correction, retaining:

- autoHide and hidden-layer exclusion without export-only conversion;
- autoDim and layer-filter dimming with current-source foreground geometry,
  finite bounds, exact serialized opacity and numerically equivalent computed
  opacity after standalone reopening;
- invalid-viewport failure without malformed download or live mutation, followed
  by successful retry;
- the actual native production-boundary regression and its negative controls;
- pending free/inline labels, repeated formulas, Unicode, successful math and
  complete malformed/resource-failure literal fallback;
- click-time snapshot consistency across edits/style/view/document changes,
  and a later export reflecting a new 3D view;
- accessible status, duplicate-click suppression, finite failure/retry and
  temporary-resource cleanup;
- actual transparent and white App downloads reopened outside the application,
  with geometry, placement, explicit colors, glyph-local white outlines,
  multiline/tab/markup-like fallback, backgrounds and visible raster pixels;
- finite dimensions, valid collision-free local references, no external
  resources/page CSS/runtime dependence, and exclusion of editor overlays.

Compare export-side non-mutation against the state after intentional user
edits; do not require history to remain unchanged across deliberate edits.
Diagnose and minimally fix later demonstrated 31E failures. Passing autoDim's
opacity assertion alone is not complete standalone acceptance.

Preserve all ten preceding groups and `settled-SVG-export-standalone`.
Phase 31E requires **all eleven**, with actual saved/downloaded/reopened
artifacts and executed native boundary controls. Retain the parent validator's
rejection tests and compatibility with complete earlier-phase reports. Do not
weaken verification/review/commit/push gates or reopen unrelated 31D work.

## Verification and permitted execution

Run focused checks with the required Node PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
node --test \
  tests/scripts/settledSvgExportOracle.test.ts \
  tests/scripts/standaloneSvgCapture.test.mjs \
  tests/ui/svgSettledExport.test.ts \
  tests/ui/svgPreviewExport.test.ts \
  tests/ui/fileTransfer.test.ts \
  tests/rendering/svgInlineLabelRuntime.test.ts \
  tests/scripts/runPhaseVerification.test.mjs \
  tests/scripts/runPhaseRunner.test.mjs
node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.json --noEmit
node --check scripts/standaloneSvgCapture.mjs
node --check tests/scripts/standaloneSvgCapture.test.mjs
node --check scripts/checkSettledSvgExports.mjs
node --check scripts/checkInlineLabels.mjs
node --check scripts/checkFreeLabels.mjs
node --check scripts/checkFreeLabelGeometry.mjs
node --check scripts/checkFreeLabelRaces.mjs
node --check scripts/checkFreeLabelsApp.mjs
node node_modules/eslint/bin/eslint.js \
  scripts/standaloneSvgCapture.mjs tests/scripts/standaloneSvgCapture.test.mjs \
  scripts/checkSettledSvgExports.mjs scripts/checkFreeLabels.mjs \
  scripts/fixtures/freeLabels.tsx scripts/fixtures/freeLabelsApp.tsx \
  scripts/fixtures/settledSvgExportOracle.ts \
  scripts/fixtures/settledSvgBoundaryFixture.ts \
  tests/scripts/settledSvgExportOracle.test.ts \
  src/ui/svgSettledExport.ts src/ui/svgPreviewExport.ts src/ui/fileTransfer.ts \
  src/rendering/svgLabelExportRegistry.ts src/rendering/svgLabelView.ts \
  src/rendering/SvgTexLabel.tsx tests/ui/svgSettledExport.test.ts \
  tests/ui/svgPreviewExport.test.ts tests/ui/fileTransfer.test.ts
npm test
npm run build
git diff --check
```

Include any added/changed helper and regression files in applicable focused,
syntax and lint checks. Keep focused counts within the full-suite total.
Compare App/SvgDiagram lint with baseline if changed; do not clean up unrelated
pre-existing diagnostics.

Complete authorized parent/Terminal verification is:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31E verify
```

This runs tests, build, diff check, label assets and the full browser harness
on the dirty checkout with fresh logs/artifacts and tracked/untracked identity.
It does not implement, review, commit or push. Do not recursively run `31E fix`
or `31E implement` as verification.

If acting as the automated fix child, run available focused/full Node checks
and build, then let the outer runner perform browser verification after the
handoff. A child browser restriction does not prevent the harness correction
or available unit regressions. In a standalone run, use supported permission
escalation when necessary and available, or hand off to the authorized Terminal.
Do not change persistent sandbox settings or weaken browser/security checks.

Require fresh complete matching parent evidence after correction. Successful
matching parent browser results can support review without repeating commands
inside a restricted review child. Partial or stale evidence cannot close the gate.

## Documentation and acceptance criteria

Update only relevant Phase 31E preview/export and roadmap status. Record the
opacity representation mismatch, chosen tolerance and why it cannot conceal
material dimming defects. Preserve the completed React SVG-context correction
and its regressions. Replace stale statements that parent native foreground
verification is unavailable with this run's actual geometry success and opacity
assertion failure, while keeping later scenarios explicitly unverified.

The normal runner performs fix -> parent verification -> independent review.
This run failed before review. A standalone `verify` success does not itself
run review or establish approval. Preserve that order and the commit gate.

31E is ready for review only when:

- native opacity comparison accepts representation-only error with a justified
  tight bound and rejects missing/doubled dimming, invalid values and real drift;
- exact captured/serialized attributes and source/identity/namespace/geometry
  checks remain intact, with the repaired label subtree preserved;
- all four visibility policies, invalid-viewport retry and the native boundary
  fixture execute successfully with retained observations and controls;
- actual App downloads/reopens pass for both backgrounds, pending edits,
  subsequent 3D view and failure/retry cases;
- bounded captures, pre-image diagnostics, PNG coverage and independent resource
  cleanup remain intact without export-side live/model/history mutation;
- fresh matching parent evidence is `passed`/`complete`, identifies the browser,
  completes all eleven groups and has no incomplete/unexecuted groups or page
  errors, with actual observations for the formerly unexecuted cases;
- required tests/build/static/diff checks pass, earlier-phase regressions remain
  intact, and documentation reflects observed results.

Do not mark 31E complete before required verification and independent review
succeed. Phase 31F remains deferred.

## Report after implementation

Lead with the opacity comparison correction and its status. Report changed
files; captured, raw-attribute and computed-style values; the numeric tolerance
and supporting reasoning; regression/negative-control results; preserved
production renderer and screenshot fixes; newly executed visibility/native
boundary/App download results; commands, versions, exit statuses and focused/
full counts; evidence paths and current checkout fingerprint; and unavailable
or failing checks. Keep child implementation/checks, parent browser verification
and independent review statuses separate. Neither the old Qku3Ld result nor the
partial t7U6g3 run verifies the corrected checkout.
