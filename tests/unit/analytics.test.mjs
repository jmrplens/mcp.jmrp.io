/**
 * Which pages load Cloudflare Web Analytics.
 *
 * Every page but the inspector's. The inspector is the one page where a
 * credential is typed or obtained, and what the gitlab notice and the
 * policies page promise about it — its Content-Security-Policy lets the
 * token go to this domain and gitlab.com and nowhere else — only holds
 * while it loads no beacon and keeps cloudflareinsights.com out of its
 * `connect-src` (the vhost's `$mcp_connect_src` map does the second half).
 * The exclusion keys on `page="inspector"`, so this also holds every
 * inspector route file to that prop: a new one that forgot it would load
 * the beacon.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { pageLoadsAnalytics } from "../../src/lib/analytics.ts";

test("every page but the inspector's loads the beacon", () => {
  for (const page of ["home", "servers", "internals", "policies", "license"]) {
    assert.equal(pageLoadsAnalytics(page), true, page);
  }
  assert.equal(pageLoadsAnalytics("inspector"), false);
});

test('every inspector route says page="inspector", the callback included', () => {
  const routes = [
    "src/pages/inspector.astro",
    "src/pages/es/inspector.astro",
    "src/pages/inspector/callback.astro",
  ];
  for (const route of routes) {
    const source = fs.readFileSync(route, "utf8");
    assert.match(
      source,
      /page="inspector"/,
      `${route} does not pass page="inspector"`,
    );
  }
});

test("the copy that promises the inspector's boundary names the inspector", () => {
  // These sentences used to say "this page's Content-Security-Policy", which
  // stopped being true of every page but the inspector the day analytics
  // came in; the boundary they describe is the inspector's.
  // cspell:ignore declara -- the Spanish sentence, matched as the site serves it.
  const servers = fs.readFileSync("src/data/servers.ts", "utf8");
  assert.ok(
    servers.includes(
      "the inspector's Content-Security-Policy declares connect-src 'self' https://gitlab.com",
    ),
  );
  assert.ok(
    servers.includes(
      "la Content-Security-Policy del inspector declara connect-src 'self' https://gitlab.com",
    ),
  );
  assert.ok(!servers.includes("this page's Content-Security-Policy"));
});
