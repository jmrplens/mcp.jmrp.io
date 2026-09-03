/**
 * The SEO/GEO files have to COME OUT of the build, and come out with content.
 *
 * They are checked against `dist/` and not against the code because the failure
 * that matters is not a syntax one: it is a file that stops being generated.
 * Nobody sees `robots.txt`, `llms.txt`, the social cards or the favicon when
 * opening the page — no screen turns red — so their disappearance is invisible
 * until a crawler stops finding them, and by then nobody connects one thing
 * with the other.
 *
 * The vhost serves by ALLOWLIST: a new file here also needs its `location`.
 * That is why {@link SERVED_AT_ROOT} is a hand-written list and not a
 * `readdirSync`: when someone adds one, this test goes red and forces them to
 * remember nginx.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { serverCards } from "../../src/data/server-cards.ts";
import { actionsDomainPaths } from "../../src/data/surface.ts";
import { policies } from "../../src/i18n/ui/policies.ts";
import {
  DEFAULT_LANG,
  LANGS,
  PAGE_PATHS,
  pageUrl,
  serverPageUrl,
} from "../../src/lib/seo.ts";

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
const ORIGIN = "https://mcp.jmrp.io";

/** The real vhost, outside the repo. It may not exist when the build runs on another machine. */
const VHOST = "/etc/nginx/sites-available/mcp.jmrp.io.conf";

/**
 * The files at the root of `dist/` that nginx serves, each with its `location`
 * in /etc/nginx/sites-enabled/mcp.jmrp.io.conf. The `security_headers*_mcp.conf`
 * snippets are NOT here: they are copied to /etc/nginx, not served.
 */
const SERVED_AT_ROOT = [
  // A branded error page. It is not served by its URL but through
  // `error_page 404 /404.html` in the vhost (with its `location = /404.html
  // internal;`) — and the vhost's own error_page directives go BEFORE the
  // shared include that carries the global ones, since in nginx the first
  // one wins.
  "404.html",
  // The IndexNow key. It is not a secret: the protocol requires publishing it
  // to prove control of the domain.
  "8b3b0f3c6a883bd7d274f2cf7645921a.txt",
  "apple-touch-icon.png",
  // The name iOS before 7 asks for BEFORE the one above. Same drawing: its
  // route re-exports the other's handler rather than copying it.
  "apple-touch-icon-precomposed.png",
  "favicon.svg",
  "humans.txt",
  "index.html",
  // The home page's twin. The ONLY one landing at the root: the rest live in
  // their page's directory (internals/index.md), outside this test.
  "index.md",
  "llms-full.txt",
  "llms.txt",
  // The path MCP clients guess. No server is mounted here — this deployment
  // hosts two — so it serves a JSON-RPC error carrying both endpoints, which
  // is what a client knows how to read. See src/pages/mcp.ts.
  "mcp",
  "og-en.png",
  "og-es.png",
  "robots.txt",
  "servers.json",
  "sitemap-0.xml",
  "sitemap-index.xml",
];

/** Snippets the deployment copies to /etc/nginx/snippets, not web content. */
const NGINX_SNIPPETS = new Set([
  "security_headers_mcp.conf",
  "security_headers_assets_mcp.conf",
]);

/** A stable order for comparing lists of file names. */
const byName = (a, b) => a.localeCompare(b);

/**
 * Reads a file from `dist/`, failing with a message that says what is missing.
 *
 * @param name The path relative to `dist/`.
 * @param encoding The encoding; `null` for raw bytes.
 * @returns The file's content.
 */
function read(name, encoding = "utf8") {
  const url = new URL(name, DIST);
  assert.ok(
    fs.existsSync(url),
    `dist/${name} is missing — the build did not emit it`,
  );
  return fs.readFileSync(url, encoding);
}

test("the root of dist/ is exactly the vhost's allowlist", () => {
  const found = fs
    .readdirSync(DIST, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    // nginx picks the pre-compressed files next to the original; they are not routes of their own.
    .filter((name) => !name.endsWith(".br") && !name.endsWith(".gz"))
    .filter((name) => !NGINX_SNIPPETS.has(name))
    .sort(byName);

  assert.deepEqual(
    found,
    [...SERVED_AT_ROOT].sort(byName),
    "a spare root-level file will 404 until its `location` is added to the " +
      "vhost; a missing one has stopped being generated",
  );
});

/**
 * The page directories the vhost has to serve, each with its `location`.
 * Hand-written and not derived from `dist/`, for the same reason as
 * SERVED_AT_ROOT: so that adding a page forces you to remember nginx.
 */
const SERVED_PAGES = [
  "index.html",
  "es/index.html",
  "inspector/index.html",
  "es/inspector/index.html",
  "internals/index.html",
  "es/internals/index.html",
  "policies/index.html",
  "es/policies/index.html",
  "license/index.html",
  "es/license/index.html",
  "servers/index.html",
  "es/servers/index.html",
  "servers/libgen/index.html",
  "es/servers/libgen/index.html",
  "servers/gitlab/index.html",
  "es/servers/gitlab/index.html",
];

/**
 * Every HTML page the build wrote, except the two that decline an identity.
 *
 * `SERVED_PAGES` lists the sixteen hand-maintained ones; this walks the build
 * instead, so the 56 action-domain pages are covered too and a page added
 * tomorrow is covered the day it ships. The 404 is an error body, and
 * /inspector/callback/ is the OAuth landing step: both are `noindex` and
 * neither has a twin, which is exactly why they are excluded here and by the
 * guard in `Base.astro`.
 */
function twinnedPages() {
  return fs
    .readdirSync(DIST, { recursive: true })
    .map(String)
    .filter(
      (f) =>
        f.endsWith("index.html") &&
        !f.includes("inspector/callback/") &&
        // The Spanish 404 is `es/404/index.html` because the build writes
        // directories; it is an error body like the root one, not a page.
        !f.includes("/404/"),
    );
}

test("every page announces its markdown twin, and the twin is really there", () => {
  // The twins were served correctly all along — right content type, and a
  // `Link:` header canonicalizing them back — but nothing on the HTML side
  // said they existed. jmrp.io shipped the same announcement as an opt-in
  // per-page prop first and 20 of its 96 twinned pages silently never passed
  // it, so this asserts the two halves that make the claim true: the tag is
  // present, and the file it points at was actually built.
  const pages = twinnedPages();
  // A guard on the guard: if the walk ever stops finding pages, the loop
  // below would pass by doing nothing.
  assert.ok(pages.length >= 70, `only ${pages.length} pages were walked`);
  for (const page of pages) {
    const html = read(page);
    // The minifier reorders attributes, so the tag is matched as a whole and
    // never on a fixed attribute order — the trap that makes a naive check
    // report a tag missing when it is right there.
    const tag = [...html.matchAll(/<link\b[^>]*>/g)]
      .map(([t]) => t)
      .find(
        (t) =>
          t.includes('rel="alternate"') && t.includes('type="text/markdown"'),
      );
    assert.ok(tag, `${page}: no <link rel="alternate" type="text/markdown">`);
    assert.equal(
      /href="([^"]+)"/.exec(tag)?.[1],
      `${ORIGIN}/${page.replace(/index\.html$/, "")}index.md`,
      `${page}: the twin link should point at THIS page's twin`,
    );
    // The file, not just the promise: a link to a twin the build never wrote
    // is a 404 advertised in every head.
    read(page.replace(/index\.html$/, "index.md"));
  }
});

