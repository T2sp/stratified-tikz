# Phase 22A Implementation Prompt: Path arrow data model and TikZ option generation

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

Phase 21 is complete.

The editor now supports:

- 2D and 3D diagrams;
- preview-centered UI;
- paths, path templates, arc/circle/ellipse, sheets, filled regions/sheets, ruled surfaces, Coons patches, curved surfaces;
- symbolic variables and coordinate expressions;
- grid/lattice generation;
- custom work planes;
- camera controls;
- layer manager;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo;
- SVG preview and TikZ generation.

Phase 22 adds:

1. Arrow options for 2D and 3D paths.
2. Mid-segment arrow decorations, similar to TikZ `decorations.markings`.
3. Path direction reversal.
4. 2D-only braided monoidal category string-diagram crossing controls:
   - detect path intersections;
   - click an intersection to toggle:
     - no braiding;
     - braiding;
     - anti-braiding;
   - avoid relying on the TikZ `knot` package because it tends to conflict with decorations.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- UI overlay/draft state should not be stored in `Diagram`.
- Arrow/braiding data that affects TikZ output should be persisted.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- TikZ indentation must remain 4 spaces.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, and all existing geometry behavior.


## Goal

Add a persistent arrow/decorations data model for 2D and 3D paths, and implement TikZ option generation for arrowheads.

This subphase focuses on model, validation, save/load, and TikZ option string generation. UI/SVG rendering comes later.

## Required arrow features

Support:

1. Ordinary endpoint arrows.
2. Mid-segment arrowheads using TikZ `decorations.markings`, equivalent to styles like:

```tex
->-/.style={
    postaction={decorate},
    decoration={
        markings,
        mark=at position #1 with {\arrow{>}}
    }
},
-<-/.style={
    postaction={decorate},
    decoration={
        markings,
        mark=at position #1 with {\arrow{<}}
    }
}
```

3. Default mid-arrow position:

```text
0.5
```

4. Arrow head choices:

```text
\arrow{>}
\arrow{Stealth}
\arrow{Latex}
\arrow{Stealth[harpoon]}
\arrow{Stealth[harpoon,swap]}
```

The default is:

```text
\arrow{>}
```

5. Direction should be reversible later. This subphase should include enough model support for future path direction reversal.

## Scope

Implement:

- arrow option data model;
- validation helpers;
- save/load support;
- TikZ option generation for endpoint and mid-arrow decorations;
- library requirement detection for `decorations.markings` and `arrows.meta`;
- tests.

Do not implement yet:

- Inspector UI;
- SVG arrow rendering;
- actual reverse-direction UI;
- braiding/intersection detection;
- crossing toggles;
- new geometry.

## Data model

Add arrow options to path/curve style or path-specific metadata.

Suggested:

```ts
type ArrowHeadKind =
  | "standard"              // \arrow{>}
  | "stealth"               // \arrow{Stealth}
  | "latex"                 // \arrow{Latex}
  | "stealthHarpoon"        // \arrow{Stealth[harpoon]}
  | "stealthHarpoonSwap";   // \arrow{Stealth[harpoon,swap]}

type EndpointArrowMode =
  | "none"
  | "forward"
  | "backward"
  | "both";

type MidArrowDecoration = {
  enabled: boolean;
  position: number; // default 0.5, valid 0 < position < 1
  direction: "forward" | "backward";
  head: ArrowHeadKind;
};

type PathArrowOptions = {
  endpoint: EndpointArrowMode;
  mid: MidArrowDecoration;
};
```

Exact shape can differ.

Requirements:

- applies to 2D and 3D path/curve strata;
- supports ordinary curves, concatenated paths, arc/circle/ellipse templates, and existing path-like curve objects as practical;
- default is no endpoint arrow and no mid arrow unless user selects it;
- default mid-arrow position is `0.5` when mid arrow is enabled;
- default arrow head kind is `standard`;
- invalid position rejected;
- invalid head kind rejected;
- old diagrams without arrow options load with defaults.

## TikZ arrow generation

### Endpoint arrows

Endpoint arrows may use normal TikZ arrow syntax:

```tex
->, <-, <->
```

or equivalent arrows.meta syntax when a nonstandard head is selected.

If endpoint arrow head shape is also configurable, use a valid tested TikZ syntax.

MVP acceptable:

- endpoint arrows support direction modes with default TikZ arrow heads;
- custom arrow head shapes are required for mid-arrow decorations.

If endpoint arrow shape customization is implemented, test it carefully.

### Mid-arrow decoration

Generate TikZ options equivalent to:

```tex
postaction={decorate},
decoration={
    markings,
    mark=at position 0.5 with {\arrow{>}}
}
```

For backward mid arrows, use a valid TikZ markings syntax.

Required:

- default forward mid arrow uses `\arrow{>}`;
- backward default uses `\arrow{<}` or another valid reversed equivalent;
- custom heads use one of the configured arrowhead strings.

If the exact reversed syntax for custom arrowheads is nontrivial, choose and test a valid approach. Do not emit obviously broken TikZ.

### Libraries

If mid-arrow decorations are used, generated TikZ must request or comment the required libraries according to existing project conventions:

```tex
\usetikzlibrary{decorations.markings}
```

If arrows.meta heads like `Stealth`, `Latex`, or harpoon options are used, request:

```tex
\usetikzlibrary{arrows.meta}
```

Respect standalone vs inline math setup placement and the project's existing library/comment policy.

Inline output must still have no blank lines.

## Validation

Reject:

- unknown arrow head kind;
- mid-arrow position not finite;
- mid-arrow position <= 0 or >= 1;
- invalid endpoint arrow mode;
- invalid mid-arrow direction.

## Tests

Add tests:

1. Old diagram without arrow options loads with defaults.
2. Valid arrow options validate.
3. Invalid mid-arrow position rejected.
4. Invalid arrow head kind rejected.
5. Endpoint forward arrow exports arrow option.
6. Endpoint backward arrow exports arrow option.
7. Endpoint both exports arrow option.
8. Mid-arrow default exports `mark=at position 0.5` and `\arrow{>}`.
9. Mid-arrow backward exports `\arrow{<}` or chosen valid reversed syntax.
10. `Stealth` mid-arrow exports `\arrow{Stealth}`.
11. `Latex` mid-arrow exports `\arrow{Latex}`.
12. `Stealth[harpoon]` exports correctly.
13. `Stealth[harpoon,swap]` exports correctly.
14. Required TikZ libraries are included/commented when needed.
15. Inline math output with arrow decorations has no blank lines.
16. Numeric path output without arrows unchanged.

## Documentation

Document:

- endpoint arrows;
- mid-arrow decoration;
- default position `.5`;
- arrow head choices;
- required TikZ libraries.

## Report after implementation

Please report:

- files modified;
- arrow data model;
- default options;
- TikZ option syntax;
- library handling;
- tests added/updated;
- test results;
- build results;
- limitations.
