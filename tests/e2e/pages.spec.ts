import { expect, test } from "@playwright/test";

/**
 * Smoke coverage for the pages this task's split introduced: `/inspector/`,
 * `/internals/` and `/policies/`, in both languages.
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

test("las ocho páginas responden y llevan título propio", async ({ page }) => {
  const paths = [
    "/",
    "/es/",
    "/inspector/",
    "/es/inspector/",
    "/internals/",
    "/es/internals/",
    "/policies/",
    "/es/policies/",
  ];
  const titles = new Set<string>();
  for (const path of paths) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    const title = await page.title();
    expect(title, `${path} sin título`).not.toBe("");
    titles.add(title);
  }
  // Ocho títulos distintos: dos páginas con el mismo <title> compiten entre sí.
  expect(titles.size).toBe(8);
});
