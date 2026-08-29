/**
 * The source of truth for the site's public URLs.
 *
 * Whoever needs to know which languages exist, at which path each one lives or
 * what its social card is called gets it from here: the layout (canonical,
 * hreflang, Open Graph), the JSON-LD graph, `robots.txt`, `llms.txt` and the
 * OG images.
 *
 * Centralizing it is NOT cosmetic. The `<link rel="alternate">` used to be
 * built with a `lang === "en" ? "es" : "en"` ternary inside the layout, which
 * is why neither page self-referenced in hreflang — Google discards the whole
 * cluster when the self-reference is missing, so EN and ES competed with each
 * other instead of grouping. Iterating a map means adding a new language
 * cannot leave the cluster short again.
 */

import { DEFAULT_LANG, type Lang, LANGS } from "../i18n/config.ts";
import { ui } from "../i18n/ui.ts";

// Language identity (`Lang`, `LANGS`, `DEFAULT_LANG`) lives in
// `src/i18n/config.ts` now; re-exported here so existing imports of this
// module (`og-[lang].png.ts`, `llms.ts`, `jsonld.ts`) keep working, without
// this file holding a second, driftable copy of the same values.
export { DEFAULT_LANG, LANGS } from "../i18n/config.ts";

/** The site's origin. Absolute URLs are built from it. */
export const SITE_ORIGIN = "https://mcp.jmrp.io";

/**
 * The IndexNow key: it is not a secret.
 *
 * The protocol publishes it at `https://mcp.jmrp.io/<key>.txt`; its job is not
 * to authenticate but to prove control of the domain, so it lives in the repo
 * on purpose, so the key and the file cannot drift apart.
 */
export const INDEXNOW_KEY = "8b3b0f3c6a883bd7d274f2cf7645921a";

/**
 * Each language's path. English lives at the root
 * (`i18n.routing.prefixDefaultLocale: false`).
 *
 * The type is `Record<Lang, …>` on purpose: `Lang` comes from
 * `src/i18n/config.ts`, so adding a language there without giving it a path
 * here does not compile.
 */
export const LOCALE_PATHS: Record<Lang, string> = {
  en: "/",
  es: "/es/",
};

/** `og:locale` values use `language_TERRITORY` format, not BCP-47. */
export const OG_LOCALES: Record<Lang, string> = {
  en: "en_US",
  es: "es_ES",
};

/** The social card's dimensions. They also go in `og:image:width/height`. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** The site's name, in `og:site_name` and in the JSON-LD graph's `WebSite`. */
export const SITE_NAME = "mcp.jmrp.io";

/** Every page of the site. The key is what routes and the graph refer to. */
export type PageId =
  "home" | "inspector" | "internals" | "policies" | "servers";

/**
 * Path of each page, relative to its language root.
 *
 * Empty for the home page: `pageUrl` concatenates it to `LOCALE_PATHS`, which
 * already carries the trailing slash. Renaming a route means changing it here
 * and nowhere else — but only before it is published, since a live URL costs a
 * 301 and a reindexing cycle.
 *
 * `servers` is the `/servers/` INDEX only — one fixed URL, like every other
 * entry here. Each server's OWN detail page (`/servers/<id>/`) has a variable
 * segment this map cannot express without one static entry per server id,
 * which would turn "add a third MCP" back into a code change. See
 * `serverPageUrl`/`serverPageAlternates` below for that page's URLs instead.
 */
export const PAGE_PATHS: Record<PageId, string> = {
  home: "",
  inspector: "inspector/",
  internals: "internals/",
  policies: "policies/",
  servers: "servers/",
};

/**
 * Absolute canonical URL of a page in one language.
 *
 * @param lang Language of the page.
 * @param page Which page; defaults to the home page.
 * @returns URL with a trailing slash, as `build.format: "directory"` emits it.
 */
export function pageUrl(lang: Lang, page: PageId = "home"): string {
  return `${SITE_ORIGIN}${LOCALE_PATHS[lang]}${PAGE_PATHS[page]}`;
}

/**
 * A language's social-card path, relative to the root.
 *
 * @param lang The page's language.
 * @returns The path of the PNG `src/pages/og-[lang].png.ts` generates.
 */
export function ogImagePath(lang: Lang): string {
  return `/og-${lang}.png`;
}

/**
 * The social card's absolute URL.
 *
 * `og:image` MUST be absolute: Slack, WhatsApp and Bluesky do not resolve
 * relative paths and end up with no image.
 *
 * @param lang The page's language.
 * @returns The PNG's full URL.
 */
export function ogImageUrl(lang: Lang): string {
  return `${SITE_ORIGIN}${ogImagePath(lang)}`;
}

