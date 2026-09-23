import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

const freeLabelGroups = [
  "existing-renderer-regressions",
  "independent-oracle-negative-controls",
  "boundary-anchor-camera-matrix",
  "inverted-success-and-failure-races",
  "pending-lock-and-autohide",
  "deletion-and-unmount",
  "real-App-input-JSON-history-reused-ID-load",
  "current-SVG-cloning",
];
const inlineLabelGroups = [
  "inline-node-rendering-placement-halo-picking",
  "inline-node-lifecycle-path-operations-export",
];
const settledExportGroups = ["settled-SVG-export-standalone"];
const inlineCompleteGroups = [...freeLabelGroups, ...inlineLabelGroups];
const allLabelGroups = [...inlineCompleteGroups, ...settledExportGroups];
const combinedLabelGroups = [...allLabelGroups, "combined-free-inline-workflows"];

// Cumulative: later groups become mandatory when their implementation lands.
export const pointNodeScenarios = {
  "point-node-body-layout-lifecycle": [
    "point-language-shapes-2d-3d", "point-valid-invalid-valid-exact-source",
    "point-A-B-C-delete-duplicate-history-load", "point-resource-retry-font-readiness",
    "point-native-direct-cursor-workplanes-inspector-persistence",
  ],
  "point-node-picking-visibility": [
    "point-contour-boundaries-cycling", "point-camera-pan-zoom-drag",
    "point-hidden-filtered-locked-dimmed-siblings",
  ],
  "point-node-settled-export": [
    "point-native-pending-transparent-edit", "point-native-pending-white-load",
    "point-whole-node-fallback-opacity-validation",
  ],
  "point-node-paint-import-persistence": [
    "point-paint-native-inspector-history", "point-paint-imported-presets-persistence",
    "point-paint-lifecycle-dimming", "point-paint-pending-transparent-edit",
    "point-paint-pending-white-load",
  ],
};
export function pointNodeScenarioArtifacts(name) {
  return [`${name}.json`, ...((name.startsWith("point-native-pending-") || name.startsWith("point-paint-pending-"))
    ? [`${name}.svg`, `${name}.png`, `${name}-standalone.json`]
    : name === "point-whole-node-fallback-opacity-validation" ? ["point-fallback.svg"]
      : name === "point-paint-imported-presets-persistence" ? ["point-paint-saved.json", "point-paint-import.sty"]
      : name === "point-paint-native-inspector-history" ? ["point-paint-legacy.json"]
      : name === "point-native-direct-cursor-workplanes-inspector-persistence"
        ? ["point-native-2d.json", "point-native-3d.json"] : [])];
}
const pointNodeGroups = [...combinedLabelGroups, ...Object.keys(pointNodeScenarios)];
const pointNodeMathGroups = pointNodeGroups.filter((group) => group !== "point-node-paint-import-persistence");
const phase32Groups = { "32A": pointNodeMathGroups, "32B": pointNodeGroups,
  "32C": pointNodeGroups, "32D": pointNodeGroups };

export function browserChecksForPhase(phase) {
  const normalized = String(phase).toUpperCase();
  if (normalized === "31B") return ["check:label-assets"];
  if (["31C", "31D", "31E", "31F", ...Object.keys(phase32Groups)].includes(normalized)) {
    return ["check:label-assets", "check:free-labels"];
  }
  return [];
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function gitOutput(cwd, env, args) {
  const result = spawnSync("git", args, {
    cwd,
    env,
    maxBuffer: 1024 * 1024 * 100,
  });
  if (result.error || result.status !== 0) {
    const error = new Error(
      `Cannot identify checkout: git ${args.join(" ")}: ${result.error?.message ?? result.stderr?.toString().trim() ?? result.signal ?? "failed"}`,
    );
    error.exitCode = result.status ?? 1;
    throw error;
  }
  return result.stdout;
}

// Hash raw bytes, including untracked fixtures, without including ignored build
// output or logs. The fingerprint is stable across repeated checks of one tree.
export function captureCheckoutIdentity({ cwd = process.cwd(), env = process.env } = {}) {
  const revision = gitOutput(cwd, env, ["rev-parse", "HEAD"]).toString().trim();
  const diff = gitOutput(cwd, env, [
    "diff", "HEAD", "--binary", "--no-ext-diff", "--no-textconv", "--no-color",
  ]);
  const names = gitOutput(cwd, env, ["ls-files", "--others", "--exclude-standard", "-z"])
    .toString().split("\0").filter(Boolean).sort();
  const untrackedSha256 = Object.fromEntries(names.map((name) => {
    const file = resolve(cwd, name);
    const bytes = lstatSync(file).isSymbolicLink()
      ? readlinkSync(file, { encoding: "buffer" })
      : readFileSync(file);
    return [name, sha256(bytes)];
  }));
  const identity = { revision, trackedDiffSha256: sha256(diff), untrackedSha256 };
  return { ...identity, fingerprint: sha256(JSON.stringify(identity)) };
}

export function verificationMatchesCheckout(report, options = {}) {
  if (report?.status !== "passed" || !report.checkout?.fingerprint
    || report.checkoutAfter?.fingerprint !== report.checkout.fingerprint) return false;
  try {
    return captureCheckoutIdentity(options).fingerprint === report.checkout.fingerprint;
  } catch {
    return false;
  }
}

function browserEnvironment(cwd, env) {
  const result = { ...env };
  // A pre-existing server could represent another checkout. Each browser check
  // must start its own server against the tree identified in verification.json.
  delete result.STZ_BROWSER_BASE_URL;
  if (result.STZ_PLAYWRIGHT_MODULE === undefined) {
    try {
      result.STZ_PLAYWRIGHT_MODULE = createRequire(resolve(cwd, "package.json")).resolve("playwright");
    } catch {
      const cached = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime",
        "dependencies", "node", "node_modules", "playwright", "index.mjs");
      if (existsSync(cached)) result.STZ_PLAYWRIGHT_MODULE = cached;
    }
  }
  if (result.STZ_BROWSER_EXECUTABLE === undefined && process.platform === "darwin") {
    const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (existsSync(chrome)) result.STZ_BROWSER_EXECUTABLE = chrome;
  }
  return result;
}

