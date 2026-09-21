import { writeFileSync } from "node:fs";

// Private runner protocol. The parent supplies a fresh response path and keeps
// stdout/stderr attached so command diagnostics and evidence paths survive.
const [phase, stage, responsePath, operation = "verify"] = process.argv.slice(2);

try {
  // Deliberately imported inside a fresh process, from this automation checkout.
  // Catch import failures as well as command/evidence failures for the handoff.
  const verifier = await import("./phase-verification.mjs");
  const options = { cwd: process.cwd(), env: process.env };
  let response;
  if (operation === "browser-checks") {
    response = { browserChecks: verifier.browserChecksForPhase(phase) };
  } else if (operation === "verify") {
    const report = verifier.runPhaseVerification({ phase, stage, ...options });
    if (!verifier.verificationMatchesCheckout(report, options)) {
      throw new Error(`Verification does not match the current checkout; evidence: ${report.summaryPath}`);
    }
    response = { report, requiredChecks: [
      "npm-test", "npm-build", "git-diff-check", ...verifier.browserChecksForPhase(phase),
    ] };
  } else {
    throw new Error(`Unknown verifier operation: ${operation}`);
  }
  writeFileSync(responsePath, JSON.stringify(response, null, 2) + "\n");
} catch (error) {
  const exitCode = Number.isInteger(error.exitCode) && error.exitCode > 0 ? error.exitCode : 1;
  console.error(error.message);
  if (error.report?.summaryPath) console.error(`Verification evidence: ${error.report.summaryPath}`);
  writeFileSync(responsePath, JSON.stringify({
    error: { message: error.message, exitCode },
    ...(error.report ? { report: error.report } : {}),
  }, null, 2) + "\n");
  process.exitCode = exitCode;
}