test("a server's twin carries the configuration its page carries", () => {
  // The twins are the surface llms.txt points every assistant at, and the
  // server ones used to drop the whole "Connect it to your client" block:
  // 828 words against the page's 5244, with the endpoint, the OAuth client id
  // and all six client snippets living only in the HTML. "How do I connect
  // this to Claude Code" is the question this site answers, so the answer
  // being absent from the machine-readable copy was the expensive kind of
  // omission — silent, and exactly where it would be looked for.
  //
  // Asserted on the built twin so it covers the renderer and the data
  // together, in both languages.
  for (const dir of ["", "es/"]) {
    for (const server of ["libgen", "gitlab"]) {
      const name = `${dir}servers/${server}/index.md`;
      const md = read(name);
      // The server name and `--transport http` swap places between the OAuth
      // form and the token one, so the name is matched anywhere on the line
      // rather than pinned to a position.
      assert.ok(
        new RegExp(String.raw`claude mcp add[^\n]*\b${server}\b`).test(md),
        `${name}: no Claude Code command — the twin dropped the connect block`,
      );
      // Inside a fence, not merely mentioned in prose: what makes it useful
      // is that it can be copied out whole.
      const fenced = [...md.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map(
        (m) => m[1],
      );
      assert.ok(
        fenced.some((block) => block.includes(`https://mcp.jmrp.io/${server}`)),
        `${name}: the endpoint appears in no fenced block`,
      );
    }
  }
  // gitlab is the one with an OAuth path, and the client id is the part a
  // client cannot guess: without it these clients fall back to dynamic
  // registration, which gitlab.com answers with an unusable scope.
  for (const dir of ["", "es/"]) {
    const name = `${dir}servers/gitlab/index.md`;
    assert.ok(
      /--client-id [0-9a-f]{64}/.test(read(name)),
      `${name}: the OAuth client id is missing from the twin`,
    );
  }
});

test("no markdown twin is an orphan", () => {
  // The closure check jmrp.io runs at build time, in the direction the other
  // tests do not cover. They walk pages and ask whether the twin exists; this
  // walks twins and asks whether a page announces them. A twin nothing points
  // at is served, indexed by nobody and quietly out of date — and since the
  // announcement is now derived from the twin ROUTES rather than guessed from
  // the page, the two sets should be exactly equal.
  // Read the announcements out of the built HTML rather than from `pages()`,
  // which deliberately omits the action-domain pages — and those are 56 of
  // the 72 twins.
  const all = fs.readdirSync(DIST, { recursive: true }).map(String);
  const announced = new Set();
  for (const file of all) {
    if (!file.endsWith(".html")) continue;
    const href = /<link[^>]*type="text\/markdown"[^>]*>/.exec(read(file));
    if (!href) continue;
    const url = /href="([^"]+)"/.exec(href[0])?.[1];
    if (url) announced.add(new URL(url).pathname.slice(1));
  }
  const built = all.filter((file) => file.endsWith("index.md"));

  for (const twin of built) {
    assert.ok(
      announced.has(twin),
      `${twin}: built, but no page announces it — an orphan twin`,
    );
  }
  assert.equal(
    built.length,
    72,
    `expected 72 twins, found ${built.length} — a page gained or lost one`,
  );
});

test("the pages with no twin do not claim one", () => {
  // The 404 and the OAuth landing step have no `index.md`, so a tag on them
  // would advertise a URL that 404s. They are also the only two pages that
  // decline an identity, which is what the guard in `Base.astro` keys on.
  for (const page of [
    "404.html",
    "es/404/index.html",
    "inspector/callback/index.html",
  ]) {
    assert.ok(
      !read(page).includes('type="text/markdown"'),
      `${page}: announces a markdown twin it does not have`,
    );
  }
});

