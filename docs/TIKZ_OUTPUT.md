# TikZ output

## Goal

The TikZ output must be readable and suitable for manual editing.

Do not emit one huge unreadable path.

The output should look like code a human might have written.

## Export Modes

StratifiedTikZ has two TikZ export modes:

- `standalone`
- `inlineMath`

### Standalone mode

`standalone` is the default, traditional output intended for ordinary document
snippets and standalone figures. Existing standalone output remains the
compatibility baseline.

Setup commands may appear before `\begin{tikzpicture}` as they did before Phase
18. For example, package requirement comments, external-style load comments,
local color definitions, layer declarations, and 3D camera setup may be emitted
before the picture. The `tikzpicture` itself keeps the normal drawing options,
including `tdplot_main_coords` for 3D output.

Standalone mode may use blank lines for readability.

### Inline math mode

`inlineMath` is intended for `align`, `aligned`, `equation`, and similar
math-environment workflows. Each exported diagram is still its own independent
`tikzpicture`; StratifiedTikZ does not combine multiple pictures into one export.

Every inline math snippet starts with a `tikzpicture` whose options include:

```tex
baseline={([yshift=-.5ex]current bounding box.center)}
```

All diagram-local setup is emitted inside that picture: external-style load
comments, local `\definecolor` commands, local user styles, layer declarations,
camera setup, and then the diagram content. Inline math output has no blank
physical lines, including leading or trailing blank lines, because blank lines
can create paragraph breaks and errors in `align` and related environments.
Readability is preserved with comment separators such as
`%----------------------------------------` and section comments instead of empty
lines.

External imported TikZ style files are not inlined. The generated inline snippet
includes comment-only load instructions, but no active external `\input`. Load
those external files in the parent document preamble or before the math
environment that contains the exported picture.

Example `align` use:

```tex
\begin{align}
  \begin{tikzpicture}[baseline={([yshift=-.5ex]current bounding box.center)}]
    % ...
  \end{tikzpicture}
  &=
  \begin{tikzpicture}[baseline={([yshift=-.5ex]current bounding box.center)}]
    % ...
  \end{tikzpicture}
\end{align}
```

The selected mode affects only TikZ output. It does not affect SVG preview,
diagram geometry, layer membership, camera controls, or undo/redo history.
Standalone is used when no saved export mode is present.

## Path arrows

Curve strata may export endpoint arrows and mid-path arrowhead decorations.
Endpoint arrows use ordinary TikZ draw options:

```tex
->    % forward
<-    % backward
<->   % both
```

Mid-path arrows use TikZ `decorations.markings`:

```tex
postaction={decorate},
decoration={markings, mark=at position 0.5 with {\arrow{>}}}
```

The default mid-arrow position is `0.5`. Forward standard arrows export as
`\arrow{>}` and backward standard arrows export as `\arrow{<}`. Custom mid-arrow
heads are:

```tex
\arrow{Stealth}
\arrow{Latex}
\arrow{Stealth[harpoon]}
\arrow{Stealth[harpoon,swap]}
```

Backward custom heads use TikZ's reversed marking command, for example
`\arrowreversed{Stealth}`.

Generated output requests the required libraries when needed:

```tex
\usetikzlibrary{decorations.markings}
\usetikzlibrary{arrows.meta}
```

`decorations.markings` is needed for any mid-arrow decoration. `arrows.meta` is
needed for `Stealth`, `Latex`, and harpoon arrow heads. Inline math output keeps
these setup lines inside the `tikzpicture` setup section and still removes blank
physical lines.

The Inspector shows arrow controls for path-like curve strata: polylines, cubic
Bezier curves, concatenated paths, and path templates. Grids do not expose these
controls. The controls edit the persisted `arrows` object, so save/load,
undo/redo, SVG preview, and TikZ export all use the same arrow options. Mid-arrow
positions must satisfy `0 < position < 1`; invalid values are ignored by the edit
helper and rejected by model validation.

The arrow controls are intentionally compact:

- endpoint direction is one select (`none`, `forward`, `backward`, `both`);
- mid-arrow enablement, position, direction, and head are edited separately;
- the Reverse path direction command gives button feedback through its disabled
  state and tooltip when a path kind cannot be reversed.

SVG preview draws approximate triangular arrowheads for endpoint and mid-arrow
decorations. The preview follows the projected path tangent in both 2D and 3D,
but it does not attempt to reproduce the exact TikZ `Stealth`, `Latex`, or
harpoon glyphs.

## 2D braiding crossings without knot package

2D path crossings can be marked as no braiding, braiding, or anti-braiding.
Braiding means path A passes over path B; anti-braiding means path B passes over
path A. These states are stored in the diagram model and are exported only for
2D codimension-1 curve crossings.

In the SVG preview, crossing markers cycle on click:

1. no braiding;
2. braiding (`pathAId` over `pathBId`);
3. anti-braiding (`pathBId` over `pathAId`);
4. back to no braiding.

Markers use a visible diamond with a white halo and an SVG tooltip describing
the current state and the next click. The preview toolbar reports the most
recent toggle and also reports capped detection or skipped ambiguous overlaps.

TikZ export does not use the `knot` package. The generator first emits the full
paths normally, including their endpoint arrows and mid-arrow decorations. It
then emits a short explicit overlay for each braided crossing:

```tex
% Braiding crossing: path-a over path-b; no knot package.
% Background mask clips the under-strand; over-strand redraw intentionally omits arrow decorations.
\draw[
    draw=stzBraidingBackground,
    draw opacity=1,
    line width=5.2pt
]
    (braidingCrossing0Maskp0) -- (braidingCrossing0Maskp1);
\draw[
    draw=stzBraiding0pathaOverStroke,
    draw opacity=1,
    line width=1.2pt
]
    (braidingCrossing0Overp0) -- (braidingCrossing0Overp1);
```

The background color defaults to white and is emitted as a local `xcolor`
definition. The mask stroke width is the under-strand line width plus a 4pt gap.
The short crossing segment length is currently 0.24 model coordinate units,
centered at the detected crossing and aligned with the local tangent.

SVG preview uses the same model-space overlay idea: normal paths are drawn first,
then a background-colored mask is drawn along the under-strand, and then the
over-strand is redrawn as a short plain stroke. Overlay strokes do not receive
pointer events, so crossing markers and path controls remain clickable.

The over-strand redraw intentionally omits endpoint arrows and mid-arrow
decorations to avoid duplicate arrowheads near crossings. The original full path
still keeps its arrow options. If a mid-arrow lies exactly at the crossing, the
background mask may partially obscure it; move the arrow position slightly when
that distinction matters.

The Reverse path direction command reverses supported path geometry while
preserving the source object ID, name, layer, labels, style, style references,
and arrow options. Forward arrows remain forward relative to the new path
direction. Supported reversal targets are polylines, cubic Bezier curves, and
concatenated paths made from line, cubic Bezier, and arc segments. Arc reversal
swaps endpoints and start/end angles, and flips clockwise versus
counterclockwise direction. Template circles and ellipses are not reversible yet
because the current template model has no orientation metadata; grids and
surfaces are also not reversed by this command.

