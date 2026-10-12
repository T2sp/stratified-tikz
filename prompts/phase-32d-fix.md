# Phase 32D Fix for bounded lossless evidence publication

## Objective and scope

Continue from the implemented geometry, native input, live-capture lifecycle
and authenticated standalone DOM-to-model association.
The newest parent completes2D image inspection and UI/resource restoration,
then times out saving final live evidence under the existing5,000ms deadline.

Correct the scoped evidence persistence/publication path.
Keep every measured observation and strict acceptance check, while avoiding
repeated serialization/writing of unchanged large capture/native/cumulative
documents inside each bounded boundary.
Use immutable, replayable artifacts/references and owned ordered publication;
a timed-out writer must not later overwrite newer failed/terminal state.

Limit changes to evidence serialization/storage/publication, necessary caller/
reporter/parent-loader integration, meaningful persistence regressions, isolated
runner copies and Phase32 status documentation.
Preserve production/reference bytes, native UI/input behavior, full-stroke
measurements, one actual PNG, strict pixel oracle, complete-root standalone
capture helpers and authenticated association semantics.
Do not reopen geometry, selection, correspondence or toolbar preparation to
pass an evidence-write deadline.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md` and
`docs/PHASE_32_PLAN.md`. Inspect the exact retained artifacts and persistence
call chain before choosing the smallest lossless change.
Maintain cumulative strict verification, verification-before-review/commit and
the post-review matching-tree guard. Phase32 remains incomplete.

## Latest handoff, parent failure and identity

Implemented correspondence handoff:
`/private/tmp/stz-32d-standalone-correspondence-20261012/HANDOFF.json`.
Keep its61 new controls, file-local replay/placement proof, preservation audits
and current association module. Child strict report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-manual-ipYoJ9/verification.json`.

Newest parent verifier:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-hdS5Co/response.json`.
Strict report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-tBkjSj/verification.json`.
Current artifacts are under its `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json` and ordered diagnostics.
- `point-layout-signed-polygonal-zero-axis-2d-live-capture.json`,
  `...-2d-native.json` and `...-2d-live.png`.
- `point-layout-failure.json` and `point-layout-app-failure.json`,
  containing the outer timeout and owned live-capture failure observations.

Branch: `phase/32d-margin-minsize-anchor`.
HEAD: `ff72e61c43ebc2da3f09513b023e89543719aa3c`.
Pre-prompt tree matches the parent's before/after checkout:

~~~text
71e315fcd7f14234def03fa404d6dc19d080089266049bfbc23e38fe9d32fcbe
~~~

Tracked-diff SHA256:
`5c118e4e291911c57b8ecfe06d64cae2248243e54342e438f4abc500ba755944`.
Preserve six modified tracked files: both Phase32 documents;
`scripts/checkPointLayoutAnchors.mjs`, `scripts/pointLayoutAnchorsContract.mjs`,
`tests/scripts/phase32dVerification.test.mjs` and
`tests/scripts/runPhaseRunner.test.mjs`.
Preserve the untracked `scripts/signedPointStandaloneAssociation.mjs`:
SHA256 `509f70fb773714ef88306da199dfcef5ba67e4e80a49fcab858bc55ef142d5cd`.
The earlier two live-capture modules and494 reference/test files are now in HEAD.
Use exact handoff inventories/hashes and preserve prior work.
The prompt changes identity: capture actual current tracked/untracked bytes
rather than treating this fingerprint as future acceptance.

| Retained evidence | Actual result |
| --- | --- |
| Implementation child | 6,836/6,836 tests passed, zero failures/skips;61 new association controls. Build/diff, strict TypeScript, changed-script lint/syntax passed. Four inherited lint errors remain. Browser startup stopped at localhost EPERM before Chrome. Focused counts overlap. |
| tBkjSj parent | Tests/build/diff/label-assets passed; free-labels failed saving final2D live evidence. Sixteen of18 cumulative groups completed,17 started. Six predecessor32D scenarios terminal-pass; combined layout incomplete and final standalone unexecuted. PageErrors empty. |
| Capture progress | Five2D trusted native actions, one PNG, internal strict pixel assertion, native toolbar expansion/restoration and resource cleanup completed. Final capture lifecycle assertion/normal return did not execute after persistence timeout. |
| Remaining | Caller native-before-assertion and new standalone fixture were not reached. Both new standalone downloads/association/file replay, new3D cases/live/download, both pending scenarios and final standalone remain unexecuted in this run. Independent completion review has not begun; no child commit/push. |

