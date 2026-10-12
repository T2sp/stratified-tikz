# Phase 32D Fix for authenticated empty-body SVG artifact validation

## Objective and scope

Continue from implemented geometry, native/live capture, standalone correspondence
and bounded lossless publication. The newest browser subprocess completes all18
groups/all nine32D scenarios with exit0, but the strict parent's generic SVG
artifact gate rejects the valid new empty-source standalone file.

Correct this narrowly scoped parent artifact classification/validation mismatch.
Authenticate intentional empty point bodies through the existing strict
source/association/file-local replay, preserving complete native body structure
without requiring nonexistent glyph paint.
Keep legacy nonempty-body checks and every downstream native/file/PNG/TikZ gate.

Limit changes to the evidenced parent SVG gate/dispatch, necessary small
structural helpers, faithful gate/runner fixtures, isolated runner copies and
Phase32 status docs. Preserve production/reference bytes, sanitized SVG output,
empty raw text, geometry/camera/model/picking, complete-root/live capture,
association and lossless-publication semantics.
Do not add fake text/paths to the body or change fixtures/exports to satisfy
the old painted-body assumption.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md` and
`docs/PHASE_32_PLAN.md`. Inspect exact downloaded files and resolve authenticated
evidence before interpreting the outer gate failure.
Maintain verification-before-review/commit and post-review matching-tree guard.
Phase32 remains incomplete until the full strict parent and review pass.

## Latest handoff, parent result and identity

Newest user attachment:
`/Users/takamatoshinori/.codex/attachments/9a1b7f2f-b8bd-4ce2-b2ce-e64cb00ba7c6/Pasted text.txt`.
Implemented publication handoff:
`/private/tmp/stz-32d-lossless-publication-20261012/HANDOFF.json`.
Child strict report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-manual-HfVaWU/verification.json`.
Keep72 new publication/capture/runner controls, lossless replay measurements,
preservation audits and exact file inventory.

Newest parent verifier:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-ZFGC6y/response.json`.
Strict report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-zyBzG8/verification.json`.
Artifacts are under its `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json` is a `stz-evidence-document-v1` pointer.
  Resolve with `readEvidenceDocumentSync` from `scripts/evidencePublication.mjs`
  using the exact checkout; do not inspect pointer keys as a browser report.
- `point-layout-signed-polygonal-zero-axis.json` and both dimensions'
  `...-{2,3}d-native.json`, `...-live-capture.json` and `...-live.png`.
- Both `point-layout-signed-polygonal-zero-axis-{2,3}d.svg`,
  `...-{2,3}d.png`, saved JSON, standalone raw records and both TikZ modes.
- Both pending transparent/white workflows and final cumulative standalone
  artifacts, plus publication index/packs/boundaries and owned server/browser logs.

Branch: `phase/32d-margin-minsize-anchor`.
HEAD: `ef06105a0d1659cc2e9e34abfabaedb157fdb6cd`.
Pre-prompt tree matches parent before/after identity:

~~~text
a9e886bad0f6961dec0b1ae00321c388ece2f1f7993f9a9c6bfd93e763f271df
~~~

Tracked-diff SHA256:
`65c16bf723890624da041eb5428f7c3047faaffba5b5afe5efb6c89651850b04`.
Preserve thirteen modified tracked files: both Phase32 docs; `package.json`;
`scripts/automation/phase-verification.mjs`, `scripts/checkFreeLabels.mjs`,
`scripts/checkPointLayoutAnchors.mjs`, `scripts/ownedAppPage.mjs`,
`scripts/pointCheckDiagnostics.mjs`, `scripts/pointLayoutAnchorsContract.mjs`,
`scripts/zeroAxisLiveCaptureWorkflow.mjs`,
`tests/scripts/phase32dVerification.test.mjs`,
`tests/scripts/runPhaseRunner.test.mjs` and
`tests/scripts/runPhaseVerification.test.mjs`.
Preserve two untracked files and hashes:
`scripts/evidencePublication.mjs` —
`8323706563e62bc99f45723d1ef26af3dc4362f5488960627936c3894224ebad`;
`tests/scripts/evidencePublication.test.mjs` —
`8b402bd2b5973b278da5242b76b3665a66d7972a545afa414a248155f56199f9`.
Keep all earlier production/reference/association/capture files in HEAD.
The prompt changes identity: capture actual current tracked/untracked bytes
for future acceptance rather than reuse this historical fingerprint.

