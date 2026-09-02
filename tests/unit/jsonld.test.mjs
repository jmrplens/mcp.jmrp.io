/**
 * The JSON-LD graph has to reach the deployed HTML.
 *
 * These tests look at `dist/` and not at the source, because between
 * `Base.astro`'s frontmatter and the file nginx serves there are two steps that
 * can eat the block with nobody noticing: Astro's bundling (if the `is:inline`
 * is ever lost, the script leaves the HTML and ends up in a JS module) and the
 * post-build's minifier (`minifyJS: true`, which must NOT touch an `ld+json`
 * data block). A JSON-LD that is absent, or that has stopped parsing, is
 * invisible: it breaks nothing on screen and nobody sees it fail.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { test } from "node:test";

import { serverCards } from "../../src/data/server-cards.ts";
import { servers } from "../../src/data/servers.ts";
import {
  actionsDomainPageUrl,
  PAGE_PATHS,
  pageUrl,
  serverPageUrl,
} from "../../src/lib/seo.ts";

// The build only creates a detail page for a server with a committed card
// (`servers.filter((server) => serverCards[server.id])` in `src/lib/llms.ts`
// — a server can be listed in `servers.ts` before its snapshot lands). Every
// loop below that reads a `servers/<id>/index.html` file has to walk THIS
// set, not `servers` itself, or a card-less server makes `graphOf()` fail on
// a missing file instead of reporting an actual graph problem.
const cardServers = servers.filter((server) => serverCards[server.id]);

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
const PERSON_ID = "https://jmrp.io/#person";

/**
 * Path (relative to `dist/`) of a server's WebAPI `@id`. Both the id and the
 * `@id` string it returns are derived straight from `servers.ts`, so they can
 * never drift from what `jsonld.ts`'s `apiId()`/`sourceId()` compute.
 */
function apiIdOf(server) {
  return `${server.endpoint}#api`;
}

function sourceIdOf(server) {
  return `${server.repo}#source-code`;
}

/**
 * Server DETAIL pages (`/servers/<id>/`, either language).
 *
 * These are the ONLY pages whose graph declares a full `WebAPI`/
 * `SoftwareApplication` + `SoftwareSourceCode` node — the entity lives where
 * it is described (see `jsonld.ts`'s header comment and `PageMeta.serverId`).
 * Every other page — including the `/servers/` INDEX itself — only
 * REFERENCES those nodes by `@id` (`mainEntity`, the FAQ's `about`), never
 * redeclares them. This regex is used below to assert that split, not to
 * exclude these pages: they carry a complete, correct graph like any other
 * page's now.
 */
const SERVER_DETAIL_PAGE = /^(es\/)?servers\/[^/]+\/index\.html$/;

function htmlPages() {
  const pages = fs
    .readdirSync(DIST, { recursive: true })
    .map(String)
    // `404.html` is excluded on purpose: it is an error body, not an
    // address, so it emits no graph. Emitting one was worse than not —
    // everything derives from `lang`, so the 404 redefined
    // `https://mcp.jmrp.io/#webpage` with `name: "Page not found"`, exactly
    // the entity split the rest of the code avoids. Pinned by
    // `the 404 declares no identity`.
    .filter((f) => f.endsWith(".html") && f !== "404.html")
    // Same reasoning as the 404, one step further: a page marked `noindex`
    // emits no graph either. The OAuth callback is the case — it is a popup
    // that closes itself, and it borrows the inspector's chrome, so a graph
    // there would assert the inspector's `@id` from a second URL. That is the
    // entity split every comment in `jsonld.ts` exists to prevent, and it is
    // why the layout skips the block rather than inventing an identity for a
    // page that has none.
    .filter(
      (f) =>
        // Attribute ORDER cannot be assumed: the post-build minifier
        // alphabetises them, so the tag ships as
        // `<meta content="noindex, follow" name="robots">`. Matching on the
        // pair rather than on a fixed order is what keeps this from silently
        // matching nothing — which is exactly how it failed first.
        !/<meta[^>]*content="noindex[^>]*name="robots"/.test(
          fs.readFileSync(new URL(f, DIST), "utf8"),
        ),
    );
  assert.ok(pages.length > 1, "the site has at least the root and /es/");
  return pages;
}

