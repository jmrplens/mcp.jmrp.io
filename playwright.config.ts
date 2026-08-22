import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
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
    command:
      'DIST_DIR=$(node scripts/deploy-swap.mjs prepare) && astro build --outDir "$DIST_DIR" && astro preview --outDir "$DIST_DIR" --port 4321',
    url: "http://localhost:4321",
    reuseExistingServer: false,
  },
});
