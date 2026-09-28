# Phase 32B lifecycle timeout investigation

This investigation is separate from the dashed-cap geometry correction. The
accepted `wPPGzN` parent run covered the pre-fix tree. The independent review's
whole-suite result remains **3,986 passed / 1 failed / 3,987 total**, with zero
skipped/cancelled tests. Its later **11/11** focused rerun is a distinct success
and does not explain the failure. Both original logs and `checks.json` remain at
`/private/tmp/stz-32b-review-H8bkE3/` without modification.

The original failure names `owned App lifecycle evidence`, so it is a bounded
lifecycle file write, not a browser capture timeout. The previous helper used that
same name for install, three startup captures, startup completion, diagnostic
persistence and disposal. Its timer stack cannot distinguish those phases.
The test installed intentionally hanging browser mocks only after `setup()`,
but passed `timeoutMs: 15` to the entire helper, including real filesystem saves.

A retained directory, `stz-owned-app-test-E5Y3GP`, contains only the initial
`created` lifecycle event, timestamped `2026-09-27T12:43:06.535Z`, during the
reviewer's full-run interval. This is consistent specifically with an install
save that timed out before `setup()` registered cleanup; later capture saves
would contain a `document-observation`, and completed setup registered cleanup.
The original log does not record the directory or page ID, however, so the
association is corroborating evidence rather than conclusive attribution.
The operating-system scheduling trigger, and the precise phase of the historic
failure absent that association, remain unproven. A copy and original-file hashes
are retained under `/private/tmp/stz-32b-lifecycle-investigation/`.

The helper now labels each lifecycle write with its phase (`install`,
`capture:<boundary>`, `startup-complete`, `failure:<stage>`, `finish`, `dispose`),
and labels capture/transition writes separately. Its optional read-only observer
records operation name, configured deadline, wall elapsed time and pass/failure;
an observer exception cannot replace the primary operation's outcome. Production
still uses the unchanged `boundedPointDiagnostic` implementation, default 2,000ms
bounds and existing screenshot grace period. No browser/fixture timeout,
concurrency setting, retry policy or dependency changed.

Before hardening the test, one focused run and one ordinary `npm test` run used
the same 15ms real timer with this phase instrumentation. The focused helper
suite passed 11/11. The ordinary whole-suite run passed 3,987/3,987 in 253,958ms, zero
failed/skipped/cancelled tests; its helper file also passed 11/11. Neither run
reproduced the reviewer failure. Their timing records show:

| Operation in the timeout test | Focused wall ms | Full-suite wall ms |
| --- | ---: | ---: |
| Install lifecycle write | 0.080 | 1.499 |
| Failure JSON after capture | 0.071 | 8.307 |
| Intentional hanging DOM capture (15ms deadline) | 15.133 | 16.260 |
| Intentional hanging screenshot (115ms deadline) | 115.263 | 116.493 |

These measurements establish which work consumes the old short budget and show
scheduling variation; they do not establish why the historic timeout fired.
Logs are `focused-before.log` and `full-before.log`; individual operation traces
are in corresponding directories, summarized in `timing-summary.json`. The
full-suite investigation is a developing-tree observation, not final-tree
verification; its whole-suite success is retained separately in its own log.

The timeout regression now uses Node's test-local mock of `setTimeout`. Real
filesystem setup, JSON persistence and disposal still execute and are read back.
The configured budgets remain 15ms/115ms. The test advances its controlled clock
only after the deliberately hanging DOM operation starts, then only after the
hanging screenshot starts. Thus both actual deadline paths execute without
assigning the operating system a 15ms disk-scheduling requirement. A separate
10-second test-runner bound guards an accidentally unreachable entry gate.
Node restores the timer mock after the test; global suite concurrency is intact.

All prior assertions remain: primary-error retention, both timeouts, ownership
of both late rejections, retained failure/lifecycle JSON, close events and cleanup.
The test additionally checks exact phase/deadline messages, both retained timeout
records, and complete listener removal. Setup registers cleanup before install,
so a future startup failure cannot strand its owned listeners/directory.
The optional `STZ_LIFECYCLE_TIMING_DIR` records traces even during test cleanup,
with temporary test data removed independently of timing-output success.

After hardening, the focused helper suite passed 11/11. The helper plus bounded
diagnostics suites passed **25/25** with `--unhandled-rejections=strict`, zero
skipped/cancelled tests; `focused-strict-after.log` and the final
`focused-strict-final.log` retain those separate successful runs. Targeted
ESLint, script syntax and diff checks passed. A successful fresh whole-suite run
on the final tracked/untracked/binary identity is still required independently;
neither these focused checks nor the historical parent pass substitutes for it.
The final verification/handoff records that result outside the checkout so the
verified identity remains unchanged. Setting `STZ_LIFECYCLE_TIMING_DIR` during
that run retains final full-suite phase timings without editing the checkout.