/** The raw content of a page's `application/ld+json` blocks. */
function jsonLdBlocks(page) {
  const html = fs.readFileSync(new URL(page, DIST), "utf8");
  return [
    ...html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ].map((m) => m[1]);
}

/** A page's already-parsed graph, with a useful message when the JSON is broken. */
function graphOf(page) {
  const blocks = jsonLdBlocks(page);
  assert.equal(
    blocks.length,
    1,
    `${page}: exactly one application/ld+json block is expected, there are ${blocks.length}`,
  );
  let parsed;
  try {
    parsed = JSON.parse(blocks[0]);
  } catch (error) {
    assert.fail(`${page}: the JSON-LD is not valid JSON — ${error.message}`);
  }
  assert.equal(
    parsed["@context"],
    "https://schema.org",
    `${page}: no @context`,
  );
  assert.ok(Array.isArray(parsed["@graph"]), `${page}: @graph is not a list`);
  return parsed["@graph"];
}

/** `n["@type"]` normalized to an array, so one type and several compare alike. */
function typesOf(node) {
  return [node["@type"]].flat();
}

test("EVERY page carries a JSON-LD block that parses", () => {
  for (const page of htmlPages()) {
    const graph = graphOf(page);
    assert.ok(graph.length > 0, `${page}: the @graph is empty`);
  }
});

test("the WebAPI and its SoftwareSourceCode live ONLY on their server's page (en + es)", () => {
  // The whole point of this rewrite: before it, both nodes were redefined in
  // full on the home page AND on `/servers/`, and absent from the one page
  // that should carry them — the server's own detail page. Now exactly two
  // pages (en/es) define each pair, and every other page must not.
  for (const server of cardServers) {
    const apiId = apiIdOf(server);
    const sourceId = sourceIdOf(server);
    const apiPages = [];
    const sourcePages = [];
    for (const page of htmlPages()) {
      const graph = graphOf(page);
      if (
        graph.some((n) => n["@id"] === apiId && typesOf(n).includes("WebAPI"))
      ) {
        apiPages.push(page);
      }
      if (
        graph.some(
          (n) => n["@id"] === sourceId && n["@type"] === "SoftwareSourceCode",
        )
      ) {
        sourcePages.push(page);
      }
    }
    const byName = (a, b) => a.localeCompare(b);
    const expected = [
      `servers/${server.id}/index.html`,
      `es/servers/${server.id}/index.html`,
    ].sort(byName);
    assert.deepEqual(
      apiPages.sort(byName),
      expected,
      `${apiId}: should be declared only on its own page (en+es), it was declared on ${JSON.stringify(apiPages)}`,
    );
    assert.deepEqual(
      sourcePages.sort(byName),
      expected,
      `${sourceId}: should be declared only on its own page (en+es), it was declared on ${JSON.stringify(sourcePages)}`,
    );
  }
});

test("a server's WebAPI declares the SAME data in both its languages", () => {
  // The node's `@id` does not carry a language segment (it hangs off the
  // endpoint URL, which is the same for both `/servers/<id>/` and
  // `/es/servers/<id>/`), so the two pages describing it must agree on every
  // field — this is the data-drift risk "reference, don't redefine" exists
  // to close off.
  for (const server of cardServers) {
    const enApi = graphOf(`servers/${server.id}/index.html`).find(
      (n) => n["@id"] === apiIdOf(server),
    );
    const esApi = graphOf(`es/servers/${server.id}/index.html`).find(
      (n) => n["@id"] === apiIdOf(server),
    );
    assert.deepEqual(
      enApi,
      esApi,
      `${apiIdOf(server)}: the data should be identical between /servers/${server.id}/ and /es/servers/${server.id}/`,
    );
  }
});

