# Phase 31B Targeted Fix Prompt: Recover from native module-load failures and verify browser retry

## Environment

Work on the current Phase 31B checkout. Preserve the existing ink-bounds fixes
and any unrelated user work. Do not reset the branch or replace the current
adapter with an earlier version.

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Required verification includes focused real-adapter tests, `npm test`,
`npm run build`, targeted lint, script syntax checks, `git diff --check`, and
the fresh-build browser asset/retry/raster checks described below.

Do not add dependencies or change the pinned MathJax/font versions as a
workaround. Do not perform repository-wide lint cleanup. Never report an
unavailable check as passed.

## Latest review findings

The latest Phase 31B review reported `needs_changes`: no Critical issues,
exactly one Medium issue, and no Low-priority issues.

### Medium: transient native module failures can prevent recovery until page reload

On browsers that cache failed ES module loads, an actual runtime or additional
font download failure can remain unsuccessful after connectivity returns and
the public service's `invalidate()` runs:

- `src/rendering/labels/mathjaxEngine.ts` retries the same runtime import;
- `scripts/prepareMathjaxAssets.mjs` generates fixed additional-font import
  specifiers, which are retried with the same module identities;
- `src/rendering/labels/mathjaxRuntime.ts` deletes its own rejected font-load
  Promise, but that does not clear the browser's module cache.

This can disable all mathematics, or formulas needing the failed font chunk,
for the rest of that page session.

