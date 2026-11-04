/**
 * What the build generates for nginx, read as nginx would read it. These lines
 * reach production through a deploy and fail silently: `nginx -t` accepts a twin
 * with no CORS and a redirect that drops the query.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "nginx-snippets-"));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const dist = path.join(scratch, "dist");
const TWINS = [
  "index.md",
  "servers/libgen/index.md",
  "servers/gitlab/actions/issue/index.md",
  "es/servers/gitlab/actions/issue/index.md",
];
for (const twin of TWINS) {
  fs.mkdirSync(path.dirname(path.join(dist, twin)), { recursive: true });
  fs.writeFileSync(path.join(dist, twin), "# twin\n");
}
// The compression step's output sits beside the twins and is not one.
fs.writeFileSync(path.join(dist, "index.md.br"), "");

// STAGING_DIR is read when the module loads, so this has to come first.
process.env.MCP_NGINX_STAGING = path.join(scratch, "staged");
const { stageNginxSnippets } =
  await import("../../src/integrations/post-build/nginx-snippets.ts");
stageNginxSnippets(dist, { info() {}, warn() {} });

const directives = (name) =>
  fs
    .readFileSync(path.join(scratch, "staged", name), "utf8")
    .split("\n")
    .filter((line) => line.startsWith("location "));

test("every twin can be read from another origin", () => {
  const lines = directives("mcp_md_twin_locations.conf");
  assert.equal(lines.length, TWINS.length);
  for (const line of lines) {
    assert.match(
      line,
      /add_header Access-Control-Allow-Origin "\*" always;/,
      `no CORS on ${line}`,
    );
  }
});

test("opening CORS does not cost a twin its security headers", () => {
  // Any `add_header` in a location discards what the server level set.
  for (const line of directives("mcp_md_twin_locations.conf")) {
    assert.match(
      line,
      /include \/etc\/nginx\/snippets\/security_headers_assets_mcp\.conf;/,
    );
  }
});

test("a twin stays on default_type, not on a types block", () => {
  // Stored as identity at the edge, which is what keeps a twin out of the Range
  // failure when the worker is skipped.
  for (const line of directives("mcp_md_twin_locations.conf")) {
    assert.match(line, /default_type "text\/markdown; charset=utf-8";/);
    assert.doesNotMatch(line, /\btypes\s*\{/);
  }
});

test("an action page's redirect keeps the query string", () => {
  assert.deepEqual(directives("mcp_actions_slash_redirects.conf"), [
    "location = /es/servers/gitlab/actions/issue { return 308 /es/servers/gitlab/actions/issue/$is_args$args; }",
    "location = /servers/gitlab/actions/issue { return 308 /servers/gitlab/actions/issue/$is_args$args; }",
  ]);
});
