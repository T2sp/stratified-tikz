# Phase 32D Fix for singular-cylinder diagnostics and deterministic timeout tests

## Objective and scope

The current strict parent verification passed on its exact checkout. Independent
read-only completion review returned needs_changes with zero Critical and two
Medium issues. Fix both before another completion review:

1. Diagnose cylinder layouts whose effective transverse radius is zero instead
   of substituting a finite result for PGF's undefined division.
2. Make the required writer-timeout regression control only its intended gated
   writer boundary, keeping normal I/O/measurement/cleanup and production limits.

Limit production changes to the evidenced cylinder singular-domain branch and
small testable helpers/deadline seams needed for these fixes.
Retain valid degenerate shapes, authored options/units/source/model coordinates,
existing unsupported-layout diagnostics, saved version2, native input/capture,
association, empty-body gate and lossless publication.
No unrelated geometry, renderer, exporter, dependency or test-concurrency rewrite.
Permit the narrow parent artifact integration required by the new diagnosed case.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md` and
`docs/PHASE_32_PLAN.md`. Inspect the independent evidence and exact test race.
Maintain verification-before-review/commit and post-review matching-tree guard.
The passed parent does not override needs_changes. Phase32 remains incomplete.

## Latest accepted verification, review and identity

Newest independent review is the user's supplied read-only review:
needs_changes, Critical0, Medium2, Low0, ready_to_commit:false.
Reviewer full-suite log: `/private/tmp/stz-32d-review-npm-test.log`.
Independent cylinder reproduction: `/private/tmp/stz-review-cylinder-zero-IrjltG/`,
including fixed-box input/raw/compiler log, production layout/SVG and actual
generated/wrapped TikZ compilation.

Matching passed parent:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-HoyCdl/verification.json`.
Its `05-check-free-labels/artifacts/` contains accepted browser report,
authenticated packs/pointers and native/live/association/SVG/PNG/TikZ evidence.
Resolve pointers with `readEvidenceDocumentSync` and that exact checkout.
Implemented empty-body handoff:
`/private/tmp/stz-32d-empty-body-20261012/HANDOFF.json`.
Its child startup failure is historical; HoyCdl is the canonical passed parent.
Do not use old HMy8AM/Zm4oWG review records as this review's identity.

Branch: `phase/32d-margin-minsize-anchor`.
HEAD: `470866616c46216c4459f3b7ff84b8cd3efbb981`.
Pre-prompt tree matches parent before/after:

~~~text
4da475401c30e0562982de816fc85ad81381876a3a525bef16dfb18b8f3c718f
~~~

Tracked-diff SHA256:
`b2236ce19ad5d220316755b7072af63fc6d49b1a34cd16f97887a75619b573cb`.
Preserve seven modified tracked files: both Phase32 documents;
`scripts/automation/phase-verification.mjs`,
`scripts/signedPointStandaloneAssociation.mjs`,
`tests/scripts/phase32dVerification.test.mjs`,
`tests/scripts/runPhaseRunner.test.mjs` and
`tests/scripts/runPhaseVerification.test.mjs`.
Preserve three untracked shared fixtures:
`tests/scripts/phase32abParentEvidenceFixture.mjs` —
`e968fbf236d6ed81c701fce466e8b3a7531e35f87a1baa2ce4ccc284bb6f125f`;
`tests/scripts/phase32dParentEvidenceFixture.mjs` —
`4c5edd06875f96e414b8d31a6de877f06ca5fb9f09844c2d4bc4d1155fd7d263`;
`tests/scripts/signedPointStandaloneFixture.mjs` —
`b08c0196cb1133d3c4e4c5fb2ad6f3055d52e97c278915ef263314cecca0c795`.
Keep earlier references/publication/capture/native work in HEAD.
The prompt changes identity; capture actual current tracked/untracked bytes for
future acceptance rather than reusing a historical fingerprint.

