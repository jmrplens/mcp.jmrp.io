/**
 * Anti-leak guards over the surface extracted from the MCP servers.
 *
 * The author's GitLab instance cannot appear in ANYTHING published or in
 * ANYTHING committed: the repo is public and its hostname lives only in `.env`
 * (MCP_SURFACE_FORBIDDEN_HOSTS). That is why this file contains the value
 * nowhere — not in fixtures, not in comments, not in failure messages: it is
 * read from `process.env` at run time and, when something fails, the assert
 * lists file PATHS, never what was being searched for.
 *
 * Without the variable (public CI, no `.env`) the scans skip with a note: that
 * is the intended behaviour, because the alternative would be writing the
 * hostname into the repo in order to search for it. On the author's machine
 * `.env` exists, so the guard always runs there.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// `dist` is a SYMLINK to the active blue/green colour, so it points at what is
// PUBLISHED, not at what was just built. `DIST_DIR` makes it possible to
// validate a build that has not been deployed yet (e.g. `pnpm build:only &&
// DIST_DIR=builds/green pnpm test:unit`), which is exactly what is needed to
// avoid publishing something untested. Without the variable it behaves as it
// always did.
const DIST = fileURLToPath(
  new URL(`../../${process.env.DIST_DIR ?? "dist"}/`, import.meta.url),
);

// The committed snapshots that feed the SSR are public surface too: a leak
// here travels straight into the repo with the next commit.
const SURFACE = fileURLToPath(
  new URL("../../src/data/surface/", import.meta.url),
);

// Same pattern as scripts/deploy-live-mcp.mjs: `loadEnvFile` does NOT override
// what already comes from the environment (shell > .env) and a missing file is
// not an error.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // No .env: whatever the environment brings is what counts.
}

/**
 * The needles to search for: MCP_SURFACE_FORBIDDEN_HOSTS' hosts in lowercase,
 * with and without a port (today's value carries no port, but the guard must
 * not depend on that). Returns `null` when the variable is absent — the caller
 * decides whether to skip.
 *
 * @returns {string[] | null} Substrings to detect, or `null` with no variable.
 */
function resolveNeedles() {
  // The SAME variable as FORBIDDEN_HOSTS in scripts/sync-server-surface.mjs,
  // and not by taste: if the build and its safety net resolve different
  // needles, they inspect different things and a leak can be published with
  // both green. When the build's guard was decoupled from the transport (it
  // went from deriving the host from the instance it called to reading its own
  // variable), this resolver was left behind reading the old one — exactly the
  // failure the comment over there warned about. If one changes, so does the
  // other.
  const raw = process.env.MCP_SURFACE_FORBIDDEN_HOSTS;
  if (!raw) return null;
  const needles = new Set();
  for (const item of raw.split(",")) {
    const entry = item.trim();
    if (!entry) continue;
    let parsed = [];
    try {
      const u = new URL(entry.includes("://") ? entry : `https://${entry}`);
      parsed = [u.host, u.hostname];
    } catch {
      // No scheme and no colon: new URL throws; falls through to the raw value below.
    }
    if (parsed.filter(Boolean).length === 0) {
      // A value with no scheme, OR with a colon and no scheme ("host:8443"):
      // new URL does NOT throw on the latter — it parses it as a scheme plus an
      // opaque path with an EMPTY host, and without this fallback the scan
      // tests would skip themselves precisely when the variable is set.
      parsed = [entry, entry.split(":", 1)[0]];
    }
    for (const h of parsed) {
      if (h) needles.add(h.toLowerCase());
    }
  }
  return needles.size > 0 ? [...needles] : null;
}

// Only binaries (images, fonts) and the pre-compressed files are left out of
// the scan: .br/.gz are copies of an original that IS scanned and their
// compression could hide the substring. Everything else in the complete build
// stays in — HTML, JSON, TXT, XML, JS, CSS, SVG, .conf and the files with no
// extension such as .well-known/api-catalog or the server cards.
const SKIP_EXTENSIONS = /\.(br|gz|png|ico|jpe?g|webp|woff2?)$/i;

/**
 * Scans `rootDir` recursively and returns the relative paths of the text files
 * that contain one of the needles (case-insensitively).
 *
 * @param {string} rootDir The root directory to walk.
 * @param {string[]} needles Substrings, already lowercased.
 * @returns {string[]} Relative paths with a needle inside.
 */
function scanForNeedles(rootDir, needles) {
  const files = fs
    .readdirSync(rootDir, { recursive: true })
    .map(String)
    .filter((file) => !SKIP_EXTENSIONS.test(file))
    .filter((file) => fs.statSync(path.join(rootDir, file)).isFile());
  const leaks = [];
  for (const file of files) {
    const content = fs
      .readFileSync(path.join(rootDir, file), "utf8")
      .toLowerCase();
    if (needles.some((needle) => content.includes(needle))) {
      leaks.push(file);
    }
  }
  return leaks;
}

const SKIP_NOTE =
  "MCP_SURFACE_FORBIDDEN_HOSTS is neither in the environment nor in .env: there is no host " +
  "to search for (in CI that is expected)";

test("no published surface contains the GitLab instance's host", (t) => {
  const needles = resolveNeedles();
  if (!needles) {
    t.skip(SKIP_NOTE);
    return;
  }
  const leaks = scanForNeedles(DIST, needles);
  assert.deepEqual(
    leaks,
    [],
    `a forbidden host appears in ${leaks.length} published file(s): ` +
      `${leaks.join(", ")} — the value searched for is deliberately not printed`,
  );
});

test("the snapshots in src/data/surface/ do not contain the host either", (t) => {
  // The extractor already carries its own hard failure before writing; this is
  // the safety net in case someone edits a snapshot by hand.
  const needles = resolveNeedles();
  if (!needles) {
    t.skip(SKIP_NOTE);
    return;
  }
  const leaks = scanForNeedles(SURFACE, needles);
  assert.deepEqual(
    leaks,
    [],
    `a forbidden host appears in ${leaks.length} committed snapshot(s): ` +
      `${leaks.join(", ")} — the value searched for is deliberately not printed`,
  );
});

test("the guard bites: a host planted in a copy of dist is detected", (t) => {
  // This verifies the MECHANISM, not the state: if `scanForNeedles` stopped
  // seeing the substring, the two tests above would stay green forever. The
  // tree is SYNTHETIC — the mechanism does not need the real dist, and copying
  // it would make this test fail in a checkout with no build (the header
  // promises that `pnpm test:unit` with neither `.env` nor a build stays
  // green). With no host configured, a synthetic needle is planted (the
  // .invalid TLD, RFC 2606) so the mechanism is covered in CI too.
  const needles = resolveNeedles() ?? ["gitlab.fixture.invalid"];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "surface-guard-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const copy = path.join(tmp, "dist");
  fs.mkdirSync(path.join(copy, "clean"), { recursive: true });
  fs.writeFileSync(
    path.join(copy, "clean", "index.html"),
    "<!doctype html><title>no needles</title>",
  );

  const planted = path.join("guard-fixture", "leak.json");
  fs.mkdirSync(path.join(copy, "guard-fixture"));
  fs.writeFileSync(
    path.join(copy, planted),
    // The planted host comes from the environment (or from the synthetic
    // needle), never from a literal: this temporary file is removed in the
    // `t.after` above.
    JSON.stringify({ endpoint: `https://${needles[0]}/api/v4` }),
  );

  const leaks = scanForNeedles(copy, needles);
  assert.deepEqual(
    leaks,
    [planted],
    "the scan had to detect exactly the planted file (and only that one)",
  );
});
