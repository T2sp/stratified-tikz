# Phase 32A implementation and verification handoff

Status: implementation and harness delivered; **not acceptance-complete**.
Fresh accepted parent browser verification and independent review remain open.
No 32B–32D production features are included.

## Prerequisite

Before implementation, the actual later 31F `im78Xe` report and independent
review were inspected, rather than inferring completion from the older audit or
browser stdout. The accepted report has matching before/after fingerprint,
five successful commands, twelve completed groups, 144 passing scenarios and
no page errors/incomplete groups. The transparent/white SVG and standalone JSON
artifacts exist and were inspected. `logs/codex/31F-review-summary.json` records
pass; its full review explicitly accepts the matching evidence. The production
label code and verifier/worker were unchanged between that completed 31F commit
and this checkout's starting revision `860d185`. See the reconciled
[31F audit](PHASE_31_COMPLETION_AUDIT.md) for exact report paths.

## Production changes and data decisions

- `src/rendering/labels/useSvgLabelState.ts`, `SvgTexLabel.tsx`: extract the
  existing mount-scoped subscription without changing the shared conversion
  service, worker, parser, validation, caching or lifecycle semantics.
- `src/rendering/SvgPointNode.tsx`, `svgPointNodeLayout.ts`,
  `svgPointNodeView.ts`: render the full point from one current body state;
  separate body placement, contour, painted and anchor-clearance bounds;
  preserve empty dimensions and legacy circle/polygon/star and paint semantics.
- `src/rendering/SvgDiagram.tsx`, `svgHitTesting.ts`: commit runtime-only
  geometry keyed by document/point/source/font/shape/size. Native selection and
  overlap cycling use that geometry. The body is part of its owning point.
- `src/rendering/svgLabelExportRegistry.ts`, `src/ui/svgSettledExport.ts`:
  freeze the complete point's click-time inputs, stop nested capture traversal,
  settle the body, reconstruct contour and body through the shared pure view,
  and validate the full reconstruction plus the existing strict body structure.
  Cloned parent opacity/visibility, deadline fallback, duplicate-click policy
  and overlay exclusion remain in the established export path.

No dependency, saved-schema/version, migration, model, history, constructor,
Inspector storage or TikZ-generator change was needed. Source is never trimmed,
normalized or wrapped in delimiters. Direct/cursor placement and projection
continue using authoritative model coordinates. Standalone and inlineMath TikZ
keep the raw node body and existing style/external-reference conventions.

Supported source remains the Phase 31 bounded Unicode/math grammar. Arbitrary
TikZ/PGF execution, preambles/packages, style-file macros, full LaTeX paragraph
and font compatibility remain unsupported. Such bodies, invalid math, resource
failures and bounded-work failures keep the whole literal source. Independent
paint, new shapes, configurable spacing/minimum dimensions and anchors remain
32B–32D work.

## Tests, runner and documentation changes

`tests/rendering/svgPointNodeRuntime.test.ts` adds five registered tests using
real MathJax plus controlled delivery/font readiness. They cover all legacy
shapes in 2D/3D, every delimiter, Unicode/whitespace/multiline fallback,
view/picking identity, empty dimensions, stale completion, immutable whole-node
settlement, deadlines, JSON/history and both TikZ modes. The existing
`svgHelpers.test.ts` point-boundary tests now use the common pending policy.
`package.json` explicitly registers the new test file.

`scripts/checkPointNodes.mjs`, `checkPointNodesApp.mjs`, `checkFreeLabels.mjs`,
`fixtures/freeLabels.tsx`, and `fixtures/freeLabelsApp.tsx` add the browser
scenarios below. The App fixture only supplies input documents, controlled
conversion delivery and read-only observations; user edits, loads, history,
creation and downloads use production controls.

`scripts/automation/run-phase.mjs` registers all four planned slugs.
`phase-verification.mjs` activates fifteen cumulative groups for 32A–32D (the
twelve 31F groups plus three implemented point groups). Future stage groups must
be activated by their own implementations. Exact completed scenario names,
terminal success, page errors, checkout identity including untracked fixtures,
and required JSON/SVG/PNG files are checked. JSON must parse; SVG must contain
a whole point; PNG must have its binary signature. Missing or obsolete evidence
stops before review/commit. The fresh-process worker loading is preserved.

`tests/scripts/runPhaseVerification.test.mjs`, `runPhaseRunner.test.mjs`, and
`freeLabelsFailureEvidence.test.mjs` cover cumulative policy, old Phase 31
reports, missing/started scenarios, missing/corrupt artifacts, checkout mismatch,
page errors, pre-review rejection, and policy refresh by a running parent.

`PREVIEW_UI.md`, `SPEC.md`, `ROADMAP.md`, `LABEL_ADAPTER.md`,
`PHASE_31_COMPLETION_AUDIT.md`, and `PHASE_32_PLAN.md` record the current scope,
resolved prerequisite and remaining gates. This report is the child handoff.

## Acceptance mapping (implemented assertions; browser execution pending)

