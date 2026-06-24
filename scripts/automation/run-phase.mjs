import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// const phase = process.argv[2];
// const mode = process.argv[3] ?? "implement";

// const phases = {
//     "9B": {
//     branch: "phase/9b-layer-aware-tikz-output",
//     commitMessage: "Implement Phase 9B layer-aware TikZ output",
//     fixCommitMessage: "Fix Phase 9B same-layer TikZ ordering",
//     implementPrompt: "prompts/phase-9b-implement.md",
//     reviewPrompt: "prompts/phase-9b-review.md",
//     fixPrompt: "prompts/phase-9b-fix.md",
//     },
// };

// if (!phase || !phases[phase]) {
//   console.error("Usage: node scripts/automation/run-phase.mjs <phase>");
//   console.error(`Known phases: ${Object.keys(phases).join(", ")}`);
//   process.exit(1);
// }

// const spec = phases[phase];
const phaseInput = process.argv[2];
const mode = process.argv[3] ?? "implement";

if (!phaseInput) {
  console.error("Usage: node scripts/automation/run-phase.mjs <phase> [implement|fix]");
  console.error("Example: node scripts/automation/run-phase.mjs 9C");
  console.error("Example: node scripts/automation/run-phase.mjs 9C fix");
  process.exit(1);
}

const phase = phaseInput.toUpperCase();
const phaseLower = phase.toLowerCase();

const phaseSlugs = {
  "9B": "layer-aware-tikz-output",
  "9C": "layer-based-selection-filtering",
  "9D": "spath-save-integration",
  "10A": "remove-selected-elements",
  "10B": "direct-input-points-labels",
  "10C": "direct-input-paths-sheets",
  "10D": "cursor-drag-handle-editing",
  "10E": "multi-step-undo-and-redo",
  "11": "improve-control-points",
  "11C": "relative-bezier-tikz-export",
  "12A": "workplane-model-geometry",
  "12B": "workplane-origin-normal",
  "12C": "workplane-three-numeric-points",
  "12D": "workplane-existing-point-strata",
  "12E": "workplane-preview-creation",
  "12F": "workplane-camera-export-separation",
  "12G": "plane-local-direct-creation",
  "12H": "direct-creation-existing-point-sources",
  "12I": "workplane-local-bezier-metadata",
  "12J": "tikz-3d-scope-bezier-export",
  "13A": "3d-coordinate-axes-guide",
  "13B": "inspector-layout-stabilization",
  "13C": "workplane-toolbar-reorganization",
  "13D": "coordinate-source-highlighting",
  "13E": "orthographic-camera-model",
  "13F": "camera-controls-ui",
  "13G": "camera-aware-creation-dragging",
  "13H": "camera-presets-save-load",
  "13I": "tikz-camera-export-alignment",
  "13J": "perspective-projection-hardening",
  "14A": "concatenated-path-model",
  "14B": "same-plane-concatenated-path-creation",
  "14C": "concatenated-path-editing",
  "14D": "segment-style-overrides",
  "14E": "cross-workplane-concatenated-paths",
  "15A": "closed-boundary-fill-model",
  "15B": "create-fill-from-closed-paths",
  "15C": "fill-svg-tikz-evenodd",
  "15D": "filled-region-sheet-editing",
  "15E": "curved-sheet-model-sampling",
  "15F": "curved-sheet-render-export",
  "15G": "hemisphere-saddle-creation",
  "15H": "reference-diagram-presets-export",
  "16A": "layer-metadata-manager-foundation",
  "16B": "layer-rename-swap",
  "16C": "layer-duplicate-delete",
  "16D": "layer-translation",
  "16E": "layer-visibility-locking",
  "16F": "layer-manager-polish",
  "17A": "user-editable-style-presets",
  "17B": "external-tikz-style-references",
  "17C": "tikzset-style-import-parser",
  "17D": "imported-style-autodetect-preview",
  "17E": "custom-tikz-style-export",
  "17F": "style-manager-polish",
  "18A": "tikz-export-mode-model-ui",
  "18B": "inline-math-setup-baseline",
  "18C": "inline-math-no-blank-lines",
  "18D": "export-mode-polish-docs",
  "19A": "symbolic-expression-model",
  "19B": "variable-manager-pgfmathsetmacro",
  "19C": "symbolic-coordinate-input",
  "19D": "symbolic-tikz-export-integration",
  "19E": "grid-generation-model-preview",
  "19F": "grid-foreach-clip-export",
  "19G": "symbolic-grid-polish",
  "19H": "triangular-honeycomb",
  "20A": "ruled-coons-model-sampling",
  "20B": "ruled-surface-create-render-export",
  "20C": "coons-patch-create-render-export",
  "20D": "projected-render-depth-model",
  "20E": "surface-depth-sorting",
  "20F": "curve-occlusion-hidden-style",
  "20G": "point-label-visibility-ui",
  "20H": "auto-visibility-export-hardening",
  "21A": "preview-centered-ui-shell",
  "21B": "floating-toolbar-tool-model",
  "21C": "direct-input-drawer",
  "21D": "inspector-preview-drawer",
  "21E": "ibis-style-layer-window",
  "21F": "ui-overhaul-polish",
  "22A": "path-arrow-model-tikz",
  "22B": "path-arrow-ui-svg-reverse",
  "22C": "2d-path-intersection-detection",
  "22D": "braiding-crossing-state-ui",
  "22E": "braiding-render-export-no-knot",
  "22F": "arrow-braiding-polish",
  "23A": "example-bar-curated-layout",
  "23B": "toolbar-palette-add-path-polish",
  "23C": "camera-panel-below-preview",
};