| Retained evidence | Actual result |
| --- | --- |
| Implementation child | 6,908/6,908 tests passed, zero failures/skips;72 new controls. Build/diff, strict TypeScript, changed-file lint/syntax passed. Four inherited lint errors remain. Child browser startup stopped at localhost EPERM before Chrome. |
| Frozen-tree offline replay | Final live/native/report boundary232.86ms and215,233 additional bytes; unchanged repeat21.19ms and12,044 bytes.5,000ms deadline preserved. These are offline replay measurements, not native acceptance. |
| zyBzG8 browser subprocess | Exit0, resolved report passed/complete;18/18 groups started/completed, all nine32D scenarios terminal-pass,202 evidence records/4,547 diagnostics, no incomplete/unexecuted groups or page errors. Node26.9.0, Chrome154.0.8037.98. |
| Executed browser coverage | Twelve polygonal placements, both zero-axis native/live lifecycles, both seven-node standalone SVG/PNG/reopening/TikZ, both pending transparent/white workflows and final standalone completed. |
| Strict parent disposition | check:free-labels failed during evidence validation at first2D new SVG. Parent targeted replay for the new scenario and later policy checks were not reached. No independent completion review, commit or push. |

Do not carry tBkjSj's final-publication timeout, BjrAYN's index mismatch or
older unexecuted native coverage forward as current blockers.
Lossless publication now enabled a complete browser run, but browser exit0/
all-group success alone cannot bypass the failing strict artifact gate.
Fresh parent acceptance and completion review remain required.

## Exact failed predicate and valid empty body

Parent error:

~~~text
check:free-labels evidence is incomplete or invalid:
Invalid whole-point SVG artifact: point-layout-signed-polygonal-zero-axis-2d.svg
~~~

At `scripts/automation/phase-verification.mjs:877–878`, each non-mechanism SVG
is sent to `hasWholePointSvg`.
That helper's `wholePoint` at lines795–800 requires a sibling shape contour
and titled body group AND `hasPaint(body)`.
`hasPaint` looks for descendant `text/path/rect/use` elements.

Both new artifacts are valid empty-source point-only SVGs:
2D4,301 bytes,3D4,495 bytes; each has one SVG root,36 groups,7 sibling contour
paths and7 empty titles, with no runtime data attributes.
Every expected/model/click source is exactly `''`.
The body has the actual native body/ink/content shell, for example:

~~~xml
<g transform="...">
  <title/>
  <g transform="translate(0 0)" opacity="1" fill="#203040"
     color="#203040" pointer-events="none"><g/></g>
</g>
~~~

Its contour is a sibling path in the point node, not glyph paint within that
body. No text/path/rect/use inside the empty body is correct.
The helper already parses `<title/>`; self-closing-tag parsing is not the failure.
The balanced root/body/contour tree exists, but `hasPaint(body)` is false.

`src/rendering/svgLabelView.ts` constructs title(source) and the
ink/content groups even when content is empty. Confirm the actual source path
if needed; preserve this emitted shell and raw source convention.
The existing `signedPointStandaloneAssociation` file-local validation already
authenticates all seven owners, exact body shell, contour/body/outer placement,
source-proven document order, root/CTMs and sanitized file bytes.
Actual standalone PNGs/strict pixel records are retained for both dimensions.

The generic envelope rejects before
`validateTargetedPaintEvidence → assertSignedPolygonalStandaloneEvidence`,
so that stronger parent validation has not yet accepted this scenario.
Do not equate browser-local success or direct helper tests with full parent
dispatch success, and do not treat the correct absence of glyphs as missing
point geometry.

## Scoped contextual artifact-gate fix

Inspect `hasWholePointSvg`, the scenario/artifact loop and targeted dispatch in
`scripts/automation/phase-verification.mjs`,
`scripts/pointLayoutAnchorsContract.mjs` and
`scripts/signedPointStandaloneAssociation.mjs`.

Keep legacy `hasWholePointSvg` defaults and existing nonempty-title/no-ink
rejections. Add an explicit supported empty-body validation route for the exact
`point-layout-signed-polygonal-zero-axis` scenario in `layoutAnchorGroup` and
its exact2D/3D standalone SVG artifact names.
Authenticate eligibility from the current resolved scenario, immutable saved/
model/click/source/owner/revision records and the expected seven empty points,
not filename, title emptiness, a copied flag or report success alone.
Unknown/wrong scenario, foreign artifact or damaged nonempty body must not
inherit an empty-body allowance.