BjrAYN's ordering mismatch and qsihsK/Ab9guh blockers remain history.
The association fix is implemented and registered but has no new native
standalone acceptance in tBkjSj.
Do not substitute prior partial results or child startup EPERM for the actual
parent persistence failure. A restored diagnostic name is not a terminal pass.

## Exact observed persistence boundary

Primary error:

~~~text
Timed out after 5000ms during Zero-axis live restored-after-image-attempt evidence
~~~

`captureZeroAxisLive` in `scripts/zeroAxisLiveCaptureWorkflow.mjs` calls the
final `persist('restored-after-image-attempt')` after native restoration and
resource observation. `boundedPointDiagnostic` in
`scripts/pointCheckDiagnostics.mjs:13` supplies the deadline error.

The same2D PNG as BjrAYN is retained:36,882 bytes,1700×1300,632 magenta pixels,
local y−34.02419354838708..33.71774193548388 and valid narrow stroke bounds.
SHA256:

~~~text
fab81d376069bb3ab3ee08b17a5e89b8db34ea2589ffeeee3b3e13d81cfa26b3
~~~

Current records contain one native Collapse and one native Expand, inherited
expanded toolbar restored, stable protected state/geometry, cleared registries,
listeners0 and no native action/restoration/secondary errors.
The internal pixel assertion returned successfully before the final persist.
The timeout prevents the final `assertZeroAxisLiveCapture` and normal return;
do not call the complete capture lifecycle accepted.

`retainLive` at `scripts/checkPointLayoutAnchors.mjs:826–832` sequentially
serializes/writes full live, full native including live, then calls `observe`.
`observe` in `scripts/checkFreeLabels.mjs:87–91` appends a diagnostic/checkpoint
and calls `save`, which rewrites the entire accumulated report.

| Retained file | Bytes |
| --- | --- |
| 2D live-capture JSON | 74,465,740 |
| 2D native JSON | 130,844,920 |
| Cumulative free-labels evidence JSON | 255,833,911 |

One boundary therefore includes about461 MB of full-document writes plus
serialization under a single5s wrapper. The report contains4,223 diagnostics
and189 evidence entries. Several older direct embedded native-interaction/
overflow entries are large; new live diagnostic stubs alone are small.
A capture snapshot retains640 full-stroke samples with up to16 hit-stack
descriptors each, repeatedly duplicated across lifecycle snapshots.
The existing `createPointDiagnostics` already persists separate raw artifacts
and small report references; retain that useful mechanism.

Large repeated persistence is the supported likely cause. Individual
serialization/write durations were not recorded, so do not assign the timeout
to one particular file or claim a measured throughput.
Add bounded byte/operation/duration observations for the changed path.

The saved live raw record lacks the subsequently installed timeout primary;
outer failure records contain the error.
The bounded helper owns late rejections but cannot cancel its operation.
Source therefore permits a late timed-out retain/report write to race with
outer failure publication; the retained report does not prove that race
actually overwrote failure state.
The fix must explicitly own late completion and durable terminal publication.

## Scoped lossless publication fix

Inspect the actual `retainLive → observe → save` path, lifecycle persist/error
ownership, direct large32D diagnostic payloads and parent raw-artifact readers.
Choose a small lossless representation/publication change supported by measured
payload structure, not a generic renderer/storage rewrite.

Freeze/own each evidence boundary before asynchronous publication.
Keep exact measured state/history/selection/revision/source/request/owner,
camera/UI/viewport/scroll/CTMs, all640 samples and their hit stacks, native
events/action ordering, image bytes/hash/frame, restoration and cleanup records.
Do not trim samples, drop state fields, replace raw data with flags/hashes alone
or alter comparisons to compensate for absent observations.

Persist unchanged repeated snapshots/state/descriptor data once in immutable
artifacts or lossless tables with explicit references. Retain every referenced
byte and sufficient schema/path/hash/length/identity information for deterministic
parent replay. Reconstruct original values exactly before existing assertions.
Do not equate similar owners/points, coalesce changed snapshots or lose boundary
timestamps/order when sharing data. Preserve exact distinctions and provenance.

Avoid rewriting full live and full native documents at every stage, or embedding
the entire live lifecycle again in native/failure/report records.
Avoid serializing/writing the accumulated large browser report on every scoped
capture boundary. Publish durable compact boundary/index records referring to
fully retained raw data, then consolidate required terminal reports through
the owned publication path.
If direct earlier32D entries inflate the report, externalize them losslessly
with compatible resolution rather than changing unrelated31F/32A behavior.
Keep the existing group/scenario/checkpoint/history and artifact-inclusion semantics.