test("every endpoint is joined to the repository that produces it, inside its own server's page", () => {
  // The code node ties an endpoint to the repository that produces it — the
  // evidence behind "can I trust this?". Its @id is #source-code, NEVER
  // #software: that IRI is defined by jmrp.io/projects with different data,
  // and redefining it here made the merged entity contradict itself (a
  // regression that did ship).
  for (const page of htmlPages()) {
    const graph = graphOf(page);
    const sources = graph.filter((n) => n["@type"] === "SoftwareSourceCode");
    const apis = graph.filter((n) => typesOf(n).includes("WebAPI"));
    const ids = new Set(graph.map((n) => n["@id"]));

    if (SERVER_DETAIL_PAGE.test(page)) {
      assert.equal(
        sources.length,
        1,
        `${page}: the page should carry its own SoftwareSourceCode`,
      );
      assert.equal(
        apis.length,
        1,
        `${page}: the page should carry its own WebAPI`,
      );
    } else {
      assert.equal(
        sources.length,
        0,
        `${page}: it should redefine no SoftwareSourceCode — only the server's own page does`,
      );
      assert.equal(
        apis.length,
        0,
        `${page}: it should redefine no WebAPI — only the server's own page does`,
      );
    }

    for (const source of sources) {
      assert.ok(
        String(source["@id"]).endsWith("#source-code"),
        `${page}: ${source["@id"]} overwrites jmrp.io/projects' canonical @id`,
      );
      // targetProduct is an array: the LOCAL endpoint (which must resolve
      // within this same page, because WebAPI and SoftwareSourceCode live
      // together on the detail page) and jmrp.io's canonical #software (an
      // external reference, which is exactly how linked data is supposed to
      // work — point at it without redefining it).
      const raw = source.targetProduct ?? [];
      const targets = Array.isArray(raw) ? raw : [raw];
      assert.ok(
        targets.some((t) => ids.has(t["@id"])),
        `${page}: ${source["@id"]} points at no endpoint on this page`,
      );
    }
    // And the way back: from the endpoint the code is reachable without an
    // inverse of targetProduct, via isBasedOn.
    for (const api of apis) {
      assert.ok(
        ids.has(api.isBasedOn?.["@id"]),
        `${page}: ${api["@id"]} does not link its source code (isBasedOn)`,
      );
      assert.ok(
        Array.isArray(api.featureList) && api.featureList.length > 0,
        `${page}: ${api["@id"]} has no featureList — an agent cannot tell what it does`,
      );
    }
  }
});

test("the graph declares the site and the page at every URL, with a WebAPI ONLY on its server's page", () => {
  // `servers.json` comes from the SAME source (`src/data/servers.ts`), so
  // adding an MCP and forgetting to give it a page leaves this test red.
  const index = JSON.parse(
    fs.readFileSync(new URL("servers.json", DIST), "utf8"),
  );
  const endpoints = Object.values(index.endpoints);
  assert.ok(endpoints.length > 0, "servers.json sin endpoints");

  for (const page of htmlPages()) {
    const graph = graphOf(page);
    // `@type` can be an array: the endpoint nodes are both `WebAPI` and
    // `SoftwareApplication`, so they inherit CreativeWork properties such as
    // `license` or `dateModified` that `WebAPI` does not allow.
    const byType = (type) => graph.filter((n) => typesOf(n).includes(type));

    assert.equal(
      byType("WebSite").length,
      1,
      `${page}: the WebSite node is missing`,
    );
    assert.equal(
      byType("WebPage").length,
      1,
      `${page}: the WebPage node is missing`,
    );

    const apis = byType("WebAPI");
    if (SERVER_DETAIL_PAGE.test(page)) {
      assert.equal(
        apis.length,
        1,
        `${page}: the page should declare exactly one WebAPI`,
      );
      assert.ok(
        endpoints.includes(apis[0].url),
        `${page}: the WebAPI (${apis[0].url}) matches no endpoint in servers.json`,
      );
    } else {
      assert.equal(
        apis.length,
        0,
        `${page}: it should declare no complete WebAPI — only reference it by @id`,
      );
    }
    for (const api of apis) {
      assert.equal(
        api["@id"],
        `${api.url}#api`,
        `${page}: the WebAPI's @id derived from the endpoint`,
      );
      assert.ok(
        api.documentation,
        `${page}: WebAPI ${api.url} sin documentation`,
      );
    }
  }
});

