# Phase 23C Implementation Prompt: Camera UI below Preview with slider controls

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

Phase 22 is complete or near complete.

The editor now supports:

- preview-centered UI;
- floating toolbar inside SVG/PGF Preview;
- direct input drawer;
- inspector drawer;
- layer palette/window;
- camera controls;
- examples and JSON load/save;
- 2D/3D diagrams;
- paths with arrows;
- braiding/string-diagram crossings;
- custom work planes;
- symbolic variables;
- grids/lattices;
- sheets, filled regions/sheets, curved surfaces, ruled surfaces, Coons patches;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math output with no blank lines;
- save/load;
- undo/redo.

Phase 23 is a UI refinement phase.

The user wants three groups of changes:

1. Example bar placement and content.
2. Toolbar palette behavior and Add path menu simplification.
3. Camera UI relocation below the Preview and slider-based controls.

Important constraints:

- This is primarily UI/layout work.
- Do not change diagram geometry semantics.
- Do not change TikZ generation semantics unless required by an example asset integration.
- UI open/closed state should remain editor/UI state, not diagram data.
- Preserve all existing creation/editing behavior.
- Preserve save/load, undo/redo, SVG preview, TikZ source generation, camera/work-plane/layer/style/variable/grid/braiding behavior.


## Goal

Move the camera UI out of the PGF/SVG Preview overlay and place it below the Preview, above the TikZ Source panel.

Target layout:

```text
----------------
PGF/SVG Preview
----------------
Camera window
----------------
TikZ Source
----------------
```

The camera window should expose slider-based controls with keyboard/numeric input.

## User requirements

- The current camera window is on top of the PGF Preview.
- Move it below the Preview.
- The camera window should sit between Preview and TikZ Source.
- `theta` and `phi` should be sliders next to a 3D curvilinear-coordinate reference graphic/sample.
- Slider values should also be editable by keyboard/numeric input.
- `zoom`, `pan x`, and `pan y` should also be sliders with keyboard/numeric input.
- Preserve existing camera behavior and reset/presets if present.

## Scope

Implement:

- new Camera panel placement below Preview;
- removal or hiding of old preview-overlay camera window;
- slider + numeric input controls for:
  - theta;
  - phi;
  - zoom;
  - pan x;
  - pan y;
- compact 3D coordinate reference graphic/sample beside theta/phi controls;
- tests.

Do not implement:

- new camera projection model;
- perspective projection;
- new TikZ export semantics;
- new camera presets unless small;
- new dependencies.

## Layout

The Camera panel should appear after the Preview area and before TikZ Source.

Requirements:

- not overlaying the Preview;
- does not block canvas clicks;
- compact height;
- collapsible if the panel is tall;
- visible only for 3D diagrams, or disabled/compact for 2D according to existing camera policy;
- responsive on narrow screens.

Suggested:

```text
PreviewPanel
CameraPanel
TikzSourcePanel
```

## Theta/Phi controls

Controls:

```text
theta: [slider] [number input]
phi:   [slider] [number input]
```

Requirements:

- slider and numeric input stay synchronized;
- keyboard input works;
- invalid numeric input rejected or clamped according to existing policy;
- existing tikz-3dplot theta/phi convention preserved;
- updating theta/phi updates preview and TikZ output as before.

Recommended ranges:

- theta: existing valid range or `0..180`;
- phi: existing valid range or `-180..180` / `0..360`;
- preserve existing behavior if already established.

## 3D coordinate reference graphic/sample

Next to theta/phi controls, show a small visual reference for 3D curvilinear/camera angles.

MVP acceptable:

- a small SVG icon showing x/y/z axes and theta/phi labels;
- static graphic;
- does not need to be mathematically animated.

Better:

- orientation hints update slightly with theta/phi.

No new dependency.

Requirements:

- compact;
- does not affect diagram preview;
- purely explanatory UI.

## Zoom/Pan controls

Controls:

```text
zoom:  [slider] [number input]
pan x: [slider] [number input]
pan y: [slider] [number input]
```

Requirements:

- slider and numeric input synchronized;
- zoom remains positive;
- invalid input rejected/clamped;
- pan ranges reasonable;
- existing Fit/Reset behavior preserved if present;
- TikZ export policy for zoom/pan remains unchanged.

## Remove old overlay camera window

If the old camera window lived inside Preview overlay:

- remove it;
- or hide it when the new Camera panel exists;
- ensure there is not duplicate camera UI.

If a compact camera button remains in Preview from Phase 21, decide whether it should scroll/jump to the panel or toggle panel collapse. Report policy.

Preferred:

- no large camera overlay inside Preview.
- a small Camera button may remain only if it controls panel visibility and does not duplicate controls.

## Tests

Add focused tests:

1. Camera panel renders below Preview for 3D diagrams.
2. Old preview-overlay camera controls are not duplicated.
3. Theta slider updates camera theta.
4. Theta numeric input updates slider/camera.
5. Phi slider updates camera phi.
6. Zoom slider updates camera zoom and remains positive.
7. Pan x/y sliders update pan.
8. Invalid numeric input rejected/clamped.
9. Reset camera still works.
10. TikZ camera output reflects theta/phi changes if existing export supports it.
11. 2D diagrams hide/disable camera panel according to policy.
12. Camera panel open/collapse state is UI-only and does not affect diagram JSON/TikZ except camera values themselves.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Open 3D example.
2. Camera panel appears below Preview.
3. Camera controls are not covering Preview.
4. Theta slider changes view.
5. Theta numeric input changes view.
6. Phi slider/input changes view.
7. Zoom slider/input works.
8. Pan x/y sliders/inputs work.
9. Reset/Fit works if present.
10. TikZ source updates theta/phi.
11. Open 2D example.
12. Camera panel hides or disables according to policy.
13. Preview clicks are not blocked by camera controls.

## Preserve existing behavior

Do not regress:

- camera model;
- theta/phi tikz-3dplot alignment;
- reset/fit/presets;
- preview projection;
- camera-aware cursor creation/dragging;
- TikZ export;
- SVG pointer mapping;
- Preview toolbar/layer/inspector/direct drawers;
- save/load;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- Camera panel placement;
- old overlay removal/hide policy;
- slider/input synchronization;
- theta/phi ranges;
- coordinate reference graphic behavior;
- 2D behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