| Acceptance area | Required group / completed-scenario identity after a successful run |
| --- | --- |
| Empty/spaces/plain/Japanese, all delimiters, mixed runs, fractions/roots/scripts/depth, legacy shapes in 2D/3D | body-layout-lifecycle: `point-language-shapes-2d-3d` |
| Same-owner valid-invalid-valid, exact spaces/tabs/newlines/backslashes | body-layout-lifecycle: `point-valid-invalid-valid-exact-source`; native Inspector/history also below |
| A-B-C, delete, duplicate, Undo/Redo, load/reused ID, round trip and unmount | body-layout-lifecycle: `point-A-B-C-delete-duplicate-history-load` |
| Bounded resource failure/retry and late actual font measurement propagated to shape/highlight/picking | body-layout-lifecycle: `point-resource-retry-font-readiness` |
| Native Add point direct/cursor, 2D and 3D xy/xz/yz fixed planes, Inspector, Undo/Redo, downloaded JSON/load and both TikZ modes | body-layout-lifecycle: `point-native-direct-cursor-workplanes-inspector-persistence` |
| Native inner/outer contour clicks and normal/Alt owner cycling | picking-visibility: `point-contour-boundaries-cycling` |
| Moved 3D camera, pan/zoom, native drag, position/paint edits without compilation | picking-visibility: `point-camera-pan-zoom-drag` |
| Locked/hidden/filtered/dimmed points, free/inline siblings | picking-visibility: `point-hidden-filtered-locked-dimmed-siblings` |
| Actual pending transparent download followed by edit; standalone measured body/contour, paint/local references and PNG | settled-export: `point-native-pending-transparent-edit` |
| Actual pending white download followed by document replacement; standalone body/contour and PNG | settled-export: `point-native-pending-white-load` |
| Complete capture, no nested duplicates, full fallback, inherited dimming, deliberately corrupted contour rejection | settled-export: `point-whole-node-fallback-opacity-validation` |

The full group names have prefix `point-node-`. Every scenario writes JSON
observations before optional bounded image work. The pending download scenarios
require their SVG, standalone JSON and PNG artifacts; the native entry scenario
also requires both actual JSON downloads. Existing Phase 31F groups remain
mandatory. No native 32A scenario or standalone point artifact has executed in
this child; the table is a harness map, not a claim of successful browser coverage.

## Executed child checks

Node **v26.9.0**, with `/opt/homebrew/bin` first in PATH; no browser launched.

| Check | Result / log |
| --- | --- |
| `npm test` | **2,471 passed**, zero failed/skipped; `/private/tmp/stz-32a-test-final.log` |
| Focused real-MathJax point tests | **5/5 passed**; `/private/tmp/stz-32a-point-tests.log` |
| `npm run build` | Passed; `/private/tmp/stz-32a-build.log`; existing >500 kB chunk warning |
| Strict production TypeScript | Passed; `/private/tmp/stz-32a-strict-tsc.log` |
| Strict fixture TypeScript | Passed; `/private/tmp/stz-32a-fixture-tsc.log` |
| Strict new-test TypeScript | Passed with `--ignoreConfig --types node`; `/private/tmp/stz-32a-test-tsc.log` |
| Focused ESLint | Changed helpers/tests/fixtures/scripts passed; `stz-32a-focused-lint.log`, `stz-32a-script-lint.log`, `stz-32a-final-*-lint.log` in `/private/tmp` |
| Changed script syntax | `node --check` passed for runner, policy and browser scripts |
| `git diff --check` | Passed |
| `npm run check:label-assets` | **Failed before browser launch**, `listen EPERM 127.0.0.1`; `/private/tmp/stz-32a-label-assets.log` |
| `npm run check:free-labels` | **Failed at development-server-listen**, `listen EPERM 127.0.0.1:5173`; `/private/tmp/stz-32a-free-labels.log` |

Asset **static-only** validation passed: four entries, 43 worker chunks,
85 references and 40 approved font modules, recorded at
`/private/tmp/stz-32a-child-label-assets/asset-graph-evidence.json`. This is not a
native resource-loading/recovery/containment pass. The final free-label failed
report is `/private/tmp/stz-32a-child-free-labels-final/free-labels-evidence.json`;
all fifteen groups remain unexecuted, with no browser version or native artifacts.
The earlier twelve-group child failure is retained in
`/private/tmp/stz-32a-child-free-labels/` and is not final-checkout evidence.

`SvgDiagram.tsx` focused lint reports the same pre-existing `react-hooks/refs`
error (current line 978, baseline line 976). The baseline was executed using
`git show HEAD:src/rendering/SvgDiagram.tsx` piped into ESLint with the production
filename. Both JSON reports are `/private/tmp/stz-32a-{baseline,svgdiagram}-lint.json`.
No additional violation was introduced. Repository-wide lint was not run because
this demonstrates the checkout was already not lint-clean; unrelated cleanup
was left out.

## Exact parent handoff

