# Phase 31 combined label audit

Phase 31F adds combined regression coverage and reconciles the label documentation.
**Phase 31 is not complete.** The `HHcakE` parent run executed all twelve browser
groups successfully, including `combined-free-inline-workflows`, but rejected
the complete report using a stale eleven-group verifier retained from parent
startup. Independent 31F review was not reached. A fresh invocation of the
corrected runner must accept evidence for the final checkout before review;
the failed parent report remains failed.

## Prerequisites and production integration

Audited from `1302a03` (merged Phase 31E), with the paired 31A–31E implementation
and review prompts, recorded reviews in `logs/codex/`, and targeted fix findings.
The 31A, 31D and 31E recorded reviews pass. The older 31B/31C review summaries
retain browser-environment blockers; the later complete 31D/31E parent runs and
reviews exercise those adapter/free-label gates. No historical summary was
rewritten or substituted for current verification.

The actual production chain is:

1. `App` owns authoritative diagram/history data and document revision. Its SVG
   export handler captures the committed preview synchronously.
2. `SvgDiagram` supplies the same `SvgLabelRuntime` to visible free labels and
   path inline-node text. Excluded captions and undisplayed metadata do not enter
   that path. Path-local node IDs include their path/document owner identity.
3. `SvgTexLabel` uses `parseLabelText` through `createLabelService`, the pinned
   MathJax adapter, and per-mounted-label revision checks. `SvgTexLabelView`
   renders validated geometry and escaped ordinary text.
4. Free-label picking reads committed revision-matched layout through
   `svgLabelBounds`/`svgHitTesting`; inline text remains pointer-transparent and
   uses existing marker candidates. Placement and paint are independent of
   conversion cache identity.
5. `captureSvgExportSnapshot` copies the committed SVG and immutable label
   captures; `settleSvgExportLabels` and `renderSettledSvgLabelDocument` create
   detached settled label subtrees. The existing sanitizer removes editor
   overlays and resolves standalone presentation before download.

No production feature, dependency, schema, model, history policy, or TikZ
generator is changed by 31F. The identified gaps were combined workflow
coverage, stale documentation, and a completion gate that previously accepted
31E's eleven-group report for 31F. The on-disk gate requires twelve groups for
31F, while earlier phases retain their supported complete historical sets. The
subsequent `HHcakE` run exposed a separate lifecycle defect: the long-lived
runner kept the verifier imported before its implementation child updated that
gate. This calls for an automation correction, not a production rendering change.

## Files changed

| Purpose | Files |
| --- | --- |
| Six combined Node regressions and explicit registration | `tests/integration/phase31fCombinedLabels.test.ts`, `package.json` |
| Combined native browser group and 17 paired language fixtures | `scripts/checkCombinedLabels.mjs`, `scripts/fixtures/combinedLabels.ts`, `scripts/checkFreeLabels.mjs` |
| Read-only service observations and controlled resource recovery | `scripts/fixtures/freeLabels.tsx` |
| Twelve-group completion gate and failure/gate regressions | `scripts/automation/phase-verification.mjs`, `tests/scripts/runPhaseVerification.test.mjs`, `tests/scripts/runPhaseRunner.test.mjs`, `tests/scripts/freeLabelsFailureEvidence.test.mjs` |
| Fresh verifier lifecycle and running-parent regressions | `scripts/automation/run-phase.mjs`, `scripts/automation/phase-verification-worker.mjs`, `tests/scripts/runPhaseRunner.test.mjs` |
| User language/help, exact contract, status and audit | `docs/PREVIEW_UI.md`, `docs/SPEC.md`, `docs/ROADMAP.md`, `docs/LABEL_ADAPTER.md`, `docs/PHASE_31_COMPLETION_AUDIT.md` |

## Acceptance matrix

These are representative combinations, not a Cartesian product. Existing
focused invariants remain registered in `npm test`; new combined Node tests are
in `tests/integration/phase31fCombinedLabels.test.ts`. Browser rows identify
executable assertions; their current execution status is recorded below.