Dispatch these genuine empty-source artifacts into the existing strong
association/file-local/standalone replay, or a small contextual envelope helper
whose acceptance is inseparable from that mandatory replay.
Keep exact required artifacts, current checkout, balanced single root,
sibling contour + complete titled native body/ink/content shell, all seven
owners/paths/titles/placements and expected canonical DOM order.
Accept both `<title/>` and equivalent `<title></title>` with actually empty
source; reject missing title, missing content shell, malformed/nested wrong
structure and nonempty title lacking required body paint.
Do not globally remove `hasPaint` or accept a naked `<g><title/></g>`.

The dedicated route must still execute all
`assertSignedPolygonalStandaloneEvidence`/
`assertSignedPointStandaloneAssociation` and lossless raw-file replay checks,
including paint/contour/body/outer transforms, unique authenticated association,
owner-bound reopened zero-axis CTM, complete actual SVG/PNG/TikZ bytes,
current saved/click/native/live evidence and forbidden/external/background
checks. Preserve exact assertions/tolerances.
If checks are deferred within a scenario loop, it cannot count as accepted until
the mandatory strict route has completed; do not implement a filename-only skip.

Keep balanced element parsing/comments/closing-tag rejection and legacy SVG
mechanism/input classification intact.
No extra producer glyph, fake source/ID/title, altered sanitizer, post-download
SVG edit, geometry change or capture retry may make a valid empty body pass.
Add no new dependency or unrelated generalized XML/export rewrite.

Retain authenticated document pointers/packs and use
`readEvidenceDocumentSync` with checkout for all raw reads.
Do not reintroduce direct JSON parsing of pointer files or discard lossless
publication authenticity to reach the targeted assertion.
Preserve failed/terminal owner semantics, small immutable publication and
strictly resolved exact state/history/observations.

## Faithful gate and runner regressions

Current `tests/scripts/runPhaseVerification.test.mjs` whole-point gate tests
cover nonempty painted bodies and deliberately reject nonempty absent ink.
Its artifact fallback near lines106–110 manufactures a nonempty title/text SVG.
The existing “complete evidence” tests near936–942 do not traverse a complete
valid32D artifact loop; faithful empty seven-point fixtures in the32D policy
suite invoke targeted helpers directly.
That integration gap hid this outer-gate mismatch.

Add faithful2D/3D empty-source positives through the REAL parent dispatch/
complete artifact loop, with intact7-node SVG structure, resolved immutable
scenario/native/live/click/saved/association records, actual complete PNGs and
both TikZ modes.
Keep expected/model order and actual DOM order distinct and preserve real blank
titles. Do not substitute a nonempty generic fallback or mock the strong
validator away.
Use compact shared fixtures to avoid redundant heavyweight allocation.

Verify valid self-closing and explicitly closed empty titles with the full
native shell. Keep legacy nonempty painted body positives and every existing
absent-ink/contour/malformed negative.
Add compact contextual failures for missing/wrong scenario or artifact binding,
nonempty/wrong source, missing/duplicate/foreign owner/title/body/ink/content/
contour, extra/reordered/wrongly owned nodes, broken root/namespace/XML,
changed paint/placement/CTM and blank/short/mismatched PNG.
Add missing/corrupt/stale publication refs, wrong file/hash/current checkout,
wrong saved/click/native records and empty-body reuse in unrelated legacy
scenarios. Required targeted checks must actually be reached and reject them.
A helper returning true from title/filename alone must fail these controls.

Preserve all72 publication,61 correspondence,65 live-capture and55 background
controls, deterministic stalled-writer/late-rejection/primary Error semantics,
normal heap/concurrency and earlier structural-sharing fixture corrections.
Keep completed native input, precise trusted capture-event retargeting,
full640-sample live capture, one PNG, exact inherited UI restoration/cleanup,
strict pixel oracle and unchanged complete-root capture helpers.
Retain source-proven correspondence, separate raw/derived identity, exact
file-local node structure and owner-bound standalone CTM.

