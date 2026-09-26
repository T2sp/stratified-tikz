# Phase 32B Targeted Fix Prompt: Preserve App-page continuity and runtime-directory uncertainty

## Environment and scope

Work on the current Phase 32B branch, `phase/32b-color-opacity-outline`.
Inspect status first and preserve all existing work. At this prompt update the
checkout was clean at `2f2faa123c6aefe3b025fa807b29f9d5bb9760f2` (`Fix 32B`).
The latest failed parent verification has identical before/after fingerprints:

```text
92acaac8b89c875545026db18eba8fa61ad088b672dc8ea0be05c94614d4169b
```

This identifies the checkout before this prompt edit, not a future corrected
checkout. Obtain fresh final evidence including tracked changes, untracked
files and binaries. Use Node >=22.12.0:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Fix the browser acceptance failure and the independently reproduced imported
paint defect below. Preserve the committed provenance, unsupported-mutation,
runtime-model diagnostic and bounded-history corrections. Do not restart those
implementations. Keep Phase 32A behavior and defer 32C/32D. Use strict TypeScript,
bounded literal parsing and existing dependencies. Do not execute arbitrary
TeX/PGF in the importer or preview; focused independent PGF fixtures are in scope.

## Latest verification: failed, not ready for completion

Parent report and handoff:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-manual-UWQV23/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-AdrvZI/response.json
```

| Check | Actual result |
| --- | --- |
| `npm test` | 3,256 passed; zero failures/skips |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| `npm run check:label-assets` | Passed |
| `npm run check:free-labels` | Failed in `point-node-paint-import-persistence` |
| Runtime | Node v26.9.0; Chrome 154.0.8037.57 |

The command log is `05-check-free-labels/command.log` beside that report;
its `artifacts/` directory contains the native observations. The run passed
`point-paint-local-override-intent`, `point-paint-cross-file-resolution`,
`point-paint-unsupported-color-bindings`, `point-paint-unsupported-mutations`
and `point-paint-clear-imported-style` before failing. Clear itself is not the
failing assertion in this run.

The earlier full success at
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-manual-T7zrqY/verification.json`
is historical evidence for its recorded revision plus working tree. Do not
substitute it for acceptance of the new correction or ignore the later failure.

## 1. Diagnose and correct loss of the owned App fixture

Immediately after `runPointImportedPaintChecks()` returns,
`scripts/checkPointNodePaint.mjs` restores the previously saved mixed-paint
fixture with `await load(download.json); await settle()` (approximately line
362). `load()` calls `state()` before opening the Load JSON control. That read
fails because `window.stzAppLabels` is undefined:

```text
page.evaluate: TypeError: Cannot read properties of undefined (reading 'state')
  at state (scripts/checkPointNodePaint.mjs:40:28)
  at load (scripts/checkPointNodePaint.mjs:93:26)
  at runPointNodePaintChecks (scripts/checkPointNodePaint.mjs:362:11)
```

The subsequent Inspector diagnostic fails through the same API at approximately
line 466. It does not supply the missing page identity information. In the
failed artifact directory:

- `point-paint-observation-0235.json` is a valid multi-clear reload snapshot.
- `point-paint-observation-0236.json` observes the standalone SVG.
- `point-paint-observation-0237.json` preserves the primary missing-API failure,
  with no recorded page errors.
- The outer `failure.png` captures the renderer fixture, not the failing owned
  paint App page. Empty `pageErrors` is not proof that the App document survived.

Current inspection does not demonstrate a page-variable mix-up: the App page
and standalone SVG page are distinct, and the SVG helper closes its own page.
The fixture assigns `window.stzAppLabels` once and never deletes it. Document
replacement or incomplete initialization is plausible; neither is established
as the actual cause. Port 5174 does not establish external server reuse: the
parent verifier clears `STZ_BROWSER_BASE_URL` and starts its own server.

A read-only, instrumented rerun of the paint group passed all 14 paint scenarios
on the same committed sources, with one initial App navigation and no later
navigation before cleanup. Its artifacts are:

```text
/private/tmp/stz-32b-paint-reproduce.mjs
/private/tmp/stz-32b-paint-reproduce.log
/private/tmp/stz-32b-paint-reproduction/lifecycle.jsonl
/private/tmp/stz-32b-paint-reproduction/
```

This is a scoped reproduction attempt, not a successful cumulative Phase 32B
report, and does not identify the intermittent trigger.

