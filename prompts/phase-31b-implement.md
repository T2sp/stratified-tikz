# Phase 31B Implementation Prompt: MathJax SVG conversion, isolated state, metrics, and cache

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Required verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Run repository-wide lint only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Report existing lint debt separately; do not turn this subphase into unrelated
cleanup. Run any additional focused checks required below. Never report an
unavailable check as passed.

## Project context

You are working on StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

This prompt series was prepared from public `main` at commit
`1a49d02a7ade18ecf08c4b4f1e22414e740970bb`, following Phase 30.
Inspect the current checkout before making changes; named files are starting
points, not an exhaustive change list. Preserve later compatible work.

Phase 31 consists of these ordered subphases:

| Subphase | Responsibility |
| --- | --- |
| 31A | Label input grammar and exact-source fallback contract |
| 31B | MathJax-to-SVG adapter, metrics, isolated conversion, and cache |
| 31C | Free-label rendering, asynchronous lifecycle, placement, and picking |
| 31D | Path inline-node labels through the shared renderer |
| 31E | Settled-label SVG export and standalone SVG fidelity |
| 31F | Combined regression coverage, documentation, and completion audit |

Implement or review only the subphase named in this file. Later subphases are
not acceptance requirements for earlier ones. Every subphase must leave the
existing application usable and its own verification passing.

Preserve these project conventions and existing behaviors:

- strict TypeScript; avoid `any`;
- an n-stratum means codimension n, not geometric dimension;
- separate model, geometry, rendering, TikZ generation, and UI;
- small, testable helpers and behavior-level tests;
- the SVG Preview editing canvas, 2D/3D projection, pan, zoom, and work planes;
- layer filtering, visibility, locking, selection, and existing edit gestures;
- coordinate anchors/references and symbolic coordinates;
- save/load, existing history semantics, and Undo/Redo;
- human-readable TikZ, 4-space indentation, and blank-line-free inline-math output;
- transparent/white SVG export and removal of editor-only overlays.

## Phase 31 shared contract

Only user-authored visible diagram labels are typeset: free `TextLabel.text`
and path inline-node `text`. Coordinate names, axes, handles, toolbar copy,
and saved-path `pathLabel` identifiers are not TeX labels for this feature.
Do not add new visual uses of previously undisplayed stratum label metadata.

Keep the original input authoritative in the model and editor. Do not add
math delimiters, trim the saved string, change the JSON schema, or rewrite
TikZ source. Existing TikZ export-mode formatting remains unchanged. Generated
SVG, parsed runs, errors, metrics, caches, and pending requests are derived
runtime state and must never enter `Diagram` or undo history.

The bounded preview language supports ordinary Unicode text mixed with
`$...$`, `\(...\)`, `$$...$$`, and `\[...\]` math runs. The exact scanner and
escaped-literal rules are defined in Phase 31A. MathJax is a math typesetter,
not a full LaTeX engine. Arbitrary packages, document preambles, external
style-file macros, and unsupported text-mode commands are outside this phase;
an unsupported label falls back to its complete original source.

For an invalid delimiter, unsupported construct, undefined math command,
TeX parse error, output error, resource failure, or bounded-work failure:

```text
failed label -> latest original input, displayed literally in full
```

Never show an error SVG, a replacement message, a partly typeset label, or a
previous successful formula in place of a failed current label. Preserve
delimiters, backslashes, leading/trailing/repeated spaces, tabs, and physical
newlines in literal fallback. Insert original input as text, never HTML.
The failure of one label must not suppress other labels or diagram geometry.
Pending labels also show their latest source until their own result is ready.

Successful output uses SVG geometry plus ordinary SVG text for text runs;
avoid `foreignObject` and rasterized formulas. Keep geometry self-contained,
colors explicit, and dimensions finite. MathJax-generated markup is not a
license to insert arbitrary user HTML or SVG.

Each label's rendering, bounds, and picking must describe the same input
revision. No stale completion may resurrect a deleted label or overwrite a
newer input, document, selection, or style state. Moving the camera or label
must not recompile unchanged TeX.

