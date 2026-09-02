/**
 * Post-Build Integration (mcp.jmrp.io)
 *
 * A trimmed copy of jmrp.io's integration of the same name. It runs on
 * `astro:build:done` and only TRANSFORMS `dist/`'s contents: extracting data
 * URIs out of the CSS, the HTML pass (SRI, nonces, inline styles to classes),
 * generating the header artifacts for nginx, and compressing assets.
 *
 * Two invariants of this site, both verified in
 * `tests/unit/postbuild-artifacts.test.mjs`:
 *
 * 1. The generated `.conf` files carry an `_mcp` suffix. jmrp.io deploys its
 *    own snippets to the same `/etc/nginx/snippets/`; a repeated name leaves
 *    the other site with the wrong CSP.
 * 2. The HTML is NOT pre-compressed. nginx injects the nonce with
 *    `sub_filter`, which cannot rewrite an already-compressed file (see
 *    `compression.ts`).
 *
 * PUBLISHING (copying the `.conf` files to nginx, `nginx -t`, reload, CDN
 * purge) does not live here: it is `scripts/deploy-live-mcp.mjs`, run by hand.
 *
 * Compared with jmrp.io's original, `optimizeImages` was dropped (the
 * `images.ts` module is not copied: this site serves no images of its own) and
 * so was the `sudo` permissions fix (that was for jmrp.io's blue/green layout;
 * here nginx serves `dist/` in place and deployment is a separate script).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";

import { compressAssets } from "./post-build/compression.js";
import { finalizeCspConfig } from "./post-build/csp.js";
import { extractCssDataUris } from "./post-build/css.js";
import { processHtmlFiles } from "./post-build/html.js";
import { stageNginxSnippets } from "./post-build/nginx-snippets.js";
import type { CspData } from "./post-build/types.js";
import { timed } from "./timing.js";

/**
 * Creates the `mcp-post-build` integration.
 *
 * @returns {AstroIntegration} The configured integration.
 */
export default function postBuildIntegration(): AstroIntegration {
  return {
    name: "mcp-post-build",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const relativeDist = path.relative(process.cwd(), distDir);
        logger.info(`Starting optimizations in [${relativeDist}]`);

        const cspData: CspData = {
          imageDomains: new Set<string>(),
        };

        try {
          await timed("extractCssDataUris", logger, () =>
            extractCssDataUris(distDir, logger),
          );

          // The CSP artifacts are always generated, deployed or not: that is
          // what lets the tests check them without touching nginx.
          const enableCsp = true;

          await timed("processHtmlFiles", logger, () =>
            processHtmlFiles(distDir, cspData, enableCsp, logger),
          );
          await timed("finalizeCspConfig", logger, () =>
            finalizeCspConfig(distDir, cspData, logger),
          );
          await timed("compressAssets", logger, () =>
            compressAssets(distDir, logger),
          );
          // AFTER compression, so the twins it walks are the real `index.md`
          // files and not the `.br`/`.gz` the step above adds beside them.
          await timed("stageNginxSnippets", logger, () =>
            stageNginxSnippets(distDir, logger),
          );
        } catch (error) {
          logger.error("Fatal optimization error:");
          logger.error(
            error instanceof Error
              ? error.stack || error.message
              : String(error),
          );
          throw error instanceof Error ? error : new Error(String(error));
        }

        logger.info(`Optimizations completed successfully.`);
      },
    },
  };
}