Current limitations:

- braiding is 2D-only and is not exported for 3D diagrams;
- crossing detection is sampled, so it does not solve exact symbolic
  intersections;
- collinear overlaps are reported as ambiguous and skipped;
- dense diagrams are bounded by path, segment, path-pair, and candidate caps;
- the explicit no-knot overlay is local to the crossing and is not a full knot
  theory engine.

## Approximate 3D surface ordering

3D diagrams can opt into approximate surface face depth sorting through
`diagram.view.visibility` or the TikZ generation option. The default is off, so
existing exports keep their manual layer and stratum order.

When `enabled` and `surfaceDepthSort` are true, the generator samples sheet
faces, computes average projected depth with the active orthographic TikZ
camera, and emits farther faces before closer faces. Each sorted face is emitted
as a separate `\filldraw` command with the sheet style preserved and a comment
recording the source sheet, face index, and average depth.

Layer-aware output remains active. In `layerThenDepth` mode, the generator sorts
by layer first and then depth inside each layer. In `depthThenLayer` mode, depth
is the shared sorter's first key, but the emitted TikZ still uses `pgfonlayer`
blocks, so declared layer order remains important for the final drawing.

This is a painter's algorithm approximation. Intersecting surfaces, cyclic
overlaps, and large coarse faces can still render incorrectly. Increase surface
sampling or use the layer manager when exact visibility matters. The MVP does
not depend on `tikz-3dtools` or LuaLaTeX-side visibility packages; SVG preview
and TikZ export use the TypeScript visibility approximation so they stay
aligned. A future optional LuaLaTeX/lua-tikz3dtools export mode could be added
separately.

Automatic visibility also supports sampled curve hidden segments and optional
point/label visibility policies. Hidden curve runs are exported as separate
`\draw` commands using the configured hidden line style and opacity multiplier;
visible runs use the original curve style. Point and label visibility either
dims or omits anchors according to the saved policy. If the face or curve sample
caps are exceeded, TikZ export emits a warning comment and falls back to the
ordinary layer-aware command for that sheet or curve instead of writing partial
or unbounded sampled output. Inline math export still removes blank lines from
these comments and generated commands.

## Variables

Diagram variables export as `\pgfmathsetmacro` definitions. For example:

```tex
\pgfmathsetmacro{\R}{2}
\pgfmathsetmacro{\q}{30}
```

For dependent variables, expressions are formatted with the explicit macro map:

```tex
\pgfmathsetmacro{\R}{2}
\pgfmathsetmacro{\r}{\R / 2}
```

The MVP accepts variable and macro names made only of letters (`[A-Za-z]+`).
This keeps generated TeX control sequences simple and means names such as `R1`
are rejected until a broader macro policy is introduced. Variable expressions
use StratifiedTikZ's scalar-expression parser, not raw TeX.

Export policy: every valid diagram variable is emitted, including variables not
currently referenced by exported geometry. This keeps output deterministic and
keeps dependent variable definitions readable without a separate use-analysis
pass. Variables are emitted in dependency order; independent variables keep the
user's saved order. Invalid or duplicate variables do not produce duplicate
`\pgfmathsetmacro` definitions.

In standalone mode, variable definitions are emitted in the setup area before
`\begin{tikzpicture}`. In inline math mode, they are emitted near the top of the
picture after local setup and before coordinates/drawing commands:

```tex
\begin{tikzpicture}[baseline={([yshift=-.5ex]current bounding box.center)}, line cap=round, line join=round]
    %----------------------------------------
    % Variables
    %----------------------------------------
    \pgfmathsetmacro{\R}{2}
\end{tikzpicture}
```

Inline math output still contains no blank physical lines.

## Symbolic coordinates

Coordinate components that store expressions are exported as braced PGF math
expressions. For example, with variables `R` and `q`, a point whose model
coordinate is `(R*cos(q), R*sin(q), 0)` exports as:

```tex
\pgfmathsetmacro{\R}{2}
\pgfmathsetmacro{\q}{30}
\coordinate (pointOrbit0p0) at ({\R * cos(\q)},{\R * sin(\q)});
```

The same coordinate formatting is used for point coordinates, label positions,
ordinary curve vertices, absolute cubic controls, filled-region boundaries, and
sheet vertices. In 3D mode the third component is emitted in the same way.

3D coordinates may also store a `workPlaneLocal` source: a saved work-plane frame
snapshot plus local scalar coordinates `(a,b)`. When all coordinates needed for
a point, label, path, polygon/quad sheet, or work-plane-filled sheet use the
same frame, TikZ export preserves the local scalar expressions inside a TikZ
`3d` library plane scope:

```tex
\begin{scope}[
    plane origin={(0,0,1)},
    plane x={(1,0,1)},
    plane y={(0,1,1)},
    canvas is plane
]
    \draw ({\R * cos(\q)},{\R * sin(\q)}) -- ({\R + 1},0);
\end{scope}
```

Same-frame detection compares a frame ID when one is available; otherwise it
compares the finite preview numeric `origin`, `u`, `v`, and `normal` vectors
within tolerance. Local scalar expressions use the same variable macro
formatter as global symbolic coordinates, so `R*cos(q)` becomes
`{\R * cos(\q)}`. The frame itself is emitted through the existing safe
TikZ-plane formatter; symbolic frame origins and basis vectors are used only
when they pass that formatter.

If a path or sheet mixes global coordinates with work-plane-local coordinates,
uses multiple local frames, or contains a local symbolic arc segment that cannot
yet be represented safely, the MVP exporter falls back to global preview
coordinates with an explicit warning comment. It does not expand local symbolic
expressions into global symbolic formulas. Single points and labels with
malformed local sources are omitted with a clear comment instead of silently
using previews.

Path templates in 3D already export in a local plane scope. If the template
center has a matching `workPlaneLocal` source, its local `(a,b)` expressions are
preserved; otherwise the center is exported with numeric local preview
coordinates and a comment explains the limitation.

Ruled surfaces and Coons patches may load copied boundary snapshots with
symbolic coordinates, including symbolic work-plane frame snapshot components
on 3D arc boundary segments, when those expressions resolve to finite preview
values and the evaluated frame is geometrically valid. Their current TikZ
surface output is a sampled mesh, so each emitted face uses the resolved finite
numeric preview mesh coordinates. If the saved boundary snapshots contain
work-plane-local symbolic coordinates, the generated TikZ includes a limitation
comment; the saved diagram still keeps the local symbolic boundary coordinate
and frame expressions for later editing and round-tripping.

Standalone 3D arc segment local-symbolic formulas are not expanded in the MVP.
Copied boundary snapshots for boundary-surface meshes use finite preview values
for sampling. In 2D template paths, symbolic centers export through the named
center coordinate, but template radii and rotation fields are still numeric in
the MVP data model.

## Grid export

