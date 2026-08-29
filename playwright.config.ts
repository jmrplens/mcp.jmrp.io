import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // One retry. Several of these specs drive a live endpoint over the public
  // internet, and the host that runs them also runs the production stack
  // (nginx, both MCP pools, their containers), so a run occasionally loses a
  // single test to a 30s expectation that would have passed on the next go —
  // observed across full-suite runs failing a DIFFERENT test each time,
  // including one backed by a stub, which is what rules out the network as
  // the sole cause. A retry hides a flake; it cannot hide a real break, which
  // fails both attempts.
  retries: 1,
  use: { baseURL: "http://localhost:4321" },
  webServer: {
    // `astro preview` serves the built artifact, so the e2e tests exercise
    // exactly what gets deployed rather than the dev server. The preceding
    // build is mandatory: without it `preview` would serve a stale artifact
    // and the e2e tests could go green over broken source.
    //
    // CAREFUL: `pnpm build` must NOT be called here, because since blue/green
    // (2026-08-22) that script is the full DEPLOY — symlink swap, Nginx
    // reload, Cloudflare purge, IndexNow and Bing. With it, every e2e run
    // published to production; it actually happened, and once with a dirty
    // tree, leaving the site advertising a wall-clock `dateModified` instead
    // of the commit date.
    //
    // So we build into the INACTIVE colour and serve that same directory: the
    // e2e tests see the fresh build and `dist` — what Nginx serves — is left
    // untouched.
    //
    // When DIST_DIR is already set — `pnpm verify` exports the directory it
    // just built into — the build is skipped and that output is served
    // straight away. Nothing else sets it, so a bare `pnpm test:e2e` and CI
    // both keep building their own.
    command: process.env.DIST_DIR
      ? `astro preview --outDir "${process.env.DIST_DIR}" --port 4321`
      : 'DIST_DIR=$(node scripts/deploy-swap.mjs prepare) && astro build --outDir "$DIST_DIR" && astro preview --outDir "$DIST_DIR" --port 4321',
    url: "http://localhost:4321",
    reuseExistingServer: false,
    // Playwright's default is 60s and this command BUILDS before it serves:
    // measured at 65s on the production host with a cold output directory
    // (`prepare` empties it, so the post-build image/compression caches start
    // from scratch), which failed the run before a single test executed. The
    // build is the slow part, not the server; three minutes is room for a
    // loaded machine, not a wait anyone sits through on a healthy one.
    timeout: 180_000,
  },
});