| Area | Representative fixture and evidence |
| --- | --- |
| Plain input | `scripts/fixtures/combinedLabels.ts`: empty, spaces, ordinary text and Japanese/Unicode through free and inline owners; `labelText.test.ts` and inline empty-node policy tests |
| Supported math | Combined delimiter fixtures plus real `mathjaxAdapter.test.ts`: all four delimiters, fractions, scripts, roots and matrices |
| Mixed input | Combined multiline/multiple-run fixtures and real adapter layout: shared baselines, text newline splits, math-body newline retention |
| Invalid input | Combined missing/mismatched delimiter, malformed fraction and undefined macro; `mathjaxErrors.test.ts` covers error hooks and resolved errors |
| Unsupported input | Combined text commands/package/macro cases and real adapter isolation tests; no preamble or external-style macro access |
| Literal fallback | Combined full-source cases and existing literal tab/edge-whitespace browser oracle: markup-like text, repeated spaces, tabs, CRLF/LF and backslashes |
| Resource failure | Combined same-service recovery; `labelServiceLifecycle.test.ts` font/init deadlines; built `check:label-assets` runtime/transitive/font import failure and retry |
| Editing races | Combined Node current-source/layout/picking lifecycle; `checkFreeLabelRaces.mjs`, App valid–invalid–valid and inline same-owner recovery with held results |
| Lifecycle | Existing native delete/unmount/reused-ID-load groups and App held Undo/Redo; combined Node history/load/settlement assertions |
| Cache | Combined free/path duplicate conversions with independent paint, placement, edits/removal; service tests cover eviction, font/config keys and retry |
| Work bounds | Real adapter expansion/array tests; parser source/run limits; mounted limit fallback and pending/unsettled caps in focused service tests |
| Placement | Existing independent nine-anchor oracle and 18-case boundary matrix; inline five-placement, tall-fraction and two-zoom halo oracle; multiline combined fixtures |
| Interaction | Production native free-label click/drag/cycling; inline glyph-only pass-through and marker-centered Alt-click, including complete 3D candidate cycles |
| View | Combined same-runtime 2D/3D camera changes with conversion counts; existing pan/zoom boundary matrix, autoHide and autoDim observations |
| Visibility | Pending lock/autoHide tests and settled autoHide/autoDim/hidden-layer/filter exports; excluded captions/metadata remain outside conversion |
| Styling | Combined free/path independent color/opacity/scale; real explicit/currentColor adapter paint; inline white outline pixel oracle and negative controls |
| Export | `checkSettledSvgExports.mjs`: pending click-time capture, continued edits/load, both backgrounds, real downloads and standalone `file://` reopening with local reference checks |
| Persistence | Combined actual serialization/save-load/history and both generated TikZ modes, plus existing model/TikZ suites; compare values before and after asynchronous work |
| Accessibility | Shared source-named `role="img"`; outline copies are `aria-hidden`; combined browser checks assert no additional named formula target |

## Eight editing workflows

| Workflow | Runtime coverage |
| --- | --- |
| 1. Create mixed owners, typeset, style/place, select/drag | New combined browser group plus existing free-label native drag and inline marker gestures; shared view/picking Node tests |
| 2. Valid → invalid → repaired, same current bounds | Actual App textarea workflow, free-label race probes, inline same-owner recovery and new combined real-adapter Node test |
| 3. Inverted completion, delete/load/Undo/Redo | Existing held-result browser groups and App reused-ID loads, extended by combined Node document/history/export lifecycle |
| 4. Pan/zoom/3D camera without recompilation | Existing boundary matrix and inline moved-camera native probes, plus combined free/path invocation counts |
| 5. Repeated formulas, change one/remove another | New simultaneous free/path browser fixture and combined Node service/controller test; immutable geometry and owner-specific presentation |
| 6. Resource failure, finite fallback, recovery | New combined mounted resource scenario, existing mounted failure isolation, native deployed import recovery and focused font/timeout tests |
| 7. Export pending, continue editing labels/geometry/view | Existing actual App download with held captured free/path conversions, later 3D document and white export; detached settlement Node tests |
| 8. Save/load/Undo/Redo after success/failure/export | Combined actual model/history round-trips and both TikZ outputs; App JSON download/import and held-history/export invariants |