Grid strata export compactly with TikZ `\foreach` loops rather than one emitted
`\draw` command per grid line. The saved `latticePattern` selects rectangular,
triangular, or honeycomb output; missing values default to rectangular for old
diagrams. In 2D, a rectangular grid uses the canonical xy frame and exports as
a local scope with a rectangular clip followed by vertical and horizontal
foreach loops:

```tex
\begin{scope}
    \clip (0,0) rectangle (5,5);
    \foreach \stzGridU in {0,0.5,...,5} {
        \draw[
            draw=stzCurveGridStroke,
            draw opacity=1,
            line width=1.2pt
        ]
            (\stzGridU,0) -- (\stzGridU,5);
    }
    \foreach \stzGridV in {0,0.5,...,5} {
        \draw[
            draw=stzCurveGridStroke,
            draw opacity=1,
            line width=1.2pt
        ]
            (0,\stzGridV) -- (5,\stzGridV);
    }
\end{scope}
```

The rectangular clip is always emitted before the loops. It is the saved grid
clip in local grid coordinates, so it affects both loop directions and keeps the
visible grid boundary concise. Grid style options use the same curve-style
export path as other geometric 1-dimensional strata, including named colors,
opacity, line width, line style, local user presets, and compatible imported
TikZ style references. Layer placement is unchanged: the whole grid scope is
emitted inside the grid stratum's `pgfonlayer` block.

Triangular lattices use `uRange.step` as the local spacing. The exporter clips
to the numeric intersection of the saved range rectangle and rectangular clip,
then emits three line-family loops: local u-direction lines, +60 degree lines,
and -60 degree lines. Honeycomb lattices use `uRange.step` as the flat-top
hexagon edge length. Their SVG preview de-duplicates shared edges; compact TikZ
export uses nested `\foreach` loops over hexagon centers and draws a clipped
hexagon path for each cell, so shared edges can be overdrawn in the MVP.

In 3D, a grid stores the work-plane frame snapshot from creation/edit time. The
generator does not consult transient active work-plane UI state. When the saved
frame can be emitted safely, the grid uses the TikZ `3d` library plane scope:

```tex
\begin{scope}[
    plane origin={(0,1,0)},
    plane x={(1,1,0)},
    plane y={(0,1,1)},
    canvas is plane
]
    \clip (-1,-1) rectangle (1,1);
    \foreach \stzGridU in {-1,0,...,1} {
        \draw[...] (\stzGridU,-1) -- (\stzGridU,1);
    }
\end{scope}
```

Inside that scope, grid paths are local 2D `(u,v)` coordinates. The plane scope
is the only place the 3D frame is described. `\usetikzlibrary{3d}` is emitted
when at least one work-plane-local grid, work-plane-filled sheet, local-symbolic
point/label/path/sheet, 3D template path, or work-plane-local relative Bézier
curve needs this scope form.

MVP symbolic policy: rectangular `\foreach` range triplets (`min`, `max`, and
`step`) must be numeric so the generator can produce safe
`{first,next,...,last}` syntax and avoid broken or ambiguous PGF loops.
Symbolic range triplets are omitted with a clear comment rather than expanded
line by line. Rectangular clip endpoints may be symbolic when they pass the same
scalar-expression parser and TikZ formatter used for symbolic coordinates;
those endpoints are emitted as braced PGF math expressions such as `({\R},0)`.
Triangular and honeycomb compact exports currently require numeric ranges,
spacing/edge length, and clip bounds.

Invalid grid ranges, non-positive steps, reversed clips, non-finite preview
values, and unsafe symbolic expressions are rejected by model validation before
normal export. The generator also guards against these cases and omits an
invalid grid with a readable comment instead of writing `NaN`, `Infinity`, or a
malformed `\foreach`.

The editor treats the selected export mode as export UI state. When JSON is
downloaded from the UI, the preference is persisted as `diagram.view.exportMode`
alongside other view/export preferences. Old saved diagrams without that field
load using `standalone`.

## Reference examples and presets

The app ships editable reference examples for common export patterns:

- a 2D translucent filled-region diagram with solid and densely dotted curves;
- a 3D hemisphere patch with paths, point markers, and free labels;
- a 3D saddle patch with crossing paths, point markers, and free labels;
- a 2D even-odd compound filled boundary;
- a 2D string diagram with endpoint arrows;
- a 2D path with a mid-arrow decoration at position `0.5`;
- a 2D braiding and anti-braiding crossing diagram using no knot package;
- a 2D harpoon arrowhead diagram.

The `generate:tikz-examples` script writes these references alongside the base
2D and 3D examples:

```bash
npm run generate:tikz-examples
```

The style inspectors expose read-only built-in presets for blue/red translucent
filled regions or sheets, black solid curves, black densely dotted curves, and
common black point markers. The Inspector also supports user-created structured
presets for regions, sheets, curves, points, and free text labels. User presets
can be created from the selected element style, renamed, edited, deleted, and
applied to compatible elements.

The Inspector groups preset controls by origin. Built-in presets are read-only
shortcut buttons. Saved presets are split into user presets and imported presets,
with a filterable, scrollable list for large imported style files. User presets
show explicit rename and delete actions. Imported presets show the imported TikZ
key, external source, load hint, preview options when available, and editable
target tags such as `draw`, `filldraw`, `node`, `curve`, `sheet`, `point`,
`label`, and `region`.

Built-in presets remain convenience controls: applying one copies explicit style
values into the selected element. User presets are saved in
`diagram.userStylePresets`; applying one copies explicit style values and records
`stylePresetId` on the element so TikZ can reference the local preset style.
Direct manual edits clear `stylePresetId`. If a loaded diagram ever has a stale
`stylePresetId` whose structured style no longer matches the preset, the TikZ
generator falls back to inline structured options so the exported source matches
the model style.

Imported `.sty` / `.tex` styles that look like color or node-shape styles also
appear in the same saved preset chooser. This detection is heuristic: `/color/`
keys and simple color/opacity options become presets for curves, sheets,
regions, labels, and points; `/shape/` keys and simple node-shape options become
presets for points and labels. The Inspector preview uses an approximate subset
of TikZ options, including named colors, simple `red!60` xcolor mixes, opacity,
fill/draw opacity, dashed/dotted/densely dotted, `thick`, `thin`, and simple
`line width=<...>` values. Unsupported options are ignored for preview.
The UI warns that SVG preview is approximate and that the external style file
must be loaded by the user in LaTeX; StratifiedTikZ does not embed the file.
If an imported reference is missing its external source or its target tags are
incompatible with the selected preset kind, the Inspector reports that status
instead of silently treating the imported key as reliable.

In standalone output, Phase 17A user presets are emitted as local options of
`\begin{tikzpicture}`:

```tex
\begin{tikzpicture}[
  line cap=round,
  line join=round,
  stratifiedStyleBlackCurve/.style={draw=stzStyleusercurveblackcurveStroke, draw opacity=1, line width=1.2pt}
]
```

The generator does not emit a pre-picture `\tikzset{...}` block for standalone
user presets. In inline math output, user preset definitions are emitted inside
the picture after local color definitions so color-dependent styles can resolve
locally:

