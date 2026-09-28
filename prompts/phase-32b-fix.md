# Phase 32B Targeted Fix Prompt: Resolve native 3D visibility control timeout

## Environment and scope

Work on `phase/32b-color-opacity-outline`. Read `AGENTS.md`, the paired 32B
implement/review prompts, current implementation report and relevant diagnostics.
Preserve all current tracked changes and 150 untracked files, including the
completed dashed-cap, effective-style layout, solid-join and lifecycle work.
At this prompt update HEAD is `87798f7deaaedf298159b719a86288078dd69191`.
The implementation handoff and latest parent verification match this identity:

```text
24397265a1a6ec1bef2636e96843225b5d4386dce36876dfc0105f6282f58d4e
```

This is the identity before this prompt edit, not a final verification claim.
Recompute tracked/untracked/binary identity after corrections. Do not reset,
discard or restart existing work. Use Node >=22.12.0:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Investigate and correct the latest native input timeout at the approximate 3D
visibility checkbox, preserving the save/change/reload acceptance contract.
Then complete matching cumulative native verification and independent review.
The timeout's exact cause remains unproven; do not assume another geometry
change is needed. Keep strict TypeScript, existing dependencies and completed
32A/32B behavior. Keep 32C/32D deferred.

## Evidence and current acceptance status

Read and retain these separate results:

```text
/private/tmp/stz-phase32b-dash-handoff/HANDOFF.md
/private/tmp/stz-phase32b-dash-handoff/independent-review.md
/private/tmp/stz-phase32b-dash-handoff/independent-audit-index.json
/private/tmp/stz-phase32b-dash-handoff/final-checkout.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-reehte/response.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-UThawr/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-UThawr/05-check-free-labels/command.log
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-UThawr/05-check-free-labels/artifacts/free-labels-evidence.json
```

The dash implementation finished with **4,158/4,158 tests passed**, build/diff,
strict TypeScript, targeted lint and script syntax passed. Its independent
review found the production correction satisfactory within the tested scope,
but returned `needs_changes` for missing current native acceptance. Both child
browser attempts stopped before acceptance at localhost `listen EPERM`.
The separate Chrome UI attempt was rejected by automatic approval:
“Computer Use was not approved to use Google Chrome.” Preserve these facts;
do not change permissions or bypass rejection to produce acceptance.

The subsequent parent `UThawr` run reached real Chrome **154.0.8037.57** on
Node **v26.9.0**, with matching before/after identity:

| Required command | Parent result |
| --- | --- |
| `npm test` | 4,158 passed, zero failed/skipped/cancelled |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| `npm run check:label-assets` | Passed |
| `npm run check:free-labels` | Failed at `point-node-native-input` |

The free-label report has 11 completed groups; five remain incomplete, including
four unexecuted groups. `point-node-body-layout-lifecycle` is incomplete;
`real-App-input-JSON-history-reused-ID-load`, `settled-SVG-export-standalone`,
`point-node-settled-export` and `point-node-paint-import-persistence` were not
executed. No page errors were recorded, but native acceptance is incomplete.
In particular, the new dash-cap group coverage has not passed in this run.

Do not describe this latest failure as a server-startup permission problem or
claim all native checks passed. The historical `wPPGzN` parent acceptance
(16 groups, 28 scenarios, 386 artifacts, pre-fix fingerprint `121aaf32…`) remains
valid for its earlier tree, not the current implementation.

## 1. Locate the exact native failure and preserve its evidence

The failing call is currently `scripts/checkPointNodesApp.mjs:203`, inside
`runNativePointChecks`, reached through `checkPointNodes.mjs` and
`checkFreeLabels.mjs`. Playwright reports:

```text
locator.uncheck: Timeout 30000ms exceeded.
waiting for getByLabel('Enable approximate 3D visibility', { exact: true })
  locator resolved to <input type="checkbox"/>
  attempting click action
    waiting for element to be visible, enabled and stable
    element is visible, enabled and stable
    scrolling into view if needed
```

The log ends during scrolling after actionability checks succeeded. It does not
prove a click occurred, a visibility update was committed, or why scrolling
failed to finish. This differs from the earlier free-label SVG
`scrollIntoViewIfNeeded` failure waiting for element stability; retain both
histories without asserting a shared cause.

Inspect these files in the `UThawr` artifacts directory:

- `point-observation-0179.json` through `point-observation-0183.json`: the 3D
  `inlineMath` save/change/reload sequence completed, with no payload differences
  and document revision advancing from 4 to 5.
