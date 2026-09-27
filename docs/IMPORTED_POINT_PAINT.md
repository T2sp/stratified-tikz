# Phase 32B imported point paint

This describes the implemented bounded preview grammar and export contract.
It does not claim Phase 32C geometric shapes or Phase 32D configurable layout.
Browser acceptance remains a separate parent-runner gate.

## Saved values and effective defaults

Saved format version 2 materializes a point's explicit `paint` object:
`text: { color, opacity }`, `fill: { enabled, color, opacity }`, and
`stroke: { enabled, color, opacity, width, lineStyle, dashPattern?, dashPhase,
lineCap, lineJoin }`. `PointStyle.opacity` is an overall multiplier applied once
to each paint operation; it is not an SVG group opacity. Explicit `paint` values
are authoritative. Legacy `color`/`fill` fields remain available for old input
compatibility but do not override explicit paint.

Version 2 also accepts optional `PointStyle.importedPaint` editing metadata:
`{ referenceId, baseline: PointPaint, overriddenFields: PointPaintField[] }`.
The baseline records the importer's paint snapshot; the field list records
explicit local intent independently of value equality. Fields identify one
property (`fill.color`, `text.opacity`, `stroke.width`, `stroke.dashPattern`,
and so on); `opacity` identifies the overall multiplier. Both the snapshot and
field list are validated and deep-cloned, and the reference must match the
point or preset's active imported reference. Invalid explicit metadata is
rejected. Replacing/removing that reference clears incompatible metadata.

The quick bar's **Clear TikZ style** detaches the preset reference, external
reference and `importedPaint` together, for a single point or compatible multiple
points. It clones the retained paint; all explicit channel values, overall
opacity, body, geometry and unrelated records survive. The result is valid before
saving, including commit/undo/redo. Ordinary paint edits only detach the preset
association and retain the active external reference and its editing metadata.

New imported point presets begin with an empty override list. Accepted local
edits add their affected fields, including equal-valued edits and coupled
controls' intentionally edited channels. Editing unknown fill away from black
and back to black therefore remains an authoritative local black override.
Changing fill does not claim unresolved text, border, or opacity. Enablement
alone can emit bare `fill`/`draw`, preserving unknown external color. Preset
reapplication restores the preset's own values and overrides, resetting edits
made only on the point. Clipboard, duplication, history and JSON preserve the
metadata without sharing its mutable paint snapshot or field array.

Old version-1/version-2 diagrams and user presets remain readable without this
metadata. Their saved explicit values remain authoritative; they are not
automatically regenerated on another import. Export and the first new edit
preserve distinguishable differences from the effective imported baseline.
That first edit also materializes metadata for subsequent operations. An old
equal-valued local edit is indistinguishable from an untouched fallback because
old files never recorded the distinction; it cannot be reconstructed reliably.
Absent metadata therefore does not automatically claim every legacy fallback.

| Input | Effective appearance |
| --- | --- |
| Legacy point or user preset without paint | Black text; old color for stroke and filled background; hollow means white background; enabled stroke at 0.4pt; old opacity applies to each paint |
| Newly created point | Black filled circle, black text, black 0.4pt solid border, alphas 1; size 3 |
| Imported point with omitted fields | The same explicit application defaults, then supported imported options in source order |
| Imported point with local edits | Saved local paint values override supported external paint after applying the external style |

For every row, `size / 2` retains its legacy inner-separation meaning. Square
and triangle retain the existing regular-polygon identities. Neither hollow nor
alpha zero means disabled paint. `fill=none` is genuinely unfilled;
`draw=none` disables the border. Zero-alpha enabled paint remains represented
explicitly. Empty-node dimensions, source text and coordinates are unchanged.

A partial imported style such as `text=red` therefore previews a black filled
circle with red text. Both TikZ output modes write `circle` and `inner sep=1.5pt`
before the external key and explicit effective paint after it. They do not rely
on PGF's unfilled-rectangle defaults. A deferred external shape option still
occurs after the application's baseline shape and remains effective in TikZ;
its preview limitation is diagnosed.

## Declarations and bounded expansion

The scanner accepts a complete sequence of top-level literal declarations in file order:

```tex
\tikzstyle{base}=[fill=blue,draw=green]
\tikzset{ns/.cd, point/.style={base,text=red}}
\definecolor{MyBlue}{HTML}{1248AB}
```