```tex
\begin{tikzpicture}[baseline={([yshift=-.5ex]current bounding box.center)}, line cap=round, line join=round]
%----------------------------------------
% Local colors
%----------------------------------------
\definecolor{stzStyleusercurveblackcurveStroke}{HTML}{000000}
%----------------------------------------
% Local styles
%----------------------------------------
\tikzset{
  stratifiedStyleBlackCurve/.style={draw=stzStyleusercurveblackcurveStroke, draw opacity=1, line width=1.2pt}
}
...
\end{tikzpicture}
```

Imported TikZ style references are external. StratifiedTikZ saves the source
metadata and imported option key, but generated TikZ does not inline the
external `\tikzset{...}` definition and does not emit an active `\input{...}` by
default. Imported references are emitted only when their saved targets match the
element kind or the TikZ command target (`draw`, `filldraw`, or `node`). When an
emitted command uses an imported key, the top style section contains
comment-only load instructions. In inline math mode these comments are inside
the `tikzpicture`; in standalone mode they remain before the picture as before:

```tex
% External TikZ styles referenced below.
% Load these files in your LaTeX preamble or before the picture:
% - mygeometry.sty
% Suggested:
%   \input{mygeometry.sty}
\begin{tikzpicture}[
  line cap=round,
  line join=round
]
  \draw[
    3cat/phys/1strata/color/x,
    draw=stzCurvewireStroke,
    draw opacity=1,
    line width=1.2pt
  ]
    (curvePolyWire0p0) -- (curvePolyWire0p1);
\end{tikzpicture}
```

Command option ordering is deterministic:

1. matching local user preset style name;
2. imported external style key;
3. structured inline fallback options when no local preset is used;
4. non-style command options such as `spath/save` or `even odd rule`.

User preset definitions themselves are emitted once as local
`\begin{tikzpicture}` options and contain only structured StratifiedTikZ style
options. Imported keys are never inlined into those local definitions. If
several elements use references from the same external source, the load comment
lists that source once.

The `.sty` / `.tex` importer uses a limited `\tikzset` parser. It supports
multiple braced `\tikzset{...}` blocks, `.cd` path prefixes, and keys of the
form `name/.style={...}` with simple nested braces in the option body. It strips
ordinary TeX comments where practical and skips unsupported entries with
warnings. It does not expand macros, resolve `\input`, evaluate conditionals, or
execute TeX. Parsed option bodies are saved as reference metadata for inspection,
but generated TikZ still emits only the external-load comments and imported
option keys; it never inlines the parsed `\tikzset` definitions. Unsupported
preview options are therefore preserved for export by the external style key,
not by copying the option body into generated TikZ.
Duplicate imported keys are reported and imported once using the later parsed
definition. Files without supported `\tikzset` style entries report a failed
import rather than changing the diagram.

## Mathematical convention

The word **n-stratum** means **codimension n**.

Therefore:

In 2D mode:

- codim 1 = curve / wire
- codim 2 = point / vertex / coupon

In 3D mode:

- codim 1 = sheet
- codim 2 = curve / line defect
- codim 3 = point / junction

## Coordinate source

The TikZ generator must use the model coordinates stored in the diagram.

It must not care whether the coordinates were created by direct input or cursor input.

Coordinate input mode belongs to the editor state, not to the TikZ output.
Active work-plane state also belongs to the editor state. Axis-aligned work
planes, custom work planes, work-plane point-picking state, camera preview
guides, and work-plane labels are never exported. The 3D SVG coordinate axes
preview guide is also editor/display state, not diagram geometry; it is exported
only when the user enables the coordinate axes TikZ export option. These editor
aids affect TikZ only indirectly when cursor-created geometry has already been
committed to the diagram as ordinary model coordinates.

The 3D camera is persisted, when present, as diagram-level view metadata at
`diagram.view.camera3d`. It uses `tikz-3dplot`-compatible `thetaDeg` and
`phiDeg` notation for the preview camera, and generated 3D TikZ exports those
angles with `\tdplotsetmaincoords{theta}{phi}`. The app may pass the current
unsaved camera to the generator so the TikZ source matches the live SVG preview
orientation. If no current camera is passed, the generator uses
`diagram.view.camera3d`, then the diagram camera, then the initial 3D camera as
a fallback. `thetaDeg` and `phiDeg` are the source of truth for 3D orientation;
deprecated legacy `projectionBasis` metadata is ignored by preview and export
when those angle fields are present.

The current production camera is orthographic. A hidden perspective camera type
may be recognized by the model for future work, but perspective rendering,
work-plane picking, and TikZ export are not supported. TikZ export rejects
perspective cameras explicitly rather than emitting misleading
`tikz-3dplot` output.

Only camera orientation is exported. Zoom and pan remain SVG-view-only and do
not silently scale or translate TikZ geometry. Resetting the app camera to the
initial/default display restores the initial exported TikZ camera values.
Camera changes are view operations and do not create geometry undo entries.

## Coordinate names

Generated coordinate names use the current stratum name as a readable stem.
The stem is sanitized for TikZ coordinate-name safety by keeping ASCII letters
and digits, removing unsafe TeX characters, and folding separators such as
spaces or hyphens into camel-case word boundaries. For example, `F line`
becomes `FLine`.

If a stratum name is blank or sanitizes to nothing, the generator falls back to
a safe geometric default such as `point`, `curve`, or `sheet`. If a sanitized
stem starts with a digit, the fallback is prefixed before the digit.

Coordinate names remain deterministic and unique by combining the geometric
prefix, optional concrete type, sanitized name stem, emission element index, and
coordinate index. Elements are emitted by numeric layer, and elements on the
same layer keep their original diagram order rather than being sorted by id.
Examples:

```tex
\coordinate (pointParticle0p0) at (0,0);
\coordinate (curvePolyBoundary1p0) at (0,0);
\coordinate (curvePolyBoundary1p1) at (1,0);
\coordinate (curveBezierFLine2p0) at (0,1);
\coordinate (sheetPolySurface0p0) at (0,0,0);
```

Free text labels are separate diagram objects. Their `name` fields do not
create coordinate-name stems; labels are emitted directly as TikZ nodes at their
stored model coordinates.

## Saved path labels

Path-like strata may also carry an optional `pathLabel` field. This field is
not a displayed label. It is a TikZ saved-path name used to emit an `spath/save`
option on the exported path:

```tex
\draw[
  draw=stzCurveA,
  draw opacity=1,
  line width=1.2pt,
  spath/save=myPath
]
  (p0) -- (p1);
```

If `pathLabel` is missing, empty, or only whitespace after trimming, no
`spath/save` option is emitted. Saved path labels are currently exported for
polyline curves, cubic Bézier curves, concatenated paths, and polygon sheet
paths. They are not emitted for point strata or for free text labels in
`diagram.labels`.