- `point-observation-0184.json` through `point-observation-0186.json` and
  `point-native-3d-standalone.json`: the subsequent 3D `standalone` download
  completed with no payload differences. Saved controls include axes on,
  visibility on, surface depth sorting off, theta 41, phi -28, zoom 1.3 and
  pan `(12,-9)`.
- `point-observation-0187.json`: native failure capture from the actual App URL,
  with a readable 3D document at revision 5 and local `errors: []`.

After that standalone download, the code changes export mode to `inlineMath`,
turns axes off, turns surface depth sorting on, then tries to turn visibility
off. The timeout occurs at this final checkbox action, before changing theta to
63 and before the standalone file's reload. There is no corresponding
standalone `before-reload`/`reload` evidence. Preserve both export-mode iterations;
the successful inline iteration cannot replace the failed standalone iteration.

The failure capture establishes that the state API was callable when captured,
not uninterrupted App identity or healthy scrolling/rAF throughout the action.
Its setup observer covers the direct-input form, which is already closed here;
zero form/control counts are expected and do not diagnose the checkbox.
It omits current checkbox state/geometry and `uiSettings`. The persisted
`diagram.view` from the earlier load is not proof of current live UI settings.
The outer `failure.png` shows the separate renderer fixture, not this native
App page. Do not use it as checkbox or App-layout evidence.

## 2. Investigate with bounded evidence from the actual native App

Inspect `checkPointNodesApp.mjs`, `appJsonPersistence.mjs`,
`pointNativeSetupDiagnostics.mjs`, `ownedAppPage.mjs`, existing geometry/scroll
helpers and their tests, and the production visibility controls/layout.
The native input page is created separately from the renderer and from later
paint/import App workflows. Reuse appropriate existing diagnostics without
assuming those other pages' ownership instrumentation covers this call.

Reproduce the exact 2D/3D direct/cursor and persistence sequence, including
both `inlineMath` and `standalone` iterations, using the normal viewport and
real controls. Also run it in the cumulative predecessor sequence. A focused
reproduction is investigation evidence, not a substitute for full acceptance.
Preserve original failures and put investigative/corrected results separately.

Add only the observations needed to distinguish the cause, before the suspect
control changes and at failure, with explicit dimension/mode/action boundaries:

1. Actual page/document identity, URL, closed/crashed state, lifecycle and local
   page errors; guarded App API availability, document revision, current
   `uiSettings`, relevant model/history state and saved download identity.
2. Checkbox match count, associated label, checked/enabled/connected state,
   bounding rectangle, viewport and relevant scroll-container offsets/styles.
   Record nearby layout changes after surface-depth-sort is enabled, active
   focus and overlays/hit target where relevant. Distinguish pre-action,
   post-action and failure observations rather than inferring state from code.
3. Finite timing/scroll/rAF responsiveness observations sufficient to distinguish
   layout movement, browser/protocol stalls, App replacement and host timing
   anomalies. Treat each as a hypothesis until supported by retained evidence.
   Do not infer a host-sleep cause merely from an unusually long wall duration.
4. A bounded screenshot and structural/control snapshot of this actual native
   App before it closes. Keep fallback metadata if capture stalls. Retain the
   original Playwright error, call log and stack even if diagnostics fail.

Reuse finite diagnostic deadlines and ownership of late rejections. Cap retained
samples/DOM/event size, remove listeners/timers, and close only owned resources.
A secondary capture/write/cleanup error must not mask the original timeout or
hang the suite. Do not add another unbounded readiness/geometry wait or rely on
an unconditional fixture API call to diagnose a missing App.

Make the smallest correction justified by evidence, whether in control layout,
state transitions or native harness interaction. A targeted scroll/readiness
correction must preserve realistic native control access and observable state
changes. Do not force clicks, invoke DOM `click()`/dispatch synthetic events,
mutate checkbox/model state via evaluation, preconfigure the fixture to skip
unchecking, or suppress the failed action. Do not hide the issue with arbitrary
sleeps, blanket deadline increases, global concurrency changes, retries until
green, or replacing/reloading the App after continuity loss.

## 3. Preserve persistence proof and register targeted regressions

The save/change/reload sequence deliberately changes live controls so reload
cannot pass because controls already equal the saved values. Preserve and make
observable the real visibility `true -> false -> true` transition, surface
sorting `false -> true -> false`, export mode/axes changes and camera restoration
for both 3D iterations. Confirm differing live settings before reload, then
compare the complete downloaded document, UI settings and selected controls.
Keep the revision increment, selection reset, cleared redo branch, immutable
JSON downloads, exact source and both 2D/3D direct/cursor/work-plane checks.