Braces, brackets and parentheses protect embedded commas. TeX comments are
masked for parsing while the exact source is retained. Declaration-level `.cd`
prefixes relative style names; leading `/` paths retain their absolute meaning.
Style bodies use the invocation's active key directory, which is `/tikz` for
normal node options. A declaration under `ns/` does not enter that directory
when applied. Thus `ns/outer/.style={base}` resolves `base` as `/tikz/base`,
including when another style invokes `ns/outer`. To reference the namespaced
definition explicitly, write `ns/base` or `/tikz/ns/base`.

Internal canonical identity makes `base` and `/tikz/base` aliases. It is used
before ordered declaration deduplication, during lookup, and for cycle detection.
The last definition wins even for repeated alias overwrites; its original key
spelling and raw options are retained. `/other/base` and relative `tikz/base`
remain distinct from `/tikz/base`. Missing root references are diagnosed even
if a same-named definition exists in the declaring style's directory.

All applicable imported sources share one ordered resolution context. The
`externalTikzStyleSources` array is the load order, independent of the order of
points or saved references. Later canonical definitions win for the directly
invoked key as well as nested references: selecting an old reference ID does
not select its stale root body. Raw source declarations supply this context;
older saved references without raw-source definitions use their saved options.
The exact selected reference ID, source ID, key spelling, raw source and raw
options remain unchanged. A second file can use styles and named colors from
the first, without a false missing-reference diagnostic.

New preset construction, reference diagnostics, point baseline reconstruction,
unresolved-field analysis and both TikZ modes use that context. When another
source is imported, only point/preset paint carrying matching importer snapshot
metadata follows new definitions. Unoverridden channels receive the new
effective baseline; overridden channels and distinguishable changes from the
old snapshot keep their values. An earlier unknown fallback becoming known
does not become a local override. Untracked legacy styles and authored values
are preserved. When arbitrary runtime execution makes the baseline uncertain,
snapshot differences cannot establish authorship: only recorded local fields
are authoritative, and refresh preserves the saved fallback and intent. Truly
missing styles remain diagnosed and unresolved.

When a later full definition restores supported resolution, refresh checks the
previous context as well. Previously uncertain snapshot differences never become
new overrides: only recorded fields survive onto the supported baseline. An
untracked legacy fallback receives a fresh supported snapshot on that recovery.
This replaces uncertain paint and unrecorded overall opacity while retaining
nonpaint shape/size. A recorded overall-opacity edit remains authoritative.

Known literal references expand at their exact option position. Runtime `.cd`
inside a style body is explicitly unsupported: it produces a diagnostic and
marks paint unresolved. Subsequent relative options, including those in nested
expansion or the calling option list, remain conservatively unresolved. Explicit
absolute supported options such as `/tikz/text=red` can still resolve their own
fields when the bounded scan establishes only directory uncertainty. An absolute
path does not establish handler or color-binding certainty after arbitrary code.
This does not pretend to execute or approximate runtime directory changes.
Cycles and excessive depth/work produce diagnostics and terminate preview work.
No `.code`, macros, package/preamble execution, parameterized styles, or arbitrary
PGF/TeX programs are evaluated.

Unsupported execution-capable runtime options, including `/utils/exec`, unknown
keys/handlers and invocation of a retained code mutation, lose color-binding and
option-handler certainty for the entire current resolution. The resolver marks
every paint field unresolved and records `executionUncertain` in its transient
preview result. Later `text`, `fill`, `draw`, `color`, mixtures, opacity and line
options cannot clear that state, even with absolute `/tikz/...` paths. No payload
is interpreted, and the possible effects are not restricted to a color named
inside the code. Known earlier values remain deterministic preview fallbacks;
later literal-looking values are not applied using potentially stale bindings.
The state propagates through nested styles, canonical aliases and the return to
an outer option list. An independent resolution without those executable effects
keeps normal literal behavior. Ordinary invalid values for a known paint key
still invalidate its own fields and allow justified later recovery.

Assigned retained keys are checked too; a literal `font=...` cannot hide a
stored code handler. TeX-bearing deferred layout values, nonliteral runtime
directories and unscanned tails of retained mutation lists also lose execution
certainty. The scanner does not interpret their payloads.
Runtime handler suffixes such as `shape aspect/.style` and nonliteral key tokens
are checked before deferred-layout classification. A layout-like prefix cannot
hide a handler definition or restore later paint certainty.

