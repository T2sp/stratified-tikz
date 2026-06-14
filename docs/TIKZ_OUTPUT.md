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
% Codimension 1 strata: curves
% ----------------------------------------------------------------------------

% ----------------------------------------------------------------------------
% Codimension 2 strata: points
% ----------------------------------------------------------------------------

% ----------------------------------------------------------------------------
% Labels
% ----------------------------------------------------------------------------
```

## Output sections in 3D mode

In 3D mode, group output as:

```tex
% ----------------------------------------------------------------------------
% Coordinates
% ----------------------------------------------------------------------------

% ----------------------------------------------------------------------------
% Codimension 1 strata: sheets
% ----------------------------------------------------------------------------

% ----------------------------------------------------------------------------
% Codimension 2 strata: curves
% ----------------------------------------------------------------------------

% ----------------------------------------------------------------------------
% Codimension 3 strata: points
% ----------------------------------------------------------------------------

% ----------------------------------------------------------------------------
% Labels
% ----------------------------------------------------------------------------
```

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

## Label section

Labels should be emitted near the end of the TikZ output.

In both 2D and 3D modes, use the section:

```tex
% ----------------------------------------------------------------------------
% Labels
% ----------------------------------------------------------------------------
```

Each label should be emitted as a separate TikZ node.

The output should remain readable.

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