### Required correction and evidence

Trace ownership and document continuity from App-page creation through native
import/clear/save/download, standalone SVG open/capture/close, helper return and
the next App load. Add bounded diagnostics that do not depend on `stzAppLabels`:

- Identify the owned App page and expected fixture URL; retain main-frame
  navigation, close/crash and relevant console/module/request failure events.
- Observe actual URL, document readiness, root/scripts and API availability at
  startup, the helper-return boundary and failure. Retain a document-generation
  identity so a same-URL reload cannot masquerade as the same App instance.
- Capture the failing App page's bounded DOM/screenshot before cleanup, separately
  from the renderer and standalone SVG pages. Persist primary error and lifecycle
  evidence even when the fixture API, DOM capture or screenshot is unavailable.
- Attribute any reproducible navigation/reinitialization to its actual trigger
  before changing page ownership, Vite configuration or readiness sequencing.
  Keep editor model, history and scenario continuity observable across the
  standalone work. Mark the next lifecycle scenario before its setup so a setup
  failure is not mislabeled as an already-passed clear scenario.

Fix the demonstrated cause with the smallest change. Do not blindly add sleeps,
optional chaining, an automatic reload/recreated App, or a rerun-until-green loop.
A readiness wait is appropriate at legitimate startup; after scenarios begin,
it must not conceal lost model/history, a wrong page or a new document generation.
Do not weaken assertions, reset history to avoid the failure, skip the remaining
paint/export scenarios, or label the failure a production paint defect without
evidence. If the trigger remains unproven, report that explicitly and retain the
new diagnostics rather than claiming a deterministic fix.

Add registered regression coverage for the corrected lifecycle boundary,
wrong/missing API or document replacement, failure-evidence ownership, bounded
capture and cleanup preserving the primary error. Exercise the actual native
App-to-standalone-to-App transition; stub tests alone do not close this gap.

## 2. Preserve runtime-directory uncertainty inside unsupported mutations

Independent read-only review found a separate Medium production export defect.
This source compiles successfully in PGF:

```tex
\tikzset{
  myPoint/.style={fill=red,text=red},
  myPoint/.append style={/other/.cd},
  /other/text/.style={/tikz/text=blue,/tikz/.cd},
  outer/.style={myPoint,text=green}
}
```

Import it and apply `outer` to a point. `resolveTikzPaint()` reports green text
and omits `textColor` from unresolved fields. Generated output emits a green
text override after `outer`. Actual PGF renders the external node blue: the
append changes the active directory, so the later relative `text=green` invokes
`/other/text`, which explicitly selects blue and restores `/tikz`.

Evidence from pdfTeX 1.40.29 / PGF 3.1.11a is retained at:

```text
/private/tmp/stz-32b-review-mutation-directory-BYCyop/source.sty
/private/tmp/stz-32b-review-mutation-directory-BYCyop/generated.tex
/private/tmp/stz-32b-review-mutation-directory-BYCyop/observations.json
/private/tmp/stz-32b-review-mutation-directory-BYCyop/reference.tex
/private/tmp/stz-32b-review-mutation-directory-BYCyop/reference.pdf
/private/tmp/stz-32b-review-mutation-directory-BYCyop/reference.log
/private/tmp/stz-32b-review-mutation-directory-BYCyop/pdf-operators.txt
```

The PDF operators show external `PGF` blue (`0 0 1 rg`) and generated `APP` green
(`0 1 0 rg`). Inspect the retained generated fragment and compiler evidence;
do not claim both export modes were independently compiled without doing so.

The relevant code is `src/model/importedTikzPaint.ts`: approximately lines
179–181 notice `/.cd` during dependency discovery, but lines 240–243 process
unsupported mutation bodies without updating `runtimeDirectoryKnown`. Later
relative options can therefore restore false certainty. Ordinary runtime `.cd`
in a supported style body already keeps later relative options unresolved.

### Required correction and regressions

Carry runtime-directory uncertainty from recognizable unsupported mutation
bodies, including nested dependencies, into subsequent ordered resolution.
A dependency warning/load hint alone is insufficient. Keep later relative paint
unresolved when its key's meaning is unknown; do not invent a known post-key
color override. Conservative uncertainty is sufficient: implementing arbitrary
PGF handlers or full runtime `.cd` evaluation is not required.

