/**
 * `src/data/server-cards.ts` reads a snapshot written by an external MCP
 * server and refreshed by an unattended script (`scripts/sync-server-cards.sh`,
 * no human review of shape). These tests cover the two directions that can
 * go wrong silently: a card that HAS the new SEP-1649 fields (libgen) must
 * expose them curated and filtered; a card that does NOT (gitlab) must keep
 * working exactly as before; an unsafe icon `src` must never survive into
 * the curated summary; a `websiteUrl` with an unexpected scheme must never be
 * published as the server's official site; and a card missing the minimum
 * shape this module depends on must fail loudly instead of producing
 * `undefined` deep in a page.
 *
 * Since gitlab 2.7.x the same two directions cover `capabilities`,
 * `subscriptions` and the curated `subscribable` flag on resource templates:
 * gitlab must expose them, libgen (no `subscriptions`, no `_meta`) must keep
 * summarizing them to `undefined`/`[]` without error, and the raw `_meta`
 * must never leak into the curated summary.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  filterIcons,
  filterWebsiteUrl,
  getServerCard,
  SUBSCRIBABLE_META_KEY,
  summarizeServerCardDocument,
  validateServerCardDocument,
} from "../../src/data/server-cards.ts";
import { servers } from "../../src/data/servers.ts";
import { safeIcon } from "../../src/lib/card-icons.ts";

test("libgen (complete card): exposes the server's title/description/websiteUrl/icons, the tools' and prompts' icons, and curated annotations", () => {
  const card = getServerCard("libgen");
  assert.ok(card, "libgen should have a committed card");

  assert.equal(card.serverInfo.name, "libgen-mcp");
  assert.equal(card.serverInfo.title, "Books & Papers MCP Server");
  assert.equal(
    card.serverInfo.description,
    "Federated search of books and papers, BibTeX/RIS citations, open-access retrieval and reading.",
  );
  assert.equal(card.serverInfo.websiteUrl, "https://jmrp.io/docs/libgen-mcp");
  assert.ok(
    Array.isArray(card.serverInfo.icons) && card.serverInfo.icons.length > 0,
  );
  assert.ok(
    card.serverInfo.icons.every((icon) => icon.src.startsWith("data:image/")),
  );

  assert.ok(card.tools.length > 0, "libgen should have tools");
  for (const tool of card.tools) {
    assert.ok(
      Array.isArray(tool.icons) && tool.icons.length > 0,
      `${tool.name}: sin icons`,
    );
    assert.ok(tool.icons.every((icon) => icon.src.startsWith("data:image/")));
  }

  const download = card.tools.find((t) => t.name === "download");
  assert.ok(download, "the 'download' tool is missing");
  assert.ok(download.annotations, "download: no curated annotations");
  assert.deepEqual(
    Object.keys(download.annotations).sort((a, b) => a.localeCompare(b)),
    ["destructiveHint", "idempotentHint", "openWorldHint", "readOnlyHint"],
  );
  assert.equal(download.annotations.readOnlyHint, false);
  assert.equal(download.annotations.destructiveHint, false);
  assert.equal(download.annotations.idempotentHint, true);
  assert.equal(download.annotations.openWorldHint, true);
  // `title` is on CardToolAnnotations but must NOT leak into the curated
  // summary: the tool's own `title` field already carries the display name.
  assert.equal("title" in download.annotations, false);

  assert.ok(card.prompts.length > 0, "libgen should have prompts");
  for (const prompt of card.prompts) {
    assert.ok(
      Array.isArray(prompt.icons) && prompt.icons.length > 0,
      `${prompt.name}: sin icons`,
    );
  }
});

test("gitlab (its own identity since 2.7.0): exposes title/description/websiteUrl/icons, and the annotations it already carried", () => {
  const card = getServerCard("gitlab");
  assert.ok(card, "gitlab should have a committed card");

  // Up to 2.6.6 this test asserted the opposite: gitlab was the REAL fixture
  // for "a card without the SEP-1649 fields", against libgen, which did carry
  // them. 2.7.0 gave them to it, so that subject no longer exists in the repo —
  // the degradation is now covered by the synthetic document in "a minimal
  // valid card does not fail". The opposite of before is asserted here ON
  // PURPOSE, not out of giving in to a failure: the data changed, and a test
  // that kept demanding `undefined` would block publishing the identity the
  // server already declares.
  assert.equal(card.serverInfo.name, "gitlab-mcp-server");
  assert.equal(card.serverInfo.title, "GitLab MCP Server");
  assert.ok(
    card.serverInfo.description,
    "gitlab: serverInfo.description is missing",
  );
  assert.equal(
    card.serverInfo.websiteUrl,
    "https://jmrp.io/docs/gitlab-mcp-server",
  );
  assert.ok(
    card.serverInfo.icons?.length,
    "gitlab: serverInfo.icons is missing",
  );

  assert.ok(card.tools.length > 0, "gitlab should have tools");
  // 2.7.2 closed the gap this test documented: the card now carries the same
  // arrays of 3 icons as tools/list across ALL FOUR families (it was a finding
  // of the site's audit, addressed in upstream PR #305). Per-entry degradation
  // is covered by the synthetic "bare" document.
  for (const tool of card.tools) {
    assert.ok(tool.icons?.length, `${tool.name}: 2.7.2 publishes tool icons`);
  }
  for (const prompt of card.prompts) {
    assert.ok(
      prompt.icons?.length,
      `${prompt.name}: 2.7.2 publishes prompt icons`,
    );
  }
  for (const resource of card.resources) {
    assert.ok(
      resource.icons?.length,
      `${resource.name}: 2.7.2 publishes resource icons`,
    );
  }
  for (const template of card.resourceTemplates) {
    assert.ok(
      template.icons?.length,
      `${template.name}: 2.7.2 publishes template icons`,
    );
  }

  // Annotations already existed on gitlab's card before this change; the
  // point of exposing them is that they now show up in the curated summary.
  const withAnnotations = card.tools.find((t) => t.annotations);
  assert.ok(withAnnotations, "gitlab: no tool exposes annotations");
  assert.equal(typeof withAnnotations.annotations.destructiveHint, "boolean");
  assert.equal(typeof withAnnotations.annotations.readOnlyHint, "boolean");
});

test("filterIcons: discards an icon with a disallowed scheme and keeps the valid data:image/ ones", () => {
  const icons = [
    { src: "data:image/svg+xml;base64,AAAA" },
    { src: "javascript:alert(1)" },
    { src: "https://evil.example/icon.svg" },
  ];
  assert.deepEqual(filterIcons(icons), [
    { src: "data:image/svg+xml;base64,AAAA" },
  ]);
});

test("filterIcons: when none is safe it returns undefined instead of an ambiguous empty array", () => {
  assert.equal(filterIcons([{ src: "javascript:evil()" }]), undefined);
});

test("filterIcons: with no input icons it returns undefined", () => {
  assert.equal(filterIcons(undefined), undefined);
});

test("validateServerCardDocument: a malformed card (no serverInfo.name) fails loudly", () => {
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

test("validateServerCardDocument: a malformed card (no serverInfo.version) fails loudly", () => {
  assert.throws(
    () =>
      validateServerCardDocument("broken", {
        serverInfo: { name: "broken-mcp" },
      }),
    /serverInfo\.version/,
  );
});

test("validateServerCardDocument: a family that is not an array fails loudly", () => {
  assert.throws(
    () =>
      validateServerCardDocument("broken", {
        serverInfo: { name: "broken-mcp", version: "1.0.0" },
        authentication: { required: false, schemes: [] },
        tools: "not-an-array",
      }),
    /tools is present but not an array/,
  );
});

test("validateServerCardDocument: a minimal valid card does not fail, and the absent families end up as []", () => {
  const doc = validateServerCardDocument("minimal", {
    serverInfo: { name: "minimal-mcp", version: "0.1.0" },
    authentication: { required: false, schemes: [] },
  });
  assert.deepEqual(doc.tools, []);
  assert.deepEqual(doc.prompts, []);
  assert.deepEqual(doc.resources, []);
  assert.deepEqual(doc.resourceTemplates, []);

  // 2.7.x extension: with neither `capabilities` nor `subscriptions` the card
  // is still valid, and the absence reaches the summary as `undefined` (not as
  // `{}` or `null`) — which is what the page checks to skip rendering a
  // block.
  const card = summarizeServerCardDocument("minimal", doc);
  assert.equal(card.capabilities, undefined);
  assert.equal(card.subscriptions, undefined);
  assert.deepEqual(card.resourceTemplates, []);
});

test("filterWebsiteUrl: keeps an https URL", () => {
  assert.equal(
    filterWebsiteUrl("https://jmrp.io/docs/libgen-mcp"),
    "https://jmrp.io/docs/libgen-mcp",
  );
});

test("filterWebsiteUrl: the scheme is case-insensitive, and the value comes out verbatim", () => {
  assert.equal(
    filterWebsiteUrl("HTTPS://jmrp.io/docs"),
    "HTTPS://jmrp.io/docs",
  );
});

test("filterWebsiteUrl: discards any scheme that is not https, without throwing", () => {
  // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- The http:// literal IS the case under test: that a card publishing its site in cleartext loses the link instead of being published as the "official site". Replacing it with https would empty the assertion.
  assert.equal(filterWebsiteUrl("http://jmrp.io/docs"), undefined);
  assert.equal(filterWebsiteUrl("javascript:alert(1)"), undefined);
  assert.equal(filterWebsiteUrl("data:text/html,<h1>hola</h1>"), undefined);
  assert.equal(filterWebsiteUrl("file:///etc/passwd"), undefined);
});

test("filterWebsiteUrl: discards what is not a URL, and an absent one stays undefined", () => {
  assert.equal(filterWebsiteUrl("/docs/libgen-mcp"), undefined);
  assert.equal(filterWebsiteUrl(""), undefined);
  assert.equal(filterWebsiteUrl(undefined), undefined);
});

test("validateServerCardDocument: a card with no authentication fails loudly instead of blowing up in the template", () => {
  assert.throws(
    () =>
      validateServerCardDocument("broken", {
        serverInfo: { name: "broken-mcp", version: "1.0.0" },
      }),
    /authentication is missing or not an object/,
  );
});

test("validateServerCardDocument: an authentication that is not an object fails loudly", () => {
  assert.throws(
    () =>
      validateServerCardDocument("broken", {
        serverInfo: { name: "broken-mcp", version: "1.0.0" },
        authentication: "none",
      }),
    /authentication is missing or not an object/,
  );
});

test("validateServerCardDocument: an authentication.required that is not a boolean fails loudly", () => {
  assert.throws(
    () =>
      validateServerCardDocument("broken", {
        serverInfo: { name: "broken-mcp", version: "1.0.0" },
        authentication: { required: "yes", schemes: [] },
      }),
    /authentication\.required is missing or not a boolean/,
  );
});

test("validateServerCardDocument: an authentication.schemes that is not an array fails loudly", () => {
  assert.throws(
    () =>
      validateServerCardDocument("broken", {
        serverInfo: { name: "broken-mcp", version: "1.0.0" },
        authentication: { required: true, schemes: "header-token" },
      }),
    /authentication\.schemes is missing or not an array/,
  );
});

// The new validations run when the module is imported, so a real card that
// broke them would already have taken this file down; it is asserted here so
// the failure says which of the two and in which field, rather than "could not
// import".
test("both committed cards satisfy authentication's minimal shape", () => {
  for (const id of ["libgen", "gitlab"]) {
    const card = getServerCard(id);
    assert.ok(card, `${id} should have a committed card`);
    assert.equal(
      typeof card.authentication.required,
      "boolean",
      `${id}: required`,
    );
    assert.ok(Array.isArray(card.authentication.schemes), `${id}: schemes`);
  }
});

// The `filterWebsiteUrl`/`filterIcons` tests above exercise the functions in
// ISOLATION: they would pass just as well if nobody called them. And no
// committed card can cover the wiring, because none carries a value the filters
// would change (libgen publishes its site over https, gitlab publishes none).
// These cases bring their own document, which is the only way deleting the
// filter from the summary gets noticed.
test("summarizeServerCardDocument: a websiteUrl that is not https never reaches the summary the page renders", () => {
  const doc = validateServerCardDocument("wired", {
    serverInfo: {
      name: "wired-mcp",
      version: "1.0.0",
      // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- The http:// literal IS the case under test: that a card publishing its site in cleartext loses the link instead of showing up as the "official site". Replacing it with https would empty the assertion.
      websiteUrl: "http://jmrp.io/docs",
    },
    authentication: { required: false, schemes: [] },
  });

  const card = summarizeServerCardDocument("wired", doc);
  assert.equal(card.serverInfo.websiteUrl, undefined);
  // The rest of serverInfo still comes through: the filter discards a field, not the card.
  assert.equal(card.serverInfo.name, "wired-mcp");
  assert.equal(card.serverInfo.version, "1.0.0");
});

test("summarizeServerCardDocument: an https websiteUrl does reach the summary, verbatim", () => {
  const doc = validateServerCardDocument("wired", {
    serverInfo: {
      name: "wired-mcp",
      version: "1.0.0",
      websiteUrl: "https://jmrp.io/docs",
    },
    authentication: { required: false, schemes: [] },
  });

  assert.equal(
    summarizeServerCardDocument("wired", doc).serverInfo.websiteUrl,
    "https://jmrp.io/docs",
  );
});

test("summarizeServerCardDocument: icons with a disallowed scheme do not reach the summary either, neither the server's nor a tool's", () => {
  const doc = validateServerCardDocument("wired", {
    serverInfo: {
      name: "wired-mcp",
      version: "1.0.0",
      icons: [
        { src: "javascript:alert(1)" },
        { src: "data:image/svg+xml;base64,AAAA" },
      ],
    },
    authentication: { required: false, schemes: [] },
    tools: [
      { name: "dangerous", icons: [{ src: "https://evil.example/icon.svg" }] },
    ],
  });

  const card = summarizeServerCardDocument("wired", doc);
  assert.deepEqual(card.serverInfo.icons, [
    { src: "data:image/svg+xml;base64,AAAA" },
  ]);
  assert.equal(card.tools[0].icons, undefined);
});

test("each server's version fallback matches its card's", () => {
  // `servers.ts`'s `version` is the value the Server Card falls back to when
  // the build cannot read `/health` (offline build, stopped container). It is
  // a SECOND copy of a number the snapshot already carries, so it goes stale
  // the moment `sync-server-cards.sh` refreshes a card and nobody edits
  // `servers.ts` — which is what happened three times: libgen (1.6.3 vs
  // 1.6.4), gitlab (2.6.5 vs 2.6.6, stale since the repo's first commit) and
  // both again on the 1.6.6/2.7.0 refresh. A code review caught one of the
  // three, and only after the drift shipped.
  //
  // Nothing else notices, because the fallback is unreachable on any build
  // WITH network — which is every build anyone watches.
  for (const server of servers) {
    const card = getServerCard(server.id);
    if (!card) continue; // A server may be listed before its snapshot lands.
    assert.equal(
      server.version,
      card.serverInfo.version,
      `${server.id}'s fallback in servers.ts (${server.version}) does not match ` +
        `its card (${card.serverInfo.version}). Refresh the fallback when ` +
        `syncing the snapshot.`,
    );
  }
});

test("summarizeServerCardDocument: a card without serverInfo's optional fields invents none", () => {
  // This covers what gitlab demonstrated with real data up to 2.7.0. Without
  // the synthetic case, the day both cards publish every optional field nobody
  // would still be checking that absence propagates as `undefined` rather than
  // as `null`, `""` or an empty array — which is what the page distinguishes to
  // decide whether to render a block.
  const doc = validateServerCardDocument("bare", {
    serverInfo: { name: "bare-mcp", version: "0.1.0" },
    authentication: { required: false, schemes: [] },
  });
  const card = summarizeServerCardDocument("bare", doc);
  assert.equal(card.serverInfo.title, undefined);
  assert.equal(card.serverInfo.description, undefined);
  assert.equal(card.serverInfo.websiteUrl, undefined);
  assert.equal(card.serverInfo.icons, undefined);
});

test("safeIcon: prefers the SVG even when the card publishes it in another position", () => {
  // The array's order is decided by the SERVER. If a card put the WebP first,
  // the page would render a 16px raster in a 1em slot and on top of that apply
  // ServerPage's `filter: invert(1)`, meant for monochrome SVGs: two visible
  // defects and no error.
  const webpFirst = [
    {
      src: "data:image/webp;base64,AA==",
      mimeType: "image/webp",
      theme: "light",
    },
    { src: "data:image/svg+xml;base64,BB==", mimeType: "image/svg+xml" },
  ];
  assert.equal(safeIcon(webpFirst).mimeType, "image/svg+xml");

  // With no SVG, the first safe one is taken rather than rendering nothing.
  const noSvg = [
    { src: "data:image/webp;base64,AA==", mimeType: "image/webp" },
  ];
  assert.equal(safeIcon(noSvg).mimeType, "image/webp");

  // An SVG with an unsafe `src` does not win for being an SVG.
  const unsafeSvg = [
    { src: "javascript:alert(1)", mimeType: "image/svg+xml" },
    { src: "data:image/webp;base64,AA==", mimeType: "image/webp" },
  ];
  assert.equal(safeIcon(unsafeSvg).mimeType, "image/webp");
});

// Coverage of `capabilities`/`subscriptions`/`subscribable` (gitlab 2.7.x).
// The real subject with data is gitlab; libgen is the real subject for the
// degradation (it publishes neither subscriptions nor _meta); the synthetic
// ones cover what no committed card can demonstrate today.

test("gitlab: exposes capabilities and subscriptions in the curated summary", () => {
  const card = getServerCard("gitlab");
  assert.ok(card, "gitlab should have a committed card");

  assert.ok(card.capabilities, "gitlab: capabilities is missing");
  assert.equal(
    card.capabilities.resources.subscribe,
    true,
    "gitlab declares capabilities.resources.subscribe",
  );

  assert.ok(card.subscriptions, "gitlab: subscriptions is missing");
  const listen = card.subscriptions.methods["subscriptions/listen"];
  assert.ok(listen, "the subscriptions/listen method is missing");
  assert.equal(
    listen.available,
    true,
    "subscriptions/listen: available in this deployment",
  );
  assert.equal(
    listen.since_protocol,
    "2026-07-28",
    "subscriptions/listen.since_protocol",
  );

  const subscribe = card.subscriptions.methods["resources/subscribe"];
  assert.ok(subscribe, "the resources/subscribe method is missing");
  assert.equal(
    subscribe.available,
    false,
    "resources/subscribe: unavailable (stateless)",
  );
  assert.equal(
    typeof subscribe.requires,
    "string",
    "resources/subscribe.requires: string",
  );
  assert.ok(
    subscribe.requires.length > 0,
    "resources/subscribe.requires: not empty",
  );

  // No pinned counts: the build re-syncs the snapshot and every upstream
  // release would move them without the card ceasing to be coherent. Internal
  // coherence is what the next test's deepEqual proves.
  assert.ok(
    card.subscriptions.subscribable_uri_templates.length > 0,
    "the card declares at least one subscribable URI template",
  );
});

test("gitlab: the subscribable _meta flag propagates curated and matches the declared list", () => {
  const card = getServerCard("gitlab");
  assert.ok(card?.subscriptions, "gitlab should have a card and subscriptions");

  assert.ok(
    card.resourceTemplates.length > 0,
    "gitlab publishes resource templates",
  );
  const flagged = card.resourceTemplates.filter((tmpl) => tmpl.subscribable);
  assert.equal(
    flagged.length,
    card.subscriptions.subscribable_uri_templates.length,
    "the count of marked templates must equal the declared list",
  );

  // An anti-drift guard between the two sources within the SAME card: the set
  // of templates marked by `_meta` must be EXACTLY the one
  // `subscriptions.subscribable_uri_templates` declares. If a server release
  // updates one list and not the other, this deepEqual says so by name.
  const fromMeta = flagged
    .map((tmpl) => tmpl.uriTemplate)
    .sort((a, b) => a.localeCompare(b));
  const declared = [...card.subscriptions.subscribable_uri_templates].sort(
    (a, b) => a.localeCompare(b),
  );
  assert.deepEqual(
    fromMeta,
    declared,
    "the card's two sources have drifted apart",
  );

  // The raw `_meta` must not leave the data layer — a mirror of the
  // `annotations.title` assertion in libgen's test.
  for (const tmpl of card.resourceTemplates) {
    assert.equal(
      "_meta" in tmpl,
      false,
      `${tmpl.uriTemplate}: raw _meta in the summary`,
    );
  }
});

test("libgen: capabilities with no subscriptions, and zero templates", () => {
  const card = getServerCard("libgen");
  assert.ok(card, "libgen should have a committed card");
  assert.equal(
    card.capabilities?.tools?.listChanged,
    true,
    "capabilities.tools.listChanged",
  );
  assert.equal(
    card.subscriptions,
    undefined,
    "libgen publishes no subscriptions",
  );
  assert.deepEqual(
    card.resourceTemplates,
    [],
    "libgen publishes no resource templates",
  );
});

test("validateServerCardDocument: a capabilities that is not an object fails loudly", () => {
  assert.throws(
    () =>
      validateServerCardDocument("broken", {
        serverInfo: { name: "broken-mcp", version: "1.0.0" },
        authentication: { required: false, schemes: [] },
        capabilities: "tools",
      }),
    /capabilities is present but not an object/,
  );
  // An array also gives `typeof === "object"`: it must not slip through.
  assert.throws(
    () =>
      validateServerCardDocument("broken", {
        serverInfo: { name: "broken-mcp", version: "1.0.0" },
        authentication: { required: false, schemes: [] },
        capabilities: [],
      }),
    /capabilities is present but not an object/,
  );
});

test("validateServerCardDocument: subscriptions with no methods / a non-boolean available / no subscribable_uri_templates fails loudly", () => {
  const base = {
    serverInfo: { name: "broken-mcp", version: "1.0.0" },
    authentication: { required: false, schemes: [] },
  };

  assert.throws(
    () => validateServerCardDocument("broken", { ...base, subscriptions: {} }),
    /subscriptions\.methods is missing or not an object/,
  );

  assert.throws(
    () =>
      validateServerCardDocument("broken", {
        ...base,
        subscriptions: {
          methods: { "resources/subscribe": { available: "yes" } },
          subscribable_uri_templates: [],
        },
      }),
    /subscriptions\.methods\["resources\/subscribe"\]\.available is missing or not a boolean/,
  );

  assert.throws(
    () =>
      validateServerCardDocument("broken", {
        ...base,
        subscriptions: {
          methods: { "subscriptions/listen": { available: true } },
        },
      }),
    /subscriptions\.subscribable_uri_templates is missing or not an array/,
  );
});

test("summarizeServerCardDocument: only _meta === true marks something subscribable", () => {
  const doc = validateServerCardDocument("meta", {
    serverInfo: { name: "meta-mcp", version: "1.0.0" },
    authentication: { required: false, schemes: [] },
    resourceTemplates: [
      {
        uriTemplate: "x://a/{id}",
        name: "a",
        title: "A",
        description: "with the boolean flag",
        _meta: { [SUBSCRIBABLE_META_KEY]: true },
      },
      {
        uriTemplate: "x://b/{id}",
        name: "b",
        title: "B",
        description: "with the flag as a string",
        _meta: { [SUBSCRIBABLE_META_KEY]: "true" },
      },
      {
        uriTemplate: "x://c/{id}",
        name: "c",
        title: "C",
        description: "with no _meta",
      },
    ],
  });

  const card = summarizeServerCardDocument("meta", doc);
  assert.deepEqual(
    card.resourceTemplates.map((tmpl) => tmpl.subscribable),
    // The `=== true` is strict on purpose: a "true" string does not count.
    [true, false, false],
    "only the server's explicit boolean marks a template as subscribable",
  );
});
