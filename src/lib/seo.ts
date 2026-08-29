/**
 * Fuente de verdad de las URL públicas del sitio.
 *
 * Quien necesite saber qué idiomas existen, en qué ruta vive cada uno o cómo se
 * llama su tarjeta social lo saca de aquí: el layout (canonical, hreflang, Open
 * Graph), el grafo JSON-LD, `robots.txt`, `llms.txt` y las imágenes OG.
 *
 * Centralizarlo NO es cosmético. Antes, el `<link rel="alternate">` se
 * construía con un ternario `lang === "en" ? "es" : "en"` dentro del layout, y
 * por eso ninguna de las dos páginas se autorreferenciaba en hreflang — Google
 * descarta el clúster entero cuando falta la autorreferencia, así que EN y ES
 * competían entre sí en vez de agruparse. Iterando un mapa, dar de alta un
 * idioma nuevo no puede volver a dejar el clúster cojo.
 */

import { DEFAULT_LANG, type Lang, LANGS } from "../i18n/config.ts";
import { ui } from "../i18n/ui.ts";

// Language identity (`Lang`, `LANGS`, `DEFAULT_LANG`) lives in
// `src/i18n/config.ts` now; re-exported here so existing imports of this
// module (`og-[lang].png.ts`, `llms.ts`, `jsonld.ts`) keep working, without
// this file holding a second, driftable copy of the same values.
export { DEFAULT_LANG, LANGS } from "../i18n/config.ts";

/** Origen del sitio. Las URL absolutas se construyen a partir de él. */
export const SITE_ORIGIN = "https://mcp.jmrp.io";

/**
 * Clave de IndexNow: no es un secreto.
 *
 * El protocolo la publica en `https://mcp.jmrp.io/<clave>.txt`; su función no
 * es autenticar sino demostrar control del dominio, así que va en el repo a
 * propósito para que clave y fichero no puedan desincronizarse.
 */
export const INDEXNOW_KEY = "8b3b0f3c6a883bd7d274f2cf7645921a";

/**
 * Ruta de cada idioma. El inglés vive en la raíz
 * (`i18n.routing.prefixDefaultLocale: false`).
 *
 * El tipo es `Record<Lang, …>` a propósito: `Lang` sale de `src/i18n/config.ts`,
 * así que añadir un idioma allí sin darle ruta aquí no compila.
 */
export const LOCALE_PATHS: Record<Lang, string> = {
  en: "/",
  es: "/es/",
};

/** Los `og:locale` van en formato `idioma_TERRITORIO`, no en BCP-47. */
export const OG_LOCALES: Record<Lang, string> = {
  en: "en_US",
  es: "es_ES",
};

/** Dimensiones de la tarjeta social. Van también en `og:image:width/height`. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** Nombre del sitio en `og:site_name` y en el `WebSite` del grafo JSON-LD. */
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
 * Ruta de la tarjeta social de un idioma, relativa a la raíz.
 *
 * @param lang Idioma de la página.
 * @returns Ruta del PNG que genera `src/pages/og-[lang].png.ts`.
 */
export function ogImagePath(lang: Lang): string {
  return `/og-${lang}.png`;
}

/**
 * URL absoluta de la tarjeta social.
 *
 * `og:image` DEBE ser absoluta: Slack, WhatsApp y Bluesky no resuelven rutas
 * relativas y se quedan sin imagen.
 *
 * @param lang Idioma de la página.
 * @returns URL completa del PNG.
 */
export function ogImageUrl(lang: Lang): string {
  return `${SITE_ORIGIN}${ogImagePath(lang)}`;
}

/**
 * Texto alternativo de la tarjeta social.
 *
 * Describe LO QUE SE VE en el PNG —titular y lede, que es lo que dibuja
 * `og-[lang].png.ts`— y no repite el `<title>` del documento: el título ya
 * viaja en `og:title` justo al lado, y un alt que lo duplique no le dice nada
 * nuevo a quien no puede ver la imagen.
 *
 * @param lang Idioma de la tarjeta.
 * @returns Texto para `og:image:alt` y `twitter:image:alt`.
 */
export function ogImageAlt(lang: Lang): string {
  return `${ui[lang].title} — ${ui[lang].subtitle}`;
}

/** Una anotación `<link rel="alternate">`. */
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
 * Path of one action-domain page under a server's ficha, e.g.
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
