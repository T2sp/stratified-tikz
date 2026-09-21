# Phase 31 combined label audit

Phase 31F adds combined regression coverage and reconciles the label documentation.
**Phase 31 is not yet marked complete:** fresh parent-runner browser evidence and
the subsequent independent review must cover this checkout, including the new
`combined-free-inline-workflows` group. Earlier evidence is prerequisite evidence,
not a pass for these new assertions.

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
31E's eleven-group report for 31F. The gate now requires twelve groups for 31F,
while earlier phases can still use their complete historical group sets.

## Files changed

| Purpose | Files |
| --- | --- |
| Six combined Node regressions and explicit registration | `tests/integration/phase31fCombinedLabels.test.ts`, `package.json` |
| Combined native browser group and 17 paired language fixtures | `scripts/checkCombinedLabels.mjs`, `scripts/fixtures/combinedLabels.ts`, `scripts/checkFreeLabels.mjs` |
| Read-only service observations and controlled resource recovery | `scripts/fixtures/freeLabels.tsx` |
| Twelve-group completion gate and failure/gate regressions | `scripts/automation/phase-verification.mjs`, `tests/scripts/runPhaseVerification.test.mjs`, `tests/scripts/runPhaseRunner.test.mjs`, `tests/scripts/freeLabelsFailureEvidence.test.mjs` |
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

## Current verification and completion gate

Implementation checks used Node **v26.9.0** with `/opt/homebrew/bin` first in
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
No current browser, download or standalone-reopen assertion ran. The parent
must supply fresh results; sandbox settings and assertions were not changed.

Repository-wide lint was not run because the unchanged App/SvgDiagram baseline
is not clean. A focused baseline inspection records **10 errors and 4 warnings**
(App: 9/4; SvgDiagram: 1/0) in
`/private/tmp/stz-31f-lint-baseline.json`, consistent with the accepted 31E review.
These files are unchanged by 31F. That existing debt is separate from the passing
changed-file lint check.

Run from the final checkout with Node >=22.12.0; the parent runner runs these
sequentially so asset preparation in test/build does not race:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31F verify
```

The final command retains logs/checkout hashes, runs both required browser checks,
and verifies all twelve groups. It does not implement, review, commit or push.
For direct browser checks, use the external Playwright module and Chrome already
used by the runner, with a fresh `STZ_SMOKE_ARTIFACT_DIR`. Do not alter sandbox
permissions or weaken assertions to get a result.

Completion requires exit zero for tests/build/diff and both browser checks;
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
