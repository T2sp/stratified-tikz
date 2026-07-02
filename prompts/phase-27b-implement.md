# Phase 27B Implementation Prompt: Path inline nodes/vertices exported as `node[pos=..., ...]`

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

Implement path-attached inline nodes/vertices exported using TikZ syntax such as:

```tex
node[pos=0.5, above] {...}
```

This feature is for placing a node/vertex on a path without splitting or changing the path geometry. Actual path splitting is Phase 27C.

## Scope

Implement:

- path inline node/vertex data model;
- UI for adding/editing inline nodes on a path;
- SVG preview marker/label;
- TikZ export as `node[pos=..., ...]`;
- save/load/validation;
- tests.

Do not implement:

- path geometry split;
- new path segment types;
- graph layout;
- new node styling system beyond useful options;
- broad label system refactor.

## Data model

Suggested:

```ts
type PathInlineNode = {
  id: string;
  pathId: string;
  position: {
    kind: "globalPath"; // normalized along whole path
    value: number;      // 0 < value < 1
  } | {
    kind: "segment";
    segmentIndex: number;
    value: number;      // 0 < value < 1
  };
  text: string;
  options: {
    placement?: "above" | "below" | "left" | "right" | "center";
    sloped?: boolean;
    allowUpsideDown?: boolean;
    anchor?: string;
  };
  style?: ...;
};
```

Exact shape can differ.

MVP can store segment-local position if that maps more reliably to TikZ.

Requirements:

- attached to a path-like object;
- persists through save/load;
- path deletion deletes attached inline nodes;
- path duplication handles inline nodes according to existing duplicate policy;
- invalid position rejected;
- no stale path references.

## UI

Provide a path action:

```text
Add path node / Add vertex node
```

Workflow options:

1. Select a path, choose Add node, click on the path.
2. Or direct form:
   - path;
   - position;
   - text;
   - options.

The user specifically wants `node[pos=..., ...]`, so the UI should expose:

```text
pos: 0.5
options: above / below / sloped / ...
text:
```

Default:

```text
pos = 0.5
```

If the user intended a "vertex" marker, allow empty text or a small marker node.

## TikZ export

For a path with inline nodes, emit nodes in the path command where possible.

Example:

```tex
\draw (A) -- node[pos=0.5, above] {$f$} (B);
```

For multi-segment paths, decide:

### Preferred MVP

Attach to a specific segment and insert node after that segment operation.

Example:

```tex
\draw (A) -- node[pos=0.5, above] {$f$} (B) -- (C);
```

### Alternative

Global path position, converted to segment + local pos for export.

Requirements:

- inline nodes preserved in ordinary TikZ output;
- coordinateRef endpoints still export;
- arrow options preserved;
- inline math output no blank lines;
- 4-space indentation;
- if auto-visibility/sampled export cannot preserve inline nodes, fall back to ordinary reference/node-preserving export with comment.

## SVG preview

Show inline node at its evaluated path position.

Requirements:

- finite projected position;
- visually selected/editable when path/inline node selected;
- does not mutate path geometry;
- hit-testable if reasonable.

## Tests

Add tests:

1. Inline node validates with `pos=0.5`.
2. Invalid pos <=0 or >=1 rejected.
3. Save/load round-trip.
4. TikZ export contains `node[pos=0.5`.
5. Segment-local inline node appears on correct segment.
6. SVG preview position finite.
7. Deleting path removes/rejects attached inline nodes.
8. Path with coordinateRef and inline node exports both `(A)` and `node[pos=...]`.
9. Path with arrows and inline node preserves both.
10. Auto-visibility path export falls back or preserves node; no silent numeric/sampled loss.
11. Inline output no blank lines.
12. Old paths without inline nodes unchanged.

## Documentation

Document that this is TikZ `node[pos=...]` attachment and does not split path geometry.

## Report after implementation

Please report:

- files modified;
- model shape;
- UI workflow;
- TikZ insertion strategy;
- SVG preview behavior;
- auto-visibility fallback policy;
- tests added/updated;
- test results;
- build results;
- limitations.