| Evidence | Actual result |
| --- | --- |
| HoyCdl parent | All five required checks passed, including6,975 tests, build/diff/label-assets/free-labels. Exact checkout before/after matches. |
| Resolved browser report | passed/complete;18/18 groups, all nine32D scenarios,202 records/4,547 diagnostics, no page errors/incomplete/unexecuted groups. Empty-body dispatch and downstream authenticated targeted/file/pixel/reference replay passed. |
| Reviewer full suite | 6,974 passed,1 failed, total6,975, exit1, zero skips. Failure is the timeout regression's earlier PNG-file read deadline, not native acceptance. |
| Other reviewer checks | Focused runtime/model/export79/79 and isolated timeout1/1 passed. Build, strict TypeScript, diff/syntax passed; focused lint had no new findings. Unchanged _role reproduced against HEAD; repo-wide lint not rerun. |
| Review decision | Cylinder conformance and timing-dependent regression remain. needs_changes blocks completion/commit despite parent acceptance. Review read-only; no commit followed it. |

Preserve complete native/download/standalone evidence as historical acceptance.
Fresh verification of the changed tree remains mandatory.
Earlier startup, root-only, association-order, publication and empty-body-gate
blockers are resolved; do not repeat them as current fixes.

## Cylinder zero-divisor diagnosis

Reproduction: empty cylinder with Inner sep=0pt and Minimum size=0pt.
Retained `production-layout.json` reports limitation:null and requested path
`M 0 0 L 0 0 L 0 0 L 0.24 0 L 0.24 0 L 0.24 0 Z`.
Live/settled preview paints invented tiny geometry without a warning.
Independent PGF3.1.11a fixed-box and document-wrapped actual generated TikZ fail:

~~~text
PGF Math Error: You've asked me to divide 0.0 by 0.0
~~~

Use `fixed-box.tex`, `geometry.txt`, `compilation.txt`,
`actual-generated.tex`, `actual-generated-wrapped.tex` and
`actual-generated-wrapped-compilation.txt` in the reproduction directory.
Fixed-box raw stops at CASE/FONT before paint/anchors.
The wrapperless compilation's Undefined control sequence is a separate document
context failure and is not the cylinder-domain evidence.

At `src/geometry/pointNodeShapes/solve.ts:330–338`, cylinder fits rotation/incircle
axes then sets `rx = aspect * y`, `ry = max(y, minimumWidth / 2)`.
Line337 substitutes sineAngle0 for `ry === 0`. Upstream divides by that effective
transverse radius before asin and later axial-minimum work.
The narrow singular condition is computed `ry === 0`, including signed zero,
after fitting/rotation/incircle/minimumWidth.
Do not predicate solely on empty text, input-y0 or a general zero-axis condition.

Use the existing RangeError/geometry.limitation route before constructing
requested cylinder contours/seam/regions. Keep the existing asin-domain error.
Do not substitute zero/epsilon, invent another shape, clamp minima or reject
the valid authored model. MinimumHeight, outerSep and line width cannot cure
this division because they operate elsewhere/afterward.

Preserve `rx === 0` with `ry > 0` where independently valid, supported negative
nonzero radii, positive-minimumWidth controls, rotation90/270 axis exchange and
incircle fitting. Do not suppress valid ellipse/basic zero-axis shapes or
corrected partial/reversed/signed traversal.

Use shared `svgPointNodeGeometry` RangeError handling to show the existing
warning in live/pending/settled SVG. Keep upright body/source placement.
No requested cylinder contour, seam, custom body/end region or internal border
may leak into rendering/export/picking. Requested painted bounds remain empty;
selection/picking follow visible body, if any, and warning with current tolerance/
visibility/lock/filter guards. No hidden requested-shape hit region or oversized
selection bounds.

Preserve raw layout/units/context/provenance, saved/history reload, coordinates
and both TikZ modes' authored cylinder intent. Do not rewrite shape/minima to
make TeX compile or claim compilation success for intentional unsupported input.

## Independent cylinder evidence and regressions

Add an authenticated independent PGF expected-failure bundle:
complete TeX input, actual generated source/correct wrapper, engine/PGF3.1.11a/
upstream hashes, command/no-shell-escape flags, nonzero exit, compiler log and
partial raw observations. Keep original172 boxes/4,925 anchors/11 failure
references byte-for-byte; register additions separately.
Do not derive oracle expectations from production or regenerate old fixtures.

