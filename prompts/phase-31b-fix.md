# Phase 31B Targeted Fix Prompt: Correct overflowing math ink bounds and verify portable SVG

## Environment

Work on the current Phase 31B checkout, including its existing uncommitted
fixes. Preserve those changes and unrelated user work. Do not reset the branch
or replace the current adapter with an earlier version.

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Required verification includes focused real-adapter tests, `npm test`,
`npm run build`, targeted lint, script syntax checks, `git diff --check`, and
the existing built-asset browser smoke described below.

Do not add dependencies or change the pinned MathJax/font versions as a
workaround. Do not perform repository-wide lint cleanup. Never report an
unavailable check as passed.

## Latest review findings

The latest Phase 31B review reported `needs_changes`: no Critical issues,
exactly one Medium issue, and no Low-priority issues.

### Medium: accepted formulas can have incorrect bounds and clipped portable SVG

The production adapter accepts formulas whose visible ink extends beyond
MathJax's nominal layout box:

- `$\rlap{x}$` succeeds with a reported width of `0.016em`, while a point in its
  glyph lies at `x = 0.527em`;
- `$\llap{x}$` and negative spacing can put ink outside the horizontal bounds;
- `$\smash{x}$` retains glyphs above the returned viewport.

At the reviewed locations, `src/rendering/labels/labelSvg.ts` derives the
viewport and metrics solely from MathJax's nominal box, and
`src/rendering/labels/labelMetrics.ts` treats those metrics as ink bounds.
Serialized output also omits MathJax's overflow behavior.

The incorrect bounds were directly reproduced through the real adapter.
Clipping was supported by code inspection, not verified in a browser. Preserve
that distinction when describing the starting evidence.

Adding `overflow: visible` alone cannot fix incorrect layout/picking bounds or
make a standalone SVG image reliably contain its ink.

### Outstanding verification: built browser assets and raster fidelity

The review's browser smoke was unavailable: localhost binding failed with
`listen EPERM`, and a Chrome launch attempt also failed. Browser deployment,
additional font requests, and standalone raster fidelity remain unverified.
This is an outstanding acceptance check, not a second reported Medium issue.

The review recorded 2,223 passing full-suite tests, 67 passing focused adapter
tests, a passing build, targeted lint, both asset-script syntax checks, and
`git diff --check`. Static deployment inspection resolved 46 manifest entries,
86 references, and all 40 additional font modules under `/stratified-tikz/`.
These are previous results to preserve and recheck, not proof that the bounds
defect or browser acceptance has been resolved.

## What the review confirmed correct

Preserve the existing implementation and regressions for:

- exact pinned MathJax/font versions and lockfile agreement;
- real-engine error detection and exact complete-label fallback;
- isolated TeX state, scoped error capture, and later-request recovery;
- bounded synchronous work, pending work, settlement, retries, and caches;
- concurrent-request coalescing and immutable reusable results;
- narrow SVG element, attribute, paint, and reference validation;
- local lazy assets and configured-base URL resolution without CDN fallback;
- documented units, limits, cache identities, and deferred canvas integration;
- unchanged diagram model, saved JSON, history, and production rendering.

The repository has pre-existing `react-hooks/refs` lint debt in unchanged
`src/rendering/SvgDiagram.tsx`. It is outside this fix.

## Goal

Make every successful Phase 31B conversion return portable geometry and layout
bounds that include its actual visible ink. For constructs that cannot be
handled correctly within the adapter's supported, bounded implementation,
return exact complete-source fallback instead.

Resolve the reported cases through the production adapter, add meaningful
real-engine regressions, and complete the browser verification when the
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
- `src/rendering/labels/labelSvg.ts`, `labelMetrics.ts`, and `labelService.ts`;
- `src/rendering/labels/mathjaxConfig.ts`, `mathjaxEngine.ts`, and
  `mathjaxRuntime.ts`;
- the label SVG, metrics, service, lifecycle, real-adapter, and error tests;
- `scripts/prepareMathjaxAssets.mjs`, `scripts/checkLabelAssets.mjs`, the Vite
  build configuration, and `package.json`.

Inspect actual code and assertions. Passing counts or test names do not prove
that visible geometry lies inside the returned bounds.

## 1. Establish a correct ink-boundary policy

Reproduce the reported cases before choosing the smallest correct fix. Two
approaches, or a documented combination, are acceptable.

### Accurate geometry and metrics

If retaining support for overflowing constructs:

- distinguish the logical advance used to place following runs from actual
  left/right/top/bottom ink extents;
