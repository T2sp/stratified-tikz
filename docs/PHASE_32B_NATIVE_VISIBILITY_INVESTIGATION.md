# Phase 32B native visibility timeout investigation

The trigger remains unproven. This change corrects missing native-page evidence
and strengthens the save/change/reload assertion; it does **not** claim a proven
scroll or production fix. Production geometry, controls and CSS are unchanged.
32B remains incomplete until matching cumulative native verification and fresh
independent review pass. 32C/32D remain deferred.

## Retained results

The supplied starting identity `24397265a1a6ec1bef2636e96843225b5d4386dce36876dfc0105f6282f58d4e`
belongs to HEAD `87798f7`. This session actually began at prompt-update commit
`5c1ef003fe14b6cbc8f857214ec28e66541dfaea`, on the requested branch, with a clean
working tree. All 150 previously untracked file contents match the old handoff's
SHA256 values; they are now tracked. No reset, discard, regeneration, commit or
push is part of this investigation.

The dashed-cap handoff's 4,158/4,158 test pass, build/static checks and independent
production review remain separate from its missing native acceptance. Its two
child server-listen `EPERM` failures and automatic Chrome UI rejection
(“Computer Use was not approved to use Google Chrome.”) remain unchanged.
No permission change or alternative UI access was attempted.

The subsequent parent `UThawr` run used Chrome 154.0.8037.57 and Node v26.9.0.
Its matching before/after identity passed tests/build/diff/label-assets, then
failed free-label acceptance in `point-node-native-input`. It completed 11
groups; five were incomplete, including four unexecuted groups. There were no
recorded page errors. This was **not** a server-startup failure, and the new
dashed-cap native scenario did not execute.

Observations 0179–0183 prove the 3D `inlineMath` save/change/reload sequence,
empty payload differences and revision 4 → 5. Observations 0184–0186 and
`point-native-3d-standalone.json` prove the following `standalone` download,
with axes/visibility on, sorting off, theta 41, phi −28, zoom 1.3, pan (12,−9).
They do not prove its later reload. After changing mode, axes and sorting, the
original `uncheck()` timed out at 30,000ms while scrolling the visibility
checkbox into view, after actionability succeeded. No click or committed
visibility change is established, and theta 63/reload had not been reached.

Observation 0187 shows a readable actual App state at revision 5 and local
`errors: []` when failure capture ran. It does not prove uninterrupted identity
or frame/scroll health during the action. Its direct-input form observer
correctly sees no open form and contains neither current checkbox geometry nor
live `uiSettings`. Earlier persisted `diagram.view` is not live UI evidence.
The outer `failure.png` depicts a different renderer page. None is used to infer
checkbox geometry or a host-sleep cause.

The earlier free-label SVG failure waited for element stability, unlike this
failure during scrolling after stability succeeded. The lifecycle-write timeout,
separate 11/11 rerun, later full passes, fixture-memory fix, historical `wPPGzN`
native acceptance and Cairo zero-entry observations retain their original scope.
See [the lifecycle investigation](PHASE_32B_LIFECYCLE_INVESTIGATION.md) and the
preceding sections of [the implementation report](PHASE_32B_IMPLEMENTATION.md).

## Scope of the harness correction

Inspection finds the controls in the source-panel heading's nested scroll
container. The visibility and sorting handlers update separate booleans; no
conditional replacement, animation or geometry loop was demonstrated. Nested
scrolling, layout movement, browser/protocol stalls, document replacement and
host timing remain hypotheses. There is insufficient evidence to choose a
native interaction workaround or change production layout.

The native point workflow now installs `createOwnedAppPage` on its **own** page
before navigation, with a distinct artifact prefix. State reads guard the
document generation, URL and API instance atomically. Each persistence control
operation records explicit dimension/mode/action boundaries, continuity before
and after, and finite geometry/timing samples. The original real `check`,
`uncheck`, `setChecked`, selection and numeric input actions are unchanged.
No force click, synthetic event, corrective state mutation, retry, sleep,
deadline increase or replacement App is introduced.

Opt-in native-control geometry observations record associated labels and match
counts, checked/enabled/connected state, rectangles, ancestors and scroll/CSS
state, nearby layout, active focus, hit targets, viewport, frame progress and
trusted input/change events. Guarded snapshots include current UI settings,
revision and bounded model/history summaries. Browser and host clocks are both
retained without interpreting a long interval as evidence of sleep. Existing
sampling/DOM/event budgets and diagnostic deadlines remain finite; listeners,
timers and owned pages are cleaned up, with late rejections observed.

The downloaded bytes receive an explicit SHA256/length/path/revision identity.
A bounded actual-App viewport screenshot precedes each 3D change sequence.
Failure capture saves the primary error/log/stack and lifecycle before bounded
structural/control and actual-App screenshot capture, retaining metadata if
capture fails. Secondary diagnostics/cleanup cannot replace the UI failure.
The save boundary uses the existing bounded two-frame helper, without adding
a geometry-readiness wait for the checkbox.

Before **each** 2D/3D, inline/standalone reload, the scenario retains current
controls and live state and asserts they contain exactly the intended changes.
3D proves visibility true → false → true, sorting false → true → false,
opposite mode/axes and theta 41 → 63 → 41; the complete other camera settings
are compared. UI changes preserve model/history/revision. Reload still compares
the whole downloaded document, all saved UI settings and selected controls,
increments revision, resets selection and clears the redo branch. Download
bytes are re-read after reload to check immutability. Original exact-source,
direct/cursor/work-plane and downstream point-export checks remain intact.

Registered regressions include missed or stale UI transitions, diagnostics with
missing/replaced APIs, bounded sampling, capture failures/timeouts, original
error/log retention, late rejection ownership and cleanup. Mocked tests are not
native acceptance. The focused point runner executes the entire same native
point workflow, including both mode iterations, with the normal viewports; it
explicitly cannot substitute for cumulative predecessor execution.

Independent review reproduced a separate race in the first version of this
instrumentation: an optional monitor evaluation could still be in flight when
the successful action requested its mandatory post-action capture. The capture
guard correctly refused a concurrent read, but the required witness then failed.
Mandatory pre/post observations now bracket the whole monitored operation and
its existing drain. A registered deferred-response regression overlaps an
optional sample with action completion and requires all captures to remain
available, without retries, sleeps or longer deadlines. A second regression
preserves the native primary error and omits a success observation after failure.
The original reproduction/source copies and superseded 4,223-test verification
remain external. This demonstrated diagnostic race does not explain `UThawr`.

## Verification and remaining gate

The baseline cumulative attempt in this child stopped at `listen EPERM` before
browser launch. It is retained separately from `UThawr`. Final focused and
cumulative attempts, Node/build/static results, exact tracked/untracked/binary
identity, retained-source hashes and independent review are written outside the
checkout under `/private/tmp/stz-phase32b-visibility-handoff/`, after code/tests/
docs are finalized. New attempts cannot erase original evidence or establish
the historical cause merely by passing once.

The existing minimum remains 16 cumulative groups, 29 point scenarios and 605
artifacts, with all 386 prior and 219 dash-cap artifacts, 18 dash cases and the
required complete 1,089-cell audits. No production cap/join/effective-style,
picking tolerance, importer/PGF, lifecycle-memory, runner-process, 60-second
fixture-deadline or 32A behavior is changed. The authorized parent must run all
five commands on the final identity, inspect both browser reports and terminal
success, and review the checkbox's trusted action plus downstream standalone
reload and dash-cap audits. Missing execution or unresolved evidence keeps the
gate pending; no commit/push is allowed before successful verification/review.