Saved path names are sanitized for TikZ safety by the same deterministic
ASCII-letter-and-digit rules used for coordinate name stems: unsafe characters
are removed, separators such as spaces and hyphens create camel-case word
boundaries, and names that would otherwise be empty fall back to `savedPath`.
If the sanitized name starts with a digit, `savedPath` is prefixed before the
digit. For example, `my path` becomes `myPath`, `$F_{1}$` becomes `F1`, and
`123` becomes `savedPath123`.

Layer duplication does not reuse non-empty `pathLabel` strings verbatim on the
copies. The copied value appends ` copy`, then ` copy 2`, ` copy 3`, and so on
until the sanitized saved-path name is unused by the current diagram. For
example, copying `my path` normally creates `my path copy`, emitted as
`spath/save=myPathCopy`; if that sanitized name already exists, the next copy is
`my path copy 2`.

When at least one `spath/save` option is emitted, the generated style/header
section includes a comment documenting the required TikZ library:

```tex
% Required TikZ libraries for saved paths:
% \usetikzlibrary{spath3}
```

## Layer-aware output

Generated TikZ uses PGF layers so that diagram `layer` values affect drawing
order. Every numeric layer value used by an exported region, sheet, curve,
point, or free text label is mapped to a deterministic TikZ-safe layer name:

```text
0  -> stratifiedLayer0
1  -> stratifiedLayer1
-1 -> stratifiedLayerMinus1
```

Sparse and negative layer values are supported. Decimal layer values, if present
in diagram data, are converted with a readable safe suffix such as
`stratifiedLayer1Point5`.

Diagram-level `layers` metadata may assign human-readable names to numeric
layer values for the editor's Layer Manager. It may also store editor preview
state such as layer visibility and locking. TikZ export does not use these
metadata names or preview/editing flags. This keeps Phase 9B layer-aware output
stable: only element `layer` values determine emitted PGF layers and drawing
order.

Renaming a layer changes only this metadata and therefore does not change TikZ
layer membership. Swapping two layers updates the numeric `layer` values stored
on strata and free text labels, so the affected elements move to the opposite
PGF layer in exported TikZ. The metadata names swap with those contents in the
editor, but the emitted TikZ layer identifiers remain based only on numeric
values such as `stratifiedLayer0`.

Duplicating a layer creates copied strata and free text labels with new element
ids and the target numeric `layer` value. TikZ export therefore emits the copied
commands in the target `pgfonlayer` block. Deleting a layer removes its strata
and free text labels from diagram data, so export no longer emits commands for
that layer unless other elements still use the same numeric value.

Translating a layer changes model coordinates on the affected elements, so TikZ
coordinate definitions and path commands reflect the translated positions.
Translation does not introduce a TikZ transform wrapper; export remains based on
the stored model coordinates.

The output declares all used diagram layers and sets their order before the
`tikzpicture`:

```tex
\pgfdeclarelayer{stratifiedLayer0}
\pgfdeclarelayer{stratifiedLayer1}
\pgfsetlayers{stratifiedLayer0,stratifiedLayer1,main}
```

Lower numeric layer values are listed before higher numeric layer values, so
they render behind higher layers. The `main` layer is retained in
`\pgfsetlayers` for compatibility, although exported diagram elements are placed
on explicit `stratifiedLayer...` layers.

If optional 3D coordinate axes export is enabled, the generator also declares a
`stratifiedGuideLayer` before ordinary diagram layers. The axes guide is not a
stratum and is emitted in its own documented block so it remains visually behind
ordinary diagram geometry:

```tex
\pgfdeclarelayer{stratifiedGuideLayer}
\pgfdeclarelayer{stratifiedLayer0}
\pgfsetlayers{stratifiedGuideLayer,stratifiedLayer0,main}

% ----------------------------------------------------------------------------
% Coordinate axes guide
% ----------------------------------------------------------------------------

% Optional 3D coordinate axes guide. This is not a stratum.
\begin{pgfonlayer}{stratifiedGuideLayer}
  \draw[
    draw=stzCoordinateAxesGuide,
    draw opacity=0.35,
    line width=0.4pt,
    ->
  ]
    (0,0,0) -- (2.5,0,0);
  \node[
    text=stzCoordinateAxesGuide,
    opacity=0.55,
    font=\scriptsize
  ] at (2.75,0,0) {$x$};
\end{pgfonlayer}
```

The y and z axes are emitted similarly, with labels `$y$` and `$z$`. The option
is disabled by default so ordinary TikZ output remains clean.

Drawing commands for sheets, curves, points, and free text labels are wrapped in
`pgfonlayer` blocks:

```tex
\begin{pgfonlayer}{stratifiedLayer0}
  %----------------------------------------
  % Codimension 1 strata: curves
  %----------------------------------------
  \draw[...] ...;
\end{pgfonlayer}

\begin{pgfonlayer}{stratifiedLayer1}
  %----------------------------------------
  % Labels
  %----------------------------------------
  \node at (1,0) {$F$};
\end{pgfonlayer}
```

<!-- Layers are emitted in deterministic numeric order. Within a layer, items that
belong to the same emitted section preserve their existing relative diagram
order. Coordinate definitions remain outside layer blocks and keep the Phase 9A
coordinate-name rules based on sanitized stratum names and emission order. -->

## Ordering within TikZ layers

Layer blocks are emitted in deterministic numeric layer order. Lower numeric layer values are placed behind higher numeric layer values.

Within each TikZ layer block, commands are organized by codimension / element kind for readability. Therefore, the output does not necessarily preserve the full diagram.strata order across different codimension sections.

The intended ordering rule is:

1. numeric layer order;
2. codimension / element-kind section order within each layer;
3. original diagram order within each section.

For example, curves and points on the same layer may be grouped into separate codimension sections even if their order in diagram.strata is interleaved. This is intentional so that the generated TikZ source remains readable and mathematically organized.

Free text labels are emitted in their configured layer and are grouped consistently with the layer output format.

Selection, preview highlighting, hidden/locked Layer Manager state, and the
current layer filter are not exported. Hidden layers are still emitted by
default because visibility is an editor preview control, not a deletion or
export-visible-only command.

## 2D TikZ basis

In 2D mode, use ordinary TikZ coordinates.

Example style block:

```tex
\begin{tikzpicture}[
  line cap=round,
  line join=round,
  visible codim one line/.style={black, very thick},
  hidden codim one line/.style={black, very thick, dotted},
  codim two dot/.style={circle, fill=black, inner sep=1.4pt},
  open codim two dot/.style={circle, fill=white, draw=black, inner sep=1.4pt}
]
```

Coordinates should be emitted as:

```tex
\coordinate (p0) at (0,0);
\coordinate (p1) at (1,0);
```

## 3D TikZ camera

In 3D mode, use `tikz-3dplot` main-coordinate camera notation rather than a
manual 2.5D `x=...`, `y=...`, `z=...` basis. The output is still a standalone
TikZ snippet, so the header documents the package requirement as a comment:

Example style block:

