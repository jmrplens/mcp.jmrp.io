/**
 * What a deploy announces to IndexNow and Bing, and how much of it Bing takes.
 *
 * These rules are tested here rather than through `deploy-live-mcp.mjs`
 * because that script deploys: importing it copies snippets into /etc/nginx
 * and reloads the service. `scripts/lib/url-submission.mjs` exists so the
 * decisions can be exercised as plain functions.
 *
 * Both rules come from a real failure. The deploy of 2026-09-02 sent all 73
 * sitemap URLs to Bing against a daily quota of 27 and got back
 * `{"ErrorCode":2,"Message":"ERROR!!! Quota remaining for today: 27,
 * Submitted: 73"}` — an over-sized batch is rejected WHOLE, so the channel
 * published nothing while logging a bare "HTTP 400".
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_BATCH,
  parseSitemapEntries,
  selectChangedUrls,
  submissionLimit,
} from "../../scripts/lib/url-submission.mjs";

const urlBlock = ([loc, lastmod]) => {
  const stamp = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
  return `<url><loc>${loc}</loc>${stamp}</url>`;
};

const sitemap = (...entries) =>
  `<urlset>${entries.map(urlBlock).join("")}</urlset>`;

test("parseSitemapEntries keeps each lastmod with ITS OWN loc", () => {
  // The entry in the middle has no <lastmod>. Matching locs and lastmods with
  // two independent global regexes would shift the third date onto the second
  // URL — the ledger would then be wrong rather than merely incomplete.
  const entries = parseSitemapEntries(
    sitemap(
      ["https://mcp.jmrp.io/", "2026-09-01T00:00:00.000Z"],
      ["https://mcp.jmrp.io/es/", null],
      ["https://mcp.jmrp.io/license/", "2026-09-02T00:00:00.000Z"],
    ),
  );
  assert.deepEqual(
    [...entries.entries()],
    [
      ["https://mcp.jmrp.io/", "2026-09-01T00:00:00.000Z"],
      ["https://mcp.jmrp.io/es/", ""],
      ["https://mcp.jmrp.io/license/", "2026-09-02T00:00:00.000Z"],
    ],
  );
});

test("with no ledger every URL is announced, which is the right bootstrap", () => {
  const current = parseSitemapEntries(
    sitemap(["https://mcp.jmrp.io/", "2026-09-01T00:00:00.000Z"]),
  );
  const { changed, total, isBootstrap } = selectChangedUrls(current, null);
  assert.deepEqual(changed, ["https://mcp.jmrp.io/"]);
  assert.equal(total, 1);
  assert.equal(isBootstrap, true);
});

test("a deploy that changed nothing announces nothing", () => {
  // The whole point: before this, every deploy spent Bing's daily quota and
  // IndexNow's trust to say "nothing happened".
  const current = parseSitemapEntries(
    sitemap(
      ["https://mcp.jmrp.io/", "2026-09-01T00:00:00.000Z"],
      ["https://mcp.jmrp.io/es/", "2026-09-01T00:00:00.000Z"],
    ),
  );
  const previous = Object.fromEntries(current);
  const { changed, isBootstrap } = selectChangedUrls(current, previous);
  assert.deepEqual(changed, []);
  assert.equal(isBootstrap, false);
});

test("only the pages whose lastmod moved, plus new ones, are announced", () => {
  const current = parseSitemapEntries(
    sitemap(
      ["https://mcp.jmrp.io/", "2026-09-01T00:00:00.000Z"],
      ["https://mcp.jmrp.io/license/", "2026-09-02T00:00:00.000Z"],
      ["https://mcp.jmrp.io/brand-new/", "2026-09-02T00:00:00.000Z"],
    ),
  );
  const previous = {
    "https://mcp.jmrp.io/": "2026-09-01T00:00:00.000Z",
    "https://mcp.jmrp.io/license/": "2026-08-20T00:00:00.000Z",
  };
  assert.deepEqual(selectChangedUrls(current, previous).changed, [
    "https://mcp.jmrp.io/license/",
    "https://mcp.jmrp.io/brand-new/",
  ]);
});

test("a URL with no lastmod is always announced: there is no change signal", () => {
  const current = parseSitemapEntries(
    sitemap(["https://mcp.jmrp.io/", null]),
  );
  assert.deepEqual(
    selectChangedUrls(current, { "https://mcp.jmrp.io/": "" }).changed,
    ["https://mcp.jmrp.io/"],
  );
});

test("the Bing batch is clamped by every bound at once", () => {
  // Exceeding ANY of them costs the whole batch, not the excess.
  assert.equal(submissionLimit({ daily: 27, monthly: 2827 }, 73), 27);
  assert.equal(submissionLimit({ daily: 100, monthly: 5 }, 73), 5);
  assert.equal(submissionLimit({ daily: 100, monthly: 2827 }, 3), 3);
  assert.equal(
    submissionLimit({ daily: 10_000, monthly: 10_000 }, 10_000),
    MAX_BATCH,
  );
});

test("an exhausted or unreadable quota yields a batch of zero, never a negative one", () => {
  assert.equal(submissionLimit({ daily: 0, monthly: 2827 }, 73), 0);
  assert.equal(submissionLimit({ daily: -5, monthly: 2827 }, 73), 0);
  assert.equal(submissionLimit(null, 73), 0);
  assert.equal(submissionLimit({}, 73), 0);
});