Use compact PGF-confirmed cases for effective-ry0: empty zero spacing/minima,
axial extent without transverse radius, rotation/incircle and minimumHeight/
outerSep/line-width non-rescue. Include positive minimumWidth rescue, valid
`rx0/ry>0` and basic/ellipse zero-axis neighbors.
Authenticate nonempty-body cancellation/signed branches before new assertions.
Retain old negative-separation/asin and valid-cylinder references.

Add geometry/model/TikZ and shared live/settled regressions in both ambient
dimensions: diagnostic, contour/seam/region suppression including custom fills,
visible body/warning picking and far miss, exact raw options/context/history/
JSON/coordinates/TikZ and valid→singular→valid owner/request transitions.
Add narrow mandatory actual native singular-cylinder coverage to the existing
cumulative32D workflow in2D/3D, without dropping any predecessor/named scenario.
Observe current warning/model/source/owner/request/revision, trusted warning
picking/far-clear and warning-only downloaded/reopened SVG.
Use normal load/Inspector/native controls, no DEV geometry/selection mutation.
Keep raw TikZ intent, file/background/capture contracts and before-assert raw
evidence; register new raw/count/dependency requirements honestly.

Register the new empty-cylinder warning-only SVG through a strict diagnostic
artifact context in parent replay. The legacy envelope requires body glyph paint;
the existing seven-owner signed-point allowance does not apply to this case.
Authenticate exact new case/file eligibility from current model/source/owner/
revision and raw diagnostic/click/capture records, then replay the actual warning,
complete empty body shell, placement and exact SVG/PNG bytes. Require absence of
requested cylinder contour/seam/custom regions, plus normal forbidden/external/
background checks. Add real parent-dispatch positives and damaged/missing warning,
wrong source/owner/file/context/ref negatives. Preserve legacy defaults and the
seven-owner route; no dummy glyph/contour or filename-only skip may grant acceptance.

## Deterministic intended writer deadline

Reviewer log `/private/tmp/stz-32d-review-npm-test.log` fails
`actual 2D final writer timeout owns late fulfillment after expanded toolbar cleanup`
at `phase32dVerification.test.mjs:1642/1650`. First actual Error is:

~~~text
Timed out after 20ms during Zero-axis live PNG file identity
~~~

The isolated rerun passes; that does not correct the full-suite race.
At lines1616–1617, `liveWorkflowPublication` sets workflow `timeoutMs:20`
for stalledFinal/stallBoundary. `captureZeroAxisLive` applies it to every bounded
operation, including normal PNG `readFile`, measurements and cleanup.
The deliberate manifest writer gate is later, so unrelated I/O may own primary
before entry. The publisher fixture's separate1,000ms deadline is not this
observed failure; keep its role explicit and avoid competing short deadlines.

Control only the selected writer/evidence boundary after its real `entered`
signal. Use a small scoped test deadline/scheduler seam if needed while retaining
the actual ordinary writer→publisher→retain→observe/report path.
Normal I/O/measurement/image/cleanup keep production-equivalent limits;
actual production defaults remain5,000ms.
No global timer mock or short whole-workflow override may drive this regression.

Start/fire the selected controlled timeout only after the stalled writer has
actually entered. Do not include pre-gate encoding, pack writes, PNG reads or
ordinary scheduling in that20ms test budget.
A boundary-name-only20ms wrapper around all retain preparation is insufficient
if it can expire before entry.
Own asynchronous rejection immediately, so unexpected earlier failure does not
hang awaiting `entered` or leak an unhandled rejection.
Keep exact primary Error identity and a genuine selected-boundary timeout.
Do not throw a fabricated writer Error or broaden the matcher to any timeout.

Preserve all eight final combinations (2D/3D × inherited expanded/collapsed ×
late fulfillment/rejection) and both pre-restoration stalled-writer cases.
For pre-restoration, prove failed publication cannot prevent native cleanup.
Add controlled ordinary PNG-I/O delay beyond the old20ms but within the normal
budget; intended writer must still be reached and become the first controlled
failure. Use gates/scoped deterministic scheduling rather than sleeps or
machine-speed assertions.