Recognizable unsupported declarations targeting a literal key (including
`.append style`, `.prefix style` and `\tikzstyle{key}+=[...]`) are retained as
ordered invalidations.
Supported definitions and these events replay in declaration and source load
order, with the same canonical aliases and declaration-level `.cd` rules.
An invalidation gives that key an explicit unresolved definition state; it does
not merely delete the body. The last supported body can supply deterministic
preview values, but every paint field becomes uncertain and the reference
displays a diagnostic. Nested invocation propagates the uncertainty; a subsequent
supported option such as `text=green` restores only its own fields when the
mutation is demonstrably paint-only and the invocation directory is still known.
Retained code handlers also lose binding/handler certainty, irrespective of any
last-known supported body. Recognizable mutation bodies and their
nested literal dependencies also carry runtime `/.cd` uncertainty into the
calling option list. Later relative keys then remain unresolved, because they
may name handlers in another directory. Explicit supported `/tikz/...` options
still resolve their own fields after a fully scanned directory-only change;
paint-only mutations do not invent directory or execution uncertainty. Unrelated
keys, including a distinct `/other/myPoint`, keep their existing resolution.
A later full supported definition restores known resolution for that key.

This state is reconstructed from preserved raw sources after reload. Stale saved
reference options cannot replace an invalidated definition. The selected ID and
raw options remain unchanged. Dependency comments retain defining, mutating and
required nested/color sources in source load order, even when a later imported
file has no new reference for the mutated key. Recognizable style-list mutation
arguments are scanned for literal style/color dependencies, directory changes
and executable effects, never applied as paint. An executable option in an
appended/prefixed list has the same sticky effect as one in a supported body.
This separate scan is bounded to 4,096 options / 16 levels. Bound exhaustion or
cycles in either traversal leave effects unvisited and therefore lose binding/
handler certainty as well as any affected directory certainty; later absolute
options cannot restore paint. This narrows the earlier bound-failure recovery
rule, while fully scanned directory-only recovery remains supported. A bound
failure, arbitrary execution or an unknown runtime directory retains all imported
source hints. Declaration-level `.cd` still only qualifies declaration names.
Arbitrary code handlers are not interpreted.
After directory uncertainty, the scan checks possible retained definitions in
other namespaces for executable effects without applying their paint or choosing
a directory. Directory state carries across retained lists. If a mutation can
change it, fallback and retained lists are conservatively rescanned with unknown
directory because a prefix may run earlier. Candidate visits and rescans share
the same 4,096-step budget; directory-only controls still permit absolute recovery.
Mutation-only files without any
supported importable definition retain the existing import behavior; adding that
UI workflow is outside this correction. Importer snapshots refresh through the
same context without losing explicit local intent, including edits returning to
the preview fallback. Both export modes keep defaults before the external key
and omit untouched uncertain overrides after it. No mutation handler is executed.

The execution boundary is a closed cursor grammar, not a search for command
names. Outside consumed declaration arguments, only whitespace, comments,
`\tikzset`, `\tikzstyle` and `\definecolor` are supported. Balanced braces
inside option bodies/color arguments are not local execution groups. Within a
`\tikzset` block, literal declarations, declaration-level `.cd`, and the
previously described literal-target mutation invalidations are recognized;
arbitrary key invocations are outside this boundary. The passive mutation handler
allowlist is `style`, `append style`, `prefix style`, `add style`, `style args`,
`style 2 args`, `code`, `append code`, `prefix code`, `code 2 args`, `initial`
and `default`. `add style` and `style args` require exactly two complete braced
arguments and no trailing tokens. Other handlers, including `try`, `retry` and
`code args`, are rejected. A single `/.expanded` suffix is retained only for
literal arguments without expansion-capable tokens; other chains are rejected.
This classifies declaration syntax without running a handler. Declarations cannot
replace supported root paint primitives, `every ...`/`execute at ...` hooks,
dot-prefixed hook path segments, or the PGF/handler/error namespaces. Such changes
can affect other keys or the declaration grammar itself. Targets with key-list
commas are rejected. Ordinary custom namespaces, including `/other/text`, retain
their separate identities. Unknown commands (including
package wrappers, macro definitions/invocations and conditionals), local groups,
nonliteral declaration names/directories, nonliteral color model/value expansion,
and malformed command arguments reject the entire initial import. No attempt is
made to execute a condition, recognize an unused macro, or infer group lifetime.
The diagnostic identifies the unsupported context and asks for top-level literal
declarations. Literal unsupported color models such as CMYK retain the existing
per-binding null/diagnostic behavior.

