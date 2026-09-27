# Phase 32B Targeted Fix Prompt: Include dashed caps in point bounds and picking

## Environment and scope

Work on `phase/32b-color-opacity-outline`. Inspect status and preserve all current
geometry, rendering, browser/policy, documentation, package and test changes,
including the 43 untracked solid-join helper, fixture and regression files.
At this prompt update HEAD is `b8455dfc828471c87d75abb4a3c44121186d7756`.
The accepted parent report and reviewed checkout match this pre-prompt identity:

```text
121aaf324b9b9945e785e9aaf0bdc0e07a0f68895b703007e22cda5b1dba5e42
```

This describes the checkout before this prompt edit. Recompute final identity
including tracked, untracked and binary bytes after corrections. Do not reset,
discard or restart the existing work.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Correct the remaining Medium defect: supported dashed square-cap borders paint
outside the geometry used for point bounds, selection extent and picking.
Include relevant dash/cap settings in committed-layout matching. Preserve the
completed solid-join fixes and intentional selection through dash gaps.
Separately investigate the retained lifecycle-test timeout below without
weakening its assertions. Keep strict TypeScript, bounded geometry, existing
dependencies and 32A behavior; keep 32C/32D deferred.

## Accepted parent evidence and failed reviewer test

Matching parent verification passed all five commands, including both browser
commands:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-wPPGzN/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-wPPGzN/05-check-free-labels/artifacts/free-labels-evidence.json
/private/tmp/stz-32b-review-H8bkE3/checks.json
```

The review accepts 16 cumulative groups, 28 point scenarios and 386 required
artifacts with no page errors, on the unchanged tracked/untracked identity.
Actual observations, downloads, standalone reopening and PGF evidence were
inspected. This is accepted native evidence for the pre-fix tree.

Keep the independent reviewer results distinct:

| Reviewer check | Actual result |
| --- | --- |
| Full `npm test` | 3,987 total: 3,986 passed, 1 failed; zero skipped/cancelled |
| Focused lifecycle rerun | 11/11 passed; does not replace the failed full run |
| Build / diff | Passed on Node v26.9.0; existing bundle-size warning |
| Strict production/fixture/new-test TypeScript | Passed |
| Latest changed-code ESLint / script syntax | Passed / all 60 scripts passed |
| Broader focused lint | 40 baseline errors and 4 warnings, independently matched |

Repository-wide lint was not run. The independent review returned
`needs_changes`, with zero Critical, one Medium and zero Low findings and
`ready_to_commit: false`. The production geometry finding and failed full test
must both be addressed. Do not label native acceptance missing, or treat the
parent pass or isolated rerun as an explanation of the reviewer timeout.

## 1. Confirmed dashed-cap geometry defect

Inspect and preserve:

```text
/private/tmp/stz-32b-review-H8bkE3/triangle-dash-repro.json
/private/tmp/stz-32b-review-H8bkE3/dash-repro.json
```

The exact triangle is empty, size `3`, fill disabled, with an enabled solid-color
`30pt` border using `lineStyle: 'dashed'`, `dashPhase: 0`, `lineCap: 'rect'` and
`lineJoin: 'bevel'`. Rendering emits width `36`, dash array approximately
`[3.6, 3.6]`, cap `square`, join `bevel` and miter limit `10`, all in local SVG
units. Probe coordinates are relative to the projected point center.

Independent raster observations show:

| Observation | Actual paint | Current layout / picking |
| --- | --- | --- |
| Local `(0, -24)` | Fully painted, alpha 255 | Rejected |
| Local `(-6, -28)` | Fully painted, alpha 255 | Rejected |
| Minimum Y | Approximately `-29.65625` | `-15.4544155877` |
| Maximum radius | Approximately `30.3804328989` | `21.0133538218` |

Selection decoration therefore under-encloses visible paint, and overlap
cycling can omit the clicked point. Retain independent exterior negative
controls as well as these painted positive probes.

The completed solid geometry is correct for its intended input:
`svgPointNodeLayout.ts` calls `createPolygonStrokeRegion(vertices, width, join)`
and uses `radius + width / 2` for circles. However, `svgPointPaint.ts` also emits
effective dash arrays, phase and caps. Square caps at dash endpoints can extend
beyond that solid-stroke region. Both polygons and circles need the missing
extent, not just the supplied triangle.

`currentSvgPointNodeLayout()` currently matches owner/source/font/shape/size,
width and join, but omits line style, pattern, phase and cap. Once these settings
affect layout, accepting old committed geometry after their change is unsafe.

### Required targeted correction

1. Share effective stroke settings between rendering and geometry: named-style
   defaults, explicit-pattern precedence, phase, caps and joins, with the existing
   `TeX pt * 1.2` conversion. Use the actual emitted pattern semantics rather
   than a second inconsistent interpretation of raw style fields.
2. Include actual dash endpoint caps for polygons and circles. Account for
   tangent orientation on circles, dash continuity across polygon corners,
   closed-path seams and overlapping wide caps. Do not add a cap at a join
   crossed by one uninterrupted dash. Keep miter-limit and solid-join behavior.
3. Correct painted bounds, selection extent/radius, applicable clearance bounds
   and picking together. Painted extent and interaction geometry may differ:
   preserve the original contour interior and continuous stroke neighborhood
   used to select through dash gaps, while including real cap extensions.
   Do not replace that established policy with paint-only gap rejection.
4. Preserve the existing six-local-unit tolerance. A blanket radius/box padding
   is not an exact hit oracle and must not restore the old solid miter/bevel
   false positives. Solid bevel `(0,-24)` must still miss, while the reported
   dashed square-cap variant at that coordinate must hit. Preserve the fixed
   solid miter `(0,28)` miss and genuine outward miter-tip hits.
5. Match committed layouts against every effective style setting that can alter
   the new geometry. Compare pattern contents, not only array/object identity,
   and retain the current owner/source/font guards. Reject stale commits after
   relevant edits and accept the matching refreshed layout. Keep pending,
   committed and immutable export reconstruction consistent.
6. Keep computation finite and bounded for supported zero-length entries,
   positive-total patterns, short intervals, large/wrapped phases and wide
   borders. Avoid non-advancing loops and unbounded tessellation. Preserve the
   supported pattern/width range and explain any bounded approximation with
   independent error checks; do not silently drop caps or valid patterns.

Preserve the existing opacity/disabled-stroke, hollow-interior, layer/visibility,
locking, candidate-order and ordinary/Alt-cycling contracts. Keep geometric
responsive scaling and the existing local tolerance; convert screen probes
through actual transforms. Do not switch caps/joins, shrink border widths,
increase tolerance, change source text or force selection to hide the mismatch.

### Registered geometry and native regressions

Add focused registered tests covering:

- The exact triangle, both painted positive probes, independent bounds/radius
  observations and meaningful exterior negatives beyond the interaction region.
- Square-cap circle borders extending beyond `radius + halfWidth`, with butt
  and round caps as controls. Include thin/wide strokes and relevant polygon
  corners/concave shapes without regressing the solid-join suite.
- Named dashed/dotted/densely-dotted styles, explicit-pattern precedence,
  nonzero/wrapped phases, cap endpoints near corners/seams and overlapping
  caps. Keep valid zero-entry and other bounded-input controls.
- Intentional dash-gap selection, original contour interiors, disabled stroke
  and established zero-alpha behavior. Distinguish gaps from exterior misses.
- Stale committed layouts after changes to line style, pattern contents, phase
  or cap; correct refreshed layouts; pending/committed equivalence and immutable
  captured output after live edits. Keep responsive coordinate mapping covered.

Use independent SVG rasterization/native paint observations for polygon and
circle bounds, cap-positive probes and exterior negatives. Retain source SVGs,
settings, raster resolution/error limits, transforms and observations. Do not
use the corrected helper as its own oracle or simply loosen expected bounds.
Preserve original failed evidence and put corrected results separately.

Add mandatory native ordinary-click and Alt overlap-cycling regressions. The
visibly clicked node must be present in candidates and reachable through cycling;
an overlapping control must not conceal its omission. Clear prior selection,
exclude handles/overlays, use real pointer actions and retain candidate/selection
records and screenshots. Exercise actual style edits so stale dash/cap layouts
cannot pass unnoticed. Integrate the checks into cumulative acceptance with
appropriate policy/negative controls, preserving the current 16 groups,
28 scenarios and 386 artifacts while adding new required coverage.

## 2. Investigate the retained lifecycle-test timeout

Preserve these distinct results:

```text
/private/tmp/stz-32b-review-H8bkE3/npm-test.log
/private/tmp/stz-32b-review-H8bkE3/owned-app-page-rerun.log
/private/tmp/stz-32b-review-H8bkE3/checks.json
```

The full suite failed the unchanged test
`bounded failing capture and screenshot retain primary, own late rejections and permit cleanup`
at `tests/scripts/ownedAppPage.test.mjs:118` with:

```text
Timed out after 15ms during owned App lifecycle evidence
```

The test passes `timeoutMs: 15` through `setup()`. That budget covers real
lifecycle file persistence as well as diagnostic capture/disposal; intentionally
hanging browser mocks are installed only after setup. The retained timer stack
from `pointCheckDiagnostics.mjs` does not establish which lifecycle save phase
timed out. Filesystem scheduling, setup and disposal are hypotheses, not a
confirmed root cause. The focused 11/11 pass does not explain the full-run failure.

Read the test, `scripts/ownedAppPage.mjs` and bounded diagnostic helper. Identify
the failed operation/phase and collect actionable timing/evidence under focused
and ordinary full-suite conditions. Keep this investigation separate from the
dashed-cap production defect. If evidence justifies test hardening, separate
controlled timeout checks from incidental real-I/O timing, or use a narrow
deterministic scheduling seam. Preserve finite production bounds and the
assertions for primary-error retention, both capture timeouts, ownership of late
rejections, retained JSON/lifecycle evidence, close events and cleanup/isolation.

Do not blanket-increase deadlines, remove the timeout case, weaken artifact
assertions, change global concurrency or retry until green. Keep successful
reruns alongside the failure and state any unproven trigger explicitly. Require
fresh whole-suite success on the final tree; a focused rerun alone is insufficient.

## Preserve completed work and verify the final tree

Keep `src/geometry/polygonStroke.ts`, its solid-join regression/independent
fixtures, and mandatory `point-paint-polygon-joins` coverage. Preserve the
corrected convex/concave joins, miter-limit fallback, thick overlap behavior,
six-unit allowance and original contour selection. The dash-cap correction
must extend this work, not reinstate the earlier rounded polygon expansion.

Keep all importer certainty, recorded local override, raw source/persistence
and independent PGF work unchanged unless a demonstrated dependency requires
otherwise. Preserve independent paint/opacity/dimming, cloning/clipboard/history,
raw JSON/CRLF, 2D/3D semantics, immutable whole-node export and free/inline labels.
Keep App ownership/geometry diagnostics and five native geometry fault controls,
seven App → SVG → App transitions, three continuity controls and 13 artifacts,
the directory scenario and 11 artifacts, and six responsive downloads with
91 artifacts. Preserve fresh-process verification, the runner's 60-second
fixture deadline, owned-process cleanup and failed-evidence retention.

Read `AGENTS.md`, paired 32B implement/review prompts, current implementation
report and relevant rendering/geometry documentation. Document effective dash/
cap geometry, intended gap selection, revision matching, independent results and
the actual lifecycle investigation. Keep changes focused on these requested
corrections and necessary tests/documentation; defer 32C/32D.

Run focused registered regressions, applicable strict production/fixture/test
TypeScript, changed-script syntax, targeted lint and `git diff --check`.
Run `npm test` and `npm run build` sequentially because they share asset
preparation. Separate baseline lint debt and the bundle warning from new failures.

The wPPGzN parent evidence verifies the pre-fix tree; it cannot verify subsequent
changes or erase the failed reviewer run. Finalize code/tests/tracked docs before
final verification and record identities/report paths in an external handoff:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands and current cumulative native evidence, including new
dash-cap checks, on the same tracked/untracked/binary identity. Preserve failures.
Any checkout edit after verification requires matching verification again.
Obtain independent read-only review of that verified tree against
`prompts/phase-32b-review.md`, reassessing the cap geometry, layout matching and
lifecycle-test result. `32B verify` itself does not perform review.

Do not commit or push while the finding, full verification or review remains
unsuccessful. 32B stays incomplete until these gates pass; 32C/32D remain deferred.