Necessary raw artifacts/refs must be completely written and authenticated
before their boundary is published or normal preparation/test/acceptance
assertions and native actions proceed. Owned native restoration/resource cleanup
must still be attempted after publication failure, preserving primary/secondary
errors and withholding acceptance; a stalled sink must not prevent cleanup.
Required final/restored evidence must complete before lifecycle
validation/normal return or any scenario/group is marked passed.
No fire-and-forget write, skipped final evidence, optional record, swallowed
deadline or success flag may establish acceptance.

Keep the existing5,000ms boundary and native/image deadlines.
Do not merely raise the deadline, retry the screenshot, split the same unchanged
bulk write into extra fresh deadlines, add heap/concurrency flags or move required
evidence into an unbounded post-success/background task.
Reduce repeated work and demonstrate real publication stays bounded.
Record operation counts/retained bytes/durations without embedding large payloads
back into progress summaries.

Own serialization/publication with a serial or generation-aware lifecycle.
After timeout/failure, late fulfillment/rejection must remain handled and may
not mutate frozen boundary observations, replace newer files/checkpoints,
restore a report to running, publish acceptance or overwrite primary errors.
Separate immutable boundary bytes from authoritative current/failed/terminal
index state; commit references only while the owner remains valid.
Retain the original primary Error object, bounded secondary errors and current
failed disposition. An orphan/late artifact is not committed acceptance.
Do not deadlock native cleanup on a stalled publisher or abandon owned resources.

Retain raw observations before assertions/image work and exact primary failure/
restoration evidence afterward. A final evidence timeout must still preserve
the actual successful image/UI measurements and the new error in an authoritative
failure record; do not retrofit the error into previously frozen historical data.
Keep one actual image/no extra failure screenshot and exact inherited toolbar,
selection, model/history/UI and resource restoration.

## Parent replay, faithful regressions and acceptance

Integrate referenced evidence into the caller/report/parent policy with explicit
schema and strict resolution. Validate referenced artifact existence, exact
bytes/hash/length/path/current tree/stage identity, ordering and complete
coverage. Missing, stale, truncated, conflicting or unauthenticated refs fail.
Do not trust a compact summary without resolving its raw proof.

Preserve existing public validation semantics after resolution:
all18 cumulative groups, all nine32D scenarios, complete started/completed/
unexecuted accounting, exact native/lifecycle assertions and real file/PNG replay.
Keep `assertLayoutPostClickViewDiagnostic` and its parent call compatible:
ordered before/immediate-input/after stage prefixes, exactly one accepted actual
view diagnostic and last/terminal equality must survive referenced records.
Do not make post-click view proof optional or flatten it to a final flag.
Keep native/file-local association, immutable click/model order, actual DOM order,
derived one-to-one ownership and zero-axis CTM replay exact.

Current lifecycle tests in `tests/scripts/phase32dVerification.test.mjs` use a
retain stub that clones records and throws immediately at a selected boundary.
They do not exercise this real triple-write/cumulative reporter path.
Add meaningful integration controls around the actual chosen writer/observe/
publication path, using injected ordinary writers and deterministic gates/deadlines.
Retain existing immediate-error tests.

Verify lossless round-trip of faithful full-sample snapshots and exact
state/history/events/source/owner fields through artifact resolution.
Verify unchanged observations are serialized/written once and boundary/index
writes remain compact, with no repeated full cumulative dump on each capture.
Use operation/byte counts and controlled async gates rather than fragile
machine-speed assertions or repeated hundreds-of-megabytes fixture allocation.

Add genuine stalled-final-writer timeout, late fulfillment, late rejection,
failure publication competing with a late running write, missing/corrupt refs,
wrong hash/length/owner/order and mutated-after-queue data controls.
Test exact primary Error preservation, handled late rejection, no terminal
success after timeout, authoritative failed record and complete cleanup.
Keep both ambient dimensions, one PNG/no extra screenshot, inherited-collapsed
no-action and expanded collapse/restore cases, resource registries and protected
state invariants. Ensure the normal finalized artifact resolves to the same
record consumed by parent lifecycle/native/file replay.

Keep the prior deterministic stalled-report injected ordinary-writer control,
20ms test deadline, exact primary Error/nativeChecks, late rejection ownership
and complete listener/page/browser/server cleanup.
Use configurable test-only gates/deadlines for new timeout controls while
production remains5s; do not create a flaky real-5s race.
Preserve normal heap/concurrency and earlier structural-sharing fixture fix.

