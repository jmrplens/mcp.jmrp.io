import assert from "node:assert/strict";
import { test } from "node:test";

import { getLangFromUrl } from "../../src/i18n/utils.ts";

test("getLangFromUrl saca el idioma del primer segmento", () => {
  const cases = [
    ["https://mcp.jmrp.io/", "en"],
    ["https://mcp.jmrp.io/inspector/", "en"],
    ["https://mcp.jmrp.io/es/", "es"],
    ["https://mcp.jmrp.io/es/inspector/", "es"],
    // A first segment that is NOT a language falls back to the default one:
    // it is an English page, not a language 404.
    ["https://mcp.jmrp.io/internals/", "en"],
  ];
  for (const [href, expected] of cases) {
    assert.equal(getLangFromUrl(new URL(href)), expected, href);
  }
});
