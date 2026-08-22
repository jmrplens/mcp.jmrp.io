/**
 * Language identity of the site, in one place.
 *
 * `Lang` used to be derived from `ui.ts` (`keyof typeof ui`), which made every
 * consumer of the type depend on the translation table. Splitting that table
 * per page would have broken all of them at once, so the identity moves here
 * and `ui.ts` re-exports it for backwards compatibility.
 */

/** The two languages the site is published in. English lives at the root. */
export type Lang = "en" | "es";

/** Every language, in the order they are announced. */
export const LANGS: readonly Lang[] = ["en", "es"] as const;

/** The language served from the root, with no prefix. */
export const DEFAULT_LANG: Lang = "en";