Keep one PNG/strict pixels before final failure, exact toolbar restoration,
state/history/source/owner/CTMs, resource cleanup and lossless
failed-after-restoration publication.
Late completion/rejection must not overwrite failed records, report/checkpoint
authority or primary Error. Replay exact failed artifact bytes and reject
success after timeout.
Preserve publisher generations/atomic pointers, lossless refs,5s production
limits and existing deadline/error ownership.

Retain legitimate earlier targeted stalled-report controls and normal heap/
concurrency. Do not lower concurrency, raise production deadlines, skip controls
or rerun until lucky. Run corrected gated controls under normal full-suite
settings; report first failures honestly and use targeted controlled contention
to demonstrate deterministic ordering.

## Preserve completed native/artifact/publication gates

Keep all67 empty-body gate,72 publication,61 correspondence,65 live-capture and
55 background controls and inherited predecessor tests.
Empty-body SVG acceptance remains scoped to authenticated downloads after
complete native/association/file-local SVG/PNG/TikZ replay.
Preserve legacy nonempty absent-ink rejection and full empty body/ink/content
shell, title forms, exact source/root/order/placement/paint checks.
Lossless publication keeps frozen observations, authentic refs/bytes/hashes/
identity, deterministic replay and late-authority protection.
Keep actual DOM order distinct from model/click order and zero-axis CTM bound
to its authenticated owner.

Keep original32C, signed-basic8 boxes/192 anchors,54 polygonal boxes/1,386 anchors,
12 arithmetic controls/four dart traces/one singular control,
eleven zero-axis paths/37 rendering records and490 additive files.
Add cylinder evidence separately.
Keep0.025pt anchor/0.03pt contour tolerances,0.005 precision/2048 limit,
shared placement, committed picking, coordinate dragging, diamond's authenticated
outer-separation exception and valid signed/degenerate shapes.
Keep both TikZ modes, codim convention and2D z=0/3D active-plane semantics.

## Preserve completed corrections and contracts

Retain signed rectangle/ellipse `signedFittedAxes` and exact anchors/placement,
magnitude-only radius density, oblique negative-ellipse picking and existing
both-dimension signedAnchorCases/signedPickingCases/raw policies.
Retain deterministic stalled-report injected ordinary-write recorder,20ms
deadline, exact primary Error/nativeChecks count, two stalled failure writes,
late rejection ownership and complete listener/page/browser/server cleanup.
The earlier stalled-report race was resolved; preserve that targeted control.
The current global20ms live-writer test race is separate and must be corrected
without weakening the earlier deterministic deadline/error checks.

Keep explicit resolved preview schema (six dimensions, anchor, effective font
context) separate from exact authored units/source/context.
Keep immutable-click-derived native source/anchor/`110` expectations for full
runtime/saved envelope/history present, faithful fixtures and parent corruption
controls. Do not restore raw layout spreads or globally strip metadata.

Keep real unique zoom numeric/associated slider/disclosure, one native1.4 fill,
ordered before/immediate/after observations, native input/change provenance,
connected circle/rectangle/cylinder root-relative matrices, measured both-axis
scale/fixed-origin proof and precise binary32 propagation.
Keep exact state/history/selection/revision/uiSettings/pan/held-source invariants,
owned cleanup, mandatory post-click artifact and terminal/standalone/raw-policy
binding. Root screenCTM equality and persisted2D camera omission remain valid.

Keep deterministic pre-load fifteen-point fixture/ids/order/sources/styles/layout/
parameters, selected circle(7,6.5,0), two free labels and unique export-path
curve/polyline with both exact inline nodes/content/options.
Keep fixed.23 native preparation, current hit stack/owner/request/held source,
one ordinary trusted gesture, selected owner proof, Inspector/UI restoration and
all missing/duplicate/wrong-content inline/preparation regressions.

Keep immutable pending sequence: hold → normal load → native selection →
actual background/armed snapshots → SVG click while held → post-click edit/view
or replacement load → intended release → actual download → original reload/
settled expectations/both TikZ modes → external reopening → complete-root PNG.
Keep all15 click-time entries, original source/layout/placement, pending/settled
contour distinction and release-boundary evidence. Cleanup release is not
acceptance. Preserve transparent/white content and background assertions.

