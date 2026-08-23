import { expect, test } from "@playwright/test";

/**
 * Smoke coverage for the pages this task's split introduced: `/inspector/`,
 * `/internals/`, `/policies/` and now `/servers/` (index and per-server
 * detail pages), in both languages.
 *
 * `seo-artifacts.test.mjs` already checks canonical, hreflang and OG on the
 * built HTML in `dist/`; this checks the same artifact as SERVED by `astro
 * preview` (see `seo.spec.ts`'s header comment for why that distinction
 * matters — a file can be in the build and still 404 through nginx), and
 * that each page actually renders its OWN `<title>`, canonical and hreflang
 * cluster rather than just answering 200.
 */

const ORIGIN = "https://mcp.jmrp.io";

const PAGES = [
  { path: "/inspector/", lang: "en", canonical: `${ORIGIN}/inspector/` },
  { path: "/es/inspector/", lang: "es", canonical: `${ORIGIN}/es/inspector/` },
  { path: "/internals/", lang: "en", canonical: `${ORIGIN}/internals/` },
  { path: "/es/internals/", lang: "es", canonical: `${ORIGIN}/es/internals/` },
  { path: "/policies/", lang: "en", canonical: `${ORIGIN}/policies/` },
  { path: "/es/policies/", lang: "es", canonical: `${ORIGIN}/es/policies/` },
  // `/servers/` index: `PAGE_PATHS.servers`, one fixed URL like the rest above.
  { path: "/servers/", lang: "en", canonical: `${ORIGIN}/servers/` },
  { path: "/es/servers/", lang: "es", canonical: `${ORIGIN}/es/servers/` },
  // Per-server detail pages: DYNAMIC routes, but canonical/hreflang still
  // have to be THEIR OWN URL, not the index's — see
  // `canonicalOverride`/`alternatesOverride` on Base.astro and
  // `serverPageUrl`/`serverPageAlternates` in lib/seo.ts.
  { path: "/servers/libgen/", lang: "en", canonical: `${ORIGIN}/servers/libgen/` },
  {
    path: "/es/servers/libgen/",
    lang: "es",
    canonical: `${ORIGIN}/es/servers/libgen/`,
  },
  { path: "/servers/gitlab/", lang: "en", canonical: `${ORIGIN}/servers/gitlab/` },
  {
    path: "/es/servers/gitlab/",
    lang: "es",
    canonical: `${ORIGIN}/es/servers/gitlab/`,
  },
];

for (const { path, lang, canonical } of PAGES) {
  test(`${path} carga con título, canónica y clúster hreflang propios`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);

    await expect(page.locator("html")).toHaveAttribute("lang", lang);

    const title = await page.title();
    expect(title, `${path}: sin título`).not.toBe("");

    await expect(
      page.locator(`link[rel="canonical"][href="${canonical}"]`),
      `${path}: canonical ausente o apuntando a otra URL`,
    ).toHaveCount(1);

    // Self-reference plus both languages plus x-default: the same
    // three-annotation invariant `seo-artifacts.test.mjs` checks on the
    // built HTML, here verified on what the browser actually receives.
    const hreflangs = await page
      .locator('link[rel="alternate"][hreflang]')
      .evaluateAll((links) =>
        links.map(
          (l): [string | null, string | null] => [
            l.getAttribute("hreflang"),
            l.getAttribute("href"),
          ],
        ),
      );
    const byLang = new Map(hreflangs);
    expect(
      byLang.size,
      `${path}: sobran o faltan anotaciones hreflang`,
    ).toBe(3);
    expect(byLang.get(lang), `${path}: no se autorreferencia`).toBe(canonical);
    expect(byLang.get("en"), `${path}: sin hreflang en`).toBeTruthy();
    expect(byLang.get("es"), `${path}: sin hreflang es`).toBeTruthy();
    expect(byLang.get("x-default"), `${path}: sin x-default`).toBeTruthy();
  });
}

test("las catorce páginas responden y llevan título propio", async ({ page }) => {
  const paths = [
    "/",
    "/es/",
    "/inspector/",
    "/es/inspector/",
    "/internals/",
    "/es/internals/",
    "/policies/",
    "/es/policies/",
    "/servers/",
    "/es/servers/",
    "/servers/libgen/",
    "/es/servers/libgen/",
    "/servers/gitlab/",
    "/es/servers/gitlab/",
  ];
  const titles = new Set<string>();
  for (const path of paths) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    const title = await page.title();
    expect(title, `${path} sin título`).not.toBe("");
    titles.add(title);
  }
  // Catorce títulos distintos: dos páginas con el mismo <title> compiten
  // entre sí.
  expect(titles.size).toBe(14);
});