```tex
% Requires \usepackage{tikz-3dplot}
\tdplotsetmaincoords{70}{110}
\begin{tikzpicture}[
  tdplot_main_coords,
  line cap=round,
  line join=round,
  codim one sheet/.style={opacity=.35, draw=black},
  visible codim two line/.style={black, very thick},
  hidden codim two line/.style={black, very thick, dotted},
  codim three dot/.style={circle, fill=black, inner sep=1.4pt},
  open codim three dot/.style={circle, fill=white, draw=black, inner sep=1.4pt}
]
```

Coordinates should be emitted as:

```tex
\coordinate (p0) at (0,0,0);
\coordinate (p1) at (1,0,0);
\coordinate (p2) at (1,0,1);
```

The `theta` and `phi` values come from the current 3D camera's `thetaDeg` and
`phiDeg`. `\tdplotsetmaincoords` controls the view orientation on the TikZ
side; the generator does not pre-project model geometry into 2D coordinates.
Coordinate axes guide export, when enabled, uses the same outer
`tdplot_main_coords` picture and therefore the same camera view.

In inline math output, `tdplot_main_coords` is not placed on the
`\begin{tikzpicture}` options because `\tdplotsetmaincoords{theta}{phi}` is local
setup inside the picture. Instead, the camera command appears near the top of the
picture body and model-coordinate content is emitted in a
`\begin{scope}[tdplot_main_coords]` scope.

This camera export is a `tikz-3dplot`-compatible orthographic orientation, not
perspective projection. Future perspective export may require different PGF/TikZ
settings or a fallback to orthographic output with an explicit warning.

3D work-plane-local relative Bézier export remains a separate scoped feature.
The outer picture uses `tdplot_main_coords`; an eligible curve may still emit a
TikZ `3d` library scope with `plane origin`, `plane x`, `plane y`, and
`canvas is plane` for its local 2D path. The saved work-plane frame is model
geometry and is not replaced by camera data.

## Cubic Bézier controls

Absolute cubic Bézier curves export as before: start, both control points, and
end may be declared as named coordinates, and the path uses those names:

```tex
\draw (p0) .. controls (p1) and (p2) .. (p3);
```

When a cubic Bézier curve stores relative Cartesian control metadata, only the
start and end coordinates need to be declared for that path. The controls are
emitted inline using TikZ relative control syntax:

```tex
\draw (p0) .. controls +(dx1,dy1) and +(dx2,dy2) .. (p3);
```

In 3D diagrams, relative Cartesian controls use the same coordinate arity as
the rest of the 3D output:

```tex
\draw (p0) .. controls +(dx1,dy1,dz1) and +(dx2,dy2,dz2) .. (p3);
```

When a 2D cubic Bézier curve stores relative polar control metadata, the
controls are emitted as:

```tex
\draw (p0) .. controls +(angle1:radius1) and +(angle2:radius2) .. (p3);
```

Relative control modes generally do not emit independent `\coordinate`
declarations for the two control points. SVG rendering still uses the stored
absolute control-point coordinates. Plain relative polar TikZ export is
intentionally limited to 2D diagrams; arbitrary 3D polar controls must not be
exported as `+(angle:radius)` unless the path is inside an explicit local
canvas plane.

3D work-plane-local relative Cartesian and relative polar curves now store that
local basis as curve-level metadata: a frame snapshot with `origin`, `u`, `v`,
and `normal`, plus local start/end coordinates and either `dx`/`dy` offsets or
angle/radius values. This metadata is persistent diagram data for the curve; it
is separate from the transient active work-plane UI state.

When a 3D work-plane-local relative curve is consistent with its saved frame,
the generator emits it inside a TikZ `3d` library canvas-plane scope:

```tex
\usetikzlibrary{3d}

\begin{scope}[
  plane origin={(10,20,30)},
  plane x={(11,20,30)},
  plane y={(10,20,31)},
  canvas is plane
]
  \draw[
    draw=stzCurveLocalStroke,
    draw opacity=1,
    line width=1.2pt
  ]
    (2,3) .. controls +(0:2) and +(90:4) .. (6,7);
\end{scope}
```

`plane origin` is the saved frame origin. `plane x` is `origin + u`, and
`plane y` is `origin + v`. The Bézier start and end are emitted as local 2D
coordinates inside the scope. Relative Cartesian controls are emitted as
`+(dx,dy)`, and relative polar controls are emitted as `+(angle:radius)` in
that local plane.

Scoped work-plane-local relative export does not emit independent coordinate
declarations for the two relative control points. The local start/end
coordinates are emitted inline in the scoped path, avoiding dangling references
to omitted controls.

If a 3D cubic Bézier curve has no work-plane-local relative metadata, has an
invalid frame, or its saved local metadata does not match the stored absolute
points, the generator falls back to ordinary absolute 3D Bézier output:

```tex
\coordinate (p0) at (0,0,0);
\coordinate (p1) at (1,0,1);
\coordinate (p2) at (2,1,1);
\coordinate (p3) at (3,1,0);

\draw (p0) .. controls (p1) and (p2) .. (p3);
```

`\usetikzlibrary{3d}` is emitted when at least one scoped work-plane-local
relative 3D Bézier path or work-plane-filled sheet is generated.

## Filled closed-boundary strata

In 2D mode, `kind: "filledRegion"` exports as a codimension 0 filled closed
path. The generator emits one `\filldraw` command containing all copied boundary
components. Boundary segments preserve their stored order, support line and
cubic Bézier syntax, and each component closes with `-- cycle`.

In 3D mode, `kind: "workPlaneFilledSheet"` exports as a codimension 1 filled
closed path. When the stored plane frame is valid, output is placed in a TikZ
`3d` library scope using `plane origin`, `plane x`, `plane y`, and
`canvas is plane`; boundary points and controls are written as local `(a,b)`
coordinates inside that scope. If the stored frame is unavailable or the local
scope cannot be used safely, the fallback is a valid absolute 3D filled path
using model coordinates with a short explanatory comment. If a filled
closed-boundary stratum contains non-finite boundary coordinates, the generator
omits that filled path and emits a readable comment rather than writing
`NaN` or `Infinity` into the TikZ source.

Multiple boundary components are emitted as subpaths in the same fill command.
For `fillRule: "evenOdd"`, the TikZ options include `even odd rule`; for
`fillRule: "nonzero"`, the default TikZ fill rule is used. Fill color, fill
opacity, stroke color, and stroke opacity are preserved through named
`\definecolor` entries and readable `fill=`, `fill opacity=`, `draw=`, and
`draw opacity=` options.

In 3D mode, `kind: "curvedSheet"` is persisted and validated as a codimension 1
sheet primitive. TikZ export samples the primitive into a finite quad mesh using
the stratum's explicit `sampling.uSegments` and `sampling.vSegments` values. The
generator emits one named coordinate per sampled mesh vertex, then writes one
`\filldraw` polygon per sampled face inside the sheet's layer block. A short
comment identifies the curved sheet, primitive kind, sampling counts, and face
count.