Keep Clear/imported paint/shape/layout detachment and exact persistence/history;
native Select/Inspector/toolbar preparation/restoration; trusted handle/capture/
release movement, one history commit and exact Undo/Redo under the same valid
document revision; fresh JSON-load/reused-ID/cache/request isolation;
canonical layers, exact Hidden points controls, dim/hide/dim provenance,
camera theta90/phi0 and owner/filter/lock/occluder checks.
Keep ordinary unsupported body → far → warning, fixed diagnostic candidates,
six-unit clearance, bounded warnings, overflow bodies and native owner cycles.

Keep saved version2/additive layout, legacy Size/2, ordered spacing/shorthand/
per-axis em/ex contexts, text/baseline/depth, real preview/export projection,
raw free/attached/inline text and existing typography/TeX limitations.
The documented diamond outer-separation exception was authenticated and judged
correct by the preceding independent review; preserve it without applying
that exception to these signed-axis defects. No unrelated reference issue was found.

Keep both callers using unchanged `captureStandaloneSvg`, normal fonts,
bounded settling, one actual image/no retry, complete-root coverage, at most
one viewport expansion, stable coordinates and exact SVG/PNG file identity.
Keep pre-image reopening records, owned cleanup, primary errors and no extra
failure screenshot. Preserve actual PNG CRC/chunks/inflated scanline/dimensions/
byte validation, artifact inventories, raw-policy checks and runner copies.

## Fresh verification, review and handoff

Use strict TypeScript without `any`, small pure functions and separated model/
geometry/rendering/TikZ/UI. Add no dependency without explaining why.
Update Phase32 docs to both fixes, independent failure-reference inventory,
deterministic deadline scope and actual results.
Distinguish passed parent, reviewer full-suite failure and isolated pass.

Run focused cylinder PGF/domain/render/picking/model/TikZ controls, gated
final/pre-restoration writer tests and preserved native/publication/association/
empty-body/pending/standalone/runner checks.
Use Homebrew Node>=22.12.0 and normal project settings:

~~~bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
~~~

Run applicable focused strict TypeScript/lint and changed-script syntax.
Scoped inherited lint includes two geometric-caller no-unsafe-finally findings,
verifier _role and layers defaultCurveStyle.
The empty-body handoff also records older repo-wide baseline79 errors/7 warnings;
latest reviewer did not rerun it.
Keep failed baseline checks separate from passing changed-code checks.
Do not imply repository-wide lint passes or clean unrelated debt.

Run fresh browser-capable strict parent verification on actual changed bytes:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Require all18 cumulative groups: twelve31F including final standalone,
three32A and one each for32B/32C/32D; all nine existing32D scenarios plus
mandatory singular-cylinder evidence, both native/live/standalone dimensions,
twelve polygonal cases, both pending workflows/PNG/TikZ, complete parent artifact/
targeted/ref replay and no page errors.
Do not reuse HoyCdl after edits or substitute isolated/synthetic results.
Failed full-suite/incomplete native checks stop before review/commit.

Preserve clean-tree rules; do not reset/stash/discard/commit unfinished work
to bypass them.
If child startup hits EPERM, retain failure/exact tree and obtain approved
browser-capable parent execution without weakening required coverage.

After required checks pass, obtain fresh independent read-only completion review
using `prompts/phase-32d-review.md` on exact matching tracked/untracked bytes.
Inspect resolved reports/artifacts and require BOTH findings resolved:
authenticated cylinder diagnostic/raw intent, valid neighbors, deterministic
full-suite success, complete native/artifact acceptance and preserved old gates.
Keep post-review identity guard.
needs_changes blocks completion/commit even when parent verification passes.

Report both scoped fixes, additive independent references, meaningful regressions,
changed files, focused/full checks, baseline failures, exact tree/report identity
and fresh independent review result.
Keep Phase32 incomplete until every gate passes.
Leave commit/push to the parent after verification and review.