Limits are: 1,000,000 source characters, 512 declaration events (style definitions,
recognized mutations and color definitions combined), 100,000 characters per
option body, 4,096 expanded option steps, 16 reference levels, and at most 64
preview diagnostics per resolved style. Exactly 512 declaration events are
accepted. The 513th event rejects the whole source, including within one
`\tikzset` block. Rejected parse results contain no styles, declarations,
colors or raw-option metadata; they never retain a certain truncated prefix.
Initial import returns the identical input diagram, null source and no references
or presets. Existing accepted diagram values therefore remain unaffected.

Already-saved raw sources are retained exactly, including CRLF, unsupported TeX,
key spelling and load hints. Reconstructing a rejected source sets source-wide
uncertainty: all imported paint, aliases, color bindings, dependencies and earlier
source references become unresolved. Neither saved options, legacy snapshots,
later declarations nor absolute source options restore certainty, since unknown
execution can redefine any binding or key handler. Every source hint is retained.
JSON loading appends reconstructed limitations to reference diagnostics without
dropping prior diagnostics; subsequent save/load preserves them. Preview values
are explicitly fallbacks; export suppresses untouched paint after the external
key in both modes. Ordinary supported imports and their ordered per-key mutation
or runtime-directory recovery retain their previous behavior.

Runtime execution uncertainty is distinct from that source-wide rejection:
the literal top-level `.style` declaration remains accepted and its exact body
is retained; uncertainty arises when resolving an invocation. Both states are
reconstructed from raw sources or legacy saved reference options on reload.
`executionUncertain` is derived state, never a saved authority that can declare
an old snapshot safe. Reference diagnostics retain previous messages and add the
reconstructed limitations.

Matching `importedPaint` intent still preserves explicit local edits, including
an accepted value equal to its preview fallback. With either source-wide or
runtime execution uncertainty, differences from a saved snapshot or legacy
preview do not by themselves prove authorship. Export, refresh and the first
edit do not promote those differences to local overrides. A first edit without
metadata snapshots the saved fallback and claims only its actual edited fields;
existing metadata retains already recorded intent and adds the accepted fields.
Preset reapplication, serialization and Undo/Redo preserve this distinction.
Historical edits without recorded intent are inherently ambiguous under either
execution-uncertainty policy. Untouched uncertain channels stay under external
control even when another channel is explicitly edited.

`ExternalTikzStyleSource.rawSource` preserves the complete imported source.
`ImportedTikzStyleReference.rawOptions` preserves each original option body;
`options` is the legacy normalized display form. `previewDiagnostics` persists
visible limitations. External source/load hint/style key semantics are retained:
TikZ references the external key and includes load instructions, without running
or copying the file's arbitrary definitions into generated code.
Dependency tracking includes the selected reference's source and the known
defining sources of effective root/nested styles and color operands. Load hints
are deduplicated in source load order, preserving custom hints and redefinition
precedence. Selecting `outer` in `outer.sty` when it invokes `base` in
`base.sty` therefore includes both comments, with `base.sty` first. The hints
are comments only; unknown external dependencies are not fabricated or executed.

## Literal value grammar

| Category | Supported values |
| --- | --- |
| Numbers | Finite signed decimal literals such as `1`, `.35`, `-0.5`; no exponent notation, expressions, numeric macros or hexadecimal coercion |
| Alpha | `opacity`, `draw opacity`, `fill opacity`, `text opacity`; values in `[0,1]` |
| Paint | Bare or assigned `draw` and `fill`; `draw=none`, `fill=none`; `color=<color>`, `text=<color>`, or a bare named/mixed color |
| Dimensions | Decimal with `pt`, `mm`, `cm`, `in`, `bp`, or no unit (pt); 72.27 TeX pt/in and 72 bp/in |
| Width | Strictly positive `line width`; ultra thin=.1, very thin=.2, thin=.4, semithick=.6, thick=.8, very thick=1.2, ultra thick=1.6pt |
| Lines | `solid`, `dashed`, `dotted`, `densely dotted`; literal alternating `dash pattern=on <dimension> off <dimension> ...`; signed `dash phase` |
| Caps and joins | `line cap`/`cap=butt|round|rect`; `line join`/`join=miter|round|bevel` |
| Existing layout foundation | `circle`/`shape=circle`; strictly positive literal `inner sep` maps to legacy size; other shape/layout options remain diagnosed and retained |