Add registered regressions for demonstrated failure mechanisms and any new
bounded diagnostic/interaction helper. Cover primary-error retention, capture
failure/timeouts, late rejection ownership and cleanup where changed. Native
regression evidence must show the actual checkbox action and downstream
save/reload assertions; a mocked helper pass cannot prove browser behavior.
If evidence remains insufficient to identify the trigger, say so explicitly
and retain the gap; do not label it fixed because one isolated rerun passed.

## Preserve completed geometry, lifecycle and cumulative acceptance

Do not reimplement the completed dashed-cap correction. Preserve shared
effective stroke settings, named defaults and explicit-pattern precedence,
phase canonicalization, cap/join/miter semantics, bounded dash scheduling and
content-based committed-layout matching. Keep pending/committed and immutable
export geometry consistent. Preserve real cap extensions on polygons/circles,
the documented 256-edge contour for active square-capped dashed circles,
original interior and continuous-stroke selection through gaps, and exactly
six local units of picking tolerance.

Keep dashed triangle `(0,-24)` and `(-6,-28)` hits, solid bevel `(0,-24)` and
solid miter `(0,28)` misses, genuine miter-tip hits, concave/overlap/corner/seam
controls and all original solid-join fixtures. Preserve valid zero entries and
independent positive/exterior-negative paint observations. The retained Cairo
matrix normalized internal zero-on entries in 28 cases; this is not proof of
Chrome behavior. Require the current native engine audits before accepting
those cases, without dropping valid caps to match Cairo.

Keep the current mandatory minimum **16 cumulative groups, 29 point scenarios
and 605 artifacts**, including all original 386 artifacts and 219 dash-cap
artifacts, 18 dash cases and the complete 1,089-cell audits for the required
square-cap cases. Retain ordinary/Alt trusted pointer actions after live style
edits, overlap candidates, transforms, independent raster controls, contour/
continuous-neighborhood coverage and terminal/corner/internal-zero cases.
Inspect determined cells and failures; do not shrink grids or use production
geometry as its own paint oracle. Extend required policy only when necessary
for new evidence, with negative controls; never reduce existing requirements.

Keep `docs/PHASE_32B_LIFECYCLE_INVESTIGATION.md` and its phase-labelled bounded
writes, deterministic timeout test, real I/O evidence, primary-error/late-
rejection/close/cleanup assertions and unchanged production deadlines. The old
3,986/3,987 failure, separate 11/11 rerun and later complete passes remain
separate facts; its precise historical trigger remains unproven. Preserve the
file-backed verification fixture transport and demonstrated memory fix; do not
restore retained multi-megabyte closure copies or increase heap/deadline limits.

Preserve importer uncertainty/local override intent and retained independent
PGF evidence; independent paint/opacity/dimming; legacy normalization, cloning,
clipboard/history; raw JSON/CRLF; 2D/3D semantics; free/inline labels and immutable
whole-node exports. Keep five native geometry fault controls, seven App → SVG →
App transitions, three continuity controls/13 artifacts, the directory scenario/
11 artifacts and six responsive downloads/91 artifacts. Preserve fresh-process
verification, the runner's 60-second fixture deadline, owned-process cleanup
and failed-evidence retention. No unrelated cleanup or 32C/32D work.

## Verification and independent review

Document the actual mechanism, correction, retained failures and any remaining
uncertainty. Run focused registered regressions, applicable strict production/
fixture/test TypeScript, changed-script syntax, targeted lint and diff checks.
Run `npm test` and `npm run build` sequentially because they share asset
preparation. Keep demonstrated baseline lint debt and the existing bundle-size
warning separate from new failures.

Finalize code/tests/tracked docs, then record final identity and report paths in
an external handoff. In the authorized browser-capable parent, run:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands on the same final tracked/untracked/binary identity.
Inspect both browser reports, full terminal success, all mandatory scenarios/
artifacts, no page errors and no incomplete/unexecuted groups. The current
`UThawr` partial run and child `EPERM` results cannot satisfy this gate.
If execution is blocked, retain that exact limitation and hand off for authorized
parent verification; never mark an unavailable check passed or bypass approval.

Any checkout edit after verification requires matching verification again.
Obtain a fresh independent read-only review against `phase-32b-review.md`,
covering the native timeout correction, persistence evidence and previously
pending dashed-cap native acceptance. `32B verify` itself does not perform review.
Do not commit or push while required verification/review is unsuccessful.
32B remains incomplete until all gates pass; 32C/32D remain deferred.
