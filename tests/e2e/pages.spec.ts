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

/**
 * The English (unprefixed) path for a page, given its OWN path and language.
 *
 * English lives at the root (`DEFAULT_LANG`), so a Spanish path's English
 * counterpart is itself minus the `/es` prefix; an English path already IS
 * that path. Pulled out to a plain function — not a ternary inline in the
 * test body — per `playwright/no-conditional-in-test`.
 *
 * @param lang Language of `path` ("en" or "es", per {@link PAGES}).
 * @param path The page's own path, as listed in {@link PAGES}.
 * @returns The English path.
 */
function enPathOf(lang: string, path: string): string {
  return lang === "es" ? path.replace(/^\/es/, "") : path;
}

const PAGES = [
  { path: "/inspector/", lang: "en", canonical: `${ORIGIN}/inspector/` },
  { path: "/es/inspector/", lang: "es", canonical: `${ORIGIN}/es/inspector/` },
  { path: "/internals/", lang: "en", canonical: `${ORIGIN}/internals/` },
  { path: "/es/internals/", lang: "es", canonical: `${ORIGIN}/es/internals/` },
  { path: "/policies/", lang: "en", canonical: `${ORIGIN}/policies/` },
  { path: "/es/policies/", lang: "es", canonical: `${ORIGIN}/es/policies/` },
  { path: "/license/", lang: "en", canonical: `${ORIGIN}/license/` },
  { path: "/es/license/", lang: "es", canonical: `${ORIGIN}/es/license/` },
  // `/servers/` index: `PAGE_PATHS.servers`, one fixed URL like the rest above.
  { path: "/servers/", lang: "en", canonical: `${ORIGIN}/servers/` },
  { path: "/es/servers/", lang: "es", canonical: `${ORIGIN}/es/servers/` },
  // Per-server detail pages: DYNAMIC routes, but canonical/hreflang still
  // have to be THEIR OWN URL, not the index's — see
  // `canonicalOverride`/`alternatesOverride` on Base.astro and
  // `serverPageUrl`/`serverPageAlternates` in lib/seo.ts.
  {
    path: "/servers/libgen/",
    lang: "en",
    canonical: `${ORIGIN}/servers/libgen/`,
  },
  {
    path: "/es/servers/libgen/",
    lang: "es",
    canonical: `${ORIGIN}/es/servers/libgen/`,
  },
  {
    path: "/servers/gitlab/",
    lang: "en",
    canonical: `${ORIGIN}/servers/gitlab/`,
  },
  {
    path: "/es/servers/gitlab/",
    lang: "es",
    canonical: `${ORIGIN}/es/servers/gitlab/`,
  },
];

for (const { path, lang, canonical } of PAGES) {
  test(`${path} loads with its own title, canonical and hreflang cluster`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);

    await expect(page.locator("html")).toHaveAttribute("lang", lang);

    const title = await page.title();
    expect(title, `${path}: no title`).not.toBe("");

    await expect(
      page.locator(`link[rel="canonical"][href="${canonical}"]`),
      `${path}: canonical missing or pointing at another URL`,
    ).toHaveCount(1);

    // Self-reference plus both languages plus x-default: the same
    // three-annotation invariant `seo-artifacts.test.mjs` checks on the
    // built HTML, here verified on what the browser actually receives.
    const hreflangs = await page
      .locator('link[rel="alternate"][hreflang]')
      .evaluateAll((links) =>
        links.map((l): [string | null, string | null] => [
          l.getAttribute("hreflang"),
          l.getAttribute("href"),
        ]),
      );
    // Length FIRST: `new Map(hreflangs)` silently overwrites duplicate
    // language entries, so four links (two of them `en`) would still leave
    // `byLang.size === 3` and pass the size check below without this.
    expect(
      hreflangs,
      `${path}: too many or too few hreflang annotations`,
    ).toHaveLength(3);
    const byLang = new Map(hreflangs);
    expect(byLang.size, `${path}: there are duplicate hreflangs`).toBe(3);

    // x-default points at the default language's URL, same as `en` here.
    const basePath = enPathOf(lang, path);
    const enUrl = `${ORIGIN}${basePath}`;
    const esUrl = `${ORIGIN}/es${basePath}`;

    expect(byLang.get(lang), `${path}: it does not self-reference`).toBe(
      canonical,
    );
    expect(byLang.get("en"), `${path}: wrong hreflang en`).toBe(enUrl);
    expect(byLang.get("es"), `${path}: wrong hreflang es`).toBe(esUrl);
    expect(byLang.get("x-default"), `${path}: wrong x-default`).toBe(enUrl);
  });
}

test("all sixteen pages respond and carry a title of their own", async ({
  page,
}) => {
  const paths = [
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
  ];
  const titles = new Set<string>();
  for (const path of paths) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    const title = await page.title();
    expect(title, `${path} has no title`).not.toBe("");
    titles.add(title);
  }
  // Sixteen distinct titles: two pages sharing a <title> compete with each
  // other.
  expect(titles.size).toBe(16);
});