test("the #person node is jmrp.io's canonical one and carries no @context of its own", () => {
  for (const page of htmlPages()) {
    const graph = graphOf(page);
    const person = graph.find((n) => n["@id"] === PERSON_ID);
    assert.ok(person, `${page}: the #person node is missing`);
    assert.equal(
      person["@type"],
      "Person",
      `${page}: #person with a different @type`,
    );
    assert.ok(person.name, `${page}: #person with no name`);
    for (const node of graph) {
      assert.ok(
        !("@context" in node),
        `${page}: a node in the @graph carries its own @context`,
      );
    }
  }
});

test("the site's own nodes link to the person by @id without redeclaring them, and every reference resolves within the site", () => {
  // Global id set: every @id declared by ANY page's graph. A reference is
  // valid linked data as soon as it resolves HERE, even when the node that
  // defines it lives on a DIFFERENT page than the one making the reference —
  // that is precisely the "reference, don't redefine" pattern this file
  // enforces for WebAPI now (jsonld.ts already used it for #software and for
  // workTranslation/translationOfWork). An orphaned @id — one nothing in the
  // whole site ever declares — is the one thing that must never happen.
  const pages = htmlPages();
  const graphs = new Map(pages.map((page) => [page, graphOf(page)]));
  const globalIds = new Set(
    [...graphs.values()].flatMap((graph) => graph.map((n) => n["@id"])),
  );

  for (const page of pages) {
    const graph = graphs.get(page);
    // `@type` is sometimes an array — the endpoints are
    // `["WebAPI", "SoftwareApplication"]` — so comparing it as a string
    // silently matched nothing and left the WebAPI nodes untested.
    const own = graph.filter((n) =>
      typesOf(n).some((t) =>
        ["WebSite", "WebPage", "WebAPI", "FAQPage"].includes(t),
      ),
    );

    for (const node of own) {
      for (const refId of collectRefs(node)) {
        // An EXTERNAL vocabulary anchor is not a node of this site and cannot
        // be declared here: linking the entity by its IRI is precisely what is
        // right in linked data — redeclaring locally what Wikidata already
        // defines is the opposite mistake, the same one this file chases with
        // #person. The rule above was born when EVERY reference was internal
        // (#person, #software, workTranslation); the WebAPIs' `about` brought
        // the first one that is not.
        //
        // The filter is a Wikidata concept IRI and not "any absolute URL" on
        // purpose: under the loose rule, a mistyped internal @id
        // (`…/gitlab#ap`) would also count as "external" and slip past, and
        // that orphan is exactly what this test exists to catch. As a bonus it
        // pins the scheme down: `https://www.wikidata.org/entity/Q…` does NOT
        // match here and fails as an orphan, which is exactly what has to be
        // noticed the day `eslint --fix` splits the entity in two again.
        if (isExternalEntity(refId)) continue;

        assert.ok(
          globalIds.has(refId),
          `${page}: ${node["@id"]} references ${refId}, which exists in no graph of the site`,
        );
      }
    }

    const website = own.find((n) => n["@type"] === "WebSite");
    assert.equal(website.publisher["@id"], PERSON_ID);
    const apis = own.filter((n) => typesOf(n).includes("WebAPI"));
    for (const api of apis) {
      assert.equal(api.provider["@id"], PERSON_ID);
      // Redeclaring the person's data in every node is exactly what this
      // design avoids: the identity document is the single source of truth.
      assert.deepEqual(Object.keys(api.provider), ["@id"]);
    }
  }
});

/**
 * Is `id` an entity from an external vocabulary rather than a node of this
 * site?
 *
 * Wikidata only, and only with the `http://` scheme, which is the canonical
 * concept IRI already used by `knowsAbout` on jmrp.io and by every WebAPI's
 * `about`. See the use above for why the list is closed.
 *
 * The match is EXACT — anchored, and with the complete numeric Q-id — because
 * this predicate does not describe: it DECIDES which references are skipped
 * without being validated. With a loose prefix, a `…/entity/Q133436854junk`
 * still looked like Wikidata, left the loop before the assertion, and a broken
 * JSON-LD passed the test in silence: a guard that guards nothing.
 *
 * @param {string} id The referenced `@id`.
 * @returns {boolean} `true` when it lives outside the site's graph.
 */