test("the legal resolution order is three labelled cases, not one long sentence", () => {
  // The passage used to be a single 115-word sentence chaining the DOI, ISBN
  // and catalogue-hash cases together — the least readable text on the site,
  // on the page that most needs to be clear. The facts did not change; the
  // shape did, and both the page and its markdown twin have to show it.
  //
  // The labels come from the i18n module rather than being written out here:
  // this file is code, so it stays in English, and a copy of the strings
  // would drift from the ones the page actually renders.
  for (const lang of ["en", "es"]) {
    const dir = lang === "en" ? "" : "es/";
    const html = read(`${dir}policies/index.html`);
    const md = read(`${dir}policies/index.md`);
    const cases = policies[lang].legalResolution;
    assert.equal(cases.length, 3, `${lang}: expected three cases`);
    for (const entry of cases) {
      assert.ok(
        html.includes(entry.label),
        `${dir}policies/: the case "${entry.label}" is missing`,
      );
      assert.ok(
        md.includes(entry.label),
        `${dir}policies/index.md: the case "${entry.label}" is missing`,
      );
      for (const step of entry.steps) {
        assert.ok(
          md.includes(step),
          `${dir}policies/index.md: a step of "${entry.label}" is missing`,
        );
      }
    }
    assert.ok(
      html.includes('class="legal-order"'),
      `${dir}policies/: the resolution block is not rendered as a list`,
    );
  }
  // The sentence that made this the worst-reading passage on the site.
  assert.ok(
    !read("policies/index.html").includes(
      "is looked for at OAPEN and the Internet Archive only",
    ),
    "the 115-word sentence is still there",
  );
});

test("every generated page has its location in the vhost", (t) => {
  // Sibling of SERVED_AT_ROOT: that test only looks at the ROOT of dist/ (it
  // filters on entry.isFile()), so it does not see new pages, which live in
  // subdirectories (inspector/index.html) — a page with no `location` would
  // 404 in production without anything going red.
  if (!fs.existsSync(VHOST)) {
    t.skip("the vhost is not readable on this machine");
    return;
  }
  const vhost = fs.readFileSync(VHOST, "utf8");
  for (const page of SERVED_PAGES) {
    read(page); // fails with a useful message when the build did not emit it
    const url = "/" + page.replace(/index\.html$/, "");
    assert.ok(
      vhost.includes(`location = ${url} `) ||
        vhost.includes(`location = ${url}\n`),
      `${url} has no 'location' in the vhost: it will 404 in production`,
    );
  }
});

test("every markdown twin has its location and its canonical", (t) => {
  // Third sibling of the two guards above, and the one most needed: a twin
  // lives at `<page>/index.md`, so it is neither a root file (SERVED_AT_ROOT
  // cannot see it) nor an entry in SERVED_PAGES, which lists index.html.
  // Without this, adding a page with a twin and forgetting its `location`
  // publishes a 404 on the very path an agent DERIVES by itself, which is the
  // case twins exist to cover.
  //
  // It walks what the build emitted rather than a hand-kept list: here a fixed
  // list would be the bug, because the build already knows which ones exist.
  if (!fs.existsSync(VHOST)) {
    t.skip("the vhost is not readable on this machine");
    return;
  }
  // The vhost PLUS the snippets the build generates into their own
  // directory. The sixty exact locations used to be written here by hand;
  // they are emitted by `post-build/nginx-snippets.ts` now and delivered by
  // the deploy, so reading only the vhost would assert against half the
  // configuration and pass on an empty include.
  const generatedDir = "/etc/nginx/snippets/mcp";
  const generated = fs.existsSync(generatedDir)
    ? fs
        .readdirSync(generatedDir)
        .filter((name) => name.endsWith(".conf"))
        .map((name) => fs.readFileSync(`${generatedDir}/${name}`, "utf8"))
        .join("\n")
    : "";
  const vhost = `${fs.readFileSync(VHOST, "utf8")}\n${generated}`;
  const twins = [];
  // `DIST` is a file:// URL: readdirSync accepts it, but a subpath cannot be
  // derived by concatenation, so it is converted to a real path once.
  const root = fileURLToPath(DIST);
  const walk = (dir, prefix = "") => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory())
        walk(`${dir}/${entry.name}`, `${prefix}/${entry.name}`);
      else if (entry.name === "index.md") twins.push(`${prefix}/index.md`);
    }
  };
  walk(root);

  assert.ok(twins.length > 0, "the build emitted no markdown twin at all");
  // Two valid ways of being served. The exact `location =` is now the normal
  // one for every twin, including the domain pages: an exact match outranks
  // any prefix, so the generated file covers them and the nested
  // `location ~ \.md$` those prefixes used to need is gone. The prefix branch
  // stays because it is still a correct way to serve a twin, and a future
  // subtree may use it again.
  // Named, not positional: `[, , block]` skips two slots in a row, which is
  // unreadable and the linter rightly refuses — nobody reading it can tell
  // which group is being dropped.
  const prefixes = [
    ...vhost.matchAll(
      /location \^~ (?<prefix>\S+) \{(?<block>[\s\S]*?)\n {4}\}/g,
    ),
  ]
    .filter((match) => match.groups.block.includes(String.raw`\.md$`))
    .map((match) => match.groups.prefix);
  for (const twin of twins) {
    const exact = vhost.includes(`location = ${twin} `);
    const covered = prefixes.some((prefix) => twin.startsWith(prefix));
    assert.ok(
      exact || covered,
      `${twin} is not served: neither 'location = ${twin}' nor a '^~' prefix that handles .md`,
    );
  }
  // And that the canonical's map exists: without it the twins are served
  // orphaned, saying nothing about which page they belong to.
  // The variable is domain-prefixed on purpose: nginx maps are GLOBAL to the
  // http context, and an unprefixed `$md_link_header` here collided with the
  // identically named one in jmrp.io's vhost — every .md twin of that domain
  // briefly advertised a canonical pointing at mcp.jmrp.io, with `nginx -t`
  // green throughout, because the collision is silent. Asserting the prefixed
  // name is what stops that from coming back unnoticed.
  assert.match(
    vhost,
    /map \$uri \$mcp_md_link_header/,
    "the map that sets Link rel=canonical on the twins is missing or unprefixed",
  );
});

