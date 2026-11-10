import assert from "node:assert/strict";
import { test } from "node:test";

import { servers } from "../../src/data/servers.ts";
import { sameDocsSite, websiteHref } from "../../src/lib/docs-site.ts";

test("libgen's card address (jmrp.io/docs, a 301) links the documentation site itself", () => {
  assert.equal(
    websiteHref(
      "https://jmrp.io/docs/libgen-mcp",
      "https://docs.jmrp.io/libgen-mcp/",
    ),
    "https://docs.jmrp.io/libgen-mcp/",
  );
});

test("gitlab's card address (no trailing slash, a 301) links the documentation site itself", () => {
  assert.equal(
    websiteHref(
      "https://docs.jmrp.io/gitlab-mcp-server",
      "https://docs.jmrp.io/gitlab-mcp-server/",
    ),
    "https://docs.jmrp.io/gitlab-mcp-server/",
  );
});

test("an address on another site is linked verbatim", () => {
  assert.equal(
    websiteHref("https://example.org/tool", "https://docs.jmrp.io/tool/"),
    "https://example.org/tool",
  );
  assert.equal(
    websiteHref("https://jmrp.io/docs", "https://docs.jmrp.io/tool/"),
    "https://jmrp.io/docs",
  );
});

test("another repository's documentation is a different site", () => {
  assert.equal(
    sameDocsSite(
      "https://jmrp.io/docs/libgen-mcp",
      "https://docs.jmrp.io/gitlab-mcp-server/",
    ),
    false,
  );
});

test("the jmrp.io alias is matched without case, as its nginx map does", () => {
  assert.equal(
    sameDocsSite(
      "https://jmrp.io/docs/LibGen-MCP",
      "https://docs.jmrp.io/libgen-mcp/",
    ),
    true,
  );
});

test("without a docsSite, or with something that is not a URL, nothing is rewritten", () => {
  assert.equal(
    websiteHref("https://jmrp.io/docs/libgen-mcp", undefined),
    "https://jmrp.io/docs/libgen-mcp",
  );
  assert.equal(sameDocsSite("not a url", "not a url"), false);
});

test("every docsSite is the final address: on docs.jmrp.io, with its trailing slash", () => {
  for (const server of servers) {
    if (!server.docsSite) continue;
    const url = new URL(server.docsSite);
    assert.equal(url.hostname, "docs.jmrp.io", server.id);
    assert.ok(url.pathname.endsWith("/"), server.id);
  }
});
