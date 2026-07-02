# Phase 27F Implementation Prompt: Phase 27 docs, combined tests, and interaction hardening

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

Also run:

```bash
git diff --check
```

Optional, only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```
## Project context

You are working on the StratifiedTikZ project.

The editor now has mature core editing features:

- 2D and 3D diagrams;
- preview-centered UI;
- cursor and direct creation;
- coordinate anchors and coordinate references;
- symbolic variables;
- global and work-plane-local symbolic coordinates;
- cursor snapping;
- multi-selection and bulk editing;
- symbolic-aware translation;
- path concatenation;
- layer merge/translation;
- custom work planes and camera controls;
- paths with arrows;
- 2D braiding/string-diagram crossings;
- grids/lattices;
- points, labels, paths, sheets, filled regions/sheets, ruled surfaces, Coons patches, and curved surfaces;
- layer palette/window;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 27 is an interaction/editing polish phase.

Prioritized features:

1. Selection cycling for overlapping objects.
2. Path inline nodes/vertices exported as `node[pos=..., ...]` on paths.
3. Path splitting at an interior point.
4. Style eyedropper between objects with the same `geometricKind`.
5. UI polish:
   - make the Layer window Actions popover/panel semi-transparent and easier to understand;
   - change Inspector numeric inputs to allow temporarily invalid text and show warnings instead of blocking input, so values like `.5` are easy to type;
   - rename Add path `Line/manual path` to something clearer like `Arbitrary path`.

Important conventions:

- UI-only state must not be stored in `Diagram`.
- Anything affecting exported TikZ must be persisted.
- Selection/cycling state is UI-only.
- Path inline nodes/vertices affect TikZ and must be persisted.
- Path split creates or updates geometry and must be undoable.
- Style eyedropper changes style only, not geometry.
- Inline math TikZ output must contain no blank lines.
- TikZ indentation remains 4 spaces.
- Preserve save/load, undo/redo, SVG preview, TikZ export, symbolic input, work-plane-local coordinates, coordinate anchors, layer manager, arrows, braiding, and existing geometry behavior.


## Goal

Polish and harden Phase 27 features with docs, examples, and combined regression tests.

## Scope

Implement:

- docs/help text updates;
- combined tests for Phase 27 features;
- performance and save/load hardening;
- final UI polish.

Do not implement new features beyond Phase 27A-E.

## Documentation

Update docs/help for:

- selection cycling and modifier key;
- path inline nodes with `node[pos=...]`;
- path split feature;
- style eyedropper;
- lenient numeric Inspector input;
- `Arbitrary path` naming.

## Combined tests

Add tests:

1. Selection cycling works with coordinate anchor + path + inline node overlap.
2. Path inline node survives save/load and TikZ export.
3. Split path with coordinateRef endpoints and arrows.
4. Split path with inline nodes and crossings cleanup.
5. Style eyedropper on multi-selected curves with arrows.
6. Inspector numeric `.5` edit followed by TikZ export.
7. Inline output no blank lines after all Phase 27 features.
8. 4-space indentation preserved.
9. Undo/redo for path split and style eyedropper.
10. Old diagrams load.

## Performance/hardening

- candidate collection for selection cycling bounded;
- path inline node preview sampling bounded;
- path split unsupported cases fail atomically;
- style eyedropper mixed selection fail atomic.

## Report after implementation

Please report:

- files modified;
- docs updated;
- combined tests;
- performance hardening;
- test results;
- build results;
- remaining limitations.
