import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const phase = process.argv[2];

const phases = {
  "9B": {
    branch: "phase/9b-layer-aware-tikz-output",
    commitMessage: "Implement Phase 9B layer-aware TikZ output",
    implementPrompt: "prompts/phase-9b-implement.md",
    reviewPrompt: "prompts/phase-9b-review.md",
  },
};

if (!phase || !phases[phase]) {
  console.error("Usage: node scripts/automation/run-phase.mjs <phase>");
  console.error(`Known phases: ${Object.keys(phases).join(", ")}`);
  process.exit(1);
}

const spec = phases[phase];

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

  const result = spawnSync(
    "codex",
    [
      "exec",
      "--sandbox",
      "workspace-write",
      "--ask-for-approval",
      "never",
      "-c",
      "model_reasoning_effort=high",
      prompt,
    ],
    {
      encoding: "utf8",
      env,
      maxBuffer: 1024 * 1024 * 20,
    },
  );

  const combined = [
    "STDOUT:",
    result.stdout,
    "",
    "STDERR:",
    result.stderr,
  ].join("\n");

  writeFileSync(logFile, combined);

  if (result.status !== 0) {
    console.error(`Codex failed. See ${logFile}`);
    console.error(result.stderr);
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

runCodex(spec.implementPrompt, `logs/codex/${phase}-implement.log`);

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
run("git", ["commit", "-m", spec.commitMessage]);
run("git", ["push", "-u", "origin", spec.branch]);

console.log(`\nDone. Pushed ${spec.branch}.`);