From the final checkout in the browser-capable parent/Terminal environment:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32A verify
```

This current runner executes `npm test`, `npm run build`, `git diff --check`,
`check:label-assets`, and `check:free-labels`, saves checkout fingerprints,
commands/logs/artifacts, and rejects incomplete evidence. It does not implement,
commit or push. The fresh worker reads the updated phase policy even if the
parent's initial prompt said no additional browser check was configured.
Do not weaken assertions or broaden sandbox permissions to obtain a pass.

After a successful parent report, independently review the exact matching
tracked and untracked checkout against `prompts/phase-32a-review.md`, including
actual report/artifact inspection. Until both gates pass, the plan must keep 32A
pending acceptance and 32B–32D unimplemented. Child startup restrictions supply
no point-browser pass and do not invalidate the historical accepted 31F report.
The final child checkout identity is retained separately at
`/private/tmp/stz-32a-final-checkout.json` to avoid a self-referential document hash.

## Targeted positioned-whitespace fix (2026-09-22)

This section supersedes the earlier child-check counts for the targeted fix.
The starting checkout was clean on `phase/32a-tex-labeled-node`, HEAD
`ad10fe2866c5bc69cf6ec88bc981a48ce127e70f`. Existing implementation, fixtures,
prompts and earlier evidence were preserved. No production renderer, layout,
model, schema, dependency or 32B–32D feature was changed.

### Cause and corrected call sites

The historical parent `stz-phase32a-before-review-VOwz7Y` report failed in the
point language matrix, before independent review: 10/15 groups and 109 passing
records, with no point scenario artifacts. Its `real-App-workflows` stage did
not mean the later App checks had run. The previous implementation child's
localhost `EPERM` was a separate startup failure. Neither report passes this fix.

The reported source `  $\\unknownPointMacro$\t\\slash\n tail  ` has three visible
SVG text fragments; its tab and newline are represented by coordinates, not
text glyph elements. Joining only `[data-label-literal]` therefore cannot equal
raw source. The retained `/private/tmp/stz-32a-whitespace-diagnosis-KXYWFo/`
reproduction establishes this representation only, not native acceptance.

- `scripts/checkPointNodes.mjs`: `inspectPoint` now collects a positioned
  foreground observation, exact model/source/request identity, ambient dimension,
  shape and contour. The language matrix, same-owner valid/invalid/valid,
  A–B–C pending states, resource failure, and both font-readiness states use the
  separate source/visual contract. No `point.literal` string consumers remain.
- `scripts/checkPointNodesApp.mjs`: Inspector failure/redo and pending download
  bodies use the same checker. Both actual transparent and white downloads now
  include a multiline fallback point, reopened alongside the settled formula.
  The whole-node fallback boundary retains exact JSON-escaped request source,
  contour corruption rejection, capture count, and inherited dimming, and saves
  both pre-sanitization and final SVG for native observation.
- The export audit also found that the old point assertions selected runtime
  `data-*` attributes after `createSvgPreviewExportText` removes them. This is
  established by the existing sanitizer and its registered tests, independently
  of browser execution. Standalone selection now uses the unique direct source
  title and foreground structure. Raw JSON request identity is checked in the
  serialized pre-sanitization boundary; XML-normalized titles/attributes are
  checked appropriately. Final sanitized SVG is checked by actual text, native
  positions/bounds, paint, contour, and a settled native reference's bounds.
  Production sanitization and strict contour extraction are unchanged.

### Independent observations and regressions

`labelBrowserOracle.ts` supplies the shared SVG measurement implementation;
`pointLiteralOracle.mjs` injects that same trusted test code into live and
`file://` documents without a network request, script element or App stylesheet.
`positionedLiteralAssertions.ts` checks source separately from visible text.
Only direct foreground text is observed; titles, halos, math descendants,
unrelated owners and measurement clones cannot replace missing literal text.
The observer records text, x/y, transformed baseline, transforms, computed font
longhands/whitespace properties, native bounds, line extents and full-space-prefix
SVG tab measurements. It does not use production layout records as expectations,
an empty Canvas font shorthand or a guessed native character width.

Coverage is intentionally not Cartesian:

- Existing 2D/3D × four-shape language cases retain the exact reported invalid
  source and all previously required inputs.
- Additional small cases cover consecutive tabs, LF/CRLF/CR, leading/empty/
  trailing lines, boundary tabs, edge/repeated spaces, and glyphless whitespace.
  Pending A–B–C and resource failure also contain structural whitespace.
- `pointLiteralOracle.test.ts` observes text/x/y from actual production point SSR
  (not concatenated layout records) for pending and fallback output, reproduces
  the old false failure, checks XML normalization and same-owner stale content,
  and rejects missing fragments, changed edge spaces, collapsed tab/line positions,
  transformed text and shortened line bounds with unchanged source metadata.
  Its synthetic measurement adapter is explicitly not native-browser evidence.
- Five browser negative controls mutate actual foreground DOM, keeping request
  metadata unchanged: drop a fragment, trim leading spaces, collapse a tab,
  collapse a baseline, and display stale content. Their observations are retained
  inside the language scenario. These native controls await parent execution.
- `pointCheckDiagnostics.test.mjs` executes the actual point/App sequencing entry
  point with an injected early missing-point observation. It verifies the current
  case is saved before failure, no passing scenario is recorded and the later App
  group remains unexecuted; it also checks diagnostic-write and cleanup behavior.
  Both new test files are registered in `package.json` (14 tests total).

### Failure artifacts and verification gates