Bare `draw`/`fill` enables the corresponding paint without changing its color.
Bare `color` or `text` has no supported default value and is diagnosed. Empty
`dash pattern` means solid. Explicit dash patterns have an even 2–32 entries,
nonnegative dimensions, and a positive total. A later named line style clears
a preceding explicit dash pattern. Dotted patterns use on=the border width,
off=2pt (dotted) or 1pt (densely dotted); dashed uses 3pt on/off. These names do
not implicitly select round caps.

The common xcolor names are `black`, `white`, `gray`, `lightgray`, `darkgray`,
`red`, `green`, `blue`, `cyan`, `magenta`, `yellow`, `orange`, `violet`, `purple`,
`brown`, `lime`, `olive`, `pink`, `teal`. Names are case-sensitive. The literal
`\definecolor` subset supports `HTML` (six hex digits), `RGB` (three integers
0–255), `rgb` (three decimals 0–1), and `gray` (one decimal 0–1). Color names may
start with an ASCII letter followed by ASCII letters, digits, colon, underscore,
or hyphen. Other color models, package-specific names, and macros are diagnosed.

Color bindings have three states: undeclared, a supported literal, or a
recognized but unsupported declaration. The last state is an explicit unknown
binding (`null` in the reconstructed resolution context), blocking both an
earlier literal and the built-in table entry of that name. Thus unsupported
`\definecolor{red}{cmyk}{1,0,0,0}` never resolves successfully as built-in red.
Supported then unsupported becomes unknown; unsupported then supported takes
the later literal, within a file and across sources. Styles use the final
effective color environment when invoked after source loading, including
declarations textually after the style body. Binding state is reconstructed
from saved raw sources and stays local to that diagram; global built-ins and
unrelated names remain unchanged. CMYK is still unsupported.

Mixtures use `name!percentage[!name]` and may chain up to 16 mixtures; percentages
are 0–100, the omitted second color is white. Intermediate calculations retain
fractional channels and the final display color is rounded to 8-bit RGB.
Unknown colors are never silently accepted as black: the unresolved property
has a visible diagnostic and a deterministic preview fallback (the last
supported option for that property, otherwise the application default).
An unknown operand invalidates an entire mixture, including an explicitly
named second operand or an implicitly used `white`. Known operand dependencies
are retained even if another operand is unknown. An unsupported bare color or
mixture marks the three color channels unresolved without claiming unknown
enablement, opacity, or border dimensions.

Zero border width is diagnosed because PGF emits a device hairline while an SVG
zero-width stroke is invisible; use disabled stroke for an absent border.

Unsupported shape/layout options include rectangle, isosceles triangle, minimum
dimensions, negative/zero inner separation, contextual em/ex, anchors, text width,
and shape-specific parameters. They are retained without pretending that
rectangle is a square or that minimum size means inner separation.

## Option order and paint export

