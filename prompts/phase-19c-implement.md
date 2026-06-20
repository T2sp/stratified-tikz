# Phase 19C Implementation Prompt: Symbolic coordinate input in inspector and direct creation

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.

This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

Also run if available:

```bash
git diff --check
```
## Project context

You are working on the StratifiedTikZ project.

Phase 18 is complete.

The editor now supports:

- 2D and 3D diagrams;
- points, labels, curves, paths, path templates, sheets, filled regions/sheets, curved surfaces;
- custom work planes;
- camera controls;
- layer manager;
- style manager and external TikZ style references;
- standalone and inline math TikZ export modes;
- save/load;
- undo/redo;
- SVG preview;
- layer-aware TikZ output.

Phase 19 adds symbolic input and grid generation.

Core requirements:

1. Users can define variables in the toolbar.
   - TikZ output corresponds to `\pgfmathsetmacro`.
   - Invalid/dangerous inputs should be rejected before they can generate broken TikZ.

2. Coordinate inputs can accept expressions using variables and elementary functions.
   - Example:
     - variables: `R`, `q`
     - coordinate input: `(R*cos(q), R*sin(q))`
     - generated TikZ coordinate: `({\R * cos(\q)}, {\R * sin(\q)})`
   - SVG preview still needs numeric values, so expressions must be evaluated using variable preview values.

3. Add a grid-generation mode.
   - The grid should be represented compactly in TikZ using `\foreach`.
   - Range/clip controls should make grid boundaries concise.
   - In 3D, grids should be generated in a work-plane-local 2D frame when applicable.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all numeric preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Symbolic data that affects generated TikZ should be persisted in diagram/export data, not only UI state.
- UI-only draft state should not be stored in `Diagram`.
- TikZ export must remain readable and must respect standalone vs inline math export mode.
- Inline math export must still contain no blank lines.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve camera, work-plane, layer manager, style manager, save/load, undo/redo, SVG preview, and all existing geometry behavior.


## Goal

Allow coordinate inputs to accept symbolic expressions using user-defined variables and elementary functions.

Example:

Variables:

```text
R = 2
q = 30
```

Coordinate input:

```text
x = R*cos(q)
y = R*sin(q)
```

Generated TikZ coordinate:

```tex
({\R * cos(\q)}, {\R * sin(\q)})
```

SVG preview should use numeric preview values evaluated from variables.

## Prerequisites

Phases 19A and 19B are complete.

## Scope

Implement:

- symbolic coordinate model integration;
- inspector coordinate input support;
- direct creation coordinate input support;
- preview evaluation;
- TikZ coordinate output;
- save/load;
- tests.

Do not implement yet:

- cursor creation symbolic input;
- grid generation;
- raw TikZ snippets;
- `\foreach`.

## Coordinate model

Current model likely stores numeric `Vec3`.

Add support for symbolic components while preserving numeric preview values.

Suggested:

```ts
type CoordinateComponent =
  | { kind: "numeric"; value: number }
  | { kind: "symbolic"; expression: string; previewValue: number };

type SymbolicVec3 = {
  x: CoordinateComponent;
  y: CoordinateComponent;
  z: CoordinateComponent;
};
```

Alternatively, keep numeric geometry fields and add parallel symbolic metadata.

Important:

- SVG preview and editing must still have finite numeric `Vec3`.
- TikZ export should use symbolic expressions where present.
- Numeric-only diagrams should remain unchanged.

MVP can start with symbolic coordinate support for:

- points;
- labels;
- path/template parameters;
- filled boundaries;
- sheet vertices.

If full coverage is too large, prioritize:

1. point positions;
2. label positions;
3. direct-created path vertices;
4. inspector editing for existing coordinate fields.

But report limitations clearly.

## UI behavior

Coordinate inputs should allow switching per coordinate or per field:

```text
Coordinate mode:
  Numeric
  Symbolic
```

or allow text input that parses either numeric or symbolic.

Preferred:

- a single text field can accept `1.2` or `R*cos(q)`;
- if expression is numeric-only, store numeric;
- if expression references variables/functions, store symbolic.

Show preview numeric value if symbolic:

```text
x = R*cos(q)   preview: 1.732
```

Invalid input should not commit.

## Direct creation

Direct creation should support symbolic expressions in coordinate fields.

Examples:

2D point:

```text
x = R*cos(q)
y = R*sin(q)
```

3D point:

```text
x = R*cos(q)
y = R*sin(q)
z = h
```

Plane-local coordinates:

```text
a = R*cos(q)
b = R*sin(q)
```

If plane-local input is symbolic:

- evaluate numeric preview `(a,b)`;
- convert to model-space preview `Vec3`;
- export should preserve local symbolic expression only if existing export path supports plane-local symbolic output.
- Otherwise, export computed global symbolic coordinates or report limitation.

Preferred MVP:

- global coordinate symbolic export is required;
- plane-local symbolic direct input may evaluate preview and store global symbolic coordinates if feasible;
- if too complex, reject symbolic plane-local input for now with clear message.

## TikZ export

When a coordinate component is symbolic:

- export expression using variable macros;
- wrap with braces:

```tex
({\R * cos(\q)}, {\R * sin(\q)})
```

When component is numeric:

- export as before.

Mixed coordinates should work:

```tex
({\R}, 0, {h})
```

Do not emit preview numeric values into TikZ for symbolic components.

## Updates when variables change

If a variable value changes:

- preview positions of symbolic coordinates should update;
- generated TikZ should keep the same expressions;
- undo/redo behavior should be sensible:
  - changing variable is a diagram/export edit if variables are persisted;
  - dependent geometry preview updates automatically.

## Validation

Reject coordinate expressions if:

- unknown variables;
- invalid syntax;
- dangerous tokens;
- non-finite preview value;
- 2D z symbolic expression not zero unless policy permits.

In 2D:

- z should remain 0;
- symbolic z should generally be disallowed.

## Tests

Add tests:

1. Point x/y symbolic input stores expression and preview value.
2. `R*cos(q)` exports as `{\R * cos(\q)}` or equivalent.
3. `R*sin(q)` exports as `{\R * sin(\q)}`.
4. Mixed numeric/symbolic coordinate exports correctly.
5. Variable value change updates preview value.
6. Unknown variable rejected.
7. Invalid expression rejected.
8. Non-finite preview rejected.
9. 2D z remains 0.
10. Direct creation with symbolic point coordinates works.
11. Direct path creation with symbolic coordinates works if implemented.
12. Save/load round-trip preserves symbolic expressions.
13. Existing numeric coordinate editing unchanged.
14. Inline math output with symbolic coordinates has no blank lines.

## Documentation

Update docs:

- coordinate fields accept expressions;
- variables use `\pgfmathsetmacro`;
- trig uses degrees matching PGFMath;
- preview numeric value is evaluated in editor;
- unsupported cases.

## Preserve existing behavior

Do not regress:

- numeric coordinate input;
- cursor creation;
- direct creation;
- path/sheet/fill export;
- SVG preview;
- save/load;
- undo/redo;
- inline/standalone export modes.

## Report after implementation

Please report:

- files modified;
- coordinate model integration;
- UI behavior;
- supported element kinds;
- plane-local symbolic policy;
- TikZ expression output;
- variable update behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
