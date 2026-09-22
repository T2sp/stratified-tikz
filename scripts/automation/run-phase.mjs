import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
// Keep the identity guard fixed in the parent: a read-only review must not be
// able to redefine this guard or replace the in-memory report it checks.
// This guard neither runs verification nor selects/validates browser groups.
import { verificationMatchesCheckout } from "./phase-verification.mjs";

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
  console.error("Usage: node scripts/automation/run-phase.mjs <phase> [implement|fix|verify]");
  console.error("Example: node scripts/automation/run-phase.mjs 9C");
  console.error("Example: node scripts/automation/run-phase.mjs 9C fix");
  console.error("Example: node scripts/automation/run-phase.mjs 31C verify");
  process.exit(1);
}

const phase = phaseInput.toUpperCase();

if (!["implement", "fix", "verify"].includes(mode)) {
  console.error(`Unknown mode: ${mode}`);
  console.error("Use 'implement', 'fix', or 'verify'.");
  process.exit(1);
}

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
  "24A": "cursor-snap-coordinate-quantization",
  "24B": "multi-selection-state-ui",
  "24C": "bulk-style-layer-delete-duplicate",
  "24D": "bulk-symbolic-translation",
  "24E": "path-concatenation",
  "24F": "layer-merge-symbolic-translation",
  "24G": "editing-polish-hardening",
  "25A": "work-plane-local-symbolic-model",
  "25B": "work-plane-local-symbolic-ui",
  "25C": "work-plane-local-preview-import",
  "25D": "work-plane-local-tikz-export",
  "25E": "work-plane-local-editing-translation",
  "25F": "work-plane-local-polish",
  "26A": "coordinate-anchor-model-tikz",
  "26B": "add-coordinate-input-preview",
  "26C": "coordinate-references",
  "26D": "coordinate-inspector-editing",
  "26E": "coordinate-editing-integration",
  "26F": "coordinate-core-polish",
  "26G": "coordinate-preview-hide-hit-test",
  "26H": "coordinate-reference-detach-helpers",
  "26I": "coordinate-delete-detach-usage",
  "26J": "layer-translation-detach-coordinate-refs",
  "26K": "coordinate-detach-polish",
  "26L": "coordinate-multi-selection",
  "26M": "coordinate-translation-helper",
  "26N": "coordinate-translation-inspector",
  "26O": "coordinate-drag-translation",
  "26P": "coordinate-translation-polish",
  "27A": "selection-cycling",
  "27B": "path-inline-nodes",
  "27C": "path-splitting",
  "27D": "style-eyedropper",
  "27E": "ui-polish-actions-numeric-arbitrary-path",
  "27F": "interaction-polish-hardening",
  "28A": "preview-first-layout",
  "28B": "svg-export-edge-actions",
  "28C": "translucent-toolbar-zindex",
  "28D": "context-style-shortcuts",
  "28E": "toolbar-eyedropper-imported-style",
  "28F": "workplane-overlay-polar-input",
  "28G": "workplane-setup-ux",
  "28H": "coons-direction-lifecycle",
  "28I": "tikz-faithful-arrow-preview",
  "28J": "phase-28-polish-hardening",
  "28K": "svg-export-background-mode",
  "28L": "triangular-lattice-spacing-fix",
  "28M": "tikz-library-comment-continuations",
  "29": "live-linked-coons-boundaries",
  "30": "coons-patch-duplicate-translate",
  "31A": "tex-label-input-contract",
  "31B": "tex-label-svg-adapter",
  "31C": "tex-free-label-preview",
  "31D": "tex-path-inline-labels",
  "31E": "tex-label-svg-export",
  "31F": "tex-label-regression-docs"
  "32A": "tex-labeled-node",
  "32B": "color-opacity-outline",
  "32C": "shapes-geometry",
  "32D": "margin-minsize-anchor"
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

function runCodex(promptFile, logFile, verificationContext = "") {
  const prompt = [readFileSync(promptFile, "utf8"), verificationContext]
    .filter(Boolean)
    .join("\n\n");

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
    "model_reasoning_effort=high",
    "-c",
    "features.fast_mode=true",
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

// Resolve beside this runner, never from PATH or a different working tree.
// A new process loads the verifier AND its local dependencies after the child
// finishes. Re-importing the startup URL would retain the old ESM module graph.
function runVerifierWorker(stage, operation = "verify") {
  const handoffDir = mkdtempSync(join(tmpdir(), "stz-phase-verifier-"));
  const responsePath = join(handoffDir, "response.json");
  console.log(`Verifier handoff: ${responsePath}`);
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL("./phase-verification-worker.mjs", import.meta.url)),
    phase, stage, responsePath, operation,
  ], { cwd: process.cwd(), env, stdio: "inherit" });
  try {
    // The file is unique to this invocation. Missing/malformed output or a
    // worker crash can never reuse a previous successful verification.
    const response = JSON.parse(readFileSync(responsePath, "utf8"));
    if (result.error || result.status !== 0 || response?.error) {
      throw new Error(response?.error?.message ?? result.error?.message
        ?? `Verifier worker failed: ${result.signal ?? result.status}`);
    }
    if (!response || typeof response !== "object" || Array.isArray(response)) {
      throw new Error("Verifier worker must return a JSON object");
    }
    return response;
  } catch (error) {
    console.error(error.message);
    if (result.error) console.error(result.error.message);
    if (result.signal) console.error(`Verifier worker signal: ${result.signal}`);
    console.error(`Verifier handoff: ${responsePath}`);
    console.error("Verification failed. Not committing or pushing.");
    process.exit(result.status || 1);
  }
}

