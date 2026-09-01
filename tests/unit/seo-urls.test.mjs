import assert from "node:assert/strict";
import { test } from "node:test";

import {
  alternates,
  pageUrl,
  serverPageAlternates,
  serverPageUrl,
} from "../../src/lib/seo.ts";

test("pageUrl composes the URL of every page and language", () => {
  assert.equal(pageUrl("en"), "https://mcp.jmrp.io/");
  assert.equal(pageUrl("es"), "https://mcp.jmrp.io/es/");
  assert.equal(pageUrl("en", "inspector"), "https://mcp.jmrp.io/inspector/");
  assert.equal(pageUrl("es", "inspector"), "https://mcp.jmrp.io/es/inspector/");
  assert.equal(pageUrl("en", "internals"), "https://mcp.jmrp.io/internals/");
  assert.equal(pageUrl("es", "internals"), "https://mcp.jmrp.io/es/internals/");
  assert.equal(pageUrl("en", "policies"), "https://mcp.jmrp.io/policies/");
  assert.equal(pageUrl("es", "policies"), "https://mcp.jmrp.io/es/policies/");
  assert.equal(pageUrl("en", "license"), "https://mcp.jmrp.io/license/");
  assert.equal(pageUrl("es", "license"), "https://mcp.jmrp.io/es/license/");
});

test("alternates emits ITS OWN page's cluster, not the home page's", () => {
  const alts = alternates("internals");
  assert.deepEqual(alts, [
    { hreflang: "en", href: "https://mcp.jmrp.io/internals/" },
    { hreflang: "es", href: "https://mcp.jmrp.io/es/internals/" },
    { hreflang: "x-default", href: "https://mcp.jmrp.io/internals/" },
  ]);
});

test("alternates with no argument is still the home page's", () => {
  assert.equal(alternates()[0].href, "https://mcp.jmrp.io/");
});

test("pageUrl('servers') is ONLY the index, not a server's page", () => {
  assert.equal(pageUrl("en", "servers"), "https://mcp.jmrp.io/servers/");
  assert.equal(pageUrl("es", "servers"), "https://mcp.jmrp.io/es/servers/");
});

test("serverPageUrl composes a server's page under /servers/<id>/", () => {
  assert.equal(
    serverPageUrl("en", "gitlab"),
    "https://mcp.jmrp.io/servers/gitlab/",
  );
  assert.equal(
    serverPageUrl("es", "gitlab"),
    "https://mcp.jmrp.io/es/servers/gitlab/",
  );
  assert.equal(
    serverPageUrl("en", "libgen"),
    "https://mcp.jmrp.io/servers/libgen/",
  );
});

test("serverPageAlternates emits THAT page's cluster, self-reference included", () => {
  assert.deepEqual(serverPageAlternates("gitlab"), [
    { hreflang: "en", href: "https://mcp.jmrp.io/servers/gitlab/" },
    { hreflang: "es", href: "https://mcp.jmrp.io/es/servers/gitlab/" },
    { hreflang: "x-default", href: "https://mcp.jmrp.io/servers/gitlab/" },
  ]);
});