`pointCheckDiagnostics.mjs` writes numbered `point-observation-*.json` files
before assertions, separately from passing records. Records include group,
scenario and point/source/font/geometry observations. Native downloads retain
observations before bounded screenshots. Cleanup preserves the original error.
`checkFreeLabels.mjs` uses point-specific stages and starts the later App group
only after point checks return. The existing fifteen groups, eleven named point
scenarios, mandatory artifacts, fresh verifier, checkout comparison and
pre-review/commit gates are unchanged.

Executed with Node v26.9.0 and `/opt/homebrew/bin` first in PATH:

| Command/check | Observed result |
| --- | --- |
| Focused oracle/diagnostics tests | 14 passed; `/private/tmp/stz-32a-fix-oracle.log` |
| Earlier focused point/runtime/runner/failure suite | 117 passed; `/private/tmp/stz-32a-fix-focused.log` (before the extra cleanup regression; full suite includes it) |
| `npm test` | 2,485 passed, zero failed/skipped; `/private/tmp/stz-32a-fix-test-final.log` |
| `npm run build` | Passed; existing >500 kB chunk warning; `/private/tmp/stz-32a-fix-build.log` |
| `npx tsc -p scripts/fixtures/tsconfig.json --noEmit` | Passed; `/private/tmp/stz-32a-fix-fixture-tsc.log` |
| Strict new-test TypeScript (`--ignoreConfig --noEmit --strict --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2023 --jsx react-jsx --skipLibCheck --types node`) | Passed; `/private/tmp/stz-32a-fix-test-tsc.log` |
| Targeted TS ESLint and recommended JS rules with Node/browser globals | Passed; `/private/tmp/stz-32a-fix-{lint,script-lint}.log` |
| Changed script `node --check`; `git diff --check` | Passed |
| `node scripts/automation/run-phase.mjs 32A verify` during work | Node/build/diff passed; `check:label-assets` blocked by `listen EPERM 127.0.0.1`, no browser launched; `stz-phase32a-manual-hPEtGV/verification.json` under the system temp directory. This intermediate tree is not final identity evidence. |
| Direct `npm run check:free-labels`, with installed external Playwright/Chrome paths configured | Blocked at `development-server-listen`, `EPERM 127.0.0.1:5173`; `/private/tmp/stz-32a-fix-free-labels-configured.log` and `/private/tmp/stz-32a-fix-free-labels-configured/free-labels-evidence.json`. All 15 groups unexecuted, zero passing scenarios. |

An initial unconfigured direct browser command reported missing local Playwright;
using the existing supported external installation then reached the real server
restriction above. No dependency or sandbox setting was changed.

After these edits, the exact final command is run again with the tree held fixed:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32A verify
```

Its report is copied to `/private/tmp/stz-32a-whitespace-final-verification.json`,
with the matching tracked/untracked checkout identity retained separately at
`/private/tmp/stz-32a-whitespace-final-checkout.json`; this avoids a document hash
self-reference. The final transcript reports that run's observed result. A
failed/startup-blocked report is never acceptance evidence. The browser-capable
parent must run the exact command above on the final checkout, inspect all
fifteen completed groups/eleven point scenarios and artifacts, and then perform
independent review against `prompts/phase-32a-review.md`. No independent review
has run in this fix turn. **32A remains pending; 32B–32D remain deferred.**

## Native literal line-metric correction (2026-09-22)

This later correction started with a clean `phase/32a-tex-labeled-node` checkout,
HEAD `b0bd6b85144af46bed2194592a44b3be92639736`. The implementation and earlier
source/visible-fragment correction were already present and were preserved.
There are no production, dependency, schema, paint, or shape changes in this fix.

### Observed failure and limits

The actual parent report is
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32a-before-review-ni1bPs/verification.json`;
the verifier handoff is `stz-phase-verifier-7wjjNZ/response.json` in the same temp
root. The report's before/after fingerprint is
`6bc7f77ac305194a1cde6557f21b8c3d33cd32852d3f2ed4eafc50c542d068df`.
Node v26.9.0 / Chrome 153.0.8010.53 passed tests (2,485), build, diff and assets.
The free-label check passed 11/15 groups, 116 records and seven point scenarios,
then failed at `point-node-native-input`, with no page errors. Four groups and
four point scenarios remained incomplete. Independent review was not reached.
These historical passes are partial evidence, not acceptance of this correction.

`point-observation-0127.json` retains the exact native Inspector input
`'  $\\missingNativePoint$\t\n tail  '`. The second line's actual y was
16.399999618530273; the oracle expected 15.81269874572754 (difference
0.587300872802734, tolerance .5). Its SVG `Mg` ascent/descent were
10.661375999450684 / 2.7513227462768555. The expected height was
29.225397491455077 versus the published 30.4 (height tolerance 1).
The preceding isolated observation `0003` had SVG ascent/descent 11/3.
Source/model/request/title and visible text were correct. A replay through the
assertion is saved at `/private/tmp/stz-32a-metrics-historical-replay.json`;
that replay is explicitly not new native measurement or acceptance.