## Prerequisite and goal

Phase 31A is complete and its parser, literal-source representation, and tests
are the contract for this work. Read them before selecting a MathJax API.

Add a typed, independently testable adapter that converts a complete parsed
label into reusable SVG/text runs with metrics, or one complete raw-source
fallback. The adapter must distinguish a successful Promise from successful
typesetting. A label containing any failed math run is wholly unsuccessful.

This subphase supplies the engine for Phase 31C. It does not switch the
production canvas to the new renderer or change current SVG export behavior.

## Required reading before implementation

Inspect at least:

- `AGENTS.md` and `prompts/phase-31a-implement.md`;
- the Phase 31A implementation, tests, and language documentation;
- `src/rendering/SvgDiagram.tsx` and `src/rendering/svgHitTesting.ts`;
- `src/ui/svgPreviewExport.ts`, especially removal of class/data attributes;
- `src/model/types.ts` and existing label style/scale resolution;
- `package.json`, `package-lock.json`, and `vite.config.ts`;
- the existing rendering test conventions and explicit `npm test` list.

Consult official documentation for the exact installed MathJax version:

- [Conversion APIs](https://docs.mathjax.org/en/latest/web/convert.html);
- [Error detection](https://docs.mathjax.org/en/latest/web/errors.html);
- [SVG options](https://docs.mathjax.org/en/latest/options/output/svg.html);
- [Local hosting and fonts](https://docs.mathjax.org/en/latest/web/hosting.html);
- [Vite asset handling](https://vite.dev/guide/assets.html).

These are implementation references, not permission to expand the grammar.
Document any version-specific API difference instead of mixing v3 and v4
configuration examples.

## Dependency and local assets

MathJax is justified here because this feature needs mathematical layout and
SVG geometry. Add the smallest suitable supported MathJax package set at exact
versions, update the lockfile, and record the selected versions and rationale.
Do not add a second math renderer or a full TeX distribution.

Load the engine lazily when mathematical content is first requested. Plain
text and parser-rejected labels must not require MathJax initialization.
Use one shared initialization lifecycle per adapter service, without loading
the same scripts repeatedly for concurrent requests.

Provide a reproducible Vite build/development asset strategy for every needed
engine component, font-data file, and optional local font resource. Resolve
URLs against the configured application base; the reference checkout uses
`/stratified-tikz/`. An unqualified `/mathjax/...` URL is insufficient there.
Do not assume a dynamic runtime URL is automatically included in Vite's asset
graph. If copying assets is needed, make the copy step deterministic and part
of the normal development/build workflow, retaining required license files.

Require same-origin runtime assets and no implicit CDN fallback. Verify the
built application under its base path, including a formula that causes any
chosen engine's additional font data to load. An initial script succeeding
does not establish that later resource requests work.

## Adapter contract

Use small modules under an appropriate rendering subdirectory, for example
`src/rendering/labels/`. Follow Phase 31A type names rather than introducing
an incompatible second result model.

The public operation accepts the exact original source and explicit immutable
render settings. It returns a Promise of one immutable discriminated result:

- success: original source, ordered text/math runs, normalized placement and
  metrics, and a version/configuration identity;
- fallback: original source unchanged and an internal failure category.

Do not expose mutable MathJax DOM nodes, engine instances, or live CSS rules as
cached result values. Use immutable typed SVG geometry/attributes or validated
serialized SVG plus immutable layout data. Consumers must be able to reuse a
result without taking nodes away from another label.

Preserve Phase 31A run order, explicit newlines, literal text, and math display
flags. Pass only each math run's content to the math conversion API, without
its delimiters. Display delimiters control mathematical style according to
31A; they must not silently add document-level margins or line breaks.
Only ordinary-text newlines split visual label lines. Preserve physical
newlines within a math body and let MathJax interpret that complete run;
fallback displays every original newline according to the literal policy.

Return success only after all runs, resources, validation, and metrics have
completed. A later failing run discards all earlier successful run geometry.
Never trim or rebuild the fallback from token content. It must be the exact
original source, including the delimiters around every run.

Keep error details for tests/development diagnostics only. The visible fallback
is not an error explanation. Do not persist requests, diagnostics, results,
metrics, or cache entries in the diagram, editor history, or saved JSON.

## Error detection and exact-source fallback

Use the chosen version's asynchronous SVG conversion API and error hooks.
Observe TeX `formatError`, document `compileError`, and `typesetError` behavior
where available, keeping error capture scoped to the active request.
Disable `noundefined` and `noerrors` behavior that can disguise an error as
successful output. An undefined macro is a label failure, not red text.

Do not rely solely on thrown exceptions. Inspect the generated intermediate
tree/output for `merror` or the chosen version's equivalent error markers
before removing metadata. A resolved Promise containing error geometry must
return the original complete label.

Distinguish parser failure, unsupported input, TeX failure, output failure,
resource failure, invalid geometry/metrics, and work-limit failure internally.
Handle loader rejection, synchronous exceptions, asynchronous rejection,
invalid output shape, and invalid numeric data through the same literal-source
fallback contract. An error in one label must not poison the next request.

Restrict TeX extensions to an explicit supported set. Disable arbitrary
`\require`, autoloaded unapproved extensions, external resources, URL/HTML
commands, and document-level configuration. Unsupported commands fall back;
do not attempt partial TeX substitution or invoke an external LaTeX process.

## Engine isolation and bounded work

Reuse loaded code/font resources without reusing uncontrolled mutable TeX
state. Each whole-label conversion starts from the documented configuration;
user macro definitions, tags, references, and numbering state must not leak
into other labels or depend on their conversion order.

Use fresh or completely reset isolated parser/document state, with supported
state-changing constructs deliberately enabled or rejected. A reset that only
clears equation counters is insufficient if macro definitions remain. If
requests share a mutable engine, serialize the full reset/convert/inspect
transaction. Capture failures per transaction, not in one global error flag.

Reuse 31A's source-length/run-count limits and document finite limits for TeX
expansion, generated node/path count, pending requests, and cache storage.
Apply parser limits before initializing MathJax. Use engine limits to bound
synchronous expansion; a Promise timeout alone cannot interrupt JavaScript.

Set a finite loader/conversion settlement policy. On timeout, settle affected
requests as fallback, detach them from the active service generation, and
ensure a late result cannot populate the replacement generation's cache.
Do not leave a permanently pending initialization blocking all future labels.
If a worker is required by the chosen design, it must have bounded lifetime
and the same local asset/version configuration as the main application.

## Metrics and run composition

Define one normalized coordinate system with a stated baseline. Return finite
width, ascent, descent, and run placement sufficient for rendering and picking
to share the same bounds. Heights are not guessed from TeX source length.

Use the actual SVG viewBox/output metrics to account for fractions, radicals,
subscripts, superscripts, matrices, negative origins, and descenders. Convert
em/ex/user units explicitly and apply label scaling once. Reject missing,
non-finite, or nonsensical metrics; valid empty runs may have zero width.

Text runs use the specified preview font and the same whitespace/tab/newline
policy as 31A. Provide a typed measurement boundary that can use actual browser
text metrics, with deterministic providers for unit tests. Never substitute
HTML layout or silently remove spaces to obtain simpler bounds.

Identify every font metric input, including family, size or normalization
scale, weight/style where relevant, and the font-readiness generation. A late
font load must allow derived text metrics to be recomputed. Arrange text and
math on shared line baselines and combine line bounds without clipping tall
math. Phase 31C will supply the actual canvas placement and picking consumers.

## Self-contained, narrow SVG representation

Prefer `fontCache: 'none'` for initial correctness. A local font cache is
acceptable only if references remain inside each result and every insertion
receives collision-safe IDs/references. Never use a document-global glyph
cache. Identical cached output must be safe to render more than once.

Resolve required MathJax stylesheet effects into approved presentation
attributes/inline values before discarding class or data attributes. Handle
default `currentColor` explicitly through a controlled foreground-paint input
or a safe paint-resolution step. Preserve formula-internal allowed colors
without inheriting accidental page CSS. A color change need not reparse TeX
if the adapter separates neutral geometry from final paint resolution.

Validate through a narrow allowlist of SVG elements and attributes required
by the enabled output. Reject script, events, foreignObject, arbitrary HTML,
external hrefs, CSS imports, and external URL-valued paint/resource references.
Any retained fragment reference must resolve within the same result. Reject
unsupported output as a whole label; do not silently delete visible geometry.
Keep ordinary text and fallback strings as text data, never interpolated markup.

Test sanitized formula output with class/data attributes removed and no page
stylesheet. Actual full-diagram export synchronization belongs to Phase 31E;
this subphase establishes the independently portable formula representation.

## Cache behavior

Coalesce concurrent identical requests and retain only bounded completed
results. Key conversions by exact source, engine/package/configuration
identity, enabled extensions, and every setting that changes geometry or
metrics. Include display mode/run structure if not implied by the source.
Separate font-dependent layout or paint caches where that avoids unnecessary
TeX conversion. Do not include position, camera, selection, or pan/zoom.

Use a documented entry/byte bound and deterministic eviction policy. Bound
in-flight work as well as completed entries. Cache deterministic syntax
failures if useful, but do not permanently negative-cache transient loading,
font, timeout, or service initialization failures. Provide a controlled retry
or invalidation policy that avoids a retry loop on every React render.

Expose enough service lifecycle and result identity for Phase 31C to ignore
obsolete consumers. Do not implement React subscriptions or editor-generation
handling here. Shared initialization is not permission for permanent poisoned
state or for cross-label macro leakage.

## Tests

Add focused behavior tests, register every new file in `npm test`, and test
the actual adapter with the installed MathJax engine. Mocks alone, snapshots
alone, source-text searches, or direct engine calls bypassing the adapter are
insufficient. Use deterministic fake loading only for failure/lifecycle cases.

Cover at least:

1. Ordinary Unicode text and parser errors avoid loading the engine.
2. All four delimiter styles reach the right inline/display conversion mode.
3. Mixed text, several formulas, spaces, tabs, and newlines preserve run order.
4. Real fractions, radicals, indices, and matrices produce finite SVG metrics;
   physical newlines inside math/matrix bodies stay within the same math run.
5. Undefined macros and malformed TeX produce exact complete-source fallback.
6. A valid first math run and invalid later run never yield partial success.
7. A resolved error node, compile hook error, output hook error, and rejection
   all fail through the adapter; fake hooks supplement real-engine fixtures.
8. Isolated conversions in both orders cannot share user macro/tag state.
9. Concurrent identical requests initialize/convert once; distinct requests
   cannot contaminate each other's errors or result identity.
10. Loader/font failure, timeout, late completion, controlled retry, eviction,
    and configured work limits leave later valid requests usable.
11. Different configuration/font inputs invalidate the appropriate cache;
    geometry-only movement and paint-only changes avoid needless compilation.
12. Reused results remain immutable, safe for multiple placements, and free
    from unresolved external references or duplicate-ID assumptions.
13. Unknown markup/URLs are rejected; literal `<`, `>`, `&`, and quotes stay
    text; required stroke/paint behavior survives stripping class/data fields.
14. Built assets resolve under `/stratified-tikz/` with external network access
    disabled; exercise additional font-data loading for the chosen version.

Run focused tests, required Environment checks, and lint on changed production
modules if available. Record the built-asset smoke test method and results.

## Documentation and implementation report

Update the Phase 31 label documentation with package versions, supported
extensions, local asset paths, units/baselines, limits, retry policy, and cache
invalidation. Mark the adapter complete without claiming the canvas feature
is active. Keep the limitations consistent with Phase 31A.

Report changed modules, public result types, dependency/build changes, exact
fallback behavior, real-engine tests, commands/results, and any unavailable
browser check. Identify the specific interfaces handed to Phase 31C. Do not
implement free/path label UI, picking integration, or export waiting early.
