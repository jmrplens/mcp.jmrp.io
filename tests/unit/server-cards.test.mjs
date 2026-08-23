/**
 * `src/data/server-cards.ts` reads a snapshot written by an external MCP
 * server and refreshed by an unattended script (`scripts/sync-server-cards.sh`,
 * no human review of shape). These tests cover the two directions that can
 * go wrong silently: a card that HAS the new SEP-1649 fields (libgen) must
 * expose them curated and filtered; a card that does NOT (gitlab) must keep
 * working exactly as before; an unsafe icon `src` must never survive into
 * the curated summary; and a card missing the minimum shape this module
 * depends on must fail loudly instead of producing `undefined` deep in a
 * page.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  filterIcons,
  getServerCard,
  validateServerCardDocument,
} from "../../src/data/server-cards.ts";

test("libgen (card completo): expone title/description/websiteUrl/icons de servidor, icons de tools y prompts, y annotations curadas", () => {
  const card = getServerCard("libgen");
  assert.ok(card, "libgen debería tener una card committeada");

  assert.equal(card.serverInfo.name, "libgen-mcp");
  assert.equal(card.serverInfo.title, "Books & Papers MCP Server");
  assert.equal(
    card.serverInfo.description,
    "Federated search of books and papers, BibTeX/RIS citations, open-access retrieval and reading.",
  );
  assert.equal(card.serverInfo.websiteUrl, "https://jmrp.io/docs/libgen-mcp");
  assert.ok(Array.isArray(card.serverInfo.icons) && card.serverInfo.icons.length > 0);
  assert.ok(card.serverInfo.icons.every((icon) => icon.src.startsWith("data:image/")));

  assert.ok(card.tools.length > 0, "libgen debería tener tools");
  for (const tool of card.tools) {
    assert.ok(Array.isArray(tool.icons) && tool.icons.length > 0, `${tool.name}: sin icons`);
    assert.ok(tool.icons.every((icon) => icon.src.startsWith("data:image/")));
  }

  const download = card.tools.find((t) => t.name === "download");
  assert.ok(download, "falta la tool 'download'");
  assert.ok(download.annotations, "download: sin annotations curadas");
  assert.deepEqual(Object.keys(download.annotations).sort((a, b) => a.localeCompare(b)), [
    "destructiveHint",
    "idempotentHint",
    "openWorldHint",
    "readOnlyHint",
  ]);
  assert.equal(download.annotations.readOnlyHint, false);
  assert.equal(download.annotations.destructiveHint, false);
  assert.equal(download.annotations.idempotentHint, true);
  assert.equal(download.annotations.openWorldHint, true);
  // `title` is on CardToolAnnotations but must NOT leak into the curated
  // summary: the tool's own `title` field already carries the display name.
  assert.equal("title" in download.annotations, false);

  assert.ok(card.prompts.length > 0, "libgen debería tener prompts");
  for (const prompt of card.prompts) {
    assert.ok(Array.isArray(prompt.icons) && prompt.icons.length > 0, `${prompt.name}: sin icons`);
  }
});

test("gitlab (sin los campos nuevos): la ficha sigue funcionando igual, y las annotations que ya traía ahora se exponen", () => {
  const card = getServerCard("gitlab");
  assert.ok(card, "gitlab debería tener una card committeada");

  assert.equal(card.serverInfo.name, "gitlab-mcp-server");
  assert.equal(card.serverInfo.title, undefined);
  assert.equal(card.serverInfo.description, undefined);
  assert.equal(card.serverInfo.websiteUrl, undefined);
  assert.equal(card.serverInfo.icons, undefined);

  assert.ok(card.tools.length > 0, "gitlab debería tener tools");
  for (const tool of card.tools) {
    assert.equal(tool.icons, undefined, `${tool.name}: gitlab no publica icons de tool`);
  }
  for (const prompt of card.prompts) {
    assert.equal(prompt.icons, undefined, `${prompt.name}: gitlab no publica icons de prompt`);
  }

  // Annotations already existed on gitlab's card before this change; the
  // point of exposing them is that they now show up in the curated summary.
  const withAnnotations = card.tools.find((t) => t.annotations);
  assert.ok(withAnnotations, "gitlab: ninguna tool expone annotations");
  assert.equal(typeof withAnnotations.annotations.destructiveHint, "boolean");
  assert.equal(typeof withAnnotations.annotations.readOnlyHint, "boolean");
});

test("filterIcons: descarta un icono con esquema no permitido y conserva los data:image/ válidos", () => {
  const icons = [
    { src: "data:image/svg+xml;base64,AAAA" },
    { src: "javascript:alert(1)" },
    { src: "https://evil.example/icon.svg" },
  ];
  assert.deepEqual(filterIcons(icons), [{ src: "data:image/svg+xml;base64,AAAA" }]);
});

test("filterIcons: si ninguno es seguro, devuelve undefined en vez de un array vacío ambiguo", () => {
  assert.equal(filterIcons([{ src: "javascript:evil()" }]), undefined);
});

test("filterIcons: sin icons de entrada, devuelve undefined", () => {
  assert.equal(filterIcons(undefined), undefined);
});

test("validateServerCardDocument: un card malformado (sin serverInfo.name) falla ruidosamente", () => {
  assert.throws(
    () =>
      validateServerCardDocument("broken", {
        serverInfo: { version: "1.0.0" },
        authentication: { required: false, schemes: [] },
        tools: [],
        prompts: [],
        resources: [],
        resourceTemplates: [],
      }),
    /serverInfo\.name/,
  );
});

test("validateServerCardDocument: un card malformado (sin serverInfo.version) falla ruidosamente", () => {
  assert.throws(
    () => validateServerCardDocument("broken", { serverInfo: { name: "broken-mcp" } }),
    /serverInfo\.version/,
  );
});

test("validateServerCardDocument: una familia que no es array falla ruidosamente", () => {
  assert.throws(
    () =>
      validateServerCardDocument("broken", {
        serverInfo: { name: "broken-mcp", version: "1.0.0" },
        tools: "not-an-array",
      }),
    /tools is present but not an array/,
  );
});

test("validateServerCardDocument: un card mínimo válido no falla, y las familias ausentes quedan en []", () => {
  const doc = validateServerCardDocument("minimal", {
    serverInfo: { name: "minimal-mcp", version: "0.1.0" },
    authentication: { required: false, schemes: [] },
  });
  assert.deepEqual(doc.tools, []);
  assert.deepEqual(doc.prompts, []);
  assert.deepEqual(doc.resources, []);
  assert.deepEqual(doc.resourceTemplates, []);
});
