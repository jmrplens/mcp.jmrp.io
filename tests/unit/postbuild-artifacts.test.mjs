import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

// `dist` is a SYMLINK to the active blue/green colour, so it points at what is
// PUBLISHED, not at what was just built. `DIST_DIR` makes it possible to
// validate a build that has not been deployed yet (e.g. `pnpm build:only &&
// DIST_DIR=builds/green pnpm test:unit`), which is exactly what is needed to
// avoid publishing something untested. Without the variable it behaves as it
// always did.
const DIST = new URL(
  `../../${process.env.DIST_DIR ?? "dist"}/`,
  import.meta.url,
);

test("it generates the artifacts with the _mcp suffix", () => {
  assert.ok(fs.existsSync(new URL("security_headers_mcp.conf", DIST)));
  assert.ok(fs.existsSync(new URL("security_headers_assets_mcp.conf", DIST)));
});

test("it does NOT generate jmrp.io's names", () => {
  assert.ok(
    !fs.existsSync(new URL("security_headers.conf", DIST)),
    "it would collide with jmrp.io's snippet",
  );
  assert.ok(!fs.existsSync(new URL("security_headers_assets.conf", DIST)));
});

test("HTML is not pre-compressed", () => {
  const found = fs
    .readdirSync(DIST, { recursive: true })
    .filter(
      (f) => String(f).endsWith(".html.br") || String(f).endsWith(".html.gz"),
    );
  assert.equal(found.length, 0, "sub_filter cannot rewrite compressed HTML");
});

test("assets are pre-compressed", () => {
  const found = fs
    .readdirSync(DIST, { recursive: true })
    .filter(
      (f) => String(f).endsWith(".js.br") || String(f).endsWith(".css.br"),
    );
  assert.ok(
    found.length > 0,
    "static assets must carry a .br next to the original",
  );
});

test("the CSP carries nginx's variable, not the HTML's literal", () => {
  const conf = fs.readFileSync(
    new URL("security_headers_mcp.conf", DIST),
    "utf8",
  );
  assert.match(
    conf,
    /'nonce-\$cspNonce'/,
    "add_header needs the variable nginx resolves on every request",
  );
  assert.doesNotMatch(
    conf,
    /NGINX_CSP_NONCE/,
    "the HTML literal in the header would leave the nonce fixed: the CSP would protect nothing",
  );
});

test("EVERY page carries the placeholder sub_filter replaces", () => {
  const pages = fs
    .readdirSync(DIST, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".html"));
  assert.ok(
    pages.length > 1,
    "the site has at least the root page and the /es/ one",
  );
  for (const page of pages) {
    const html = fs.readFileSync(new URL(page, DIST), "utf8");
    assert.match(
      html,
      /nonce="NGINX_CSP_NONCE"/,
      `${page} has no placeholder: the nonce CSP would block its scripts and styles`,
    );
  }
});