General `opacity` assigns both graphics alphas at that position in the option
sequence; it does not multiply earlier fill/draw alpha. Text inherits the final
fill alpha unless `text opacity` was specified. Explicit text opacity remains
independent even when general opacity occurs later. General `color` updates all
three colors; a later specific text/draw/fill color overrides only its target.
These rules agree with the [PGF transparency documentation](https://tikz.dev/tikz-transparency)
and the independent compiled fixture below.

The imported resolver stores final paint alphas and sets the application's
overall opacity to 1. Subsequent overall-opacity edits multiply each effective
paint exactly once. Both standalone and inline TikZ emit named xcolor
`\definecolor` entries, independent fill/draw/text colors and alphas, actual
`none`, border width, dash state, phase, cap and join. Local paint follows the
external key. For an unresolved supported paint property (for example
`fill=\customMacro`), export preserves the external property's effect instead
of replacing it with the preview fallback; changing that local paint property
then emits an explicit override. Unknown named styles/macros can affect any paint field. Their baseline paint is
written before the external key, and unchanged unresolved fields are not emitted
after it. Later known options recover only when binding/handler and relevant
directory assumptions still hold; explicit recorded local edits remain authoritative.
Such unresolved cases remain documented preview
limitations. Deferred geometry remains the external style's responsibility.
After arbitrary runtime execution, no later imported option resolves paint from
the stale environment. An explicit local
override remains after the external key even when it returns to the original
fallback value; an untouched unresolved field remains under external control.

## Independent reference and checks

[The retained PGF fixture](../tests/fixtures/point-paint-pgf/README.md) was compiled
with PGF 3.1.11a (2025-08-29), pdfTeX 1.40.29, TeX Live 2026. It retains the exact
`.tex`, actual PDF/PNG, compiler log, uncompressed PDF operators and observed
JSON. The ten rows distinguish option order, text opacity, general/specific
color, disabled fill/stroke, zero text alpha, and dotted/line-width order. Expected values in
`tests/model/pointPaintImport.test.ts` come from that independent artifact;
they are not generated by calling the resolver under test.

[The additional namespace fixture](../tests/fixtures/point-paint-pgf/namespaces/README.md)
retains eleven independently compiled PGF text observations for root shadowing,
qualified nested references, relative/absolute aliases in both directions,
repeated alias overwrites, and distinct absolute/relative directories. Its
separate missing-root compilation intentionally fails on unknown `/tikz/base`;
the actual diagnostic and exit status are retained as negative evidence. The
original ten-row opacity/color-order fixture is unchanged. Registered tests also
cover alias-aware cycles and depth/work bounds, real imported preset application,
explicit local edits, JSON reload/reference identity, both TikZ modes, and
preservation of unresolved external paint.

[The import-order fixture](../tests/fixtures/point-paint-pgf/import-order/README.md)
retains independent PGF evidence for source ordering, canonical root
redefinitions, unsupported CMYK meanings and post-style overrides. Registered
`pointPaintImportContext.test.ts` regressions exercise sequential imports,
prior-file named colors, raw identity and save/reload, old-reference winners,
dependency hints, later definitions, history/local-edit preservation, unknown
bindings and mixtures, and literal restoration. Export assertions inspect
options after the actual external key and resolve the generated named color
definitions against independent expected values.

[The unsupported-mutation comparison](../tests/fixtures/point-paint-pgf/unsupported-mutations/README.md)
retains the review's original failing source/PDF/operators and a focused PGF
3.1.11a compilation of corrected output in both modes. The external and corrected
nodes are blue; the old generated node was red. This proves preservation of the
external effect, while the bounded preview deliberately retains diagnosed red.


[The execution-boundary comparison](../tests/fixtures/point-paint-pgf/execution-boundary/README.md)
retains all four independent failing cases and corrected PGF 3.1.11a/pdfTeX
1.40.29 comparisons against the unchanged external sources. Initial imports
reject atomically. Saved/reloaded and preset-reapplied nodes in both export modes
retain external blue for the unused macro, false conditional and grouped color,
and external red for declaration overflow. Expected colors come from actual PDF
paint operators, independently of the application parser.

The same comparison directory contains a
[handler-execution follow-up](../tests/fixtures/point-paint-pgf/execution-boundary/handler-execution/README.md):
`run/.try` executes a stored code key at declaration time. The initial intermediate
fix classified arbitrary handlers as local mutations, incorrectly exporting blue
while PGF was red. The final boundary rejects that source and stale-source reload
omits false paint; independent PDF operators show all five corrected nodes red.

[The runtime-execution follow-up](../tests/fixtures/point-paint-pgf/execution-boundary/runtime-execution/README.md)
preserves the distinct invocation-time `/utils/exec` failure: PGF's external
node was blue while both old application nodes forced red. Corrected standalone
and inline-math output compile separately against identical external source with
PGF 3.1.11a/pdfTeX 1.40.29. Each PDF's external node, untouched import, reload,
stale-snapshot reload and preset reapplication remain blue. Explicit red/black
text and yellow/black fill edits retain their requested colors, including edits
equal to the visible fallback; fill-only edits leave text blue. All 18 node
observations come from actual PDF operators. The supplied failure establishes a
color-binding side effect; handler mutation receives separate parser regression
coverage and is not claimed as a second observation from these PDFs.
