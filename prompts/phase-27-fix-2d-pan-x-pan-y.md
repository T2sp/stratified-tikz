# Phase 27 / Camera Fix Prompt: Add pan x / pan y controls for 2D preview

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

## Context

You are working on the StratifiedTikZ project.

The editor already has camera/preview controls for 3D diagrams, including:

- `theta`;
- `phi`;
- `zoom`;
- `pan x`;
- `pan y`;
- reset / fit / presets where applicable.

The user now wants `pan x` and `pan y` to work in 2D diagrams as well.

Current likely behavior:

- 2D preview supports zoom or fit behavior, but not explicit `pan x` / `pan y` controls.
- 3D camera panel exposes pan controls.
- 2D diagrams lack manual pan controls, making it harder to position the SVG/PGF Preview when working on large or off-center diagrams.

## Goal

Add 2D `pan x` and `pan y` support to the preview/camera model and UI.

Required behavior:

1. 2D diagrams should expose manual `pan x` and `pan y` controls.
2. 2D pan should affect the SVG/PGF Preview transform.
3. 2D pan should not affect TikZ geometry or exported TikZ source.
4. 2D pan should be UI/editor view state, like preview zoom/pan.
5. Reset / Fit behavior should handle 2D pan predictably.
6. 3D camera behavior must remain unchanged.
7. Tests should cover 2D pan state, UI, preview transform, reset/fit, and TikZ-export invariance.

## Scope

This is a targeted camera/preview interaction fix.

Implement:

- 2D `pan x` / `pan y` state;
- 2D pan controls in the Camera/Preview control panel;
- preview projection/transform integration;
- reset/fit behavior;
- tests.

Do not implement:

- 2D rotation;
- 2D camera theta/phi;
- new TikZ export semantics;
- new geometry transformations;
- new coordinate model behavior;
- broad UI redesign;
- new dependencies.

Do not change:

- diagram geometry;
- coordinates;
- cursor/direct input semantics;
- symbolic coordinate semantics;
- TikZ export;
- save/load format unless view settings are already persisted;
- 3D camera/tikz-3dplot alignment.

## Design policy

### 2D pan is preview-only

2D pan should change only the preview viewport.

It must not change:

- point coordinates;
- path coordinates;
- coordinate anchors;
- work-plane-local coordinates;
- grid/lattice data;
- layer positions;
- TikZ output.

This is analogous to panning a canvas in a drawing app.

### 2D pan should share concepts with 3D pan

If the project already has a `camera` or `previewCamera` model with:

```ts
panX
panY
zoom
```

extend it to be usable in 2D.

If 3D has a richer camera object:

```ts
thetaDeg
phiDeg
zoom
panX
panY
```

then 2D can use a simpler view state:

```ts
type PreviewView2D = {
  zoom: number;
  panX: number;
  panY: number;
};
```

or reuse the common fields.

Preferred:

- share `zoom`, `panX`, and `panY` helpers between 2D and 3D;
- keep 3D `theta`/`phi` 3D-only.

## UI requirements

In 2D diagrams, show a compact Camera/Preview panel with:

```text
zoom
pan x
pan y
Reset
Fit
```

Do not show:

```text
theta
phi
3D coordinate reference graphic
3D presets
```

unless current UI intentionally displays disabled 3D controls.

### Slider + numeric input

For `pan x` and `pan y`, use the same style as the 3D Camera panel:

```text
pan x: [slider] [number input]
pan y: [slider] [number input]
```

Requirements:

- slider and numeric input stay synchronized;
- keyboard input works;
- temporary invalid numeric drafts should follow the updated lenient Inspector/numeric input policy if shared;
- invalid committed values rejected or clamped;
- pan ranges should be broad enough for practical panning;
- no overlapping layout.

### Placement

Use the current Phase 23C layout:

```text
Preview
Camera / Preview controls
TikZ source
```

For 2D, the panel may be called:

```text
Preview view
```

or still:

```text
Camera
```

Preferred label:

```text
View
```

or:

```text
Preview view
```

because 2D has no camera angle.

## Preview transform semantics

For 2D diagrams, the preview coordinate mapping should include:

```text
screenX = baseProjectionX * zoom + panX
screenY = baseProjectionY * zoom + panY
```

or the equivalent existing transform pipeline.

Requirements:

- panning changes the displayed position of all rendered geometry;
- hit testing/cursor coordinate inverse mapping remains correct;
- coordinate anchor markers pan with the diagram;
- selection/cycling hit tests use the transformed positions correctly;
- drag/cursor creation still maps screen coordinates back to diagram/work-plane coordinates correctly.

## Cursor and hit-testing behavior

Panning must not break cursor input.

After pan:

- clicking a visible point on the screen should still map to the intended diagram coordinate;
- Add point / Add coordinate / Add path cursor creation should place geometry where the user clicks in diagram space;
- selection hit testing should still line up with rendered geometry;
- coordinate anchors should still be selectable.

Add tests if the project has projection/inverse mapping helpers.

## Reset and Fit

Define clear behavior.

### Reset

For 2D diagrams, Reset should restore:

```text
zoom = initial/default zoom
panX = 0
panY = 0
```

or whatever initial 2D view state is.

Do not alter geometry.

### Fit

Fit should:

- compute bounds of visible diagram objects according to existing policy;
- set zoom and pan so the diagram fits in preview;
- include/exclude hidden coordinate anchors according to existing show/hide fit policy;
- not alter geometry.

If Fit previously only adjusted zoom, update it to also set pan.

## Save/load policy

Decide whether 2D pan is persisted.

Preferred:

- if 3D camera view state is currently persisted in diagram JSON, follow the same policy for 2D pan;
- if 3D pan is UI-only, keep 2D pan UI-only.

Important:

- TikZ export must not change due to pan.
- If persisted, save/load should restore editor view only.

Report the chosen policy.

## TikZ export

2D pan must not be exported.

Tests should verify:

- same diagram with different 2D pan values produces identical TikZ output;
- inline mode unaffected;
- standalone mode unaffected.

## Tests

Add focused tests.

### Model/state tests

1. 2D default view has finite `panX` and `panY`.

2. Updating 2D `panX` changes preview view state.

3. Updating 2D `panY` changes preview view state.

4. Invalid pan input is rejected or draft-warning-handled according to UI policy.

5. 3D camera state remains unchanged by 2D pan changes.

### UI tests

6. 2D diagram shows `pan x` and `pan y` controls.

7. 2D diagram does not show `theta` / `phi` controls, or shows them disabled only if current policy says so.

8. 2D pan slider updates numeric input.

9. 2D pan numeric input updates slider.

10. Reset clears 2D pan.

11. Fit updates 2D pan and zoom.

### Preview/projection tests

12. 2D pan changes projected screen coordinates by the expected offset.

13. Inverse hit mapping remains correct after pan.

14. Coordinate anchor marker position pans consistently.

15. Selection hit testing works after pan.

16. Cursor creation places geometry correctly after pan.

### TikZ tests

17. TikZ output is identical before and after changing 2D pan.

18. Inline TikZ output remains blank-line-free.

19. 4-space indentation preserved.

### Regression tests

20. 3D camera pan/zoom/theta/phi tests still pass.

21. 3D TikZ camera export still uses theta/phi as before.

22. Existing 2D zoom behavior remains unchanged except for pan integration.

## Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Open Empty 2D.
2. Confirm `pan x` and `pan y` controls are visible in the View/Camera panel.
3. Draw a few objects.
4. Adjust `pan x`.
5. Confirm preview moves horizontally.
6. Adjust `pan y`.
7. Confirm preview moves vertically.
8. Click/select objects after panning.
9. Confirm hit testing is still aligned.
10. Add a point after panning.
11. Confirm it appears where clicked.
12. Click Reset.
13. Confirm pan returns to default.
14. Click Fit.
15. Confirm diagram is centered/fitted.
16. Generate TikZ before and after pan.
17. Confirm TikZ geometry/source is unchanged.
18. Open a 3D diagram.
19. Confirm existing 3D camera controls still work.

## Preserve existing behavior

Do not regress:

- 3D camera controls;
- 3D TikZ camera export;
- 2D geometry;
- cursor input;
- direct input;
- coordinate anchors;
- selection cycling;
- inline path nodes;
- layer manager;
- TikZ output;
- save/load;
- undo/redo.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Optional:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Only treat lint as required if the repository is already lint-clean.

## Report after implementation

Please report:

- files modified;
- 2D pan state model;
- UI placement/label;
- slider/numeric input behavior;
- reset/fit behavior;
- save/load policy;
- hit-testing/cursor mapping changes;
- TikZ export invariance;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