test("every .well-known file has its location in the vhost", (t) => {
  // Fourth sibling of the guards above, and the one with the longest history
  // of biting silently: these files are dropped into `public/.well-known/` by
  // hand, so nobody adding one is thinking about nginx. `glama.json` sat there
  // answering 404 to 133 requests before a log analysis found it, and
  // `owners.json` was found the same way: by reading 404s, not by a test.
  //
  // It walks what the build emitted rather than a hand-kept list: the
  // directory is copied verbatim from `public/`, so the build already knows
  // the full set and a fixed list here would only be a second thing to forget.
  if (!fs.existsSync(VHOST)) {
    t.skip("the vhost is not readable on this machine");
    return;
  }
  const vhost = fs.readFileSync(VHOST, "utf8");
  const dir = `${fileURLToPath(DIST)}.well-known`;
  const files = fs
    .readdirSync(dir)
    // Pre-compressed twins are served by gzip_static/brotli_static off the
    // original's location, so they never get one of their own.
    .filter((name) => !name.endsWith(".gz") && !name.endsWith(".br"));

  assert.ok(
    files.length > 0,
    "the build emitted no file in .well-known at all",
  );
  for (const name of files) {
    const url = `/.well-known/${name}`;
    assert.ok(
      vhost.includes(`location = ${url} `) ||
        vhost.includes(`location = ${url}\n`),
      `${url} has no 'location' in the vhost: it will 404 in production`,
    );
  }
});

test("robots.txt lets everyone through and announces the sitemap", () => {
  const robots = read("robots.txt");
  assert.match(robots, /^User-agent: \*$/m, "no wildcard block");
  assert.match(
    robots,
    new RegExp(String.raw`^Sitemap: ${ORIGIN}/sitemap-index\.xml$`, "m"),
    "without the Sitemap line the sitemap is only found by hand",
  );
  assert.match(
    robots,
    /^Content-Signal: search=yes, ai-input=yes, ai-train=yes$/m,
    "the AI policy is explicit on purpose, the same as on jmrp.io",
  );
  assert.doesNotMatch(
    robots,
    /^Disallow: \/\s*$/m,
    "a `Disallow: /` here would take the entire site out of the index",
  );
  for (const bot of ["Googlebot", "GPTBot", "ClaudeBot", "PerplexityBot"]) {
    assert.match(robots, new RegExp(`^User-agent: ${bot}$`, "m"), `no ${bot}`);
  }
});

test("llms.txt and llms-full.txt describe the real servers", () => {
  const index = JSON.parse(read("servers.json"));
  const endpoints = Object.values(index.endpoints);
  assert.ok(endpoints.length > 0, "servers.json sin endpoints");

  const short = read("llms.txt");
  const full = read("llms-full.txt");

  // They come from `src/data/servers.ts`, the same as servers.json:
  // registering an MCP and forgetting these files leaves the test red.
  for (const endpoint of endpoints) {
    assert.ok(
      short.includes(endpoint),
      `llms.txt does not mention ${endpoint}`,
    );
    assert.ok(
      full.includes(endpoint),
      `llms-full.txt does not mention ${endpoint}`,
    );
  }
  // llmstxt.org asks the H1 for the project or site NAME. It used to be the
  // bare hostname, which the blockquote then had to recover; the name now
  // carries what the site is. Still anchored to the host so the H1 cannot
  // drift away from the domain it describes.
  assert.match(
    short,
    /^# mcp\.jmrp\.io — .+$/m,
    "llms.txt without the standard's H1",
  );
  assert.ok(
    short.includes(`${ORIGIN}/llms-full.txt`),
    "the index has to link the long document",
  );
  assert.ok(
    full.includes("Authorization"),
    "the long entry has to say which header gitlab asks for",
  );
  assert.ok(full.length > short.length, "the long document is not longer");
});

test("llms.txt lists the sixteen pages in both languages", () => {
  const short = read("llms.txt");
  for (const path of [
    "/",
    "/es/",
    "/inspector/",
    "/es/inspector/",
    "/internals/",
    "/es/internals/",
    "/policies/",
    "/es/policies/",
    "/license/",
    "/es/license/",
    "/servers/",
    "/es/servers/",
    "/servers/libgen/",
    "/es/servers/libgen/",
    "/servers/gitlab/",
    "/es/servers/gitlab/",
  ]) {
    // The Markdown link form `](<url>)`, not a bare substring: every URL in
    // this file is a prefix of some other entry (`/` of everything, `/servers/`
    // of `/servers/libgen/`…), so a bare `includes` passes even when that
    // entry's own line is missing. `buildLlmsTxt` always emits this exact
    // `](url)` shape (`src/lib/llms.ts`).
    assert.ok(
      short.includes(`](https://mcp.jmrp.io${path})`),
      `llms.txt does not mention ${path}`,
    );
  }
});