The old oracle treated the SVG box as the font line box. Production initializes
lines with independently obtained Canvas font bounds and expands each line for
fragment ink. The historical report did not measure that Canvas configuration.
Neither browser scaling/hinting/font substitution nor universal production
correctness is established by these observations.

An initial exact-workflow attempt in this child, with the supported external
Playwright and Chrome paths, failed before browser launch at Vite
`listen EPERM 127.0.0.1:5173`. Log: `/private/tmp/stz-32a-metrics-before.log`;
report: `/private/tmp/stz-free-labels-1790082055396/free-labels-evidence.json`.
This is separate from the parent's real native metric failure and from the
older implementation child's startup restriction. No permissions were changed.

### Independent contract and consumers

`labelBrowserOracle.ts` now constructs Canvas font configuration from computed
family/size/style/weight longhands, checks assignment using two sentinel fonts,
and records the effective font, alignment, baseline, kerning and rendering.
Unsupported spacing/stretch fails explicitly. CSS/request identities, font
readiness and FontFaceSet entries are recorded; these do not pretend to identify
the platform's resolved font face for each individual glyph.

`collectLiteralMetrics` uses Canvas fontBoundingBoxAscent/Descent (actual ink
fallback when unavailable), expands each physical line with its fragments' ink,
and advances by previous descent + .2 em gap + next ascent. CRLF is one break;
empty/whitespace-only lines and boundary tabs contribute logical extents.
Canvas advance/ink overhang defines logical bounds. Baseline, centering, width,
height and all published edges use this one contract. No production measurement
provider/composer, actual fragment positions, or published bounds are inputs to
these expectations; no measured font, 16.4 baseline or 11/3 box is hardcoded.

Native SVG clones still independently measure `Mg`, fragment bounds/advances
and complete space prefixes for tabs. Actual x is checked against both native
SVG and Canvas advances. Native foreground containment is checked separately,
including sanitized exports without published bounds. Existing .5 position,
.001 transform and 1 extent/containment tolerances are unchanged. The observation
records both measurement APIs, selected per-line metrics, font longhands,
viewBox/viewport, DPR, root/body/content CTMs, local coordinates, deltas and
tolerances. Local units are explicitly distinct from CSS screen pixels.

All existing pending/resource, language, recovery, native Inspector/redo and
standalone fallback consumers use the shared corrected collector. The native
workflow keeps both 2D/3D direct/cursor/work-plane/history/persistence sequences.
It additionally compares the exact invalid source in the original App viewport,
a resized native viewport, and the isolated renderer, before assertions. The App
must exercise a nonidentity viewport scale. Both pending transparent/white
exports retain the earlier multiline fallback and now also reopen that exact
Inspector source, checking exported font longhands against the live source.
No App CSS or styling is injected into the standalone document.

`positionedLiteralAssertions.ts` reports the differing axis/metric, actual,
expected, delta and tolerance. `capturePointCheck` records collection failures
before rethrow, preserving their primary error if diagnostics also fail. Passing
scenario records still occur only after every assertion succeeds.

### Regressions and additional demonstrated gate correction

The existing SSR/negative-control tests remain. The explicitly registered
`pointLiteralMetrics.test.ts` exercises the real collection/calculation boundary
with differing SVG/Canvas boxes, exact Inspector source, per-line ink expansion,
empty/whitespace lines, all physical newline encodings, boundary tabs, font-box
fallback, longhand configuration and rejected Canvas font assignment. Synthetic
metrics test the contract; native font/transform claims still require the parent.
A final-line displacement inside unchanged enclosing bounds now fails specifically
on y baseline, in both the SSR test and the native mutation harness. Missing and
stale text, changed edge spaces, collapsed tabs/lines, transforms and damaged
bounds remain negative controls. Diagnostics tests cover measurement failure
plus secondary evidence-write failure.

Inspection also demonstrated a later artifact-gate mismatch: the sanitizer
removes all `data-*` attributes, but the verifier required point runtime markers
in downloaded SVG. Replacing the fake command's SVG with a complete sanitized
point reproduced rejection in the existing cumulative tests; failure log:
`/private/tmp/stz-32a-metrics-sanitized-gate-before.log`. The gate now checks a
balanced SVG envelope with sibling contour and titled painted body, instead of
removed markers. Tests reject missing bodies/contours, broken nesting and fake
markup in comments. This is an artifact envelope check; native reopen/geometry/
paint assertions remain mandatory. No group/scenario/artifact counts, fresh
worker, checkout matching or pre-review/commit gates were reduced.

### Executed checks and final handoff

All commands used `/opt/homebrew/bin` first in PATH (Node v26.9.0).

| Check | Observed result |
| --- | --- |
| Focused oracle/metrics/diagnostics/verifier/runner/failure tests | 124 passed; `/private/tmp/stz-32a-metrics-focused-all.log` |
| `npm test` | 2,496 passed, no failures/skips; `/private/tmp/stz-32a-metrics-test.log` |
| `npm run build` | Passed; existing >500 kB chunk warning; `/private/tmp/stz-32a-metrics-build.log` |
| Strict fixture TypeScript | Passed; `/private/tmp/stz-32a-metrics-fixture-tsc.log` |
| Strict oracle-test TypeScript | Passed; `/private/tmp/stz-32a-metrics-test-tsc.log` |
| Targeted TS and recommended JS lint | Passed; `/private/tmp/stz-32a-metrics-{lint,script-lint}.log` |
| Changed script syntax / `git diff --check` | Passed |
| Initial direct native reproduction | Startup restricted as recorded above; no native acceptance |

