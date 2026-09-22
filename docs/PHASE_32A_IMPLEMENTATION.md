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