test("the social cards are 1200x630 PNGs", () => {
  for (const lang of ["en", "es"]) {
    const png = read(`og-${lang}.png`, null);
    assert.deepEqual(
      [...png.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      `og-${lang}.png no es un PNG`,
    );
    // IHDR: width and height are the two 32-bit integers after the header.
    assert.equal(
      png.readUInt32BE(16),
      1200,
      `og-${lang}.png has a different width`,
    );
    assert.equal(
      png.readUInt32BE(20),
      630,
      `og-${lang}.png has a different height`,
    );
    // A flat-background card weighs a few KB: if the text was not rendered,
    // this catches it even when the generator's own check does not.
    assert.ok(png.length > 10_000, `og-${lang}.png is suspiciously empty`);
  }
});

test("the favicon exists and is an SVG", () => {
  const svg = read("favicon.svg");
  assert.match(svg, /<svg[\s>]/, "favicon.svg does not contain an <svg>");
});

test("the sitemap carries lastmod and the hreflang annotations", () => {
  const sitemap = read("sitemap-0.xml");
  for (const url of [`${ORIGIN}/`, `${ORIGIN}/es/`]) {
    assert.ok(
      sitemap.includes(`<loc>${url}</loc>`),
      `the sitemap does not list ${url}`,
    );
    assert.ok(
      sitemap.includes(`hreflang="en" href="${ORIGIN}/"`),
      "with no xhtml:link en, the cluster lives only in the <head>",
    );
    assert.ok(
      sitemap.includes(`hreflang="es" href="${ORIGIN}/es/"`),
      "with no xhtml:link es, the cluster lives only in the <head>",
    );
  }
  // Not a fixed literal: the site now has more than the two home pages
  // (`/inspector/` joined in this task, `/internals/` and `/policies/` are
  // coming), and each one gets its own <url> entry. The invariant that
  // matters is that NONE of them is missing a <lastmod>, not a specific count.
  const locs = [...sitemap.matchAll(/<loc>[^<]+<\/loc>/g)];
  const lastmods = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)];
  assert.equal(lastmods.length, locs.length, "every URL needs its lastmod");
  for (const [, value] of lastmods) {
    assert.ok(!Number.isNaN(Date.parse(value)), `unreadable lastmod: ${value}`);
  }
});

test("pages carry their OWN lastmod, not one shared date for the whole site", (t) => {
  // Every URL used to be stamped with `contentDate()`, the HEAD commit, so any
  // commit moved every date. That is untrue on its face, and it also disabled
  // the deploy's differential submission: `deploy-live-mcp.mjs` diffs these
  // values against a ledger to decide what to announce, and a date that always
  // moves selects all 73 URLs — which Bing then rejects whole, over quota.
  // See src/lib/sitemap-lastmod.ts.
  //
  // A build from a DIRTY tree deliberately falls back to the single date: a
  // tree matching no commit has no per-page git date to give. Skipping there
  // (rather than passing) keeps the assertion below meaningful — it must be
  // able to fail on the clean builds that CI and production actually run.
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
    t.skip("dirty tree: the sitemap falls back to one date by design");
    return;
  }

  const sitemap = read("sitemap-0.xml");
  const distinct = new Set(
    [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(([, v]) => v),
  );
  // The two languages of a page share a date (they are built from the same
  // sources), so there are far fewer dates than URLs — but more than one.
  assert.ok(
    distinct.size > 1,
    "every URL shares one lastmod: the per-page resolver in " +
      "src/lib/sitemap-lastmod.ts is not running",
  );
});

test("every sitemap entry declares ITS OWN x-default, not the home page's", () => {
  const sitemap = read("sitemap-0.xml");
  // The serializer used to emit a hardcoded x-default pointing at the home
  // page for EVERY entry, contradicting the <head> each page emits. Nothing
  // pinned that value, so it was reintroducible without a single red test.
  // `servers/`, `servers/libgen/` and `servers/gitlab/` joined this sweep
  // with the `/servers/` section: each must self-reference, not fall back
  // to the section index's x-default, let alone the site root's.
  for (const path of [
    "",
    "inspector/",
    "internals/",
    "policies/",
    "license/",
    "servers/",
    "servers/libgen/",
    "servers/gitlab/",
  ]) {
    const self = `${ORIGIN}/${path}`;
    assert.ok(
      sitemap.includes(`hreflang="x-default" href="${self}"`),
      `the sitemap does not declare x-default -> ${self}`,
    );
  }
});

/**
 * Content of every generated HTML page, indexed by route.
 *
 * Fixed pages are derived from `PAGE_PATHS` — the same map the site itself
 * builds URLs from — so a page added there is automatically covered here
 * too. Per-server detail pages (`/servers/<id>/`) are NOT one of
 * `PAGE_PATHS`'s fixed entries — see the comment on `PAGE_PATHS` in
 * `src/lib/seo.ts` for why a per-server route cannot be expressed there —
 * so they are appended separately, one per id in `serverCards` (the same
 * set `getStaticPaths` in `src/pages/servers/[server].astro` builds pages
 * for).
 *
 * Every entry carries its OWN expected canonical/hreflang URLs
 * pre-resolved (`url`, `enUrl`, `esUrl`, `xDefaultUrl`) rather than leaving
 * each downstream test to call `pageUrl(lang, page)` itself: that call is
 * only correct for `PAGE_PATHS`'s fixed entries — for a server detail page
 * it would silently resolve back to the `/servers/` INDEX URL instead of
 * that server's own page. `id` is `undefined` for fixed pages and the
 * server id for detail pages, so a test can tell the two apart without
 * comparing strings.
 *
 * NOT every page the build emits: the action-domain pages under
 * `/servers/<id>/actions/<domain>/` are not here, because most assertions
 * below are about the fixed pages' own shape. The two LENGTH assertions do
 * cover them, through `domainPages()` right after this.
 *
 * @returns One entry per page/language the build emits from `PAGE_PATHS` and
 *   from the committed server cards: `PAGE_PATHS.length × LANGS` plus one per
 *   card per language.
 */