Keep all18 cumulative groups/all nine32D scenarios mandatory, with no supported
case deferred. Fresh verification must include both seven-node transparent new
downloads, all twelve polygonal cases, both native/live lifecycles, both
fifteen-entry pending transparent/white workflows and final standalone.
Register new controls and necessary runner dependency copies.
Preserve historical evidence bytes and current authenticated references:
original172 boxes/4,925 anchors/11 failure controls; signed-basic8 boxes/
192 anchors;54 polygonal boxes/1,386 anchors;12 direct arithmetic controls;
four dart fitting traces; one singular boundary control;
eleven zero-axis PGF paths and37 independent rendering records.
Keep original32C and490 additive polygonal/zero-axis files,
0.025pt anchor/0.03pt contour tolerances,0.005 precision and2048 finite-work budget.
Keep signed fitting/clearance, narrow reciprocal math, ordered collapsed-axis/
partial/reversed/rotated traversal, zero-area fill and dash/cap/join/closure,
registered geometry/model/rendering/TikZ tests and both TikZ modes.
Retain2D z=0/3D active-work-plane conventions.

## Preserve completed corrections and contracts

Retain signed rectangle/ellipse `signedFittedAxes` and exact anchors/placement,
magnitude-only radius density, oblique negative-ellipse picking and existing
both-dimension signedAnchorCases/signedPickingCases/raw policies.
Retain deterministic stalled-report injected ordinary-write recorder,20ms
deadline, exact primary Error/nativeChecks count, two stalled failure writes,
late rejection ownership and complete listener/page/browser/server cleanup.
The earlier full6,425 test pass cleared that prior review failure; the latest
registered suite passes6,908 tests. Do not loosen this deterministic control.

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

Use strict TypeScript without `any`; preserve module separation, codim convention,
raw user text and model coordinates.
Update Phase32 docs to the exact empty-body parent-gate scope and current results,
distinguishing complete browser-local acceptance from failed outer strict policy.
Preserve offline replay/native measurement distinctions and evidence history.
Count overlapping focused sweeps honestly.

Use Homebrew Node>=22.12.0. Run focused real parent SVG-dispatch/faithful complete
32D runner/contextual empty-body/strict file/raw/ref replay checks, with preserved
publication, association, live/native, geometry/reference, pending, standalone
and deterministic stalled-report controls.
Run all required commands:

~~~bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
~~~

Run applicable focused strict TypeScript/lint and changed-script syntax checks.
Four inherited lint errors remain: two geometric-caller no-unsafe-finally errors,
verifier unused _role and layers unused defaultCurveStyle.
Report reproduced failed baseline checks separately from passing changed-file
checks. Avoid unrelated cleanup or claiming unperformed checks.

Use a fresh owned browser-capable parent/server, supported Playwright/Chrome
and actual current tracked/untracked tree without committing:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Require all18 groups: twelve31F including final standalone, three32A and one
each for32B paint/import,32C shapes/visibility/downloads and combined32D.
Require all nine32D scenarios and COMPLETE parent artifact/targeted replay,
all immutable refs resolved exactly, both new transparent SVG/PNG/TikZ records,
both pending workflows, native history/JSON persistence and no page errors.
Do not reuse zyBzG8's exit0 browser report to bypass fresh strict policy on the
changed tree or substitute a scoped/direct helper report.
Do not stop after merely clearing the generic envelope; inspect all subsequent
targeted/file/reference validation results and report any next concrete blocker.

Preserve clean-tree rules; do not reset/stash/discard/commit unfinished work
to bypass them.
If child startup encounters EPERM, retain failure/exact tree and pending parent
work without weakening acceptance. Obtain approved browser-capable execution
where available.

Only after full required verification passes, obtain independent read-only
completion review of the exact matching tracked/untracked tree using
`prompts/phase-32d-review.md` and inspect actual resolved reports/artifacts.
Require previous geometry findings resolved, faithful native/live/association/
empty-body/file proof, complete lossless publication, full-suite success and
complete strict cumulative acceptance. Keep post-review identity guard.
Failed/incomplete verification stops before review/commit; needs_changes blocks
completion/commit even when browser subprocess/tests pass.

Report the scoped parent-gate fix, meaningful integration controls, preserved
production/reference/capture/publication behavior, changed files, focused/full
checks, baseline failures, exact tree/report identity and completion-review result.
Keep Phase32 incomplete until every gate passes.
Leave commit/push to the parent after verification and review.