function evidenceObject(artifactDir, name) {
  const evidence = JSON.parse(readFileSync(join(artifactDir, name), "utf8"));
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new Error(`${name} must contain a JSON object`);
  }
  return evidence;
}

/** Artifact envelope check, not an XML safety/parser replacement. Native reopen
 * checks validate rendering/paint/geometry. Sanitized SVG has no data-* markers;
 * require balanced elements and an actual sibling contour + titled body tree. */
export function hasWholePointSvg(svg) {
  const stack = [], roots = [];
  const tokens = svg.match(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(?:"[^"]*"|'[^']*'|[^'">])*>/gu) ?? [];
  for (const token of tokens) {
    if (token.startsWith("<!--") || token.startsWith("<?")) continue;
    const closing = /^<\/([\w:-]+)\s*>$/u.exec(token);
    if (closing) {
      if (stack.pop()?.name !== closing[1]) return false;
      continue;
    }
    const name = /^<([\w:-]+)(?:\s|\/?>)/u.exec(token)?.[1];
    if (!name) return false;
    const element = { name, children: [] };
    const parent = stack.at(-1);
    (parent ? parent.children : roots).push(element);
    if (!token.endsWith("/>")) stack.push(element);
  }
  if (stack.length || roots.length !== 1 || roots[0].name !== "svg") return false;
  const hasPaint = (node) => node.children.some((child) => ["text", "path", "rect", "use"].includes(child.name) || hasPaint(child));
  const wholePoint = (node) => (node.name === "g"
    && node.children.some((child) => ["circle", "polygon"].includes(child.name))
    && node.children.some((child) => child.name === "g"
      && child.children.some((entry) => entry.name === "title") && hasPaint(child)))
    || node.children.some(wholePoint);
  return wholePoint(roots[0]);
}