Preserve the distinction between declaration-level `.cd` and invocation-time
`.cd`. Keep canonical aliases, source order, stable reference identity, bounded
recursion/work, conservative bound failures, saved-source reconstruction and
load hints. Unrelated styles must remain resolved. Preserve genuinely supported
absolute options and explicit local override intent without treating uncertain
relative options as known. Retain the existing case where a paint-only unsupported
mutation is followed by a known `text=green`; no directory uncertainty should be
invented for that already-supported recovery case.

Register focused model/TikZ regressions for the exact reproduction, a nested
mutation dependency, cross-file ordering and reconstruction, both export modes,
local override/history/persistence behavior and independent unaffected styles.
Inspect effective target-node options after its actual external key and resolve
named colors; do not obtain expected results from the resolver under test.

Retain the failing independent PGF case and compile corrected generated output
to establish that the external effect is preserved. Keep source, exact commands,
compiler/PGF versions, logs, PDF/operators and observations. Extend native import
acceptance and its required evidence for the directory-mutation case. Preserve
visible uncertainty diagnostics and raw source; no arbitrary TeX execution is
required in the renderer.

## Required reading and preserved behavior

Read `AGENTS.md`, the paired 32B implement/review prompts and current
`docs/PHASE_32B_IMPLEMENTATION.md`, `docs/IMPORTED_POINT_PAINT.md` and
`docs/DATA_MODEL.md`. Trace the files above plus:

- `scripts/checkFreeLabels.mjs`, `scripts/fixtures/freeLabelsApp.tsx`,
  `scripts/fixtures/pointPaintModelDiagnostics.ts`, `scripts/ownedPageEvent.mjs`,
  `scripts/pointCheckDiagnostics.mjs` and `scripts/standaloneSvgCapture.mjs`;
- `src/model/importedTikzStyles.ts`, `src/model/styles.ts`,
  `src/tikz/generateTikz.ts`, existing import-context/export tests and
  `scripts/automation/phase-verification.mjs`;
- `tests/scripts/runPhaseVerification.test.mjs` and fresh-process runner fixtures.

Preserve all committed corrections: immediate immutable provenance cleanup on
single/multiple clear; explicit paint and unselected points; valid undo/redo and
JSON reload; ordered unsupported mutations without stale fallback resurrection;
local override intent including return-to-fallback edits; numeric focus/blur
no-ops; source-order dependencies and unsupported color shadowing.

Keep the read-only `runtimeDiagramJson` snapshot separate from persistent JSON.
Do not validate a camera-free saved diagram as a runtime `Diagram`, insert a
camera to hide invalid state, or replace immediate validation with reload-only
validation. Keep bounded 100-entry history checks verifying the exact retained
stack and appended pre-action state, changed present and empty future.

Keep 16 cumulative groups / 25 named point scenarios as the minimum, including
both clear and unsupported mutations and the prior three import scenarios.
Preserve all six responsive downloads and their 91 required artifacts, physical
border/body/font checks, .5 → 2 → .5 captures, independent negative controls,
white-background validation, immutable SVG capture, raw text and 2D/3D semantics.
If coverage grows, update required observations/artifacts and fail-closed policy
regressions. Old evidence lacking new assertions must not satisfy acceptance.
Update isolated runner dependency copying if new verifier imports require it.

## Verification and completion

Run focused registered regressions and appropriate strict TypeScript,
changed-script syntax and targeted lint checks. Preserve unrelated established
lint debt and report it separately from the build chunk-size warning.
Run `npm test` and `npm run build` sequentially because asset preparation is shared.

Before the final freeze, update `docs/PHASE_32B_IMPLEMENTATION.md` with the
actual correction, reproduction and verification handoff location; update
model/import notes only as needed for the directory-uncertainty contract.
Keep the final report path/fingerprint in an external handoff to avoid a
self-referential tracked hash. Freeze the tree, then obtain fresh verification:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands, both browser checks, all cumulative groups/scenarios,
new regression evidence and required PGF artifacts to pass against the same
final fingerprint. A scoped successful rerun or missing page errors alone is
insufficient. Preserve any failed attempts and distinguish established root
causes from hypotheses. Do not weaken permission, evidence, review or commit gates.

If tracked docs or any other checkout files change after verification, obtain
matching verification again. Obtain independent review of the same final tree
against `prompts/phase-32b-review.md`, explicitly rechecking both issues above.
`32B verify` does not perform that review. Phase 32B remains incomplete until
verification and independent review accept the corrected tree. Keep 32C/32D deferred.