function runVerification(stage) {
  const { report, requiredChecks } = runVerifierWorker(stage);
  try {
    if (report?.phase !== phase || report.stage !== stage || report.status !== "passed"
      || typeof report.artifactDir !== "string" || !isAbsolute(report.artifactDir)
      || report.summaryPath !== join(report.artifactDir, "verification.json")
      || !/^[a-f0-9]{64}$/.test(report.checkout?.fingerprint ?? "")
      || report.checkoutAfter?.fingerprint !== report.checkout.fingerprint
      || !Array.isArray(requiredChecks)
      || !isDeepStrictEqual(requiredChecks.slice(0, 3), ["npm-test", "npm-build", "git-diff-check"])
      || !Array.isArray(report.checks)
      || !isDeepStrictEqual(report.checks.map((check) => check.name), requiredChecks)
      || report.checks.some((check) => check.status !== "passed" || check.exitCode !== 0 || check.signal !== null
        || typeof check.logPath !== "string" || !isAbsolute(check.logPath))) {
      throw new Error("Verifier worker returned an incomplete or invalid report");
    }
    if (!isDeepStrictEqual(JSON.parse(readFileSync(report.summaryPath, "utf8")), report)) {
      throw new Error("Verifier worker report does not match its saved evidence");
    }
    if (!verificationMatchesCheckout(report, { cwd: process.cwd(), env })) {
      throw new Error("Verifier worker report does not match the current checkout");
    }
    return report;
  } catch (error) {
    console.error(error.message);
    if (report?.summaryPath) console.error(`Verification evidence: ${report.summaryPath}`);
    console.error("Verification failed. Not committing or pushing.");
    process.exit(1);
  }
}

function implementationVerificationContext() {
  const { browserChecks } = runVerifierWorker("before-implementation", "browser-checks");
  if (!Array.isArray(browserChecks) || browserChecks.some((name) => typeof name !== "string")) {
    console.error("Verifier worker returned invalid browser-check selection. Not starting implementation.");
    process.exit(1);
  }
  return [
    "## Parent-runner verification",
    "After this implementation/fix turn, the parent runner will execute npm test, npm run build, and git diff --check before starting review.",
    browserChecks.length
      ? `It will also execute these required browser checks directly, outside this child Codex sandbox: ${browserChecks.join(", ")}.`
      : "No additional browser check is configured for this phase.",
    "Complete the requested implementation and harness changes. If browser startup is restricted in this child session, leave the browser result pending for the parent runner; do not weaken assertions or change sandbox permissions.",
    "The parent runner records logs and browser artifacts, stops on failed or incomplete verification, and supplies the evidence to the review turn.",
  ].join("\n");
}

function reviewVerificationContext(report) {
  return [
    "## Verification evidence from the parent runner",
    "The parent runner has completed verification outside the child Codex sandbox on the current checkout.",
    `Summary: ${report.summaryPath}`,
    `Artifact directory: ${report.artifactDir}`,
    `Tested revision: ${report.checkout.revision}`,
    `Checkout fingerprint (tracked changes and untracked files included): ${report.checkout.fingerprint}`,
    "Checks:",
    ...report.checks.map((check) =>
      `- ${check.name}: ${check.status}, exit ${check.exitCode}; log ${check.logPath}` +
      (check.artifactDir ? `; browser evidence ${check.artifactDir}` : "")),
    "Read the saved report and relevant browser evidence, compare their checkout identity with the files being reviewed, and assess the assertions and production code independently.",
    "For matching current evidence, use these parent-run browser results to satisfy the browser execution requirement. You do not need to repeat those browser commands inside the restricted child sandbox.",
    "A child-sandbox localhost/Chrome restriction does not invalidate a successful matching parent run. Missing, failed, incomplete, or stale evidence still blocks acceptance; never substitute static results for browser results.",
    "Keep this review read-only. Any checkout change during review invalidates this verification and the runner will stop before committing.",
  ].join("\n");
}

if (mode === "verify") {
  const verification = runVerification("manual");
  console.log(`\nVerification passed. Evidence: ${verification.summaryPath}`);
  process.exit(0);
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

// runCodex(spec.implementPrompt, `logs/codex/${phase}-implement.log`);
runCodex(promptToRun, `logs/codex/${phase}-${promptLogName}.log`, implementationVerificationContext());

const verification = runVerification("before-review");

const reviewOutput = runCodex(
  spec.reviewPrompt,
  `logs/codex/${phase}-review.log`,
  reviewVerificationContext(verification),
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

// Review is read-only: reuse the verified result only for the exact same tree.
// A second successful test run cannot make a review of different code current.
if (!verificationMatchesCheckout(verification, { cwd: process.cwd(), env })) {
  console.error("Checkout changed during review. Verification and review are stale; not committing or pushing.");
  process.exit(1);
}

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