- derive extents from authoritative geometry or equivalent verified engine
  information, not just the nominal SVG `viewBox` or CSS width/height;
- account for retained transforms, negative translations, glyph overhang,
  paths, rules, and stroke effects within the supported SVG representation;
- include leftward, rightward, above-baseline, and below-baseline ink in the
  portable viewport and composed label bounds;
- preserve baseline and run origins when translating a viewport to a
  normalized origin; do not shift ink twice or lose a negative offset;
- preserve the intended advance of zero-width or reduced-width constructs;
  expanding a viewport must not silently push following text/math to the right;
- keep em/user-unit conversion explicit and apply scaling once;
- preserve valid empty runs, finite metrics, and existing extent/work limits.

Update only the transient adapter types and composition logic needed to
express this distinction. Consumers must be able to obtain consistent
placement and ink bounds without measuring live DOM themselves.

Do not introduce unbounded path processing or a general SVG renderer to fix
these cases. A shape/effect whose bounds cannot be established safely must
use the fallback policy below.

### Exact complete-source fallback

It is acceptable to reject unsupported overflowing constructs instead of
implementing their geometry in this subphase.

- Detect the applicable unsupported construct/effect reliably in the actual
  conversion path. Do not special-case only the exact review examples.
- Cover the relevant negative-spacing forms and nested uses under the chosen
  policy; do not let nominally valid output bypass the check.
- Return the existing typed fallback result with the exact entire original
  source, including delimiters, leading/trailing spaces, tabs, and newlines.
- Discard all earlier successful math-run geometry in a mixed label.
- Use an appropriate existing internal failure category and document it.
- Leave subsequent valid conversions usable and caches/request identities
  consistent with the supported-input/configuration policy.

Rejecting these constructs does not permit rejecting all mathematics or
weakening the existing success controls. Preserve established safe spacing,
fractions, radicals, indices, matrices, and ordinary mixed text/math labels.

### Forbidden workarounds

Do not:

- add only `overflow: visible` or depend on a page stylesheet;
- inflate every viewport by guessed padding or estimate math dimensions from
  the TeX source length;
- clamp negative origins or erase overflowing paths to make bounds pass;
- substitute viewport width for advance without preserving run placement;
- turn a failed run into partial success or rebuild fallback from parsed runs;
- weaken SVG validation, enable arbitrary extensions, or allow external assets;
- hide the issue by changing fixtures to avoid the reported constructs.

## 2. Add real-adapter regressions

Exercise the public production service with the installed MathJax engine.
Direct engine probes and synthetic SVG tests may supplement these tests, but
must not replace them.

Cover at least:

1. `$\rlap{x}$` and `$\llap{x}$` horizontal overhang.
2. `$\smash{x}$` and a smashed expression with descenders/subscripts, covering
   ink on both sides of the nominal vertical bounds.
3. Several negative-spacing forms accepted by the configured engine, for
   example `\!`, `\kern`, `\mkern`, or `\hspace` with negative values.
4. Grouped/nested forms and a math run with content following the zero-width
   or reduced-width construct.
5. A mixed label with an earlier valid formula and a later overflowing run,
   preserving exact source whitespace, tabs, delimiters, and physical newlines.
6. Repeated conversion and a valid request after the failing/rejected case,
   preserving immutable cache reuse and request isolation.
7. Successful controls for a fraction, radical, indices, matrix, empty formula,
   safe spacing, and ordinary multiline text/math composition.

For each fixture, assert the chosen supported behavior explicitly:

- **Success:** independently established ink extents are enclosed by the
  returned geometry/portable viewport and whole-label bounds; placement and
  following-run advance remain correct. Checking only positive/finite width,
  nonzero path count, or comparing two copies of the same nominal box is
  insufficient. Use known geometry/extents or an independent bounded oracle.
- **Fallback:** the complete original source is exactly equal, with no earlier
  successful run geometry or silently dropped content returned to consumers.

Keep focused coverage in the existing adapter/SVG/metrics tests where possible.
Register any new test file in the explicitly enumerated `npm test` command.

## 3. Verify built browser assets and standalone SVG

Run the existing `scripts/checkLabelAssets.mjs` against a fresh production
build in an environment that permits localhost and Chrome/Chromium. Use an
already available external Playwright installation; do not add a project
browser-testing dependency just to run this check.

The documented command for this checkout is:

```bash
PATH=/opt/homebrew/bin:$PATH \
STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
STZ_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
STZ_SMOKE_ARTIFACT_DIR=/private/tmp/stz-label-smoke \
node scripts/checkLabelAssets.mjs
```

