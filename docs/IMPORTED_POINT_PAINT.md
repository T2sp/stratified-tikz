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

The scanner accepts literal declarations in file order:

```tex
\tikzstyle{base}=[fill=blue,draw=green]
\tikzset{ns/.cd, point/.style={base,text=red}}
\definecolor{MyBlue}{HTML}{1248AB}
```

Braces, brackets and parentheses protect embedded commas. TeX comments are
masked for parsing while the exact source is retained. `.cd` prefixes relative
style names; leading `/` paths retain their absolute meaning. Later duplicate
style definitions replace earlier ones with a diagnostic. Known bare style
references expand at their exact option position. Lookup tries the enclosing
style's directory, the supplied key, then `/tikz/<key>`; absolute keys are exact.
Cycles and excessive depth/work produce diagnostics and terminate preview work.
No `.code`, macros, package/preamble execution, parameterized styles, or arbitrary
PGF/TeX programs are evaluated.

Limits are: 1,000,000 source characters, 512 extracted definitions, 100,000
characters per option body, 4,096 expanded option steps, 16 reference levels,
and at most 64 preview diagnostics per resolved style. Oversized source has no
importable definitions. Malformed declarations are skipped with warnings.

`ExternalTikzStyleSource.rawSource` preserves the complete imported source.
`ImportedTikzStyleReference.rawOptions` preserves each original option body;
`options` is the legacy normalized display form. `previewDiagnostics` persists
visible limitations. External source/load hint/style key semantics are retained:
TikZ references the external key and includes load instructions, without running
or copying the file's arbitrary definitions into generated code.

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

Mixtures use `name!percentage[!name]` and may chain up to 16 mixtures; percentages
are 0–100, the omitted second color is white. Intermediate calculations retain
fractional channels and the final display color is rounded to 8-bit RGB.
Unknown colors are never silently accepted as black: the unresolved property
has a visible diagnostic and a deterministic application-default preview.

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
after it; later known options and explicit local edits still take precedence.
Such unresolved cases remain documented preview
limitations. Deferred geometry remains the external style's responsibility.

## Independent reference and checks

[The retained PGF fixture](../tests/fixtures/point-paint-pgf/README.md) was compiled
with PGF 3.1.11a (2025-08-29), pdfTeX 1.40.29, TeX Live 2026. It retains the exact
`.tex`, actual PDF/PNG, compiler log, uncompressed PDF operators and observed
JSON. The ten rows distinguish option order, text opacity, general/specific
color, disabled fill/stroke, zero text alpha, and dotted/line-width order. Expected values in
`tests/model/pointPaintImport.test.ts` come from that independent artifact;
they are not generated by calling the resolver under test. Additional tests
cover imports, bounds, named/custom/mixed colors, defaults, both TikZ modes,
local overrides, and source persistence.
