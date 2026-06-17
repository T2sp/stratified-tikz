# Phase 15D Implementation Prompt: Filled region/sheet editing

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


## Project context

You are working on the StratifiedTikZ project.

Phase 14 is complete or near complete.

The project goal includes efficiently drawing 2D and 3D stratified diagrams with:

- closed paths;
- filled regions/sheets;
- translucent colored 2-dimensional strata;
- solid and dotted 1-strata;
- point markers;
- labels;
- coordinate axes;
- readable TikZ output.

Phase 15 now prioritizes closed-path filling in both 2D and 3D before more specialized curved surface primitives.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- In 2D:
  - codim 0 strata are regions;
  - codim 1 strata are curves;
  - codim 2 strata are points.
- In 3D:
  - codim 1 strata are sheets;
  - codim 2 strata are curves;
  - codim 3 strata are points.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Work planes are model-space editing aids.
- A 3D closed-path filled sheet in this phase should be planar and work-plane-local.
- Preview-only UI state should not be stored in `Diagram`.
- Generated TikZ must remain readable and should preserve style/layer semantics.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load, undo/redo, camera, work-plane, concatenated path, and existing creation/editing behavior.


## Goal

Add practical editing for filled regions and work-plane-filled sheets.

Users should be able to inspect and edit:

- style;
- layer;
- name;
- fill rule;
- boundary data where feasible.

## Prerequisites

Phases 15A-15C are complete.

## Scope

Implement:

- inspector support for filled regions/sheets;
- fill rule editing;
- style editing;
- boundary summary;
- boundary coordinate editing if feasible;
- undo/redo integration.

Do not implement:

- live linked boundaries;
- boolean operations;
- advanced self-intersection repair;
- arbitrary non-planar surfaces;
- curved surface primitives.

## Inspector behavior

Display:

- object kind:
  - Filled region;
  - Work-plane filled sheet;
- number of boundaries;
- fill rule:
  - nonzero;
  - evenOdd;
- layer;
- style;
- boundary segments summary.

MVP boundary editing options:

- allow editing boundary coordinates directly; or
- allow replacing boundaries from selected closed paths; or
- show read-only boundary summary if full editing is too large.

Preferred:

- support coordinate editing using existing path segment editors if practical.

Invalid edits must not create open/non-planar boundaries.

## Fill rule editing

Allow user to switch fill rule:

- nonzero;
- evenOdd.

SVG/TikZ updates immediately.

## Tests

Add tests:

1. Inspector summary for 2D filled region.
2. Inspector summary for 3D work-plane sheet.
3. Fill rule edit updates diagram.
4. Fill rule edit updates SVG/TikZ.
5. Style edit updates SVG/TikZ.
6. Layer edit updates layer-aware TikZ.
7. Invalid boundary edit rejected if editable.
8. Undo/redo style/fill-rule edit if testable.
9. Save/load preserves fill rule.

## Documentation

Document editing limitations.

## Report after implementation

Please report:

- files modified;
- inspector behavior;
- boundary editing policy;
- fill rule editing;
- tests added/updated;
- test results;
- build results;
- limitations.
