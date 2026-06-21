# Symbolic Input And Grids

## Variables

Diagram variables live in the saved diagram model. They are not toolbar-only UI
state. A variable has a letter-only name such as `R`, `q`, or `theta`, a
validated scalar expression, a finite numeric preview value, and a TikZ macro
name.

Valid examples:

```text
R = 2
q = 30
r = R/2
```

Variable and macro names currently use `[A-Za-z]+`. Names with digits or
underscores are rejected until StratifiedTikZ has a broader TeX macro policy.
Names that collide with scalar functions, constants, TikZ commands, PGF
commands, or dangerous TeX commands are also rejected.

TikZ export emits variables before geometry:

```tex
\pgfmathsetmacro{\R}{2}
\pgfmathsetmacro{\q}{30}
```

Dependent variables are emitted in dependency order:

```tex
\pgfmathsetmacro{\R}{2}
\pgfmathsetmacro{\r}{\R / 2}
```

## Expression Grammar

Coordinate and grid scalar fields use a limited PGFMath-like grammar:

```text
expression  := additive
additive    := multiplicative (("+" | "-") multiplicative)*
multiplicative := unary (("*" | "/") unary)*
unary       := ("+" | "-") unary | power
power       := primary ("^" unary)?
primary     := number | variable | constant | functionCall | "(" expression ")"
functionCall := functionName "(" expression ("," expression)* ")"
```

Supported constants: `pi`, `e`.

Supported functions: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sqrt`,
`abs`, `exp`, `ln`, `log`, `min`, `max`.

Trigonometric preview evaluation follows PGFMath/TikZ degree semantics. For
example, `cos(60)` evaluates to `0.5`; inverse trig functions return degrees.

Expressions are data, not raw TeX. The parser rejects backslashes, braces,
semicolons, newlines, unknown variables, unknown functions, invalid syntax,
division by zero, and non-finite preview results.

## Symbolic Coordinates

Coordinate inputs can mix numeric and symbolic components. With:

```text
R = 2
q = 30
```

this point input:

```text
x = R*cos(q)
y = R*sin(q)
```

exports as:

```tex
\coordinate (pointOrbit0p0) at ({\R * cos(\q)},{\R * sin(\q)});
```

The SVG preview still uses finite numeric `Vec3` coordinates. Symbolic
components therefore store both the source expression and the evaluated preview
value. In 2D diagrams, `z` remains hidden or locked to numeric `0`.

Symbolic global coordinates are supported for point positions, free-label
positions, ordinary curve vertices, absolute cubic controls, filled-boundary
path coordinates, 2D template centers, sheet vertices, and copied boundary
snapshots used by ruled surfaces and Coons patches. Active work-plane local
symbolic input and 3D template centers remain numeric-only in the MVP.

## JSON Import With Symbolic Variables

When a saved JSON diagram contains symbolic variables or symbolic coordinate
expressions, loading pauses at a variable-resolution dialog. Saved variable
definitions are prefilled, and referenced variables that are missing from the
file are shown with empty inputs. Confirming the dialog validates the variable
expressions with the same scalar-expression evaluator, rejects cycles,
unknown variables, unsafe tokens, and non-finite preview values, then refreshes
all symbolic preview coordinates before the diagram is committed.

Canceling the dialog leaves the current editor diagram unchanged. Boundary
surface snapshots are included in this refresh, so symbolic Coons or ruled
boundary coordinates such as `.5*Len`, `-.5*Len`, and `R` can load as long as
the confirmed variables produce finite numeric preview values. Work-plane frame
snapshots nested in those boundary segments are refreshed at the same time; a
symbolic frame is accepted only when `origin`, `u`, `v`, and `normal` evaluate
to finite preview vectors and the evaluated frame is geometrically valid.

## Grid Generation

Grid strata are saved as compact generated curve strata. They are not expanded
into many persisted polyline strata.

A grid stores:

- a frame;
- a lattice pattern: rectangular, triangular, or honeycomb;
- `uRange = min, max, step`;
- `vRange = min, max, step`;
- a rectangular clip `uMin, uMax, vMin, vMax`;
- curve style and layer metadata.

2D grids use the canonical xy frame at `z = 0`. 3D grids store a snapshot of
the active work-plane frame at creation time. Triangular and honeycomb grids are
still local 2D lattices; in 3D they are embedded by the saved work-plane frame,
not by the transient active work plane at export time.

Rectangular TikZ export uses two `\foreach` loops and `\clip`:

```tex
\begin{scope}
    \clip (0,0) rectangle (5,5);
    \foreach \stzGridU in {0,1,...,5} {
        \draw[...] (\stzGridU,0) -- (\stzGridU,5);
    }
    \foreach \stzGridV in {0,1,...,5} {
        \draw[...] (0,\stzGridV) -- (5,\stzGridV);
    }
\end{scope}
```

Triangular lattices use `uRange.step` as spacing and export as three looped line
families: horizontal, +60 degrees, and -60 degrees. Honeycomb lattices use
`uRange.step` as the hexagon edge length and export as nested loops over
flat-top hexagon centers inside the rectangular clip. SVG preview de-duplicates
honeycomb shared edges; the compact TikZ MVP draws clipped hexagon paths per
cell, so shared edges may be overdrawn.

For 3D work-plane grids, the loops run in a TikZ `3d` library plane scope:

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

The rectangular `\foreach` range triplets must be numeric in the MVP. Symbolic
range triplets are reported as unsupported symbolic grid ranges and are omitted
from TikZ with a comment rather than expanded line by line. Rectangular clip
endpoints may be symbolic when they parse and evaluate safely; for example,
`clip u max = R` exports as `({\R},...)`. Triangular and honeycomb compact loop
export currently requires numeric ranges, numeric spacing/edge length, and
numeric clip bounds.

## Error Categories

The UI and validation paths surface these user-facing categories:

- unknown variable;
- invalid expression;
- non-finite preview value;
- unsafe TikZ token;
- grid line count too large;
- invalid grid step;
- unsupported symbolic grid range.

Invalid expressions and invalid grids are rejected before they can mutate the
diagram or generate malformed TikZ.

## Limitations

StratifiedTikZ does not implement a full TeX parser, arbitrary raw TikZ
snippets, or symbolic geometry theorem proving. Symbolic grid generation is
limited to rectangular clip/range grids, and symbolic `\foreach` range triplets
for all lattice patterns are intentionally deferred.