function validateBrowserEvidence(name, artifactDir, phase, checkout) {
  if (name === "check:label-assets") {
    const evidence = evidenceObject(artifactDir, "native-retry-evidence.json");
    if (typeof evidence.browser !== "string" || evidence.browser.trim() === ""
      || evidence.affectedBrowserRecoveryVerified !== true
      || evidence.nativeFailureCaching?.cachesFailedNativeImports !== true) {
      throw new Error("Affected-browser native import recovery has not been verified");
    }
    evidenceObject(artifactDir, "asset-graph-evidence.json");
    evidenceObject(artifactDir, "containment-evidence.json");
    return;
  }
  const evidence = evidenceObject(artifactDir, "free-labels-evidence.json");
  if (evidence.result !== "passed" || evidence.stage !== "complete"
    || typeof evidence.environment?.browserVersion !== "string"
    || evidence.environment.browserVersion.trim() === "") {
    throw new Error("Free-label browser verification did not reach complete with an identified browser");
  }
  // Earlier phases accept their complete historical report or a complete later
  // extension. 31E includes standalone exports; 31F also requires the combined
  // free/path workflow so an older passing report cannot close its audit.
  const requiredGroups = phase32Groups[phase] ?? (phase === "31C" ? freeLabelGroups
    : phase === "31D" ? inlineCompleteGroups
      : phase === "31F" ? combinedLabelGroups : allLabelGroups);
  const completed = evidence.completed;
  if (!Array.isArray(completed)
    || new Set(completed).size !== completed.length
    || completed.some((group) => !pointNodeGroups.includes(group))
    || !requiredGroups.every((group) => completed.includes(group))
    || ![freeLabelGroups, inlineCompleteGroups, allLabelGroups, combinedLabelGroups, pointNodeMathGroups, pointNodeGroups].some((groups) =>
      groups.length === completed.length && groups.every((group) => completed.includes(group)))) {
    throw new Error(`Phase ${phase} browser evidence must complete ${requiredGroups.length} required groups; only complete supported group sets are accepted`);
  }
  for (const key of ["incompleteGroups", "unexecuted", "pageErrors"]) {
    if (!Array.isArray(evidence[key]) || evidence[key].length !== 0) {
      throw new Error(`Free-label browser evidence ${key} must be an empty array`);
    }
  }
  if (phase32Groups[phase]) {
    if (evidence.checkout?.revision !== checkout.revision
      || evidence.checkout?.trackedDiffSha256 !== checkout.trackedDiffSha256
      || JSON.stringify(Object.entries(evidence.checkout?.untrackedSha256 ?? {}).sort()) !==
        JSON.stringify(Object.entries(checkout.untrackedSha256).sort())) {
      throw new Error("Point-node browser evidence checkout mismatch");
    }
    for (const [group, names] of Object.entries(pointNodeScenarios)) {
      if (!completed.includes(group)) continue;
      for (const name of names) {
        const records = evidence.evidence?.filter((entry) => entry.name === name) ?? [];
        if (records.length !== 1 || records[0].group !== group || records[0].result !== "passed"
          || !Array.isArray(records[0].artifacts) || records[0].artifacts.length === 0
          || !pointNodeScenarioArtifacts(name).every((file) => records[0].artifacts.includes(file))) {
          throw new Error(`Missing completed point-node scenario: ${name}`);
        }
        for (const artifact of records[0].artifacts) {
          if (typeof artifact !== "string" || !artifact || artifact.includes("..")
            || resolve(artifactDir, artifact) !== join(artifactDir, artifact)
            || !existsSync(join(artifactDir, artifact)) || lstatSync(join(artifactDir, artifact)).size === 0) {
            throw new Error(`Missing point-node artifact: ${artifact}`);
          }
          const bytes = readFileSync(join(artifactDir, artifact));
          if (artifact.endsWith(".json")) {
            const value = JSON.parse(bytes.toString());
            if (!value || typeof value !== "object") throw new Error(`Invalid point-node JSON: ${artifact}`);
          } else if (artifact.endsWith(".svg")) {
            const svg = bytes.toString();
            if (!hasWholePointSvg(svg)) {
              throw new Error(`Invalid whole-point SVG artifact: ${artifact}`);
            }
          } else if (artifact.endsWith(".png") && (bytes.length < 24
            || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))) {
            throw new Error(`Invalid point-node PNG artifact: ${artifact}`);
          }
        }
      }
    }
  }

}

function saveReport(report) {
  writeFileSync(report.summaryPath, JSON.stringify(report, null, 2) + "\n");
}

function commandError(message, exitCode = 1) {
  const error = new Error(message);
  error.exitCode = exitCode;
  return error;
}