Deferred delivery controls timing without replacing real MathJax output. Focused
tests that inject malformed engine output or rejected resources are identified
as failure tests, not as proof of successful conversion. Browser layout evidence
uses native geometry/pixels and pointer events, including deliberate faulty
output controls; screenshots alone are not the revision/persistence oracle.

## Historical browser evidence inspected

The completed prerequisite run is retained at:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31e-before-review-fIMqou/
```

Its `verification.json` reports passed. Its
`05-check-free-labels/artifacts/free-labels-evidence.json` records Node v26.9.0,
Chrome **153.0.8010.52**, all eleven then-required groups, 129 passing scenario
records, and no incomplete groups or page errors. The 31E independent review
accepted the matching checkout. The audit inspected its JSON and retained
standalone imagery, including `export-later-3d-white-standalone.png`.

Representative reproducible artifacts include
`export-click-time-2d-transparent.svg`, `export-later-3d-white.svg`, their
`*-standalone.json`/PNG files, the geometry boundary PNGs, inline halo/camera
observations, and the asset-check native retry/containment reports. The standalone
JSON records only the local SVG request, successful formula paths, literal
fallback/Unicode text, current colors/opacity and the glyph outline. These are
historical observations; the fresh 31F run must regenerate equivalent artifacts
and execute the added combined group.

## Initial implementation-child checks

These checks preceded the executed parent run below. They used Node **v26.9.0** with `/opt/homebrew/bin` first in
`PATH`. No dependency was added.

| Check | Result and retained log |
| --- | --- |
| `npm test` | Exit 0: **2,434 passed**, zero failed/skipped; final run `/private/tmp/stz-31f-npm-test-final.log` (32.02 seconds); initial full run also passed |
| New combined Node file | **6/6 passed**, including real MathJax success/error and controlled delivery; registered in `package.json` |
| Verification-runner tests | **64/64 passed** in the focused run; also included in the full suite |
| `npm run build` | Exit 0; `/private/tmp/stz-31f-build.log`; existing nonblocking >500 kB chunk warning |
| Fixture strict TypeScript | Exit 0; `/private/tmp/stz-31f-fixtures-tsc.log`; new integration test also passed a strict standalone TypeScript check |
| Changed-file ESLint | Exit 0; `/private/tmp/stz-31f-focused-lint.log` |
| Changed browser/verification script syntax | Exit 0 for `checkCombinedLabels.mjs`, `checkFreeLabels.mjs`, `phase-verification.mjs` |
| `git diff --check` | Exit 0 |
| `check:label-assets` | Exit 1 before browser launch: `listen EPERM` on `127.0.0.1`; `/private/tmp/stz-31f-label-assets.log` |
| `check:free-labels` | Exit 1 at `development-server-listen`: `listen EPERM` on `127.0.0.1:5173`; `/private/tmp/stz-31f-free-labels.log` |

The asset check's **static-only** graph validation passed: four main entries,
43 worker chunks, 85 references and 40 approved font modules. Its evidence is
`/private/tmp/stz-31f-child-label-assets/asset-graph-evidence.json`; this does not
establish browser loading, recovery or containment. The free-label failure
report is `/private/tmp/stz-31f-child-free-labels/free-labels-evidence.json`:
`browserVersion: null`, no started/completed groups, all twelve groups unexecuted.
No browser, download or standalone-reopen assertion ran in those child attempts.
The later parent run below did execute them. The child startup restriction is
not the cause of the parent failure; sandbox settings and assertions were not
changed.

Repository-wide lint was not run because the unchanged App/SvgDiagram baseline
is not clean. A focused baseline inspection records **10 errors and 4 warnings**
(App: 9/4; SvgDiagram: 1/0) in
`/private/tmp/stz-31f-lint-baseline.json`, consistent with the accepted 31E review.
These files are unchanged by 31F. That existing debt is separate from the passing
changed-file lint check.

## Executed 31F parent browser evidence and stale validation

The parent run on **2026-09-21, 13:23:35–13:25:26 UTC** is retained at:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31f-before-review-HHcakE/
```

