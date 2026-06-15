# TikZ output

## Goal

The TikZ output must be readable and suitable for manual editing.

Do not emit one huge unreadable path.

The output should look like code a human might have written.

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

## Layer-aware output

Generated TikZ uses PGF layers so that diagram `layer` values affect drawing
order. Every numeric layer value used by an exported sheet, curve, point, or
free text label is mapped to a deterministic TikZ-safe layer name:

```text
0  -> stratifiedLayer0
1  -> stratifiedLayer1
-1 -> stratifiedLayerMinus1
```

Sparse and negative layer values are supported. Decimal layer values, if present
in diagram data, are converted with a readable safe suffix such as
`stratifiedLayer1Point5`.

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

Selection and preview highlighting are not exported. Layer filtering and
layer-based selection UI are not part of this phase.

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

## 3D TikZ basis

In 3D mode, use a 2.5D TikZ basis.

Example style block:

```tex
\begin{tikzpicture}[
  x={(1cm,0cm)},
  y={(0.45cm,0.25cm)},
  z={(0cm,1cm)},
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
`Codimension 1 strata: curves`, `Codimension 2 strata: points`, and `Labels`.
Each in-layer section comment is surrounded by `%-----` separator comments for
readability.

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
\path[
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

The generator should include a comment listing required TikZ libraries if needed.

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