function pages() {
  const found = [];
  for (const [page, dir] of Object.entries(PAGE_PATHS)) {
    for (const lang of LANGS) {
      const name = `${lang === "es" ? "es/" : ""}${dir}index.html`;
      found.push({
        name,
        html: read(name),
        lang,
        page,
        id: undefined,
        url: pageUrl(lang, page),
        enUrl: pageUrl("en", page),
        esUrl: pageUrl("es", page),
        xDefaultUrl: pageUrl(DEFAULT_LANG, page),
      });
    }
  }
  for (const id of Object.keys(serverCards)) {
    for (const lang of LANGS) {
      const name = `${lang === "es" ? "es/" : ""}servers/${id}/index.html`;
      found.push({
        name,
        html: read(name),
        lang,
        page: "servers",
        id,
        url: serverPageUrl(lang, id),
        enUrl: serverPageUrl("en", id),
        esUrl: serverPageUrl("es", id),
        xDefaultUrl: serverPageUrl(DEFAULT_LANG, id),
      });
    }
  }
  return found;
}

/** Every attribute of a tag, as an object. */
function attributesOf(raw) {
  return Object.fromEntries(
    [...raw.matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]),
  );
}

/**
 * A page's `<link>` tags, as attribute maps.
 *
 * They are read attribute by attribute rather than with a regex that pins their
 * order, because the post-build's minifier REORDERS them (`rel="icon" href=…`
 * comes out as `href=… rel="icon"`). A test tied to the order would go red the
 * day the minification changes, without anything having stopped working.
 *
 * @param html The already-minified HTML of a page in `dist/`.
 * @returns One object per `<link>`, with its attributes.
 */
function linkTags(html) {
  return [...html.matchAll(/<link\b([^>]*)>/g)].map((m) => attributesOf(m[1]));
}

/**
 * The `content` attribute of a `<meta>`, looked up by `property`/`name`.
 *
 * @param html The already-minified HTML of a page in `dist/`.
 * @param attribute `property` for Open Graph, `name` for Twitter.
 * @param key The tag's name, e.g. `og:image`.
 * @returns The `content`, or `undefined` when that tag is absent.
 */
function meta(html, attribute, key) {
  const tag = [...html.matchAll(/<meta\b([^>]*)>/g)]
    .map((m) => attributesOf(m[1]))
    .find((attributes) => attributes[attribute] === key);
  return tag?.content;
}

/**
 * Decodes the entities in an attribute value.
 *
 * The value comes out of the HTML already escaped — the post-build serializes
 * it again with cheerio after minifying — so an `&` travels as `&amp;` and
 * would count
 * five characters where a search engine counts one. No description carries
 * entities today; this is what keeps the count honest the day one does.
 *
 * @param value The raw attribute value, exactly as it sits in `dist/`.
 * @returns The text a search engine actually reads.
 */
function decodeEntities(value) {
  return (
    value
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      // `&amp;` LAST: before the others it would turn `&amp;lt;` into `<`.
      .replaceAll("&amp;", "&")
  );
}

/**
 * The description a search engine would read from an already-built page.
 *
 * It goes through {@link meta} rather than a regex of its own because the
 * minifier ALPHABETIZES the attributes (`sortAttributes` in
 * `src/integrations/post-build/html.ts`), so in `dist/` it comes out as
 * `<meta content="…" name="description">`. A pattern that assumes `name` before
 * `content` finds NONE of the fourteen pages, and measuring what was never
 * found comes out green over an entire site with no descriptions.
 *
 * @param html The already-minified HTML of a page in `dist/`.
 * @returns The decoded text, or `undefined` when the tag is absent.
 */
function descriptionOf(html) {
  const raw = meta(html, "name", "description");
  return raw === undefined ? undefined : decodeEntities(raw);
}

test("every page emits complete Open Graph and Twitter Card tags", () => {
  for (const { name, html, lang, url } of pages()) {
    assert.equal(meta(html, "property", "og:type"), "website", name);
    assert.equal(meta(html, "property", "og:url"), url, `${name}: og:url`);
    assert.equal(
      meta(html, "property", "og:image"),
      `${ORIGIN}/og-${lang}.png`,
      `${name}: og:image has to be ABSOLUTE or the clients will not resolve it`,
    );
    assert.equal(meta(html, "property", "og:image:width"), "1200", name);
    assert.equal(meta(html, "property", "og:image:height"), "630", name);
    assert.ok(meta(html, "property", "og:image:alt"), `${name}: no alt`);
    assert.equal(
      meta(html, "property", "og:locale"),
      lang === "en" ? "en_US" : "es_ES",
      `${name}: og:locale`,
    );
    for (const key of ["og:title", "og:description", "og:site_name"]) {
      assert.ok(meta(html, "property", key), `${name}: no ${key}`);
    }

    assert.equal(
      meta(html, "name", "twitter:card"),
      "summary_large_image",
      `${name}: without summary_large_image the card comes out as a thumbnail`,
    );
    for (const key of [
      "twitter:title",
      "twitter:description",
      "twitter:image",
    ]) {
      assert.ok(meta(html, "name", key), `${name}: no ${key}`);
    }
  }
});