const isExternalEntity = (id) =>
  // The `http://` is DELIBERATE, for the same reason as in
  // `src/lib/jsonld.ts`: it is Wikidata's CONCEPT IRI, which uses http:// by
  // definition. With https it would compare against a different RDF resource
  // and the test would stop recognizing the anchor the site emits. As a regex
  // literal neither `sonarjs/no-clear-text-protocols` nor `unicorn/prefer-https`
  // sees it, so the eslint-disable the string version carries is not needed
  // here — and adding it would be reported as an unused directive.
  /^http:\/\/www\.wikidata\.org\/entity\/Q\d+$/.test(id);

/** Every `{"@id": …}` hanging off a node, at any depth. */
function collectRefs(node) {
  const found = [];
  const walk = (value, isRoot) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, false);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (!isRoot && typeof value["@id"] === "string") found.push(value["@id"]);
    for (const [key, child] of Object.entries(value)) {
      if (key !== "@id") walk(child, false);
    }
  };
  walk(node, true);
  return found;
}

/**
 * Deduces `{ lang, page, serverId }` from a dist HTML path, using
 * `PAGE_PATHS` as the source of truth — the same map `pageUrl()` uses to
 * build canonicals. A server detail page (`servers/<id>/index.html`) does not
 * match any fixed `PAGE_PATHS` entry — `PAGE_PATHS.servers` is the INDEX's
 * own path — so it is detected separately and returns its `serverId`.
 *
 * @param {string} htmlPath Path relative to `dist/`, e.g. `"es/internals/index.html"`.
 * @returns {{ lang: "en" | "es", page: string, serverId?: string }}
 */
function pageInfoFor(htmlPath) {
  const isEs = htmlPath.startsWith("es/");
  const lang = isEs ? "es" : "en";
  const rest = isEs ? htmlPath.slice("es/".length) : htmlPath;
  const serverMatch = /^servers\/([^/]+)\/index\.html$/.exec(rest);
  if (serverMatch) {
    return { lang, page: "servers", serverId: serverMatch[1] };
  }
  // An action-domain page: it shares page "servers" with the detail page but
  // NOT its identity — neither serverId (it does not re-emit the WebAPI) nor
  // the fixed URL.
  const domainMatch = /^servers\/([^/]+)\/actions\/([^/]+)\/index\.html$/.exec(
    rest,
  );
  if (domainMatch) {
    return {
      lang,
      page: "servers",
      serverId: undefined,
      actionsDomain: { serverId: domainMatch[1], domain: domainMatch[2] },
    };
  }
  const page = Object.entries(PAGE_PATHS).find(
    ([, segment]) => `${segment}index.html` === rest,
  )?.[0];
  assert.ok(page, `${htmlPath}: matches no PageId in PAGE_PATHS`);
  return { lang, page, serverId: undefined };
}

test("every WebPage carries ITS OWN url and @id, not the home page's nor the server index's", () => {
  // This is the concrete defect from the 2026-08-22 audit: buildSiteGraph()
  // was never told which page was being rendered, so every page that was not
  // the home page emitted the `url` and `@id` of "/" (or "/es/") while its
  // <head> already published the correct canonical. The name came out right
  // because it came from `title`; the URL did not, because it came from a bare
  // `pageUrl(lang)`. A server detail page runs the same risk against the
  // `/servers/` INDEX, because they share `page: "servers"`.
  for (const htmlPage of htmlPages()) {
    const { lang, page, serverId, actionsDomain } = pageInfoFor(htmlPage);
    const graph = graphOf(htmlPage);
    const webpage = graph.find((n) => n["@type"] === "WebPage");
    let expectedUrl = pageUrl(lang, page);
    if (serverId) expectedUrl = serverPageUrl(lang, serverId);
    if (actionsDomain)
      expectedUrl = actionsDomainPageUrl(
        lang,
        actionsDomain.serverId,
        actionsDomain.domain,
      );
    assert.equal(
      webpage.url,
      expectedUrl,
      `${htmlPage}: WebPage.url should be ${expectedUrl}`,
    );
    assert.equal(
      webpage["@id"],
      `${expectedUrl}#webpage`,
      `${htmlPage}: WebPage.@id should hang off ITS OWN url, not the home page's nor the index's`,
    );
  }
});

