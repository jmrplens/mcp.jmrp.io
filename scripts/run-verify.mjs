/**
 * Quality Assurance Orchestrator (Verify)
 *
 * Ported from jmrp.io's runner: the step machinery below (runStep,
 * runParallel, printSummary) is that file unchanged. What differs is the
 * pipeline, because this repo differs in three ways.
 *
 * Pipeline shape:
 *   1. Static phase  — Astro Check, ESLint, Prettier, Stylelint, CSpell,
 *      JSDoc coverage, identity sync. These never touch the build output, so
 *      they run concurrently via `Promise.allSettled`, accumulating every
 *      failure. If any fail the run stops here — no build is started.
 *   2. Build phase   — serial, hard stop.
 *   3. Dist phase    — unit tests, HTML5 validation, Lychee. Read-only over
 *      the build output, so concurrent and accumulating.
 *   4. Sonar phase   — serial, non-blocking: the scanner only warns, and the
 *      issues step is recorded but never blocks E2E.
 *   5. E2E phase     — Playwright, serial, always last.
 *
 * Three deliberate departures from jmrp.io:
 *
 *   - It does NOT deploy. `pnpm build` on this repo swaps the `dist` symlink
 *     and runs deploy-live-mcp.mjs, so jmrp.io's shape — verify by running
 *     the real build — would publish to production every time anyone
 *     validated anything. This builds into the inactive colour and stops
 *     there, leaving the live site on whatever it was already serving.
 *
 *   - Because of that, the dist phase cannot read `dist/`: that symlink still
 *     points at the PREVIOUS build. The runner captures the directory the
 *     build actually wrote to and exports it as `DIST_DIR`, which every
 *     downstream step honours. Checking `dist/` here would silently validate
 *     the last deploy instead of the code in the working tree.
 *
 *   - The unit tests run in the dist phase, not the static one. Seven of them
 *     assert over the build output (`seo-artifacts`, `jsonld`, `server-cards`
 *     and friends), so running them before the build would check stale files.
 *
 * The final report lists every failed step gathered across all phases, so a
 * single run surfaces the complete picture rather than one failure per
 * fix-and-rerun cycle.
 */

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Load environment variables from .env if present
try {
  if (fs.existsSync(".env")) {
    process.loadEnvFile(".env");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[Verify] Warning: Failed to load .env file: ${message}`);
}

// ANSI colors for pretty output
const colors = {
  reset: "\u{1B}[0m",
  bright: "\u{1B}[1m",
  green: "\u{1B}[32m",
  yellow: "\u{1B}[33m",
  red: "\u{1B}[31m",
  cyan: "\u{1B}[36m",
  magenta: "\u{1B}[35m",
};

/**
 * @typedef {object} StepResult
 * @property {string} name - Step name, as passed to {@link runStep}.
 * @property {boolean} success - Whether the step passed (or was skipped).
 * @property {boolean} [skipped] - Whether the step's condition was falsy.
 * @property {number|null} [status] - Process exit code (`null` if it never
 *   spawned, e.g. command not found).
 * @property {string} [output] - Captured stdout+stderr (only present when
 *   `stream` is false).
 */

/**
 * Runs a single verification step as a child process and resolves with its
 * outcome — it never rejects and never throws synchronously, so it composes
 * cleanly with `Promise.allSettled` for parallel phases. In particular, a
 * `condition` function that throws is caught and reported as a failed step
 * rather than escaping the (synchronous) `Array.prototype.map` call in
 * {@link runParallel}, which would otherwise abort the remaining steps in
 * that batch before they even ran.
 *
 * Two output modes:
 * - `stream: false` (default) — output is captured silently and only
 *   printed if the step fails. Required for steps that run concurrently
 *   with others, so their output doesn't interleave.
 * - `stream: true` — output is inherited live (used for the single, serial
 *   Build and E2E steps, where seeing progress matters more than avoiding
 *   interleaving).
 *
 * @param {string} name - Human-readable step name for logging.
 * @param {string} command - Shell command to execute.
 * @param {{condition?: boolean|(() => boolean), stream?: boolean}} [options]
 * @returns {Promise<StepResult>}
 */
function runStep(name, command, options = {}) {
  const { stream = false } = options;
  let condition;
  try {
    condition = options.condition ?? true;
    if (typeof condition === "function") condition = condition();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `${colors.red}❌ ${name} failed! condition() threw: ${message}${colors.reset}\n`,
    );
    return Promise.resolve({
      name,
      success: false,
      status: null,
      output: message,
    });
  }

  if (!condition) {
    console.log(
      `${colors.yellow}⏭ Skipping ${name} (condition not met)${colors.reset}`,
    );
    return Promise.resolve({ name, success: true, skipped: true });
  }

  console.log(
    `${colors.cyan}🚀 Running ${colors.bright}${name}${colors.reset}...`,
  );
  console.log(`${colors.reset}   ${command}`);

  const start = Date.now();

  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      stdio: stream ? "inherit" : ["ignore", "pipe", "pipe"],
    });

    let output = "";
    if (!stream) {
      child.stdout?.on("data", (chunk) => (output += chunk.toString()));
      child.stderr?.on("data", (chunk) => (output += chunk.toString()));
    }

    child.on("error", (error) => {
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.error(
        `${colors.red}❌ ${name} failed to start! (${duration}s)${colors.reset}`,
      );
      console.error(error.message);
      resolve({ name, success: false, status: null, output });
    });

    child.on("close", (code) => {
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      if (code === 0) {
        console.log(
          `${colors.green}✅ ${name} passed! (${duration}s)${colors.reset}\n`,
        );
        resolve({ name, success: true, status: code, output });
        return;
      }

      console.error(
        `${colors.red}❌ ${name} failed! (${duration}s)${colors.reset}`,
      );
      if (!stream && output) {
        console.error(`${colors.reset}--- ${name} output ---`);
        console.error(output);
      }
      console.error("");
      resolve({ name, success: false, status: code, output });
    });
  });
}

/**
 * Runs a group of steps concurrently, capturing every outcome regardless of
 * individual failures.
 *
 * @param {{name: string, command: string, condition?: boolean|(() => boolean)}[]} stepDefs
 * @returns {Promise<StepResult[]>}
 */
async function runParallel(stepDefs) {
  const settled = await Promise.allSettled(
    stepDefs.map((s) => runStep(s.name, s.command, { condition: s.condition })),
  );
  return settled.map((result, i) =>
    result.status === "fulfilled"
      ? result.value
      : {
          name: stepDefs[i].name,
          success: false,
          status: null,
          output: String(result.reason),
        },
  );
}

/**
 * Prints the final pass/fail banner, listing every failed step gathered so
 * far (not just the first one).
 *
 * @param {StepResult[]} failedSteps
 * @param {string} duration - Elapsed seconds, formatted.
 * @returns {boolean} `true` when there were no failures.
 */
function printSummary(failedSteps, duration) {
  console.log(
    `${colors.magenta}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`,
  );
  if (failedSteps.length === 0) {
    console.log(
      `${colors.green}${colors.bright}✨ ALL CHECKS PASSED SUCCESSFULLY! (${duration}s)${colors.reset}`,
    );
    return true;
  }
  console.error(
    `${colors.red}${colors.bright}💥 VERIFICATION FAILED! (${duration}s)${colors.reset}`,
  );
  console.error(`${colors.red}   Failed steps (${failedSteps.length}):`);
  for (const step of failedSteps) {
    const statusSuffix =
      step.status === null || step.status === undefined
        ? ""
        : ` (exit ${step.status})`;
    console.error(
      `${colors.red}   - ${step.name}${statusSuffix}${colors.reset}`,
    );
  }
  return false;
}

/**
 * Main verification suite orchestrator. Runs the static, build, dist, Sonar
 * and E2E phases in order and prints a final report.
 *
 * @returns {Promise<boolean>} `true` if all checks pass, `false` otherwise.
 */
async function runVerify() {
  const startTime = Date.now();
  const elapsed = () => ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(
    `\n${colors.magenta}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`,
  );
  console.log(
    `${colors.magenta}${colors.bright}🔍 Starting Project Verification Suite${colors.reset}`,
  );
  console.log(
    `${colors.magenta}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`,
  );

  // --- Phase 1: static analysis — parallel, accumulate ALL failures ---
  const staticStepDefs = [
    {
      name: "Static: Astro Check",
      command: "pnpm typecheck --minimumFailingSeverity warning",
    },
    { name: "Static: ESLint", command: "pnpm lint --max-warnings=0" },
    { name: "Static: Prettier", command: "pnpm exec prettier --check ." },
    { name: "Lint: CSS (Stylelint)", command: "pnpm lint:css" },
    { name: "Lint: Spelling (CSpell)", command: "pnpm exec cspell lint ." },
    // jmrp.io carries the same markdownlint config but nothing runs it; here
    // it is wired in, scoped to the three tracked documents.
    { name: "Lint: Markdown", command: "pnpm lint:md" },
    {
      name: "Lint: JSDoc Coverage",
      command: "node scripts/ci/calculate-jsdoc-coverage.mjs",
    },
    // This repo's equivalent of jmrp.io's identity check: it verifies the
    // committed identity document still matches its source.
    { name: "Lint: Identity sync", command: "pnpm identity:check" },
  ];

  const staticResults = await runParallel(staticStepDefs);
  const staticFailed = staticResults.filter((r) => !r.success);
  if (staticFailed.length > 0) {
    console.error(
      `${colors.red}${colors.bright}💥 Static phase failed — build was NOT started.${colors.reset}`,
    );
    return printSummary(staticFailed, elapsed());
  }

  const failedSteps = [];

  // --- Phase 2: build — serial, hard stop on failure ---
  //
  // `deploy-swap.mjs prepare` picks the colour that is NOT live and empties
  // it, printing the path. Building into that and stopping is what keeps this
  // from deploying; the swap and deploy-live-mcp.mjs never run.
  let distDir;
  try {
    // `process.execPath` rather than "node": resolving the interpreter through
    // PATH is the classic hijack vector, and this is the same treatment
    // `build-date.ts` gives git. It is also exact — the child runs on the very
    // binary running this script, not whatever another Node happens to shadow.
    distDir = execFileSync(
      process.execPath,
      ["scripts/deploy-swap.mjs", "prepare"],
      { encoding: "utf8" },
    ).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `${colors.red}${colors.bright}💥 Could not choose a build directory: ${message}${colors.reset}`,
    );
    return printSummary(
      [{ name: "Build: prepare", success: false, status: null }],
      elapsed(),
    );
  }

  // Exported so every downstream step reads the build just produced. The unit
  // tests already honour it; the other two are given it explicitly below.
  process.env.DIST_DIR = distDir;
  console.log(
    `${colors.cyan}   Building into ${colors.bright}${distDir}${colors.reset}` +
      `${colors.cyan} (not deployed)${colors.reset}\n`,
  );

  const buildResult = await runStep(
    "Build: Site (no deploy)",
    `node scripts/sync-server-surface.mjs && pnpm exec astro build --outDir "${distDir}"`,
    { stream: true },
  );
  if (!buildResult.success) {
    failedSteps.push(buildResult);
    console.error(
      `${colors.red}${colors.bright}💥 Build failed — dist-dependent checks, Sonar and E2E were skipped.${colors.reset}`,
    );
    return printSummary(failedSteps, elapsed());
  }

  // --- Phase 3: dist-dependent checks — parallel, accumulate ---
  const distStepDefs = [
    // Seven of these assert over the build output, which is why they are here
    // rather than in the static phase.
    { name: "Tests: Unit", command: "pnpm test:unit" },
    {
      name: "Lint: HTML5 Validation",
      command: `pnpm exec html-validate "${distDir}"`,
    },
    {
      name: "Lint: Broken Links (Lychee)",
      // The glob is quoted WHOLE so lychee expands it, not the shell: bash
      // without `globstar` treats `**` as a single `*`, which quietly reduced
      // the sweep from 2148 links to 138 — one directory level — and still
      // exited 0. `--root-dir` must be absolute for lychee to resolve the
      // site's root-relative hrefs.
      command: `lychee --config lychee.toml --root-dir "${path.resolve(distDir)}" "${distDir}/**/*.html"`,
    },
  ];

  const distResults = await runParallel(distStepDefs);
  failedSteps.push(...distResults.filter((r) => !r.success));

  // --- Phase 4: Sonar — serial, non-blocking ---
  const sonarScanResult = await runStep(
    "Security: SonarCloud Analysis",
    "pnpm exec sonar-scanner",
    { condition: () => !!process.env.SONAR_TOKEN },
  );
  if (!sonarScanResult.success && !sonarScanResult.skipped) {
    // The upload phase only. The pass/fail call belongs to the issues step
    // below, so this one warns and never blocks.
    console.warn(
      `${colors.yellow}⚠️ ${sonarScanResult.name} finished with warnings, continuing...${colors.reset}`,
    );
  }

  const sonarIssuesResult = await runStep(
    "Analyze: SonarCloud Issues",
    "node scripts/ci/get-sonar-issues.mjs",
    // The project key falls back to sonar-project.properties, so SONAR_TOKEN
    // alone is enough to gate this step.
    { condition: () => !!process.env.SONAR_TOKEN },
  );
  if (!sonarIssuesResult.success) {
    // Recorded as a failure at the end, but must not block E2E.
    failedSteps.push(sonarIssuesResult);
  }

  // --- Phase 5: E2E — serial, always last ---
  const e2eResult = await runStep("Tests: Playwright E2E", "pnpm test:e2e", {
    stream: true,
  });
  if (!e2eResult.success) failedSteps.push(e2eResult);

  return printSummary(failedSteps, elapsed());
}

try {
  const success = await runVerify();
  process.exit(success ? 0 : 1);
} catch (error) {
  console.error(error);
  process.exit(1);
}