After documentation is fixed, run and retain fresh final-checkout evidence:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32A verify
```

The result and matching identity are retained outside the checkout at
`/private/tmp/stz-32a-metrics-final-verification.json` and
`/private/tmp/stz-32a-metrics-final-checkout.json`, to avoid a self-referential
fingerprint. The final response reports the observed result of that run. The
supported direct final browser command uses `STZ_SMOKE_ARTIFACT_DIR=/private/tmp/stz-32a-metrics-final-free-labels`,
`STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`
and `STZ_BROWSER_EXECUTABLE=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
A startup-blocked result leaves acceptance pending; it is never a native pass.

The browser-capable parent must execute fresh verification on this exact tree,
including the new untracked test, retain all fifteen complete groups/eleven
named point scenarios and artifacts, then perform independent review against
`prompts/phase-32a-review.md`. No new native completion or independent review is
claimed by this child. **32A remains pending acceptance; 32B–32D remain deferred.**

## Targeted native JSON persistence oracle correction (2026-09-22)

The starting checkout was clean on `phase/32a-tex-labeled-node`, HEAD
`a0eefe53c396884dc0193600902104248ee423e2`; prior implementation, source/position
and native Canvas line-metric corrections, sanitized-SVG verifier policy,
fixtures and tests were already committed and preserved. No production save/load,
model, rendering, schema, dependency or Phase 32B–32D behavior changed.

### Actual parent failure

The inspected report is
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32a-before-review-wOC4BM/verification.json`,
with verifier response in `stz-phase-verifier-pMecCj/response.json` under that temp
root. Its before/after fingerprint was
`5a4c860a5254711ef637fd7d7345eda3d70c07c188845fba0b0affafa96e92c9` on revision
`b0bd6b85144af46bed2194592a44b3be92639736` plus changes. Tests (2,496), build, diff
and assets passed. Free labels failed at `point-node-native-input`, 11/15 groups,
116 passing records, seven completed point scenarios, no page errors.

`point-native-2d.json` matches raw point source, IDs, coordinates, codim, styles,
layers and labels. Its additional `view.exportMode: inlineMath` is required UI
persistence: both TikZ checks leave that mode selected. `state().json` deliberately
serializes only the editable model, while Download JSON includes current UI
options. The old whole-file save equality compared different contracts.
Observations 0133–0138 confirm native 2D metric/recovery/cursor progress; 0133
records baseline 16.399999618530273 versus 16.4 and bounds height 30.4. This was
neither lost point text nor the earlier line-metric failure. Native 2D reload,
3D, settled point exports, and subsequent App/export groups were not reached.
The aggregate native scenario was not a pass. Independent review was not reached.

### Corrected boundaries and evidence

- `src/App.tsx` adds only a DEV read-only serialized `uiSettings` observation.
  Its effect tracks mode, axis, camera and visibility changes. The independent
  `json` model/history signature retains its previous meaning.
- `scripts/fixtures/jsonPersistenceExpectation.ts` takes the original snapshot
  and independently observed UI settings, never the download. Existing production
  parsing/serialization and UI-option rules supply only expected view metadata;
  all non-view fields come unchanged from the original document. This preserves
  existing view values, applicable overrides, camera normalization, explicit
  standalone mode, 3D false axis flags, and omission of default visibility.
- `scripts/appJsonPersistence.mjs` compares the complete downloaded document,
  reports difference paths, and asserts that download changes neither model,
  history, selected settings nor document revision. Actual controls cross-check
  the separate settings observation. Reload compares the entire saved payload
  strictly, including its view, and checks restored UI state and selected controls.
- `checkPointNodesApp.mjs` retains native direct/cursor/work-plane/Inspector,
  recovery, history, both TikZ outputs and all rendering checks. It now downloads
  and loads both inlineMath and standalone in each dimension. In 3D it changes
  theta/phi/zoom/pan, saves false and true axis flags and nondefault visibility.
  Before each reload it changes mode and applicable camera/axis/visibility controls
  so restoration is observable. Load revision, cleared selection and redo branch
  are checked separately from download invariance. Original native artifact names
  remain; each dimension also writes a `-standalone.json` download.
- `checkFreeLabelsApp.mjs` uses the same save assertion for every download and
  strict reload checks for previously downloaded payloads, retaining CRLF/raw text,
  history, both TikZ modes and conversion isolation checks. Filechooser/download
  waits are owned; cleanup preserves primary errors and failure capture is bounded.
  The renderer-only point snapshot/history consumers were audited and remain
  model-only invariants.
- Numbered point observations now include before-download, downloaded raw bytes,
  parsed payload, expected metadata/document, independent settings/controls,
  dimension/scenario/path and difference paths before assertions. Before-reload
  and post-load model/control observations survive failures before the aggregate
  scenario artifact exists. General App records use `app-persistence-*.json`.
  A secondary diagnostic-write failure cannot replace a persistence mismatch;
  observations never count as passing scenarios.

### Registered regressions and actual checks

`jsonPersistenceOracle.test.ts` exercises the same save/reload assertions used by
the browser harness with independently constructed expected files in both modes
and dimensions. It rejects missing/stale/incorrect mode, missing/stale camera,
incorrect/missing axis, missing/stale/incorrect visibility, modified whitespace,
text, coordinates, IDs, codim, style, layer, unrelated document fields, format,
version and extra metadata. It covers defaults, existing view values, camera
normalization, strict reload corruption and download/history isolation.
`jsonPersistenceBrowserBoundary.test.mjs` runs the actual save/load orchestration
with a deterministic event source, separate model/UI/download inputs, saved bytes,
pre-assertion evidence, stale-observation rejection and failing post-load controls.
These Node tests do not establish native browser acceptance.

All commands used `/opt/homebrew/bin` first (Node v26.9.0):

| Check | Actual result |
| --- | --- |
| New persistence tests | 38 passed; `/private/tmp/stz-32a-persistence-focused.log` |
| Prior oracle/metrics/diagnostics/runner/verifier/failure tests plus initial 32 persistence tests | 166 passed; `/private/tmp/stz-32a-persistence-regressions.log` |
| Full `npm test` | 2,534 passed, zero failures/skips; `/private/tmp/stz-32a-persistence-test.log` |
| `npm run build` | Passed; existing >500 kB chunk warning; `/private/tmp/stz-32a-persistence-build.log` |
| Strict fixture TypeScript / strict new-test TypeScript | Passed; `/private/tmp/stz-32a-persistence-{fixture,test}-tsc.log` |
| New/changed fixture/test lint; recommended JS rules with browser/Node globals | Passed |
| App targeted lint | Same baseline 9 errors/4 warnings, same rule/severity/message headlines; `/private/tmp/stz-32a-persistence-{baseline,app}-lint.json`; no unrelated cleanup |
| Changed script syntax / `git diff --check` | Passed |
| Direct configured `check:free-labels` | Blocked before browser launch at `development-server-listen`, `EPERM 127.0.0.1:5173`; `/private/tmp/stz-32a-persistence-free-labels.log` and matching artifact directory. All 15 groups unexecuted; zero new browser passes. |

The direct run is an intermediate-tree startup failure, separate from the actual
parent assertion above. No sandbox permissions, counts, verifier rules, artifacts,
scenario identities or acceptance gates were relaxed.

After these documentation edits, hold the checkout fixed and run:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32A verify
```

