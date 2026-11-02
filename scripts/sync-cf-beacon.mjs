#!/usr/bin/env node
/**
 * Downloads Cloudflare Web Analytics' beacon so this site serves it itself.
 *
 * WHY FROM HERE, not from static.cloudflareinsights.com: the CSP is
 * nonce-only with 'strict-dynamic', and every script on the site is
 * same-origin; a copy built into `/_astro/` keeps it that way, gets the
 * nonce and the integrity attribute the post-build gives every local script,
 * and pins the exact bytes a visitor runs to the ones this build saw. jmrp.io
 * does the same (its pre-build `beacon.ts`).
 *
 * THE GUARD: the copy is wrapped so it reports only from mcp.jmrp.io. The
 * beacon is baked into the HTML at build time, so a preview of a production
 * build — `astro preview`, a scratch build served on a LAN address, the e2e
 * run — would otherwise report with the production token. An exact host
 * match makes "previews never report" true by construction, which jmrp.io
 * learned after a loopback denylist missed every RFC 1918 address.
 *
 * WHERE IT GOES: `src/generated/cf-beacon.js`, git-ignored. Base.astro finds
 * it through `import.meta.glob(..., { query: "?url" })`, so Vite emits it
 * under a content-hashed name: a new beacon is a new URL for every cache in
 * the way (jmrp.io needed a versioned path of its own once its edge Worker
 * dropped `?v=` from the cache key), and a build without the file — CI, a
 * scratch build that never ran this — compiles and simply has no tag.
 *
 * Soft failure, like every other sync script: a network error keeps the
 * previous copy, or leaves the build without a beacon if there is none. The
 * file is only rewritten when its bytes change.
 *
 * Usage: node scripts/sync-cf-beacon.mjs
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TAG = "[sync-cf-beacon]";
const SOURCE = "https://static.cloudflareinsights.com/beacon.min.js";
const TARGET = path.join(process.cwd(), "src", "generated", "cf-beacon.js");
// SITE_ORIGIN's host (src/lib/seo.ts). Written out rather than imported: this
// runs as plain Node before the build, and seo.ts is part of the build.
const PRODUCTION_HOST = "mcp.jmrp.io";
const HEADER = `/* Cloudflare Web Analytics beacon (${SOURCE}), wrapped by scripts/sync-cf-beacon.mjs to report only from ${PRODUCTION_HOST}. */`;

/**
 * The beacon as this site serves it: Cloudflare's bytes inside a function
 * that returns before running them on any other host.
 *
 * @param {string} beacon Cloudflare's script, verbatim.
 * @returns {string} The wrapped script.
 */
function wrap(beacon) {
  const guard = `if(location.hostname!==${JSON.stringify(PRODUCTION_HOST)})return;`;
  return `${HEADER}\n(function(){${guard}\n${beacon}\n})();\n`;
}

/**
 * Writes `bytes` to TARGET through a temporary file and a rename, and only
 * when they differ from what is there.
 *
 * @param {string} bytes The wrapped beacon.
 * @returns {boolean} Whether the file changed.
 */
function writeIfChanged(bytes) {
  if (fs.existsSync(TARGET) && fs.readFileSync(TARGET, "utf8") === bytes) {
    return false;
  }
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  const temporary = `${TARGET}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, TARGET);
  return true;
}

try {
  const response = await fetch(SOURCE, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const beacon = await response.text();
  // The beacon finds its configuration in this attribute; a page that lacks
  // it is not the beacon (an error page, a captive portal), and shipping it
  // would put something else in front of every visitor.
  if (!beacon.includes("data-cf-beacon")) {
    throw new Error("the response is not the beacon (no data-cf-beacon)");
  }
  const changed = writeIfChanged(wrap(beacon));
  console.log(
    `${TAG} ${changed ? "✓ cf-beacon.js: updated" : "= cf-beacon.js: no changes"}`,
  );
} catch (error) {
  const kept = fs.existsSync(TARGET)
    ? "the previous copy is kept"
    : "this build has no beacon";
  console.warn(`${TAG} ⚠ ${SOURCE}: ${error.message}; ${kept}`);
}