Use the actual available module/executable paths if these differ, and record
the exact command. Follow the execution environment's approval rules for
local-server/browser access; do not weaken browser security or network checks.

Preserve the existing assertions for application mounting under
`/stratified-tikz/`, lazy initialization, same-origin-only requests, successful
additional font-data loading, complete-source fallback, and standalone paint.

Extend this smoke only as needed to cover the chosen overflowing-ink policy:

- accepted overflow fixtures must retain their complete ink when serialized
  and loaded as standalone SVG images without application CSS; use geometry
  and raster evidence that would detect clipping, not merely a nonempty image;
- rejected fixtures must return complete-source fallback through the browser
  adapter, followed by a successful ordinary formula conversion.

The existing red/blue pixel-count check establishes paint presence, not full
ink containment. Static manifest inspection remains useful supplementary
evidence, but does not replace browser requests or raster verification.

If execution is still blocked, report the exact failure, attempted command,
and unverified assertions. Keep browser acceptance explicitly incomplete;
finish the code/test work that can run, but do not claim Phase 31B complete or
ready to commit solely from static evidence.

## Scope and preservation requirements

Limit changes to the Phase 31B adapter, its tests, necessary smoke assertions,
and directly related documentation.

Do not implement Phase 31C canvas/React/picking integration, Phase 31D path
label integration, or Phase 31E full-diagram export waiting. Do not change
diagram schema/version, persisted labels, coordinate placement, undo/history,
TikZ source generation, or existing point/free/path label rendering.

Keep existing parser, failure handling, isolation, limits, retry, local assets,
and immutable-cache regressions passing. If the supported-input or geometry
configuration identity changes, update the appropriate cache identity rather
than reusing incompatible results. Avoid unrelated UI or formatting cleanup.

## Documentation

Update `docs/LABEL_ADAPTER.md` to describe the selected ink/advance policy,
supported or rejected constructs, portable bounds, and actual verification
status. Correct the current claim that nominal viewBox extents necessarily
give actual visible bounds. Reconcile the introductory completion claim with
the remaining code/browser gates.

Keep the Phase 31 status in `docs/PREVIEW_UI.md` and `docs/ROADMAP.md` consistent
where needed. State that production canvas integration remains deferred.
Do not replace an unavailable browser result with a passing static result.

## Verification

Run focused checks:

```bash
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
  src/rendering/labels/labelService.ts \
  src/rendering/labels/mathjaxConfig.ts \
  src/rendering/labels/mathjaxEngine.ts \
  src/rendering/labels/mathjaxRuntime.ts

PATH=/opt/homebrew/bin:$PATH node --check scripts/prepareMathjaxAssets.mjs
PATH=/opt/homebrew/bin:$PATH node --check scripts/checkLabelAssets.mjs

git diff --check
```

Lint any additional changed production modules too. Run the browser smoke
above after the successful build. Record exact commands, exit status, test
counts, and browser artifacts. Report Vite's non-failing large-chunk warnings
and unrelated lint debt separately; do not broaden this fix to remove them.

## Acceptance criteria

Phase 31B can be called complete only when:

- each reported overflow case returns correct portable ink/layout bounds or
  exact complete-source fallback;
- retained success geometry is not clipped and advance/baseline composition
  remains correct;
- no partial-label success, hidden geometry deletion, guessed bounds, or
  overflow-only workaround is used;
- real-adapter regressions and supported success controls pass;
- all required test/build/lint/syntax/diff checks pass;
- the built browser smoke and applicable standalone raster checks pass, with
  observed evidence under the configured base path;
- documentation accurately states support, metrics, and verification status;
- no Critical or Medium issue remains and later-phase integration is deferred.

## Report after implementation

Report:

- files changed and the reproduced root cause;
- whether each construct is supported accurately or rejected, and why;
- how ink bounds, advance width, viewport offsets, and baseline placement are
  distinguished, or where complete-source rejection is enforced;
- the real-engine fixture matrix and exact-source fallback assertions;
- preservation of supported formulas, immutable caches, limits, and isolation;
- any transient adapter contract/configuration identity changes;
- focused tests, full suite, build, targeted lint, syntax checks, and diff-check
  commands/results;
- browser command, base-path/font request evidence, standalone raster evidence,
  and artifact paths, or the exact reason these checks remain unavailable;
- documentation changes and any remaining limitations;
- whether Phase 31B meets every acceptance gate, without claiming Phase 31C
  integration is implemented.
