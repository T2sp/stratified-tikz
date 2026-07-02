# Phase 27A Implementation Prompt: Selection cycling for overlapping preview objects

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

Implement selection cycling for overlapping objects in the SVG/PGF Preview.

When multiple selectable targets overlap or are near the cursor, users should be able to cycle through candidates instead of being stuck with the highest-priority target.

## Scope

Implement:

- hit candidate collection;
- cycling interaction;
- visual/status feedback;
- tests.

Do not implement:

- marquee selection;
- new geometry editing;
- new selection model beyond cycling state;
- new dependencies.

## Desired interaction

Preferred MVP:

```text
Click:
  select the top-priority candidate as now

Alt/Option + click:
  cycle to the next candidate under the cursor

Repeated Alt/Option + click in the same area:
  cycle through all candidates

Esc or background click:
  clear cycling state
```

Alternative if platform modifier handling differs:

```text
Cmd/Ctrl+click or a small "cycle" button
```

Choose one and document.

## Candidate types

Candidate collection should include selectable preview targets:

- coordinate anchors, when shown;
- points;
- labels;
- paths/curves;
- sheets/regions if selectable;
- braiding/crossing markers;
- path inline nodes/vertices after Phase 27B if already available;
- geometry handles only if existing handle logic wants them included.

Do not include hidden/invisible/locked targets unless current selection rules allow them.

## Priority and cycling

Keep existing first-click priority.

For cycling candidates, produce a stable ordered list.

Suggested base priority:

```text
1. active drag/geometry handles
2. coordinate anchors
3. braiding/crossing markers
4. labels
5. points
6. path inline nodes/vertices
7. paths/curves
8. sheets/regions
```

Then sort by distance and stable id.

Cycling should rotate through the candidate list without changing geometry.

## Candidate area

Use existing hit-test tolerance if available.

Requirements:

- no excessive candidate collection over the whole diagram;
- finite projected coordinates only;
- respect layer filters and coordinate show/hide;
- 3D uses projected positions/hit tests as current preview does.

## UI feedback

Show some feedback when cycling:

```text
Selected 2/5: path "f"
```

or highlight the candidate.

Optional:

- small transient candidate count near cursor.

MVP status text is fine.

## Tests

Add tests:

1. Candidate collection returns multiple overlapping objects.
2. Normal click selects top-priority candidate.
3. Alt/Option click cycles to second candidate.
4. Repeated cycle wraps around.
5. Cycling state resets when cursor location changes significantly.
6. Hidden coordinate anchors are not candidates.
7. Layer-filter-hidden objects are not candidates.
8. Coordinate anchors still outrank paths on normal click.
9. Cycling does not mutate diagram.
10. TikZ output unaffected by cycling state.
11. Braiding marker clicks still toggle when not cycling, if applicable.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Place a coordinate anchor on top of a path and sheet.
2. Click normally and confirm top target selected.
3. Alt/Option-click repeatedly and confirm selection cycles through candidates.
4. Hide coordinates and confirm coordinate is not cycled.
5. Try overlapping label/point/path.
6. Confirm TikZ output unaffected.

## Preserve existing behavior

Do not regress:

- normal single-click selection;
- coordinate anchor priority;
- braiding marker toggle;
- geometry handle dragging;
- layer filter behavior;
- coordinate show/hide;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- cycling modifier/key choice;
- candidate ordering;
- reset behavior;
- feedback behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