test("the social card carries the license metadata Search Console asks for", () => {
  // Search Console reported "Missing field license" and "Missing field
  // acquireLicensePage" for every page here: `primaryImageOfPage` was a bare
  // url/width/height. Google's image metadata feature also needs `contentUrl`
  // — a node carrying only `url` does not qualify at all, so the two license
  // fields would have stayed inert had they been added alone.
  const licensePages = [];
  for (const htmlPage of htmlPages()) {
    const { lang, page } = pageInfoFor(htmlPage);
    if (page === "license") licensePages.push({ htmlPage, lang });
    const webpage = graphOf(htmlPage).find((n) => n["@type"] === "WebPage");
    const image = webpage.primaryImageOfPage;
    assert.ok(image, `${htmlPage}: the WebPage declares no primaryImageOfPage`);
    assert.equal(
      image.contentUrl,
      image.url,
      `${htmlPage}: the card needs contentUrl; without it Google ignores license`,
    );
    for (const field of [
      "license",
      "acquireLicensePage",
      "creator",
      "creditText",
      "copyrightNotice",
    ]) {
      assert.ok(
        image[field],
        `${htmlPage}: primaryImageOfPage is missing ${field}`,
      );
    }
    // Google rejects the pair when both name the same address.
    assert.notEqual(
      image.license,
      image.acquireLicensePage,
      `${htmlPage}: license and acquireLicensePage have to be distinct URLs`,
    );
    assert.equal(
      image.acquireLicensePage,
      `${pageUrl(lang, "license")}#permission-h`,
      `${htmlPage}: acquireLicensePage should point at THIS language's /license/`,
    );
  }
  // The promise the field makes has to land somewhere: an anchor that no
  // longer renders is the silent way this regresses.
  assert.equal(licensePages.length, 2, "both /license/ pages should be built");
  for (const { htmlPage } of licensePages) {
    const html = fs.readFileSync(new URL(htmlPage, DIST), "utf8");
    assert.ok(
      html.includes('id="permission-h"'),
      `${htmlPage}: acquireLicensePage points at #permission-h, which is not on the page`,
    );
    assert.ok(
      html.includes('id="images-h"'),
      `${htmlPage}: the section that grants the card's license is missing`,
    );
  }
});