Retain all61 correspondence,65 live-capture and55 background controls.
Update necessary runner dependencies/artifact inventory/parent loader tests
without dropping historical cases or making fresh raw proof optional.
Preserve the association helper's source-proven pre-export IDs/order, unique
outer placements, separate raw/derived identity, exact file-local contour/body/
placement checks and owner-bound standalone CTM.
Keep complete-root standalone helpers and strict pixel oracle unchanged.

Require both fresh zero-axis native/live lifecycles to return successfully
with all required publications, all twelve polygonal cases, both seven-node
transparent standalone downloads/reopening/complete PNG/TikZ, both fifteen-entry
pending transparent/white workflows and final cumulative standalone acceptance.
tBkjSj never reached the new association workflow; do not infer its acceptance
from the absence of its old mismatch.

Preserve every authenticated reference byte:
original172 boxes/4,925 anchors/11 failure controls; signed-basic8 boxes/
192 anchors;54 polygonal boxes/1,386 anchors;12 direct arithmetic controls;
four dart fitting traces; one singular boundary control;
eleven zero-axis PGF paths and37 independent rendering records.
Keep original32C and490 additive polygonal/zero-axis files,
0.025pt anchor/0.03pt contour tolerances,0.005 precision and2048 finite-work budget.
Retain signed fitting/clearance, narrow reciprocal math, ordered collapsed-axis/
partial/reversed/rotated traversal, zero-area fill and dash/cap/join/closure.
Keep geometry/rendering/model/TikZ tests, both TikZ modes and2D z=0/3D active-plane
semantics. Add no dependency without explaining why.

## Preserve completed corrections and contracts

Retain signed rectangle/ellipse `signedFittedAxes` and exact anchors/placement,
magnitude-only radius density, oblique negative-ellipse picking and existing
both-dimension signedAnchorCases/signedPickingCases/raw policies.
Retain deterministic stalled-report injected ordinary-write recorder,20ms
deadline, exact primary Error/nativeChecks count, two stalled failure writes,
late rejection ownership and complete listener/page/browser/server cleanup.
The earlier full6,425 test pass cleared that prior review failure; the latest
registered suite passes6,836 tests. Do not loosen this deterministic control.

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

Use strict TypeScript without `any`; keep module separation, codim convention,
raw user text and model coordinates. Update Phase32 docs to the actual bounded
lossless-publication scope, byte/duration observations and current outcomes,
preserving implemented association/live/native/geometry history.
Count overlapping focused sweeps honestly.

Use Homebrew Node>=22.12.0. Run focused actual persistence/publication/resolver/
late-writer/error-ownership/parent-policy/runner checks and preserved association,
live-capture, native, geometry/reference, pending, standalone and deterministic
stalled-report controls.
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
The older stalled-report race and fixture allocation failure are resolved;
the current final live-publication timeout is a distinct observed blocker.

Use a fresh owned browser-capable parent process/server, supported Playwright/
Chrome and actual current tracked/untracked tree without committing:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Require all18 groups: twelve31F (including final standalone), three32A and
one each for32B paint/import,32C shapes/visibility/downloads and combined32D.
Require all nine32D scenarios, finalized native/live/file proof, all referenced
artifacts resolved exactly, both new transparent downloads/complete PNGs,
both pending workflows/PNG/TikZ, native history/JSON persistence and no page errors.
Do not reuse tBkjSj's partial/late-write diagnostics, older reports, scoped
results or synthetic controls as complete cumulative acceptance.
Do not skip predecessors or defer supported cases.

Preserve clean-tree rules; do not reset/stash/discard/commit unfinished work
to bypass them.
If child startup encounters EPERM, retain failure/exact tree and pending parent
native work without weakening acceptance. Obtain approved browser-capable
execution where available.
If another boundary fails, retain actual stage/publication timing, current raw
measurements, file identities and primary error before reporting the next blocker.

After fresh required verification passes, obtain independent read-only completion
review of the exact matching tracked/untracked tree using
`prompts/phase-32d-review.md` and inspect actual reports/artifacts.
Require prior geometry findings resolved, faithful native/live/association/file
proof, complete lossless publication, full-suite success and complete cumulative
acceptance. Keep post-review identity guard.
Failed/incomplete verification stops before review/commit; needs_changes blocks
completion/commit even when required tests/browser checks pass.

Report the scoped persistence fix, lossless payload/write measurements,
meaningful deadline/late-owner regressions, preserved production/reference/
capture behavior, changed files, focused/full checks, baseline failures,
exact tree/report identity and independent review result.
Keep Phase32 incomplete until every gate passes.
Leave commit/push to the parent after verification and review.