test("every page self-references in hreflang", () => {
  for (const { name, html, lang, enUrl, esUrl, xDefaultUrl } of pages()) {
    const byLang = new Map(
      linkTags(html)
        .filter((link) => link.hreflang)
        .map((link) => [link.hreflang, link.href]),
    );

    // The self-reference is the one that was missing: without it Google
    // discards the ENTIRE cluster and the two versions compete with each other
    // instead of being grouped.
    assert.ok(
      byLang.has(lang),
      `${name}: it does not self-reference (hreflang="${lang}")`,
    );
    assert.equal(byLang.get("en"), enUrl, `${name}: hreflang en`);
    assert.equal(byLang.get("es"), esUrl, `${name}: hreflang es`);
    // x-default points at THIS page's English version, not the home page's
    // nor (for a server detail page) the `/servers/` index's — same rule
    // the "every sitemap entry declares ITS OWN x-default" test above checks
    // for the sitemap's own hreflang annotations.
    assert.equal(byLang.get("x-default"), xDefaultUrl, `${name}: x-default`);
    assert.equal(byLang.size, 3, `${name}: too many or too few annotations`);
  }
});

test("every page declares a favicon, a canonical and the JSON index", () => {
  for (const { name, html, url } of pages()) {
    const links = linkTags(html);
    const has = (predicate) => links.some((link) => predicate(link));

    assert.ok(
      has((l) => l.rel === "icon" && l.href === "/favicon.svg"),
      `${name}: with no favicon declared no icon shows up in the results`,
    );
    assert.ok(
      has((l) => l.rel === "canonical" && l.href === url),
      `${name}: canonical missing or pointing at another URL`,
    );
    assert.ok(
      has((l) => l.type === "application/json" && l.href === "/servers.json"),
      `${name}: the machine-readable index is not announced in the <head>`,
    );
  }
});

/**
 * What Google shows of a `<title>` before it truncates. It was a literal in
 * the fixed pages' assertion; the action-domain pages need the same number,
 * and two copies of a budget is how they end up different.
 */
const MAX_TITLE_LENGTH = 65;

test("the <title> leaves room for the phrase this is searched by", () => {
  for (const { name, html, page, id } of pages()) {
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
    assert.ok(title, `${name}: no <title>`);

    // Only the home page is written to rank for the broad "Model Context
    // Protocol" query — it is the only entry point someone searching that
    // exact phrase would land on. The inner pages target their own, narrower
    // intent instead (trying the servers, how routing works, the legal
    // position), and repeating the same phrase in every title would not help
    // any of them rank for anything. Compare `common.en.metaTitle` against
    // `inspector.en.inspectorMetaTitle` / `internals.en.metaTitle` /
    // `policies.en.policiesMetaTitle` in `src/i18n/ui/`: only the home page's
    // carries it, by design.
    if (page === "home") {
      assert.ok(
        title.includes("Model Context Protocol"),
        `${name}: the title does not contain the keyword — it was only in the description`,
      );
    }
    // A server detail page's title is `<server id> <fixed suffix>` (e.g.
    // "gitlab — MCP server card · mcp.jmrp.io", 38 chars in EN — see
    // `metaTitleServerSuffix` in `src/i18n/ui/servers-page.ts`). It is
    // legitimately short: the id is the whole differentiator, and it is
    // exactly as short as the MCP server's own name. Exempted from the
    // floor only, never from the ceiling.
    if (!id) {
      assert.ok(
        title.length >= 40,
        `${name}: ${title.length} characters, too short (40 minimum)`,
      );
    }
    assert.ok(
      title.length <= MAX_TITLE_LENGTH,
      `${name}: ${title.length} characters; Google trims past ~60`,
    );
  }
});

/**
 * The meta description's budget, in characters.
 *
 * 155 is what Google shows before trimming with an ellipsis. Going over breaks
 * nothing visible — the page is served the same — so it only shows up in the
 * search result, with the sentence cut mid-word. The sibling site jmrp.io pins
 * the same number (tests/content-integrity.spec.ts), so that domain and
 * subdomain do not apply two different criteria.
 */
const MAX_DESCRIPTION = 155;

test("the action-domain pages fit the same title and description budgets", () => {
  // They are generated from a domain name of unbounded length and there are
  // 56 of them, so they are exactly the pages a hand-written list forgets —
  // `pages()` above walks none of them. The paths come from the same helper
  // both routes' `getStaticPaths` uses, so this set cannot drift from what
  // the build emits.
  let checked = 0;
  for (const { params } of actionsDomainPaths()) {
    const { server, domain } = params;
    for (const lang of LANGS) {
      const name = `${lang === "es" ? "es/" : ""}servers/${server}/actions/${domain}/index.html`;
      const html = read(name);
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
      assert.ok(title, `${name}: no <title>`);
      assert.ok(
        title.length <= MAX_TITLE_LENGTH,
        `${name}: title is ${title.length} characters — "${title}"`,
      );
      const description = descriptionOf(html);
      assert.ok(description, `${name}: no <meta name="description">`);
      assert.ok(
        description.length <= MAX_DESCRIPTION,
        `${name}: ${description.length} characters; Google trims past ` +
          `${MAX_DESCRIPTION} — "${description}"`,
      );
      checked += 1;
    }
  }
  assert.ok(checked > 0, "no action-domain page was checked");
});

test("no description goes past what Google will show", () => {
  for (const { name, html } of pages()) {
    const description = descriptionOf(html);

    // Presence is asserted first: `undefined` is not longer than 155 either,
    // so without this a page that LOSES the tag would pass.
    assert.ok(description, `${name}: no <meta name="description">`);

    assert.ok(
      description.length <= MAX_DESCRIPTION,
      `${name}: ${description.length} characters; Google trims past ` +
        // The whole description, on purpose: whoever reads the failure has to
        // be able to rewrite it without opening `dist/`.
        `${MAX_DESCRIPTION} — "${description}"`,
    );
  }
});

