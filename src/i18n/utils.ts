/**
 * Resolving the current language from the URL.
 *
 * Pages do NOT receive the language as a prop: the mirrored route files under
 * `src/pages/es/` are byte-identical to their English counterparts, which is
 * what makes it impossible for the two to drift. The only thing that tells
 * them apart is the URL they are served from.
 */
import { DEFAULT_LANG, type Lang, LANGS } from "./config.ts";

/**
 * Extracts the language from a URL pathname.
 *
 * @param url The page URL, normally `Astro.url`.
 * @returns The detected language, falling back to {@link DEFAULT_LANG}.
 */
export function getLangFromUrl(url: URL): Lang {
  const [, first] = url.pathname.split("/", 2);
  if (first && (LANGS as readonly string[]).includes(first)) {
    return first as Lang;
  }
  return DEFAULT_LANG;
}
