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

import type { Lang } from "../i18n/ui";
import { ui } from "../i18n/ui";

/** Origen del sitio. Las URL absolutas se construyen a partir de él. */
export const SITE_ORIGIN = "https://mcp.jmrp.io";

/**
 * Ruta de cada idioma. El inglés vive en la raíz
 * (`i18n.routing.prefixDefaultLocale: false`).
 *
 * El tipo es `Record<Lang, …>` a propósito: `Lang` sale de `src/i18n/ui.ts`, así
 * que añadir un idioma allí sin darle ruta aquí no compila.
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

/** Idioma cuya versión sirve de `x-default`: la raíz del sitio. */
export const DEFAULT_LANG: Lang = "en";

/** Dimensiones de la tarjeta social. Van también en `og:image:width/height`. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** Nombre del sitio en `og:site_name` y en el `WebSite` del grafo JSON-LD. */
export const SITE_NAME = "mcp.jmrp.io";

/** Todos los idiomas, en orden estable. */
export const LANGS: Lang[] = Object.keys(LOCALE_PATHS) as Lang[];

/**
 * URL absoluta y canónica de la página de un idioma.
 *
 * @param lang Idioma de la página.
 * @returns URL con barra final, tal cual la emite `build.format: "directory"`.
 */
export function pageUrl(lang: Lang): string {
  return `${SITE_ORIGIN}${LOCALE_PATHS[lang]}`;
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
 * Las anotaciones hreflang que TODA página debe emitir.
 *
 * La lista es la misma en las dos páginas —incluida la autorreferencia— porque
 * eso es justo lo que exige Google: cada versión lista todas las versiones,
 * ella incluida, o las anotaciones se consideran inválidas y se descartan.
 *
 * @returns Un alternate por idioma más el `x-default`.
 */
export function alternates(): Alternate[] {
  return [
    ...LANGS.map((lang) => ({ hreflang: lang, href: pageUrl(lang) })),
    { hreflang: "x-default", href: pageUrl(DEFAULT_LANG) },
  ];
}