test("the description meter sees the one that runs long", () => {
  // Walking only correct pages does not tell "they all fit" apart from "I find
  // none": both cases come out green. This case pins down what HAS to come out
  // long, written the way the minifier leaves it — `content` before `name` —
  // and with an entity in the middle, to prove the decoded text is what gets
  // measured and not the escape.
  const excess = `${"word ".repeat(32)}&amp; tail`;
  const html = `<meta content="${excess}" name="description">`;

  const measured = descriptionOf(html);
  assert.ok(measured?.endsWith("& tail"), "it does not decode the entity");
  assert.ok(
    measured.length > MAX_DESCRIPTION,
    "the meter does not see a description that goes over budget as long",
  );

  // The other false green: with no tag there is no length to measure, so
  // `undefined` cannot slip through as "fits with room to spare".
  assert.equal(descriptionOf('<meta content="x" name="keywords">'), undefined);
});

test("the discovery catalog and the server cards agree", () => {
  // Discovery for a domain with SEVERAL MCP servers is two documents: the
  // catalog lists them and points at one card each, and every card describes
  // exactly one server. If they drift, a client following the catalog fetches
  // a card that does not exist.
  const catalog = JSON.parse(read("well-known/ai-catalog.json"));
  const index = JSON.parse(read("servers.json"));

  assert.equal(
    catalog.entries.length,
    index.servers.length,
    "the catalog does not list the same servers as servers.json",
  );

  for (const entry of catalog.entries) {
    assert.equal(
      entry.type,
      "application/mcp-server-card+json",
      `${entry.identifier}: wrong type`,
    );

    // The card's URL has to really exist in the build. The vhost serves it
    // with a `location =`, which beats the proxy's `^~ /libgen`.
    const path = new URL(entry.url).pathname.replace(/^\//, "");
    const card = JSON.parse(read(path));

    assert.ok(card.name?.includes("/"), `${path}: name no es reverse-DNS`);
    assert.ok(card.version, `${path}: sin version`);
    assert.ok(card.description, `${path}: sin description`);

    // The card's endpoint must be one of the real ones, not the card's own URL.
    const url = card.remotes?.[0]?.url;
    assert.ok(
      Object.values(index.endpoints).includes(url),
      `${path}: remotes[0].url (${url}) no es un endpoint de servers.json`,
    );

    // A credential declared without `isSecret` is an invitation to log it.
    for (const header of card.remotes[0].headers ?? []) {
      if (!header.isRequired) continue;
      const declared = index.servers.find((s) => s.endpoint === url);
      // Compared by NAME, not by whole string: since servers.json started
      // carrying the value's shape too ("Authorization: Bearer <token>"),
      // an exact match would fail on a difference that is deliberate. What
      // has to hold is that the header the card requires is one the index
      // declares — not that both surfaces phrase it identically.
      assert.ok(
        declared.requiredHeaders.some(
          (h) => h === header.name || h.startsWith(`${header.name}:`),
        ),
        `${path}: header ${header.name} not declared in servers.json`,
      );
    }
  }
});

test("the pages carry the tokens nginx replaces with the live status", () => {
  // The status (each MCP's version and live nodes) is injected by
  // /etc/nginx/lua/mcp_ssr_status.lua, which replaces these tokens on the fly.
  // If they disappear from the build the substitution does not fail: it simply
  // does not happen, and the page comes out with no status without anything
  // going red. Hence this test.
  //
  // Under `astro preview` (the e2e suite) the tokens are NOT substituted,
  // because the lua hooks only exist in the production vhost. That is
  // expected.
  //
  // Scoped to the home pages ON PURPOSE: the live-status badge is rendered by
  // ServerCard.astro, which only the home page includes, and nginx itself
  // only rewrites these tokens on `location = /` and `location = /es/` (see
  // the vhost). `/inspector/`, `/internals/` and `/policies/` never emit
  // these tokens and are not supposed to.
  const homePages = pages().filter((p) => p.page === "home");
  for (const { name, html } of homePages) {
    for (const token of ["MCPSSR_LIBGEN_STATUS", "MCPSSR_GITLAB_STATUS"]) {
      assert.ok(
        html.includes(token),
        `${name}: the ${token} token is missing — nginx will have nothing to replace`,
      );
    }
  }
});

test("llms-full.txt and the site agree on which GitLab token scope works", () => {
  // These two surfaces drifted apart once: llms-full.txt called a `read_api`
  // token "the sane way to try the inspector" while the site said such a
  // token is refused outright. llms-full.txt is the file an agent reads
  // BEFORE connecting, so the stale copy handed every LLM-driven user a
  // credential that fails at the door. src/data/servers.ts documents why it
  // fails: the deployment checks the scope once against what its whole tool
  // set could need, and gitlab.com answers -40300 even for `initialize`.
  //
  // Asserted on the BUILT artifacts rather than the source strings: what
  // ships is what a client reads, and the two are generated from different
  // modules (src/lib/llms.ts and src/data/servers.ts).
  const full = read("llms-full.txt");
  const home = read("index.html");

  assert.ok(
    /`read_api`[\s\S]{0,120}refused/.test(full),
    "llms-full.txt does not say a read_api token is refused",
  );
  assert.ok(
    !/read_api[\s\S]{0,120}sane way/.test(full),
    "llms-full.txt still recommends a read_api token, which the server rejects",
  );
  // The home page is the other half of the contract; if it ever stops saying
  // this, the assertion above is guarding a claim nothing else makes.
  assert.ok(
    /read_api token is refused/.test(home),
    "the home page no longer states that a read_api token is refused",
  );
});