test("each page's dates are its own, not the repository's", (t) => {
  // Every page used to carry `dateModified` = HEAD's commit and
  // `datePublished` = the repository's FIRST commit. So the graph said the
  // whole site changed whenever any commit landed, and it said /license/ had
  // existed since 2026-08-06 — weeks before that page was written. Three
  // independent reviewers filed it in the same audit.
  //
  // A build from a DIRTY tree falls back to the site-wide dates on purpose (a
  // tree matching no commit has no per-page date to give), so this skips
  // rather than passes there: the assertion has to be able to fail on the
  // clean builds CI and production actually run.
  let dirty;
  try {
    dirty =
      execFileSync("/usr/bin/git", ["status", "--porcelain"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() !== "";
  } catch {
    dirty = true;
  }
  if (dirty) {
    t.skip("dirty tree: the graph falls back to site-wide dates by design");
    return;
  }

  const modified = new Set();
  const published = new Set();
  for (const htmlPage of htmlPages()) {
    const webpage = graphOf(htmlPage).find((n) => n["@type"] === "WebPage");
    assert.ok(
      webpage.dateModified,
      `${htmlPage}: the WebPage carries no dateModified`,
    );
    modified.add(webpage.dateModified);
    if (webpage.datePublished) published.add(webpage.datePublished);
  }
  // Two languages of a page share a date (same sources), so there are far
  // fewer dates than pages — but more than one.
  assert.ok(
    modified.size > 1,
    `all pages share one dateModified: the per-page resolver is not running`,
  );
  assert.ok(
    published.size > 1,
    `all pages share one datePublished: they cannot all have been published together`,
  );
});

test("each WebAPI states its terms and its limits, not just that it is free", () => {
  // `isAccessibleForFree` and `availability: InStock` together read as an
  // unconditional invitation, while /policies/ says the opposite in detail:
  // no SLA, and no commitment that either endpoint stays online — or
  // unchanged — from one day to the next. An agent deciding whether to build
  // on the endpoint reads the graph, not the FAQ.
  for (const server of cardServers) {
    const page = `servers/${server.id}/index.html`;
    const api = graphOf(page).find((n) =>
      String(n["@type"]).includes("WebAPI"),
    );
    assert.equal(
      api.termsOfService,
      "https://mcp.jmrp.io/policies/",
      `${page}: the WebAPI does not point at the terms`,
    );
    const props = Object.fromEntries(
      (api.additionalProperty ?? []).map((p) => [p.name, p.value]),
    );
    for (const name of [
      "transport",
      "authentication",
      "serviceLevelAgreement",
    ]) {
      assert.ok(props[name], `${page}: no ${name} declared`);
    }
    // Derived from the headers the server really requires, never restated.
    assert.equal(
      props.authentication === "None",
      server.requiredHeaders.length === 0,
      `${page}: the declared authentication disagrees with requiredHeaders`,
    );
  }
});

test("the FAQPage hangs ONLY off the home page", () => {
  // The notices belong to the cards, and the cards are on the home page. A
  // FAQPage on /policies/ or on a server detail page would describe questions
  // that page does not contain.
  const withFaq = [];
  for (const page of htmlPages()) {
    const graph = graphOf(page);
    if (graph.some((n) => n["@type"] === "FAQPage")) withFaq.push(page);
  }
  assert.deepEqual(
    withFaq.sort((a, b) => a.localeCompare(b)),
    ["es/index.html", "index.html"],
    "the FAQPage has to be on both home pages and on no other page",
  );
});

test("speakable hangs ONLY off the home page's WebPage", () => {
  // The same reasoning as the FAQPage: the DOM `id`s `speakable` points at are
  // put there by ServerCard, and ServerCard is only rendered on the home
  // page.
  for (const htmlPage of htmlPages()) {
    const { page } = pageInfoFor(htmlPage);
    const graph = graphOf(htmlPage);
    const webpage = graph.find((n) => n["@type"] === "WebPage");
    if (page === "home") {
      assert.ok(
        webpage.speakable,
        `${htmlPage}: the home page has no speakable`,
      );
    } else {
      assert.equal(
        webpage.speakable,
        undefined,
        `${htmlPage}: speakable outside the home page`,
      );
    }
  }
});

test("every page pairs with its own translation, not with the home page", () => {
  const graph = graphOf("internals/index.html");
  const webpage = graph.find((n) => n["@type"] === "WebPage");
  assert.equal(
    webpage.workTranslation["@id"],
    "https://mcp.jmrp.io/es/internals/#webpage",
  );
});

test("every server page pairs with ITS OWN translation, not with the index's", () => {
  for (const server of cardServers) {
    const graph = graphOf(`servers/${server.id}/index.html`);
    const webpage = graph.find((n) => n["@type"] === "WebPage");
    assert.equal(
      webpage.workTranslation["@id"],
      `https://mcp.jmrp.io/es/servers/${server.id}/#webpage`,
      `servers/${server.id}/: should pair with its own page under es/, not with /es/servers/`,
    );
  }
});

test("the 404 declares no identity and does not ask to be indexed", () => {
  const html = fs.readFileSync(new URL("404.html", DIST), "utf8");

  // No graph: emitting one would redefine the home page's @id under a
  // different name — two documents describing one entity with contradictory
  // data, the regression this repo already suffered with `#software`.
  assert.equal(
    html.includes("application/ld+json"),
    false,
    "the 404 emits JSON-LD: it would be redefining the home page's identity",
  );

  // No canonical: it pointed at `/`, i.e. it declared itself to BE the home
  // page.
  assert.equal(
    /<link[^>]+rel="canonical"/.test(html),
    false,
    "the 404 declares a canonical, and its own pointed at the home page",
  );

  // No hreflang and no Open Graph for the same reason: `og:url` is the
  // canonical, so a shared 404 link previewed as the home page.
  assert.equal(/hreflang=/.test(html), false, "the 404 emits hreflang");
  assert.equal(/property="og:url"/.test(html), false, "the 404 emits og:url");

  // And it must not ask to be indexed. The 404 status already prevents it,
  // but saying `index, follow` in an error body contradicts itself.
  assert.match(
    html,
    /<meta[^>]+content="noindex, follow"[^>]*>/,
    "the 404 does not ask for noindex",
  );
});
