/**
 * Formatting for the quantities the inspector shows.
 *
 * In a module of its own so the status line can live outside the component
 * without dragging the whole thing along.
 */

/**
 * A readable duration: milliseconds below a second, seconds above.
 *
 * @param ms The duration in milliseconds.
 * @returns The duration with its unit.
 */
export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/**
 * A readable size for the response's body.
 *
 * @param bytes The size in bytes.
 * @returns The size with its unit.
 */
export function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
}

/**
 * Content date in human form, in the page's language.
 *
 * It lives here rather than in each template because TWO places render it: the
 * footer (`Base.astro`) and the body attribution line (`UpdatedLine.astro`,
 * used on every page that has one). The second exists because readability —
 * the extractor behind RAG pipelines and assistants — **prunes `<footer>`**,
 * so the footer date was invisible to them and `byline` came back null. A
 * shared helper keeps the two from ever disagreeing.
 *
 * @param iso ISO date, the same one `contentDate()` returns.
 * @param lang Page language.
 * @returns The long-form date, in the page language ("22 August 2026", or its
 *   Spanish equivalent).
 */
export function humanDate(iso: string, lang: "en" | "es"): string {
  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