Hemisphere and saddle sheets created in the editor store the active work-plane
frame at creation time. The exporter uses only the saved primitive coordinates,
frame, style, layer, and sampling values; it does not consult preview-only UI
state. Inspector edits to radius, dimensions, side, center/origin, style, layer,
and sampling are reflected directly in the generated mesh output.

The sampled mesh export preserves fill color, fill opacity, stroke color, stroke
opacity, and layer ordering through the same named-color and `pgfonlayer`
machinery as planar sheets. It is intentionally an approximation: faces are
flat quads, there is no hidden-surface sorting, and the output size grows with
`uSegments * vSegments`. The default examples use modest sampling counts so the
TikZ source remains readable. If sampling fails or would produce non-finite
coordinates, the generator omits that curved sheet and emits a readable comment
rather than writing `NaN` or `Infinity`.

TikZ export also caps ordinary curved-sheet mesh output at 256 sampled faces. A
curved sheet above that cap is omitted with a comment asking the user to reduce
sampling. Automatic surface sorting has its own configurable
`maxSurfaceFacesForSorting` cap; when that cap is exceeded, sorting is skipped
with a warning and ordinary layer-aware sheet export follows. This keeps
generated source readable and prevents accidentally large manual edits from
producing thousands of `\filldraw` commands. SVG preview and model validation
still use the model's explicit capped sampling values; the export caps are
readability/performance guards, not new surface models.

## Output sections in 2D mode

In 2D mode, group output as:

```tex
% ----------------------------------------------------------------------------
% Coordinates
% ----------------------------------------------------------------------------

% ----------------------------------------------------------------------------
% Layered drawing commands
% ----------------------------------------------------------------------------
```

Layer blocks include comments for the contained codimension sections, such as
`Codimension 0 strata: regions`, `Codimension 1 strata: curves`,
`Codimension 2 strata: points`, and `Labels`. Each in-layer section comment is
surrounded by `%-----` separator comments for readability.

## Output sections in 3D mode

In 3D mode, group output as:

```tex
% ----------------------------------------------------------------------------
% Coordinates
% ----------------------------------------------------------------------------

% ----------------------------------------------------------------------------
% Layered drawing commands
% ----------------------------------------------------------------------------
```

Layer blocks include comments for the contained codimension sections, such as
`Codimension 1 strata: sheets`, `Codimension 2 strata: curves`,
`Codimension 3 strata: points`, and `Labels`. Each in-layer section comment is
surrounded by `%-----` separator comments for readability.

## Readability requirements

The generator should:

- use section comments
- use stable names
- put one stratum per code block
- avoid minified output
- avoid excessive inline comments
- prefer semantic style names
- preserve user-provided labels as LaTeX source

## User-defined visual styles

The TikZ generator must preserve user-defined visual styles.

For colors, the generator should define TikZ colors using `xcolor`.

Example:

```tex
\definecolor{stzColorA}{HTML}{4D9DE0}
\definecolor{stzColorB}{HTML}{000000}
```

The color names should be generated deterministically from the stratum name or id.

The generated TikZ should remain readable even when many custom colors are used.

## Color conversion

Internal colors are stored as hex strings such as:

```ts
"#4D9DE0"
```

TikZ `xcolor` color definitions should omit the leading `#`.

Example:

```tex
\definecolor{stzSheetFillA}{HTML}{4D9DE0}
```

## Sheet styles

A sheet style should include:

- fill color
- fill opacity
- stroke color
- stroke opacity

Example:

```tex
\filldraw[
  fill=stzSheetFillA,
  fill opacity=.35,
  draw=stzSheetStrokeA,
  draw opacity=1
]
  (a) -- (b) -- (c) -- (d) -- cycle;
```

If a sheet has no visible boundary, use:

```tex
draw opacity=0
```

rather than omitting style information in a way that makes the output harder to inspect.

## Curve styles

A curve style should include:

- stroke color
- stroke opacity
- line width
- line style

Example:

```tex
\draw[
  draw=stzCurveA,
  draw opacity=1,
  line width=1.2pt,
  dashed
]
  (p0) -- (p1);
```

The supported line style mapping is:

| Internal value | TikZ output |
|---|---|
| `solid` | no extra option |
| `dashed` | `dashed` |
| `dotted` | `dotted` |

For `solid`, the generator may omit the line style option.

## Point styles

A point style should include:

- color
- opacity
- shape
- fill / hollow
- size

The point style is exported as a TikZ node at the point coordinate.

### Filled circle

```tex
\node[
  circle,
  fill=stzPointA,
  draw=stzPointA,
  opacity=1,
  inner sep=1.5pt
] at (p) {};
```

### Hollow circle

```tex
\node[
  circle,
  fill=white,
  draw=stzPointA,
  opacity=1,
  inner sep=1.5pt
] at (p) {};
```

### Filled square

```tex
\node[
  regular polygon,
  regular polygon sides=4,
  fill=stzPointA,
  draw=stzPointA,
  opacity=1,
  inner sep=1.5pt
] at (p) {};
```

### Hollow square

```tex
\node[
  regular polygon,
  regular polygon sides=4,
  fill=white,
  draw=stzPointA,
  opacity=1,
  inner sep=1.5pt
] at (p) {};
```

### Filled triangle

```tex
\node[
  regular polygon,
  regular polygon sides=3,
  fill=stzPointA,
  draw=stzPointA,
  opacity=1,
  inner sep=1.5pt
] at (p) {};
```

### Hollow triangle

```tex
\node[
  regular polygon,
  regular polygon sides=3,
  fill=white,
  draw=stzPointA,
  opacity=1,
  inner sep=1.5pt
] at (p) {};
```

### Filled star

```tex
\node[
  star,
  star points=5,
  fill=stzPointA,
  draw=stzPointA,
  opacity=1,
  inner sep=1.5pt
] at (p) {};
```

### Hollow star

```tex
\node[
  star,
  star points=5,
  fill=white,
  draw=stzPointA,
  opacity=1,
  inner sep=1.5pt
] at (p) {};
```

## Point size

The point `size` value is interpreted as points.

The generator may convert:

```ts
size: 3
```

to:

```tex
inner sep=1.5pt
```

or an equivalent TikZ representation.

The exact conversion should be documented in the implementation.

## Required TikZ libraries

Non-circular point styles may require TikZ libraries.

The generator should include a comment listing point-shape TikZ libraries if
needed.

Example:

```tex
% Required TikZ libraries:
% \usetikzlibrary{shapes.geometric,shapes.symbols}
```

For square and triangle point shapes, the output may require:

```tex
\usetikzlibrary{shapes.geometric}
```

For star point shapes, the output may require:

```tex
\usetikzlibrary{shapes.geometric,shapes.symbols}
```

For scoped 3D work-plane-local relative Bézier export, the generator emits the
required TikZ `3d` library directly:

```tex
\usetikzlibrary{3d}
```

This line is conditional: it is omitted when no scoped 3D work-plane-local
relative Bézier path appears in the generated output.

The generated TikZ body should remain readable even when custom styles are used.


## Labels

Free text labels are exported as TikZ nodes.