Final results and the exact tracked/untracked identity are retained outside the
checkout at `/private/tmp/stz-32a-persistence-final-verification.json` and
`/private/tmp/stz-32a-persistence-final-checkout.json` to avoid a self-referential
fingerprint. The final response reports that run's actual result. A startup block
is never an acceptance pass. The browser-capable parent must execute the same
command on the final tree, retain all fifteen complete groups, eleven named point
scenarios and required native/download/reopen artifacts, then independently review
that exact matching checkout against `prompts/phase-32a-review.md`. Standalone
verify does not perform review. **32A remains pending; 32B–32D remain deferred.**

## Targeted native 3D coordinate-mode locator fix (2026-09-22)

The starting checkout was clean on `phase/32a-tex-labeled-node`, HEAD
`9be2a400f875d5d0d95f9ac9c14f7e3cc673b998`. Prior implementation, oracle/metrics,
persistence, sanitized-SVG verifier, fixtures and user changes are preserved.
This fix changes only browser harness code, focused tests, test registration and
completion documentation. No production control, schema, dependency, coordinate
model, rendering or deferred 32B–32D feature changed.

### Historical evidence and actual mismatch

The inspected parent is
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32a-before-review-aRv0pQ/verification.json`,
with handoff `stz-phase-verifier-bHe6qE/response.json` under the same temp root.
Its before/after fingerprint is
`26469eb29c4ebfd0699ae7c3675ea62d00922ce6dd39c4ddc1805b96981a46b8` on the older
`a0eefe53c396884dc0193600902104248ee423e2` plus working changes. It passed tests
(2,534), build, diff and assets, then failed at `point-node-native-input`: 11/15
groups, 116 passing records, seven completed point scenarios, no page errors.
The failure was a 30-second exact-label `selectOption` timeout before native 3D
coordinate entry or Create. Independent review was not reached.

Both 2D direct/Inspector/cursor and JSON save/reload modes ran before that failure.
Read-only replay of observations 0141/0146 (download) and 0143/0148 (reload) passes
the current persistence assertions and independently recomputed expectations.
Both `point-native-2d*.json` files match the recorded bytes. Preceding rendering
observation 0133 passes the current literal assertions in native/isolated/resized
contexts. These are historical observations, not a new browser run or completion
of the aggregate native scenario. The four former untracked persistence files
match their archived snapshots byte for byte.

Production `renderDirectCreationForm()` wraps a heading span and an unlabeled
select in `label.direct-coordinate-mode-field`. The select's options are
`global` / `workPlaneLocal`, displayed as “Global 3D coordinates” / “Active
work-plane local coordinates”. Playwright's associated-label text collection
includes these descendants, explaining why exact `Coordinate mode` fails. This
does not assert a browser accessible-name rule for role locators. The failed
historical form DOM was not saved; fresh live confirmation remains a parent gate.

### Correction, regressions and diagnostics

- `scripts/checkPointNodesApp.mjs` scopes the form through `#direct-input-drawer`,
  asserts the loaded dimension, one visible `Direct creation` form, its `Point`
  heading and the Add point menu's pressed Direct input button. In 3D it calls
  `selectPointCoordinateMode()` on that form, then requires one visible/enabled
  x/y/z field. Exact point kind, codim 3 and `{x:.4,y:.7,z:.2}` remain asserted.
  2D retains x/y with z=0 and has no 3D mode control. Native work-plane, camera,
  Inspector, history, both persistence modes and all export assertions remain.
