import { expect, test } from "@playwright/test";

/**
 * The SEO/GEO files are SERVED, not only generated.
 *
 * The unit tests look at `dist/`; these ask for the same deployed artifact over
 * HTTP. The difference matters: a file can be in the build and reach nobody —
 * the vhost serves by allowlist and ends in a generic 404 — and looking at the
 * directory does not catch that mismatch.
 *
 * What these tests can NOT check is the production vhost: `astro preview`
 * serves the whole of `dist/`. nginx's allowlist is checked at deploy time
 * (scripts/deploy-live-mcp.mjs warns about files with no `location`).
 */

/** Paths that have to answer 200 with their type, besides the two pages. */
const RESOURCES = [
  { path: "/robots.txt", type: /text\/plain/ },
  { path: "/llms.txt", type: /text\/plain/ },
  { path: "/llms-full.txt", type: /text\/plain/ },
  { path: "/servers.json", type: /application\/json/ },
  { path: "/og-en.png", type: /image\/png/ },
  { path: "/og-es.png", type: /image\/png/ },
  { path: "/favicon.svg", type: /image\/svg\+xml/ },
  { path: "/sitemap-index.xml", type: /xml/ },
  { path: "/sitemap-0.xml", type: /xml/ },
];

for (const { path, type } of RESOURCES) {
  test(`${path} answers 200 with content`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status(), `${path} is not served`).toBe(200);
    expect(response.headers()["content-type"]).toMatch(type);
    expect((await response.body()).length).toBeGreaterThan(0);
  });
}

test("the social image each page announces really exists", async ({
  page,
  request,
}) => {
  // A broken `og:image` is worse than having none: the client reserves the
  // card's slot and leaves it blank. Here the link is followed exactly as the
  // page publishes it, instead of assuming the path.
  for (const path of ["/", "/es/"]) {
    await page.goto(path);
    const tag = page.locator('meta[property="og:image"]');

    // Absolute and not relative: neither Slack, nor WhatsApp, nor Bluesky
    // resolves a relative path, and they end up with no image and no
    // explanation.
    await expect(tag, `${path}: og:image missing or relative`).toHaveAttribute(
      "content",
      /^https:\/\/mcp\.jmrp\.io\//,
    );

    const image = (await tag.getAttribute("content")) ?? "";
    const response = await request.get(new URL(image).pathname);
    expect(response.status(), `${path}: og:image points at a 404`).toBe(200);
  }
});

test("robots.txt sends crawlers to a sitemap that exists", async ({
  request,
}) => {
  const robots = await (await request.get("/robots.txt")).text();
  const sitemap = /^Sitemap:\s*(\S+)$/m.exec(robots)?.[1];
  expect(sitemap, "robots.txt has no Sitemap line").toBeTruthy();

  const index = await request.get(new URL(sitemap!).pathname);
  expect(index.status(), "the announced sitemap is not served").toBe(200);

  // What robots.txt announces is the INDEX; the URLs are one hop further. The
  // whole chain is followed because an index pointing at a sitemap that is not
  // served leaves the crawler empty-handed just as having none would.
  const child = /<loc>([^<]+)<\/loc>/.exec(await index.text())?.[1];
  expect(child, "the index lists no sitemap").toBeTruthy();

  const urls = await request.get(new URL(child!).pathname);
  expect(urls.status(), "the index's sitemap is not served").toBe(200);
  expect(await urls.text()).toContain("<loc>https://mcp.jmrp.io/</loc>");
});

test("every server has an anchor of its own to link to", async ({ page }) => {
  await page.goto("/");
  const index = (await (await page.request.get("/servers.json")).json()) as {
    endpoints: Record<string, string>;
  };

  for (const id of Object.keys(index.endpoints)) {
    await expect(
      page.locator(`article#${id}`),
      `without #${id} that server cannot be linked to from outside`,
    ).toBeVisible();
  }
});