`verification.json`, each command's stdout/stderr and exit-status, and
`05-check-free-labels/artifacts/checkout.diff` / `checkout-untracked.json`
identify revision `1302a03dd28af8eea0fe2930f066fff695ea5d1e` plus eleven modified
tracked files and four untracked files. Its before/after fingerprint matched:
`9109342812ad20fc3f5db0c01787af3b3fd03d349fe09e65bf1a3aa66f854e56`.
These are the historical inputs; subsequent commits or this correction do not
turn that report into evidence for a different checkout.

The run used Node **v26.9.0**, Chrome **153.0.8010.52**, the external Playwright
runtime at
`/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`,
and the Vite fixture at `http://127.0.0.1:5174`.

| Check or gate | Recorded result |
| --- | --- |
| `npm test` | Exit 0; **2,434 passed**, none failed or skipped |
| `npm run build` | Exit 0; existing nonblocking chunk-size warning |
| `git diff --check` | Exit 0 |
| `npm run check:label-assets` | Exit 0; parent accepted its evidence |
| `npm run check:free-labels` | Exit 0; stdout ends with `free-label-browser-check-passed`, `checks: 144` |
| Free-label evidence | `passed` / `complete`; all **12 groups**, **144 passing scenarios**, including **15 combined workflow records**; empty incomplete/unexecuted/page-error lists |
| Parent evidence validation | **Failed**, despite the command's recorded `exitCode: 0`; old diagnostic requires **11** groups |
| Overall parent / independent 31F review | **Failed** / **not reached** |

The exact parent error is:

```text
check:free-labels evidence is incomplete or invalid:
Phase 31F browser evidence must complete 11 required groups;
only complete supported group sets are accepted
```

The retained diff adds `combinedLabelGroups`, makes twelve mandatory for 31F,
and recognizes the new complete group set. The runner had already statically
imported `browserChecksForPhase`, `runPhaseVerification`, and
`verificationMatchesCheckout` before the implementation child changed that
module. ESM retains those loaded bindings; rereading the same import URL does
not refresh them. Its old strict validator therefore rejected the valid extra
group. The report did not complete too few groups. Neither an error-text change
nor accepting arbitrary supersets would repair this lifecycle defect.

The following actual artifacts and observations were inspected under
`05-check-free-labels/artifacts/`, in addition to the report and logs:

| Artifact / scenario | Observed evidence |
| --- | --- |
| `combined-language-2d-*.png`, `combined-language-3d-*.png` and matching report records | Seventeen paired language fixtures across both modes, with successful fractions/scripts/mixed Japanese text and complete literal failures; inline empty/whitespace policy, pointer transparency and accessible source naming remain represented |
| `combined-shared-cache-editing.png`, `combined-camera-3d.png`, `combined-resource-recovered.png` and matching records | Real shared conversion with independent free/path paint/placement; native drag and marker interaction, editing/removal, camera movement without compilation and same-service resource recovery |
| `export-click-time-2d-transparent.svg`, `*-standalone.json`, `*-standalone.png`, `*-raster.png` | Seven captured labels and 520×360 viewBox; `Before $\alpha^2$` retains opacity `0.65`; successful formula paths coexist with full literal failure/Unicode and resource fallback; no background rectangle, raster corner RGBA `[0,0,0,0]` |
| `export-later-3d-white.svg` and companion standalone/raster artifacts | Eight labels with changed 3D geometry and `After $\beta^3$`, opacity `0.8`; resource gamma recovers to a formula; one first white rectangle covers 520×360, raster corner `[255,255,255,255]` |
| `export-serialization-retry.svg` and companion standalone/raster artifacts | Successful third download after injected serialization failure; same later white-view geometry and successful/fallback label mix |
| `settled-export-*-completed.json`, native boundary artifacts and report export records | autoHide, autoDim, layer filtering, hidden-layer exclusion, invalid-viewport retry, SVG-context render boundary and zero-label case all passed, followed by native click-time download/isolation and serialization retry |