The finding is **code-supported, not browser-reproduced**. The review recorded
Chrome `153.0.8010.52` and cited the later behavior change documented in
[Chrome's official 155 beta notes](https://developer.chrome.com/blog/chrome-155-beta#avoid_caching_module_failures).
Do not describe that evidence as a successful reproduction in this checkout.

The font-retry fixture in `tests/rendering/mathjaxAdapter.test.ts` rejects
before calling the actual native import. It verifies adapter-level retry,
but cannot establish recovery from a failed browser module load.

### Outstanding verification: built browser assets and raster fidelity

The review's `npm run check:label-assets` exited with `listen EPERM` while
binding localhost, before browser requests, font loading, or standalone raster
assertions ran. This is an outstanding acceptance check, not a second Medium
issue.

The review recorded Node v26.9.0, 2,237 passing full-suite tests, 81 passing
focused adapter tests, passing targeted lint and asset-script syntax checks,
and a passing build and `git diff --check`. The build emitted non-failing
chunk-size warnings. Static inspection resolved 46 manifest entries,
86 references, and all 40 additional font modules under `/stratified-tikz/`.
These are previous results to preserve and recheck, not browser evidence.

## What the review confirmed correct

Preserve the following implementation and regressions:

- MathJax and the NewCM font are pinned, installed, and locked at `4.1.3`;
- real-engine conversion preserves exact complete-source fallback, isolated
  TeX state, scoped errors, and bounded work;
- logical advance and actual ink bounds are distinct, with independent tests
  for overlapping and smashed geometry;
- portable SVG validation, explicit paint, immutable results, cache bounds,
  and configuration/font identities are sound;
- assets are local, lazy, and resolved under the configured application base;
- diagram model, saved JSON, history, and production canvas integration remain
  unchanged, with Phase 31C correctly deferred.

The previous ink-bounds defect is resolved in the reviewed implementation.
Keep its geometry and standalone raster regressions; do not reopen that work
as the primary target of this fix.

The unchanged `src/rendering/SvgDiagram.tsx` has pre-existing
`react-hooks/refs` lint debt. It is outside this fix.

## Goal

Make the production adapter recover from an actual transient runtime or
additional-font module-load failure on supported browsers. After access is
restored and `invalidate()` or the documented bounded retry mechanism runs,
the same public service in the same page must successfully convert the same
source without a page reload.

Correct the loading lifecycle, add regressions that exercise native module
failures, and complete the built browser asset/raster verification when the
environment permits it. Keep Phase 31C integration deferred.

## Required reading before fixing

Read at least:

- `AGENTS.md` and this prompt in full;
- `prompts/phase-31a-implement.md` and the Phase 31A input/result contract;
- `prompts/phase-31b-implement.md` and `prompts/phase-31b-review.md`;
- the latest Phase 31B review report, if available; otherwise use the findings
  reproduced above as the review summary;
- `docs/LABEL_ADAPTER.md`, the Phase 31 sections of `docs/PREVIEW_UI.md`, and
  `docs/ROADMAP.md`;
- `src/rendering/labels/mathjaxEngine.ts`, `mathjaxRuntime.ts`,
  `mathjaxConfig.ts`, and `labelService.ts`;
- `src/rendering/labels/labelMetrics.ts`, `labelInkBounds.ts`, and `labelSvg.ts`;
- the label metrics, SVG, service, lifecycle, real-adapter, and error tests;
- `scripts/prepareMathjaxAssets.mjs`, its generated font import map,
  `scripts/checkLabelAssets.mjs`, `vite.config.ts`, and `package.json`.

Inspect the actual production import graph and test assertions. A retry test
name or deletion from an application-owned Map does not prove that a poisoned
native module identity can recover.

## 1. Fix recovery at the actual module-loading boundary

Choose the smallest correct local design that can recover despite a cached
native import failure. Do not prescribe success solely from clearing a
Promise, creating another MathJax document, or constructing a new service.

Cover both the runtime initialization path and the additional-font path.
Consider transitive/shared imports in the emitted build graph: changing only
an entry URL is insufficient if its dependencies still use failed identities.

A disposable module execution context or another demonstrably retryable
same-origin loading design is acceptable. The mechanism is an implementation
choice, not a requirement to introduce a particular worker architecture.
Explain why the selected mechanism avoids reusing the failed native module
state and how its resource lifetime remains bounded.

Required behavior:

- An initial failed download settles within the existing bounded failure
  policy and returns the typed complete-source fallback.
- After resource access returns, invalidation/retry permits the same service
  to produce a successful result for the same source in the same page.
- Failure during a later math run discards all earlier successful geometry;
  fallback preserves the complete original source, including delimiters,
  spaces, tabs, and physical newlines/CRLF.
- Plain-text labels remain usable, and valid mathematical conversions work
  after recovery. Preserve lazy initialization for plain-text-only requests.
- Successful results remain immutable and reusable; concurrent equivalent
  requests retain the existing coalescing behavior.

Preserve exact dependency versions, the finite approved font set, license
assets, same-origin requests, and Vite's `/stratified-tikz/` base handling.
If the build structure changes, ensure every runtime, worker, dependency, and
font resource is emitted and discoverable by the deployment check. Update the
asset generator rather than hand-editing its ignored generated output.

Do not use page reloads, a requirement to upgrade the browser, CDN fallback,
arbitrary remote imports, disabled browser security, or permanent fallback
after a transient failure as the fix. Do not eagerly load all math/font code
merely to avoid the failing lazy path.

## 2. Keep retry, storage, and lifecycle bounded

Preserve the existing source/run limits, pending and unsettled work limits,
cache entry/byte bounds, retry delay, and finite settlement behavior.

Account for resources introduced by the recovery design:

- bound simultaneous and retained loaders, execution contexts, requests,
  queues, and retry identities;
- retire or dispose of abandoned contexts/resources when applicable;
- prevent retry storms during an outage and coalesce shared initialization;
- ensure timeout, invalidation, and late completion cannot publish obsolete
  results into the current generation or poison a recovered engine;
- keep counters and cleanup correct on success, rejection, and timeout;
- preserve isolated TeX state and scoped error capture across recovery;
- keep failure categories accurate and update configuration/cache identities
  if the transient result or loading contract changes.

Deleting an application cache entry does not prove native module storage has
been released. An unbounded sequence of random/query-suffixed import URLs is
not an acceptable bounded retry strategy. A finite retry budget that leaves
the page permanently unable to recover after ordinary transient failures is
also insufficient. Document the actual lifetime and retry semantics.

Add focused lifecycle regressions for repeated failure/recovery, concurrent
callers, and completion after timeout/invalidation. Deterministic test seams
can cover these cases, including a loader that remembers failed identities,
but must supplement the real browser tests below.

## 3. Add browser regressions for actual failed imports

Extend `scripts/checkLabelAssets.mjs`, or a closely related focused browser
check, to exercise the built public service with its default production
loaders. Do not replace the native import with a callback that throws first.
Keep the existing adapter-level retry fixture as complementary coverage.

Test these independently with initially cold relevant modules:

1. **Runtime failure:** fail a real emitted runtime request, verify bounded
   complete-source fallback, restore access, call `invalidate()`, and convert
   the same source successfully using the same service in the same page.
2. **Additional-font failure:** establish ordinary math success, then fail a
   real request for a font chunk required by a different formula. Verify
   complete-source fallback, restore access, invalidate, and successfully
   convert that same source through the same service and page.
3. **Transitive failure:** where the chosen build graph has separately loaded
   shared/dependent modules, fail such a request and verify recovery too. This
   must catch a design that changes only the entry identity while retaining a
   poisoned dependency. If no such request exists, explain the built graph.

For the font case, include a mixed label with an earlier valid math run and
exact whitespace/CRLF so the failure also proves that partial geometry is not
returned. Verify later valid math and plain-text requests remain usable.

Each scenario must prove that the intended network request actually failed
and affected conversion. Install the failure before the resource is loaded,
and guard against warm module caches and Vite preloading bypassing the test.
Use a controlled request abort or failing response at the real asset boundary;
record the observed URL, failure, fallback, and subsequent successful result.

A fresh page/context may establish the cold start for each independent
scenario. Between a scenario's failure and recovery, do not reload/navigate,
replace the public service, open a new page/context, or clear browser caches.
An internal disposable context managed by the production recovery mechanism
is allowed: that is the behavior under test.

Record the actual browser version. Test in an available supported browser
that exhibits cached native failures; the review's Chrome 153 is the relevant
starting environment if still available. A newer browser that automatically
retries failed imports can mask the original defect. If only such a browser
is available, clearly distinguish its passing check from still-unverified
recovery on affected browsers. Do not silently narrow browser support.

Keep expected injected request failures local to their test scenarios. Do not
disable the smoke's general request/error assertions to make fault injection
pass. Preserve rejection of unexpected external requests and unrelated errors.

## 4. Complete fresh-build asset and standalone SVG verification

Run the browser checks against a fresh production build in an environment
that permits localhost and Chrome/Chromium. Use an already available external
Playwright installation; do not add a project dependency just for this check.

The documented command for this checkout is:

```bash
PATH=/opt/homebrew/bin:$PATH \
STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
STZ_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
STZ_SMOKE_ARTIFACT_DIR=/private/tmp/stz-label-smoke \
npm run check:label-assets
```

Use actual available module/executable paths if these differ, and record the
exact command. Follow the execution environment's approval rules for local
server/browser access without weakening browser security or network checks.

Preserve checks for application mounting under `/stratified-tikz/`, lazy
initialization, same-origin assets, additional font-data loading, matrices,
complete-source fallback, explicit paint, and standalone SVG portability.

Keep the independent native-geometry and enlarged-viewport raster checks for
overlapping/smashed ink. A nonempty image or red/blue pixel count alone must
not replace the existing clipping oracle. Static manifest/reference checks
remain useful, but do not replace real browser requests or raster assertions.

If execution is blocked, record the exact command, failure, and assertions
that did not run. Complete work that can run and keep browser acceptance
explicitly incomplete. Do not claim Phase 31B complete or ready to commit
solely from passing unit tests or static deployment evidence.

## Scope and preservation requirements

Limit changes to the Phase 31B adapter/loading boundary, necessary build and
asset checks, focused tests, and directly related documentation.

Do not implement Phase 31C canvas/React/picking integration, Phase 31D path
labels, or Phase 31E full-diagram export waiting. Do not change diagram schema,
persisted labels, coordinate placement, undo/history, TikZ source generation,
or existing point/free/path label rendering.

Keep strict TypeScript without `any`, the parser and SVG validation policy,
supported formulas, actual ink bounds, logical advance, baselines, explicit
paint, exact-source fallback, isolated state, and immutable caches intact.
Avoid unrelated UI, lint, or formatting cleanup.

## Documentation

Update `docs/LABEL_ADAPTER.md` to explain the recovery mechanism, module/cache
lifetime, invalidation/retry semantics, resource bounds, and actual browser
evidence. Distinguish an adapter-level rejected Promise from a failed native
module load; do not claim that clearing the former alone guarantees recovery.

Keep `docs/PREVIEW_UI.md` and `docs/ROADMAP.md` consistent where needed.
Retain the corrected ink/advance policy and mark any outstanding browser gate
accurately. Production canvas integration remains deferred.

## Verification

Prepare generated local assets, then run the focused checks:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/prepareMathjaxAssets.mjs
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/rendering/labelMetrics.test.ts \
  tests/rendering/labelSvg.test.ts \
  tests/rendering/labelService.test.ts \
  tests/rendering/labelServiceLifecycle.test.ts \
  tests/rendering/mathjaxAdapter.test.ts \
  tests/rendering/mathjaxErrors.test.ts
```

Then run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

PATH=/opt/homebrew/bin:$PATH npx eslint \
  src/rendering/labels/labelSvg.ts \
  src/rendering/labels/labelMetrics.ts \
  src/rendering/labels/labelInkBounds.ts \
  src/rendering/labels/labelService.ts \
  src/rendering/labels/mathjaxConfig.ts \
  src/rendering/labels/mathjaxEngine.ts \
  src/rendering/labels/mathjaxRuntime.ts \
  vite.config.ts \
  tests/rendering/labelMetrics.test.ts \
  tests/rendering/labelSvg.test.ts \
  tests/rendering/labelService.test.ts \
  tests/rendering/labelServiceLifecycle.test.ts \
  tests/rendering/mathjaxAdapter.test.ts \
  tests/rendering/mathjaxErrors.test.ts

PATH=/opt/homebrew/bin:$PATH node --check scripts/prepareMathjaxAssets.mjs
PATH=/opt/homebrew/bin:$PATH node --check scripts/checkLabelAssets.mjs

git diff --check
```

Include additional changed modules/tests in targeted checks and register any
new unit test files in the explicitly enumerated `npm test` command. Run the
browser asset/retry/raster checks above after the successful build.

Report actual commands, exit statuses, test counts, browser version, and
artifact paths. Separate non-failing chunk warnings and unrelated lint debt
from failures introduced by this change. Do not copy review counts as new
verification results.

## Acceptance criteria

Phase 31B can be called complete only when:

- actual transient runtime and additional-font import failures recover after
  access returns, using the same public service and page;
- the solution handles cached native failures, including relevant transitive
  dependencies, without relying on browser upgrades or page reloads;
- failure preserves exact complete-source fallback with no partial geometry;
- retries, resource lifetime, pending work, and caches remain bounded, and
  stale completions cannot corrupt a later generation;
- supported formulas, ink/advance correctness, isolation, and local lazy
  assets remain covered by passing regressions;
- required focused/full tests, build, targeted lint, syntax, and diff checks
  pass;
- built browser retry, base-path/font loading, and standalone raster checks
  pass with observed evidence, including recovery on an affected browser;
- documentation accurately states behavior and verification status;
- no Critical or Medium issue remains and later-phase integration is deferred.

## Report after implementation

Report:

- files changed, the root cause, and the selected recovery mechanism;
- how runtime, additional-font, and transitive import failures are handled;
- why retries avoid poisoned native state and how resources remain bounded;
- invalidation, concurrency, timeout, and stale-completion behavior;
- exact-source fallback and preservation of prior ink/advance regressions;
- focused/full test, build, lint, syntax, and diff-check commands/results;
- browser version and command, actual injected request failures, same-page
  recovery evidence, base-path/font requests, raster evidence, and artifacts;
- any blocked checks, their exact failures, and still-unverified assertions;
- documentation changes, remaining limitations, and whether every Phase 31B
  acceptance gate is met, without claiming Phase 31C integration is complete.