function runCheck(report, { name, command, args, cwd, env, browser = false }) {
  const checkDir = join(report.artifactDir,
    `${String(report.checks.length + 1).padStart(2, "0")}-${name.replace(/[^a-z0-9-]/gi, "-")}`);
  mkdirSync(checkDir, { recursive: true });
  const check = {
    name, command, args, status: "running", exitCode: null, signal: null,
    startedAt: new Date().toISOString(),
    logPath: join(checkDir, "command.log"),
    stdoutLogPath: join(checkDir, "stdout.log"),
    stderrLogPath: join(checkDir, "stderr.log"),
    exitStatusPath: join(checkDir, "exit-status"),
    ...(browser ? { artifactDir: join(checkDir, "artifacts") } : {}),
  };
  report.checks.push(check);
  saveReport(report);
  const started = Date.now();
  const commandEnv = { ...env };
  if (browser) {
    mkdirSync(check.artifactDir, { recursive: true });
    commandEnv.STZ_SMOKE_ARTIFACT_DIR = check.artifactDir;
  }
  console.log(`Verification: ${command} ${args.join(" ")}`);
  let stdoutFd;
  let stderrFd;
  let failure;
  try {
    stdoutFd = openSync(check.stdoutLogPath, "w");
    stderrFd = openSync(check.stderrLogPath, "w");
    const result = spawnSync(command, args, {
      cwd,
      env: commandEnv,
      stdio: ["ignore", stdoutFd, stderrFd],
    });
    check.exitCode = result.status;
    check.signal = result.signal;
    if (result.error || result.status !== 0) {
      throw commandError(
        `${name} failed: ${result.error?.message ?? (result.signal ? `signal ${result.signal}` : `exit ${result.status}`)}`,
        result.status ?? 1,
      );
    }
    if (browser) {
      try {
        validateBrowserEvidence(name, check.artifactDir, report.phase, report.checkout);
      } catch (error) {
        throw commandError(`${name} evidence is incomplete or invalid: ${error.message}`);
      }
    }
    check.status = "passed";
  } catch (error) {
    check.status = "failed";
    check.error = error.message;
    failure = error;
  } finally {
    if (stdoutFd !== undefined) closeSync(stdoutFd);
    if (stderrFd !== undefined) closeSync(stderrFd);
  }
  check.finishedAt = new Date().toISOString();
  check.durationMs = Date.now() - started;
  const stdout = existsSync(check.stdoutLogPath) ? readFileSync(check.stdoutLogPath, "utf8") : "";
  const stderr = existsSync(check.stderrLogPath) ? readFileSync(check.stderrLogPath, "utf8") : "";
  const combined = stdout + (stdout && stderr && !stdout.endsWith("\n") ? "\n" : "") + stderr;
  writeFileSync(check.logPath, combined);
  // Preserve the command's real exit code even when exit-zero evidence fails.
  writeFileSync(check.exitStatusPath, `${check.exitCode ?? (check.signal ? `signal:${check.signal}` : "unavailable")}\n`);
  saveReport(report);
  console.log(`Verification ${check.status}: ${name}; log: ${check.logPath}`);
  if (failure) {
    report.failedCheck = name;
    const tail = combined.trimEnd().split("\n").slice(-35).join("\n");
    if (tail) console.error(tail);
    throw failure;
  }
}

// The caller runs this in the parent runner, outside its child Codex sandbox.
// An outer sandbox still applies: permission failures remain failed checks.
export function runPhaseVerification({ phase, cwd = process.cwd(), env = process.env, stage = "verification" }) {
  const normalized = String(phase).toUpperCase();
  const prefix = `stz-phase${normalized.toLowerCase()}-${stage}-`.replace(/[^a-z0-9-]/gi, "-");
  const artifactDir = mkdtempSync(join(tmpdir(), prefix));
  const started = Date.now();
  const report = {
    phase: normalized, stage, status: "running", artifactDir,
    summaryPath: join(artifactDir, "verification.json"),
    startedAt: new Date().toISOString(),
    checkout: null, checkoutAfter: null, checks: [],
  };
  let failure;
  saveReport(report);
  console.log(`Verification evidence: ${report.summaryPath}`);
  try {
    report.checkout = captureCheckoutIdentity({ cwd, env });
    saveReport(report);
    for (const spec of [
      { name: "npm-test", command: "npm", args: ["test"] },
      { name: "npm-build", command: "npm", args: ["run", "build"] },
      { name: "git-diff-check", command: "git", args: ["diff", "--check"] },
    ]) runCheck(report, { ...spec, cwd, env });
    const browserChecks = browserChecksForPhase(normalized);
    if (browserChecks.length > 0) {
      const browserEnv = browserEnvironment(cwd, env);
      report.browserEnvironment = {
        playwrightModule: browserEnv.STZ_PLAYWRIGHT_MODULE ?? "playwright",
        browserExecutable: browserEnv.STZ_BROWSER_EXECUTABLE ?? null,
      };
      for (const name of browserChecks) {
        runCheck(report, { name, command: "npm", args: ["run", name], cwd, env: browserEnv, browser: true });
      }
    }
  } catch (error) {
    failure = error;
  }
  try {
    if (report.checkout) {
      report.checkoutAfter = captureCheckoutIdentity({ cwd, env });
      if (report.checkoutAfter.fingerprint !== report.checkout.fingerprint) {
        report.checkoutChanged = true;
        failure ??= commandError("Checkout changed during verification; rerun checks against the final tree");
      }
    }
  } catch (error) {
    failure ??= error;
  }
  report.status = failure ? "failed" : "passed";
  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - started;
  if (failure) {
    report.error = { message: failure.message, ...(failure.code ? { code: failure.code } : {}) };
  }
  saveReport(report);
  console.log(`Verification ${report.status}; evidence: ${report.summaryPath}`);
  if (failure) {
    failure.exitCode ??= 1;
    failure.report = report;
    throw failure;
  }
  return report;
}
