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
snapshots used by ruled surfaces and Coons patches. A linked Coons patch also
keeps the expressions and provenance in its materialized boundary snapshots,
including while those snapshots are frozen as last-valid fallback data. In 3D
mode, direct input and inspector editing can also store symbolic
work-plane-local coordinates `(a,b)` against a saved work-plane frame snapshot.
SVG preview still uses the finite global `Vec3` obtained from that local source.

## Work-Plane-Local Symbolic Coordinates

In 3D direct input, choose `Active work-plane local coordinates` to enter local
plane scalars instead of global `x,y,z`. The visible fields are `Plane x / a`
and `Plane y / b`; `z` is not an editable local coordinate. The entered scalars
use the same expression grammar and variable table as global symbolic
coordinates. For example, with:

```text
R = 2
q = 45
```

the direct local input:

```text
a = R*cos(q)
b = R*sin(q)
```

stores a snapshot of the active work-plane frame and evaluates the preview point
as:

```text
P = frame.origin + preview(a)*frame.u + preview(b)*frame.v
```

The Inspector uses the same local model for selected points and free labels
whose positions were saved with a `workPlaneLocal` source. Editing `a` or `b`
changes the local scalar expression and recomputes the finite global preview;
it does not convert the coordinate to global symbolic `x,y,z` expressions.

Cursor snap is unrelated to this direct symbolic workflow. Snap can quantize
cursor placement and drag handles, but direct numeric input, direct symbolic
input, Inspector symbolic edits, JSON load, and TikZ export are not silently
snapped.

TikZ export preserves same-frame local expressions where practical by entering
a TikZ `3d` library plane scope and writing the geometry in local `(a,b)`
coordinates:

```tex
\begin{scope}[
    plane origin={(0,0,0)},
    plane x={(1,0,0)},
    plane y={(0,0,1)},
    canvas is plane
]
    \draw ({\R * cos(\q)},{\R * sin(\q)}) -- ({\R + 1},0);
\end{scope}
```

If a path or sheet mixes global coordinates with local coordinates, uses
multiple stored frames, or reaches a sampled mesh output path, export falls back
to finite global preview coordinates with an explicit comment. It does not
expand local symbolic expressions into global symbolic formulas. Sampled curved
surface, ruled-surface, and Coons-patch mesh exports currently use numeric
preview samples even when their saved boundary snapshots contain local symbolic
source metadata.

## Symbolic Translation Policy

Phase 24D implements translation as the only geometric transform. General
affine transforms such as rotation, scaling, and shear are intentionally
deferred.

For every translated coordinate component, the model applies:

```text
P' = P + d
```

Numeric components remain numeric when both `P` and `d` are numeric. If either
side is symbolic, the translated component stores a symbolic addition
expression, for example:

```text
R*cos(q) + 1  ->  (R*cos(q)) + 1
R*cos(q) + a  ->  (R*cos(q)) + (a)
```

Numeric `+ 0` is omitted. Symbolic deltas are parsed with the same scalar
expression grammar as coordinate input, evaluated against the diagram's current
variables, and rejected if they contain unknown variables or non-finite preview
values. Existing symbolic coordinate previews are refreshed during translation,
so stale preview values are not carried forward.

In 2D diagrams, translation uses `dz = 0` and keeps every model `z` coordinate
numeric and equal to `0`. It never creates symbolic `z` metadata for 2D
objects.

Stored work-plane or surface frames translate only their `origin`. Basis vectors
`u`, `v`, and `normal` are copied unchanged because Phase 24D does not rotate,
scale, or shear frames. This applies to arc and path-template frames, grid
frames, work-plane-filled sheets, ruled and Coons boundary snapshots, and curved
surface frames.

For coordinates with `workPlaneLocal` source metadata, global translation uses
the stored local model directly:

```text
P = frame.origin + a*u + b*v
P' = (frame.origin + d) + a*u + b*v
```