function makePhaseSpec(phase) {
  const lower = phase.toLowerCase();
  const slug = phaseSlugs[phase] ?? "implementation";

  return {
    branch: `phase/${lower}-${slug}`,
    commitMessage: `Implement Phase ${phase}`,
    fixCommitMessage: `Fix Phase ${phase}`,
    implementPrompt: `prompts/phase-${lower}-implement.md`,
    reviewPrompt: `prompts/phase-${lower}-review.md`,
    fixPrompt: `prompts/phase-${lower}-fix.md`,
  };
}

const spec = makePhaseSpec(phase);

const env = {
  ...process.env,
  PATH: `/opt/homebrew/bin:${process.env.PATH ?? ""}`,
};

function run(command, args, options = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`);

  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function capture(command, args, options = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`);

  const result = spawnSync(command, args, {
    encoding: "utf8",
    env,
    ...options,
  });

  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }

  return result.stdout;
}

function assertCleanWorkingTree() {
  const status = capture("git", ["status", "--porcelain"]);
  if (status.trim()) {
    console.error("Working tree is not clean. Commit or stash changes first.");
    console.error(status);
    process.exit(1);
  }
}

function branchExists(branch) {
  const result = spawnSync("git", ["rev-parse", "--verify", branch], {
    encoding: "utf8",
    env,
  });
  return result.status === 0;
}

function checkoutPhaseBranch(branch) {
  if (branchExists(branch)) {
    run("git", ["checkout", branch]);
  } else {
    run("git", ["checkout", "-b", branch]);
  }
}

