import assert from "node:assert/strict";
import { test } from "node:test";

import {
  alternates,
  pageUrl,
  serverPageAlternates,
  serverPageUrl,
} from "../../src/lib/seo.ts";

test("pageUrl compone la URL de cada página e idioma", () => {
  assert.equal(pageUrl("en"), "https://mcp.jmrp.io/");
  assert.equal(pageUrl("es"), "https://mcp.jmrp.io/es/");
  assert.equal(pageUrl("en", "inspector"), "https://mcp.jmrp.io/inspector/");
  assert.equal(pageUrl("es", "inspector"), "https://mcp.jmrp.io/es/inspector/");
  assert.equal(pageUrl("en", "internals"), "https://mcp.jmrp.io/internals/");
  assert.equal(pageUrl("es", "internals"), "https://mcp.jmrp.io/es/internals/");
  assert.equal(pageUrl("en", "policies"), "https://mcp.jmrp.io/policies/");
  assert.equal(pageUrl("es", "policies"), "https://mcp.jmrp.io/es/policies/");
});

test("alternates emite el clúster de SU página, no el de la portada", () => {
  const alts = alternates("internals");
  assert.deepEqual(alts, [
    { hreflang: "en", href: "https://mcp.jmrp.io/internals/" },
    { hreflang: "es", href: "https://mcp.jmrp.io/es/internals/" },
    { hreflang: "x-default", href: "https://mcp.jmrp.io/internals/" },
  ]);
});

test("alternates sin argumento sigue siendo el de la portada", () => {
  assert.equal(alternates()[0].href, "https://mcp.jmrp.io/");
});

test("pageUrl('servers') es SOLO el índice, no la ficha de un servidor", () => {
  assert.equal(pageUrl("en", "servers"), "https://mcp.jmrp.io/servers/");
  assert.equal(pageUrl("es", "servers"), "https://mcp.jmrp.io/es/servers/");
});

test("serverPageUrl compone la ficha de un servidor bajo /servers/<id>/", () => {
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

test("serverPageAlternates emite el clúster de ESA ficha, con autorreferencia", () => {
  assert.deepEqual(serverPageAlternates("gitlab"), [
    { hreflang: "en", href: "https://mcp.jmrp.io/servers/gitlab/" },
    { hreflang: "es", href: "https://mcp.jmrp.io/es/servers/gitlab/" },
    { hreflang: "x-default", href: "https://mcp.jmrp.io/servers/gitlab/" },
  ]);
});