All three downloaded standalone observations record only their own `file://`
SVG request, no page or XML parser errors, no forbidden content, and no
unresolved `currentColor` or external references. Actual XML retains explicit
paint, exact raw opacity attributes, formula paths, glyph-local white outlines,
and whitespace-preserving literal text fragments. Native computed-opacity
checks retain their numeric tolerance. The screenshots use bounded viewports;
source preservation is established by XML/geometry assertions, not by assuming
that every long label fits within the captured viewBox. This preserves the
executed 31E export passes, including first transparent capture, later white
export and failure/retry. These are historical browser passes for `HHcakE`,
not an accepted parent result for the corrected automation checkout.

## Corrected-runner verification and independent review gate

The runner correction removes the retained startup binding used to run
verification. It starts `phase-verification-worker.mjs` from the same automation
checkout in a fresh Node process at the verification boundary. That current verifier owns
both browser-check selection and evidence validation. A private fresh response
file hands the concrete saved report/path back to the parent, which checks its
shape, equality with the saved report, status and command outcomes before
review. Startup/import/missing or malformed report failures stop the stage;
there is no fallback to the retained verifier or an earlier successful report.
The post-review identity check retains its original guard and in-memory report
so review-time edits cannot replace the accepted identity or redefine that gate.
Twelve-group 31F acceptance, earlier complete supported sets, dirty-tree manual
verification, child sandboxing, read-only review handoff and commit/push gates
are preserved.

The isolated runner suite now copies the real automation entry points into a
temporary git checkout. Its fake implementation/fix child replaces eleven-group
policy with twelve-group policy while the same parent PID remains alive. Twelve
groups reach a fake read-only review with the matching saved report; eleven
groups fail before review with a twelve-group diagnostic while retaining browser
exit zero. A retained-startup-import mutation reproduces the original eleven-group
failure, so the regression detects the old lifecycle. A dependency-only policy
change also passes through the fresh module graph. Other cases cover command exit
17, worker startup/import/response/report failures after prior success, stale
report replay, dirty-tree manual verification and review-time checkout/report/
identity-helper changes. All fixtures stop before commit and have no real remote.
The existing test file remains registered in `package.json`; no new test list
entry or dependency is needed.

Correction checks used Node **v26.9.0** and the required PATH. The focused command
was:

```bash
export PATH=/opt/homebrew/bin:$PATH
node --test tests/scripts/runPhaseRunner.test.mjs tests/scripts/runPhaseVerification.test.mjs tests/scripts/freeLabelsFailureEvidence.test.mjs tests/integration/phase31fCombinedLabels.test.ts
node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.json --noEmit
```

| Correction check | Executed result |
| --- | --- |
| Focused four-file Node run | Exit 0: **86 passed**, zero failed/skipped, including **26 runner tests** and the preserved **6 combined tests**; `/private/tmp/stz-31f-refresh-focused-tests.log` |
| Fixture strict TypeScript | Exit 0; `/private/tmp/stz-31f-refresh-fixtures-tsc.log` |
| `node --check` | Exit 0 for `run-phase.mjs`, `phase-verification.mjs`, new `phase-verification-worker.mjs`, `checkFreeLabels.mjs`, `checkCombinedLabels.mjs` |
| Focused ESLint | Exit 0 for those five scripts, `freeLabels.tsx`, `combinedLabels.ts` and all four focused test files; `/private/tmp/stz-31f-refresh-focused-lint.log` |
| Fresh corrected entry point below: `npm test` | Exit 0: **2,447 passed**, zero failed/skipped; focused counts are included in this total |
| Fresh corrected entry point: `npm run build` | Exit 0; existing nonblocking chunk-size warning |
| Fresh corrected entry point: `git diff --check` | Exit 0 |
| Fresh corrected entry point: `check:label-assets` | Exit **1** before browser launch: `listen EPERM` on `127.0.0.1`; static asset graph passed (4 entries / 43 worker chunks / 85 references / 40 font modules) |
| Fresh corrected entry point: free-label browser / independent 31F review | **Not run** after the failed asset gate; no new native export evidence or acceptance claimed |