- `scripts/pointNativeCoordinateMode.mjs` uses the form-scoped
  `.direct-coordinate-mode-field select`; requires one visible/enabled control
  and exact option values; explicitly selects `global` and checks the returned
  and current values. It uses neither `.first()` nor a default-value assumption.
  The browser regression copies the actual live App form HTML to an isolated
  page, reproduces the wrapped-label boundary with real Playwright locators,
  checks both valid selections plus an unrelated outside select, and rejects
  absent/ambiguous forms/controls, disabled control and invalid option. That page
  does not edit App model or React state. The original App still creates points
  through native fields and Create. This DOM regression awaits parent execution.
- `scripts/pointNativeSetupDiagnostics.mjs` records read-only dimension/document
  revision/model, drawer/form/tool state, labels and select DOM, scoped/global
  counts, option values/selection, visibility/enabled state and coordinate fields.
  Setup is saved before selection, and values and created model are saved around
  Create. Live exact-label/prefix/scoped-selector counts distinguish a naming
  mismatch from a missing form/control. On failure the actual page is captured
  before close, including the isolated regression page if it fails. Capture and
  failure recording each have a two-second deadline, owned timers and handled
  late rejections; capture/write/cleanup failures preserve the original error.
  Numbered records remain observations, not passing scenario records.
- `tests/scripts/pointNativeCoordinateMode.test.mjs` adds 20 registered,
  selector-aware orchestration tests for selection, missing/ambiguous/hidden/
  disabled controls, incorrect options, invalid selection, unchanged values and
  original rejection. They explicitly do not substitute for the DOM regression.
  Five additions to `pointCheckDiagnostics.test.mjs` cover failing-page evidence,
  bounded capture/write failure, late rejection ownership and timer cleanup.
- Adjacent Work-plane preset, Fixed x/y/z and camera numeric labels were checked
  against App JSX and have explicit accessibility labels. Checkbox controls lack
  the nested-option issue; TikZ mode uses a prefix regex. No additional mismatch
  was demonstrated, and these interactions are unchanged.

### Executed checks and exact final-tree handoff

All commands use `/opt/homebrew/bin` first, Node v26.9.0.

| Check | Actual result |
| --- | --- |
| Focused selection/diagnostics, prior oracle/persistence, direct creation and runner/verifier/failure regressions | 294 passed, zero failures/skips; `/private/tmp/stz-32a-coordinate-focused.log` |
| Full `npm test` | 2,559 passed, zero failures/skips; `/private/tmp/stz-32a-coordinate-test.log` |
| `npm run build` | Passed; existing >500 kB chunk warning; `/private/tmp/stz-32a-coordinate-build.log` |
| Strict fixture TypeScript | Passed; `/private/tmp/stz-32a-coordinate-fixture-tsc.log` |
| Targeted recommended JS lint / changed-script syntax | Passed; `/private/tmp/stz-32a-coordinate-{lint,syntax}.log` |
| `git diff --check` | Passed |
| Configured direct `check:free-labels` | Failed before launch at `development-server-listen`, `listen EPERM 127.0.0.1:5173`; `/private/tmp/stz-32a-coordinate-free-labels.log` and same-named artifact directory. Zero passing scenarios; all 15 groups unexecuted. |

The child startup restriction is separate from the historical parent locator
timeout and from the already corrected oracle/persistence failures. No fresh
native 3D creation, work-plane, persistence or settled-export pass is claimed.
The full 15 groups, 11 point identities, artifacts, structural checks, checkout
matching, fresh verifier and pre-review/commit failure gates are unchanged.

After documentation is fixed, hold the final tree constant and execute:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32A verify
```

Its actual report and tracked/untracked checkout identity are retained outside
the tree as `/private/tmp/stz-32a-coordinate-final-verification.json` and
`/private/tmp/stz-32a-coordinate-final-checkout.json`, avoiding a self-referential
hash. The final response supplies the observed result. The browser-capable parent
must obtain complete matching evidence, including live setup/selection and all
remaining native 3D, point export and subsequent App/export scenarios. Then review
the exact matching tree against `prompts/phase-32a-review.md`; standalone verify
does not perform independent review. No independent acceptance review ran during
this fix. **32A remains pending acceptance; 32B–32D remain deferred.**