The local scalar expressions `a` and `b` are left unchanged, including symbolic
expressions. The stored frame snapshot is object data, not the active work
plane, so translation moves each coordinate's own copied frame origin and never
mutates the active/global work-plane UI state. Work-plane-local translation, when
performed by editing local coordinates, updates `a` and `b`; the global
translation operation does not rewrite local coordinates into global symbolic
formulas.

## JSON Import With Symbolic Variables

When a saved JSON diagram contains symbolic variables or active symbolic
coordinate expressions, loading pauses at a variable-resolution dialog. Saved
variable definitions are prefilled, and variables referenced by active model
inputs but missing from the file are shown with empty inputs. Confirming the
dialog validates the variable expressions with the same scalar-expression
evaluator, rejects cycles, unknown variables, unsafe tokens, and non-finite
preview values, then refreshes the applicable symbolic preview coordinates
before the diagram is committed.

Canceling the dialog leaves the current editor diagram unchanged. Ruled-surface
snapshots and static Coons snapshots remain active symbolic inputs: expressions
such as `.5*Len`, `-.5*Len`, and `R` require variables and are refreshed during
import. Work-plane frame snapshots nested in those active boundary segments are
refreshed at the same time; a symbolic frame is accepted only when `origin`,
`u`, `v`, and `normal` evaluate to finite preview vectors and the evaluated
frame is geometrically valid.

For a linked Coons patch, the linked source strata own the active symbolic
dependencies. Its four materialized boundaries are saved snapshots, not a
second set of active inputs. If the link is stale, the frozen snapshots remain
the authoritative last-valid numeric preview geometry. A variable referenced
only by those frozen snapshots is therefore not requested during UI import.
The snapshot expressions and provenance are still preserved exactly for
persistence, inspection, detaching, and recovery; they are not stripped or
rewritten. Once every source is valid again, synchronization atomically replaces
all four fallback boundaries with freshly resolved snapshots.

Work-plane-local coordinate sources participate in the same import path. The
loader detects variables in local `a` and `b` scalar expressions and in the
stored frame snapshot fields. After the variable-resolution dialog is
confirmed, local scalar previews, symbolic frame previews, and the resulting
global `Vec3` preview are recalculated before validation and rendering.
Malformed local sources, unresolved variables, stale non-finite previews, and
frames that do not evaluate to an orthonormal right-handed frame are rejected
without replacing the current diagram.

The refresh pass covers local sources stored on point and label positions, path
segment vertices and cubic controls, arc centers and frames, polygon sheet
vertices, filled boundary segments, work-plane-filled sheet frames and
boundaries, grid frame snapshots, ruled-surface snapshots, and static Coons
boundary snapshots, including constant-point Coons boundaries. Linked Coons
patches instead refresh their active source strata; their materialized snapshots
remain unchanged until successful source synchronization. Unsupported or
malformed placements are rejected during load/validation rather than saved as
partially refreshed data.

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

Triangular lattices use `s = uRange.step` as their spacing. Their local lattice
origin is `(uRange.min, vRange.min)`, and their canonical basis is

```text
a = (s, 0)
b = (s/2, sqrt(3)s/2)
```

Thus every vertex is `origin + i*a + j*b` for integers `i,j`. The horizontal,
+60 degree, and -60 degree line families all pass through those vertices. The
saved range rectangle and rectangular clip only bound the visible domain; clip
minima do not reset the phase. Changing `s` therefore scales the lattice about
the same saved local origin. `vRange.step` remains persisted and must still be a
positive finite value for compatibility with the common grid range schema, but
triangular geometry does not use it; silently reinterpreting it would change
saved JSON semantics.

The implementation computes coordinates directly from normalized integer
indices rather than repeatedly adding floating-point steps. A shared absolute
epsilon of `1e-9` includes mathematically coincident lines on range and clip
boundaries without accumulating drift.

Honeycomb lattices use `uRange.step` as the hexagon edge length and export as
nested loops over flat-top hexagon centers inside the rectangular clip. SVG
preview de-duplicates honeycomb shared edges; the compact TikZ MVP draws clipped
hexagon paths per cell, so shared edges may be overdrawn.

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
