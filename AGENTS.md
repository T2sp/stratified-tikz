# Agent instructions

We are building **StratifiedTikZ**, a web editor for drawing stratified diagrams used in graphical calculus of higher categories.

The app supports both:

- 2D graphical calculus: diagrams in \mathbb{R}^2
- 3D graphical calculus: diagrams in \mathbb{R}^3

The outputs should be readable and robust TikZ source codes.

## Mathematical convention

The term **n-stratum** always means **codimension n**, not geometric dimension n.

In 2D mode:

- codim 0 stratum = 2-dimensional region
- codim 1 stratum = curve / wire
- codim 2 stratum = point / vertex / coupon

In 3D mode:

- codim 0 stratum = 3-dimensional region
- codim 1 stratum = surface / sheet
- codim 2 stratum = curve / line defect
- codim 3 stratum = point / junction

Use the field name `codim`.

Do not use `dimension` for this concept unless explicitly referring to actual geometric dimension.

## Ambient dimension

Every diagram has:

```ts
ambientDimension: 2 | 3
```

Do not assume that curves always have codim 2.

Do not assume that points always have codim 3.

Instead:

- in 2D mode, curves are codim 1 and points are codim 2
- in 3D mode, sheets are codim 1, curves are codim 2, and points are codim 3

Use `geometricKind` for the visual/geometric type:

- `"region"`
- `"sheet"`
- `"curve"`
- `"point"`

Use `codim` for mathematical codimension.

## Coordinate input

The editor must support both coordinate input methods:

- direct input: the user edits coordinates numerically
- cursor input: the user places or edits coordinates graphically on the canvas

In 2D mode, cursor input maps canvas positions to coordinates of the form `(x, y, 0)`.

In 3D mode, cursor input must use an active work plane, because a screen position alone does not determine a unique 3D point.

For 3D cursor input, support at least these work planes:

- xy-plane at fixed z
- xz-plane at fixed y
- yz-plane at fixed x

The TikZ generator must always use the model coordinates, regardless of whether they were created by direct input or cursor input.

## User-configurable visual styles

All strata must support user-configurable visual styles.

Each visible stratum should have a `style` object rather than only a fixed `styleId`.

The user must be able to freely choose:

- color
- opacity

For geometric 2-dimensional strata, i.e. `geometricKind: "sheet"`, the user must be able to choose:

- fill color
- fill opacity
- stroke color
- stroke opacity

For geometric 1-dimensional strata, i.e. `geometricKind: "curve"`, the user must be able to choose:

- stroke color
- stroke opacity
- line width
- line style

For geometric 0-dimensional strata, i.e. `geometricKind: "point"`, the user must be able to choose:

- point color
- point opacity
- point shape
- whether the point is filled or hollow
- point size

Important terminology:

- "2-dimensional stratum" here means geometric dimension 2.
- In 3D mode, sheets are codim 1.
- "1-dimensional stratum" here means geometric dimension 1.
- In 2D mode, curves are codim 1.
- In 3D mode, curves are codim 2.
- "0-dimensional stratum" here means geometric dimension 0.
- In 2D mode, points are codim 2.
- In 3D mode, points are codim 3.

Do not confuse geometric dimension with codimension.

## Default styles

Use these defaults unless the user changes them:

- sheets: light blue fill, opacity 0.35, matching blue stroke
- curves: black, solid line, line width 1.2pt, opacity 1
- points: black filled circle, size 3pt, opacity 1
- labels: black

## Style model

Use explicit style objects in the diagram model.

Avoid storing only preset names such as `styleId`.

Presets may exist in the UI, but the saved diagram should store explicit style values so that export is stable and independent of future changes to preset definitions.

## TikZ style output

The TikZ generator must preserve user-defined styles.

When exporting colors to TikZ, prefer named color definitions using `xcolor`.

For example:

```tex
\definecolor{stzBlueSheet}{HTML}{4D9DE0}
```

Then use readable style blocks or inline options such as:

```tex
fill=stzBlueSheet,
fill opacity=.35,
draw=stzBlueSheet,
draw opacity=1
```

The generator should avoid hard-coded color names when the user has chosen custom colors.

## Free text labels

The editor must support freely placed text labels.

A free text label is exported to TikZ as:

```tex
\node at (#1) {#2};
```

Here:

- `#1` is the label position
- `#2` is arbitrary user-provided text content

The label content is stored as raw text.

If the user wants mathematical notation, they should type it directly using LaTeX syntax, for example:

```text
$F$
$F^{(1)}L$
$\alpha \colon f \Rightarrow g$
```

The app must not automatically wrap label content in `$...$`.

The app must preserve the user-provided label content as much as possible.

Coordinates for labels can be entered in two ways:

- direct input: the user numerically enters the label position
- cursor input: the user places the label graphically on the canvas

As with strata coordinates:

- in 2D mode, label positions are interpreted as `(x, y, 0)`
- in 3D mode, cursor placement of labels uses the active work plane

Free text labels are independent from stratum labels.

A stratum may have an attached label, but the user may also create arbitrary standalone text labels.

## Partial style segments for curves

The editor should eventually support partial style changes along geometric 1-dimensional strata, i.e. curves.

This feature is primarily used to represent overlaps, under-crossings, or portions of a curve hidden behind another stratum.

Important terminology:

- "1-stratum" in this section means a geometrically 1-dimensional stratum.
- In the data model, this is `geometricKind: "curve"`.
- In 2D mode, such curves are codim 1.
- In 3D mode, such curves are codim 2.

The desired interaction is:

1. The user selects a curve.
2. The user selects a parameter range along the curve.
3. The selected range is rendered with a different line style, for example `densely dotted`.
4. The generated TikZ represents the curve as several path segments with different styles.

This feature is not required for the MVP.

For the MVP, it is acceptable to support only a single style per curve.

However, the data model should be designed so that partial curve style segments can be added later without a major rewrite.


## Development rules

- Use TypeScript strictly.
- Avoid `any`.
- Keep model, geometry, rendering, TikZ generation, and UI clearly separated.
- Do not add new dependencies without explaining why.
- Prefer small, testable pure functions.
- Add tests for data model, geometry, and TikZ generation.
- Do not rewrite unrelated files.
- Generated TikZ code must be human-readable.

## Preferred source layout

```text
src/
  model/
  geometry/
  tikz/
  rendering/
  ui/
  examples/
```

## Commands

Before considering a task complete, run:

```bash
npm run build
```

If tests are added later, also run:

```bash
npm test
```