The actual new invocation was
`PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31F verify`,
on **2026-09-21, 13:37:44–13:38:30 UTC**. It executed the corrected worker
entry point inside this child sandbox; a new process does not escape that
sandbox. Tests, build and diff ran sequentially before the asset failure, which
propagated as exit **1** and a **failed** report. Logs and reports are retained:

```text
/private/tmp/stz-31f-refresh-verify.log
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31f-manual-TSWi0u/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-wxobMD/response.json
```

The manual report contains individual command/stdout/stderr/exit-status paths.
Its revision is `9dd72732ca84a1647c0dd57ba77af3a7edfceff3`; the dirty tracked tree
and untracked worker had matching before/after fingerprint
`750986cb993db3824b6e258f6a47e5706043bf4a48a53fc2e4df993e3bfffbcb`.
This paragraph and the final documentation reconciliation were added afterward;
that report identifies the pre-reconciliation snapshot, not the final handoff
tree. The final tree identity is separately recorded in
`/private/tmp/stz-31f-refresh-final-checkout.json` to avoid a self-referential
fingerprint in a tracked document. No implementation, review, branch switch,
commit or push was performed by manual verification.

Fresh **accepted parent/Terminal** verification and subsequent independent 31F
review remain pending. A running outer process cannot acquire edits to its own
runner control flow automatically; it must restart verification through the
corrected entry point below. The child-only `TSWi0u` startup restriction does not
replace or invalidate the executed `HHcakE` browser/export passes, and neither
failed report closes the final gate. Do not recursively launch `31F fix` or
`31F implement` from a fix child. Sandbox and browser assertions were unchanged.

Run from the final checkout with Node >=22.12.0; the parent runner runs these
sequentially so asset preparation in test/build does not race:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31F verify
```

The final command retains logs/checkout hashes, runs both required browser checks,
and must accept all twelve groups through the current verifier. It does not
implement, review, commit or push.
For direct browser checks, use the external Playwright module and Chrome already
used by the runner, with a fresh `STZ_SMOKE_ARTIFACT_DIR`. Do not alter sandbox
permissions or weaken assertions to get a result.

Completion requires an accepted `status: "passed"` parent report, in addition to
exit zero for tests/build/diff and both browser checks;
`result: "passed"`, `stage: "complete"`, an observed browser version, twelve
completed groups, empty `incompleteGroups`, `unexecuted`, and `pageErrors`; matching
tracked/untracked checkout fingerprints; inspected standalone export artifacts;
and independent review. The roadmap retains this gate until that evidence exists.

## Scope and known limits

The exact grammar, package configuration and numerical work/cache limits are in
[SPEC.md](SPEC.md#bounded-tex-label-preview) and
[LABEL_ADAPTER.md](LABEL_ADAPTER.md). This is a bounded SVG math preview, not a
LaTeX engine. External TikZ styles/preambles do not supply preview macros or
packages. Only free labels and visible path inline text are typeset. Ordinary
Unicode uses installed browser/system fonts; formula geometry uses packaged
MathJax/NewCM resources. No promise of general offline availability or exact
TeX-engine typography is made. Empty inline-node text remains undisplayed under
the existing policy; fallback never truncates its authoritative source.