function runCodex(promptFile, logFile) {
  const prompt = readFileSync(promptFile, "utf8");

  console.log(`\nRunning Codex with prompt: ${promptFile}`);

  const codexBin = process.env.CODEX_BIN ?? "codex";

  const codexPathCheck = spawnSync("which", [codexBin], {
    encoding: "utf8",
    env,
  });

  const args = [
    "exec",
    "--sandbox",
    "workspace-write",
    "-c",
    "model_reasoning_effort=xhigh",
    prompt,
  ];

  const result = spawnSync(codexBin, args, {
    encoding: "utf8",
    env,
    maxBuffer: 1024 * 1024 * 50,
  });

  const combined = [
    `COMMAND: ${codexBin} ${args.map((a) => JSON.stringify(a)).join(" ")}`,
    `PATH: ${env.PATH}`,
    `which codex status: ${codexPathCheck.status}`,
    `which codex stdout: ${codexPathCheck.stdout ?? ""}`,
    `which codex stderr: ${codexPathCheck.stderr ?? ""}`,
    `status: ${result.status}`,
    `signal: ${result.signal}`,
    `error: ${result.error ? String(result.error.stack ?? result.error) : ""}`,
    "",
    "STDOUT:",
    result.stdout ?? "",
    "",
    "STDERR:",
    result.stderr ?? "",
  ].join("\n");

  writeFileSync(logFile, combined);

  if (result.error) {
    console.error(`Failed to start Codex. See ${logFile}`);
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`Codex failed with status ${result.status}. See ${logFile}`);
    console.error(result.stderr ?? "");
    process.exit(result.status ?? 1);
  }

  console.log(result.stdout);
  return result.stdout;
}

function extractReviewJson(reviewText) {
  const match = reviewText.match(
    /REVIEW_JSON_START\s*([\s\S]*?)\s*REVIEW_JSON_END/,
  );

  if (!match) {
    throw new Error("Could not find REVIEW_JSON_START / REVIEW_JSON_END block.");
  }

  return JSON.parse(match[1]);
}

function runVerification() {
  run("npm", ["test"]);
  run("npm", ["run", "build"]);
}

mkdirSync("logs/codex", { recursive: true });

console.log(`Starting automated phase: ${phase}`);
console.log(`Branch: ${spec.branch}`);

assertCleanWorkingTree();
checkoutPhaseBranch(spec.branch);

// const promptToRun =
//   mode === "fix" ? spec.fixPrompt : spec.implementPrompt;

// const promptLogName =
//   mode === "fix" ? "fix" : "implement";

// const commitMessage =
//   mode === "fix" ? spec.fixCommitMessage : spec.commitMessage;

// if (mode === "fix" && !promptToRun) {
//   console.error(`No fixPrompt configured for phase ${phase}`);
//   process.exit(1);
// }

const promptToRun =
  mode === "fix" ? spec.fixPrompt : spec.implementPrompt;

const promptLogName =
  mode === "fix" ? "fix" : "implement";

const commitMessage =
  mode === "fix" ? spec.fixCommitMessage : spec.commitMessage;

if (mode !== "implement" && mode !== "fix") {
  console.error(`Unknown mode: ${mode}`);
  console.error("Use either 'implement' or 'fix'.");
  process.exit(1);
}

// runCodex(spec.implementPrompt, `logs/codex/${phase}-implement.log`);
runCodex(promptToRun, `logs/codex/${phase}-${promptLogName}.log`);

runVerification();

const reviewOutput = runCodex(
  spec.reviewPrompt,
  `logs/codex/${phase}-review.log`,
);

let reviewJson;
try {
  reviewJson = extractReviewJson(reviewOutput);
} catch (error) {
  console.error("Failed to parse review JSON.");
  console.error(error);
  console.error("Not committing.");
  process.exit(1);
}

writeFileSync(
  `logs/codex/${phase}-review-summary.json`,
  JSON.stringify(reviewJson, null, 2),
);

console.log("\nReview summary:");
console.log(JSON.stringify(reviewJson, null, 2));

if (!reviewJson.ready_to_commit) {
  console.error("\nReview found Critical or Medium issues. Not committing.");
  if (reviewJson.suggested_fix_prompt) {
    console.error("\nSuggested fix prompt:");
    console.error(reviewJson.suggested_fix_prompt);
  }
  process.exit(1);
}

runVerification();

const status = capture("git", ["status", "--porcelain"]);

if (!status.trim()) {
  console.log("No changes to commit.");
  process.exit(0);
}

run("git", ["status", "--short"]);
run("git", ["diff", "--stat"]);

run("git", ["add", "."]);
run("git", ["commit", "-m", commitMessage]);
run("git", ["push", "-u", "origin", spec.branch]);

console.log(`\nDone. Pushed ${spec.branch}.`);