/**
 * The social card's alternative text.
 *
 * It describes WHAT IS SEEN in the PNG — the headline and lede, which is what
 * `og-[lang].png.ts` draws — and does not repeat the document's `<title>`: the
 * title already travels in `og:title` right beside it, and an alt that
 * duplicates it tells someone who cannot see the image nothing new.
 *
 * @param lang The card's language.
 * @returns The text for `og:image:alt` and `twitter:image:alt`.
 */
export function ogImageAlt(lang: Lang): string {
  return `${ui[lang].title} — ${ui[lang].subtitle}`;
}

/** One `<link rel="alternate">` annotation. */
export interface Alternate {
  hreflang: string;
  href: string;
}

/**
 * hreflang cluster of ONE page: every language plus `x-default`.
 *
 * Per page and not per site: pointing `/es/internals/` at the English home
 * page would be a false claim, and Google discards a cluster whose members do
 * not agree.
 *
 * @param page Which page; defaults to the home page.
 * @returns One entry per language plus `x-default`, self-reference included.
 */
export function alternates(page: PageId = "home"): Alternate[] {
  return [
    ...LANGS.map((lang) => ({ hreflang: lang, href: pageUrl(lang, page) })),
    { hreflang: "x-default", href: pageUrl(DEFAULT_LANG, page) },
  ];
}

/**
 * Path of ONE server's detail page (`/servers/<id>/`), relative to its
 * language root.
 *
 * Not built from a `PageId`: see the comment on `PAGE_PATHS` above for why a
 * per-server route cannot be one of its fixed entries. Built from
 * `PAGE_PATHS.servers` rather than the literal `"servers/"` so the two can
 * never drift apart.
 *
 * @param id Server id, matching `McpServer.id` in `src/data/servers.ts`.
 * @returns Path with a trailing slash, e.g. `servers/gitlab/`.
 */
export function serverPagePath(id: string): string {
  return `${PAGE_PATHS.servers}${id}/`;
}

/**
 * Absolute canonical URL of one server's detail page in one language.
 *
 * @param lang Language of the page.
 * @param id Server id.
 * @returns URL with a trailing slash, mirroring what `pageUrl` does for
 *   fixed-path pages.
 */
export function serverPageUrl(lang: Lang, id: string): string {
  return `${SITE_ORIGIN}${LOCALE_PATHS[lang]}${serverPagePath(id)}`;
}

/**
 * hreflang cluster of ONE server's detail page: every language plus
 * `x-default`, self-reference included — the per-server equivalent of
 * {@link alternates}.
 *
 * @param id Server id.
 * @returns One entry per language plus `x-default`.
 */
export function serverPageAlternates(id: string): Alternate[] {
  return [
    ...LANGS.map((lang) => ({ hreflang: lang, href: serverPageUrl(lang, id) })),
    { hreflang: "x-default", href: serverPageUrl(DEFAULT_LANG, id) },
  ];
}

/**
 * Path of one action-domain page under a server's card, e.g.
 * `servers/gitlab/actions/project/`. Same rationale as {@link serverPagePath}:
 * built on `PAGE_PATHS.servers` so the two can never drift, and not a
 * `PageId` because the route is data-driven (one page per manifest domain).
 *
 * @param id Server id.
 * @param domain Manifest domain, verbatim (`access`, `merge_request`…).
 * @returns Path with a trailing slash.
 */
export function actionsDomainPagePath(id: string, domain: string): string {
  return `${serverPagePath(id)}actions/${domain}/`;
}

/**
 * Absolute canonical URL of one action-domain page in one language.
 *
 * @param lang Language of the page.
 * @param id Server id.
 * @param domain Manifest domain.
 * @returns URL with a trailing slash.
 */
export function actionsDomainPageUrl(
  lang: Lang,
  id: string,
  domain: string,
): string {
  return `${SITE_ORIGIN}${LOCALE_PATHS[lang]}${actionsDomainPagePath(id, domain)}`;
}

/**
 * hreflang cluster of ONE action-domain page — the per-domain equivalent of
 * {@link serverPageAlternates}.
 *
 * @param id Server id.
 * @param domain Manifest domain.
 * @returns Alternates including `x-default`.
 */
export function actionsDomainPageAlternates(
  id: string,
  domain: string,
): Alternate[] {
  return [
    ...LANGS.map((lang) => ({
      hreflang: lang,
      href: actionsDomainPageUrl(lang, id, domain),
    })),
    {
      hreflang: "x-default",
      href: actionsDomainPageUrl(DEFAULT_LANG, id, domain),
    },
  ];
}
