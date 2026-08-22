/**
 * Formateo de las magnitudes que enseña el inspector.
 *
 * En un módulo aparte para que la línea de estado pueda vivir fuera del
 * componente sin arrastrarlo entero.
 */

/**
 * Duración legible: milisegundos por debajo del segundo, segundos por encima.
 *
 * @param ms Duración en milisegundos.
 * @returns La duración con su unidad.
 */
export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/**
 * Tamaño legible del cuerpo de la respuesta.
 *
 * @param bytes Tamaño en bytes.
 * @returns El tamaño con su unidad.
 */
export function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
}

/**
 * Content date in human form, in the page's language.
 *
 * It lives here rather than in each template because TWO places render it: the
 * footer (`Base.astro`) and the body attribution line (`PageBody.astro`). The
 * second exists because readability — the extractor behind RAG pipelines and
 * assistants — **prunes `<footer>`**, so the footer date was invisible to them
 * and `byline` came back null. A shared helper keeps the two from ever
 * disagreeing.
 *
 * @param iso ISO date, the same one `contentDate()` returns.
 * @param lang Page language.
 * @returns The long-form date ("22 August 2026" / "22 de agosto de 2026").
 */
export function humanDate(iso: string, lang: "en" | "es"): string {
  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