The basic output form is:

```tex
\node at (#1) {#2};
```

Here:

- `#1` is the coordinate
- `#2` is the user-provided label content

The generator must preserve the user-provided label content as much as possible.

The generator must not automatically wrap label content in `$...$`.

Free text labels are independent from saved path labels. Text stored in
`diagram.labels` is node content only; it never becomes an `spath/save` option.

If the user wants math mode, the user should type `$...$` explicitly.

Examples:

```tex
\node at (0,0) {C};
\node at (1,0) {$F$};
\node at (2,0) {$F^{(1)}L$};
\node at (3,0) {$\alpha \colon f \Rightarrow g$};
```

## Label coordinates in 2D mode

In 2D mode, label coordinates are emitted as ordinary TikZ coordinates:

```tex
\node at (1.2,0.5) {$F$};
```

Even though the internal model uses `Vec3`, the z-coordinate is omitted in 2D TikZ output.

## Label coordinates in 3D mode

In 3D mode, label coordinates are emitted as 3D TikZ coordinates:

```tex
\node at (1.2,0.5,2.0) {$F$};
```

## Label styles

A label may have style options such as:

- text color
- opacity
- font size
- anchor

Example:

```tex
\node[
  text=stzLabelA,
  opacity=1,
  font=\fontsize{10pt}{12pt}\selectfont,
  anchor=center
] at (1.2,0.5) {$F$};
```

For simple default labels, the generator may emit the shorter form:

```tex
\node at (1.2,0.5) {$F$};
```

## Label color definitions

When a label uses a custom color, the generator should define it using `xcolor`.

Example:

```tex
\definecolor{stzLabelA}{HTML}{000000}
```

Then use:

```tex
\node[text=stzLabelA] at (1.2,0.5) {$F$};
```

## Layered label output

Free text labels are emitted inside the `pgfonlayer` block for their configured
numeric layer.

Within each layer, labels are grouped under a readable label comment:

```tex
%----------------------------------------
% Labels
%----------------------------------------
```

Each label should be emitted as a separate TikZ node.

There is no separate non-layered label section. Selection and preview
highlighting are not exported.

## Label content escaping

Label text is treated as user-provided LaTeX/TikZ content.

The generator should not aggressively escape LaTeX commands.

For example, if the user enters:

```text
$F^{(1)}L$
```

the output should be:

```tex
\node at (...) {$F^{(1)}L$};
```

not:

```tex
\node at (...) {\$F\^\{(1)\}L\$};
```

However, the UI may warn the user if the label text contains obviously unbalanced braces or other syntax likely to break LaTeX compilation.

## Partial curve style segments

The TikZ generator should eventually support partial style changes along curves.

This is useful for representing overlaps, hidden portions, and under-crossings.

The conceptual output is to split the original curve into several TikZ paths, each with its own style.

For example:

```tex
% Solid visible part
\draw[
  draw=stzCurveA,
  draw opacity=1,
  line width=1.2pt
]
  (p0) .. controls (c1) and (c2) .. (q0);

% Hidden / overlapped part
\draw[
  draw=stzCurveA,
  draw opacity=1,
  line width=1.2pt,
  densely dotted
]
  (q0) .. controls (d1) and (d2) .. (q1);

% Solid visible part
\draw[
  draw=stzCurveA,
  draw opacity=1,
  line width=1.2pt
]
  (q1) .. controls (e1) and (e2) .. (p1);
```

## Line style mapping

The supported line style mapping should include:

| Internal value | TikZ output |
|---|---|
| `solid` | no extra option |
| `dashed` | `dashed` |
| `dotted` | `dotted` |
| `denselyDotted` | `densely dotted` |

## Concatenated path segment style overrides

For `kind: "concatenatedPath"`, each stored segment may define a partial
`styleOverride`. Export resolves each segment style by applying the override to
the path-level `CurveStyle`.

If every segment resolves to the same style, the generator emits one continuous
`\draw` command. If adjacent segments resolve to different styles, the
generator groups consecutive same-style segments and emits one readable
`\draw` command per group, preserving the original segment order and reusing
the shared endpoint coordinate names:

```tex
% Segment style overrides split this concatenated path by resolved style.
% Segment 1
\draw[
  draw=stzCurveA,
  draw opacity=1,
  line width=1.2pt
]
  (p0) -- (p1);

% Segment 2
\draw[
  draw=stzCurveASegment2,
  draw opacity=1,
  line width=1.2pt,
  densely dotted
]
  (p1) -- (p2);
```

When a mixed-style concatenated path also has `pathLabel`, export emits one
non-drawing `\path[spath/save=...]` command for the full continuous path before
the styled draw commands. This preserves the saved path while keeping visual
styles split into maintainable draw blocks.

3D concatenated paths export from their stored absolute `Vec3` segment
coordinates. Same-work-plane and cross-work-plane creation modes do not change
TikZ syntax after the path is committed: segment order is preserved, shared
endpoint coordinate names are reused, and no work-plane-local 2D relative syntax
or `canvas is plane` scope is emitted for ordinary free 3D concatenated paths.
This keeps free 3D paths readable and prevents transient active work-plane UI
state from affecting export.

Circular arc path segments are preserved in the model. In 2D, arc segments
export with readable TikZ `arc[start angle=..., end angle=..., radius=...]`
syntax. In 3D, an arc segment stores its local work-plane frame; when a
concatenated path is exported in global 3D coordinates, the generator may fall
back to cubic Bézier controls for that segment rather than emitting misleading
2D arc syntax outside a local plane scope.

Circle and ellipse templates are stored as template path strata and export with
native TikZ template syntax instead of cubic expansion:

```tex
\draw[<style>] (centerCoord) circle[radius=<r>];
\draw[<style>] (centerCoord) ellipse[x radius=<rx>, y radius=<ry>];
```

For 3D templates with a stored work-plane frame, export uses the TikZ `3d`
library and a `canvas is plane` scope:

```tex
\begin{scope}[
  plane origin={(Ox,Oy,Oz)},
  plane x={(Ox+ux,Oy+uy,Oz+uz)},
  plane y={(Ox+vx,Oy+vy,Oz+vz)},
  canvas is plane
]
  \draw[<style>] (cx,cy) circle[radius=<r>];
\end{scope}
```

Template radius handles are editor-only SVG preview affordances. They are not
exported to TikZ.

## MVP behavior

For the MVP, the generator may ignore `styleSegments` and render each curve with a single global style.

If `styleSegments` are ignored, this should be documented in the implementation.

## Future behavior

A later implementation should:

1. Sort style segment endpoints.
2. Split the curve into subpaths.
3. Apply the global curve style to ordinary parts.
4. Apply partial style overrides to specified ranges.
5. Emit one readable TikZ `\draw` block per subpath.

For polylines, splitting can be done by normalized arclength.

For cubic Bézier curves, splitting can be done using De Casteljau subdivision.

The generated output should remain readable, even if it uses generated intermediate coordinates such as:

```tex
\coordinate (curveA_split_1) at (...);
```
