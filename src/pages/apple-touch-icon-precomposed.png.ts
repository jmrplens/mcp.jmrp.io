/**
 * `apple-touch-icon-precomposed.png` — the same 180×180 icon, under the name
 * older iOS asks for first.
 *
 * iOS before 7 looked for the `-precomposed` variant ahead of the plain one,
 * and a device that finds neither falls back to a screenshot of the page.
 * Nothing declares this file in the markup — that is the point: it is a
 * filename convention a browser probes on its own, which is why it appeared
 * in the access log as a 404 (ten of them) with no referer at all.
 *
 * It re-exports the neighbouring route's handler rather than copying it, and
 * rather than redirecting: a redirect costs the device a second round trip
 * for an icon it asked for by name, and a copy would be a second place to
 * forget when the brand changes. "Precomposed" only ever meant "do not add
 * your own gloss", which this flat mark already satisfies — so the two names
 * genuinely are the same drawing, and now they are the same code.
 */
export { GET } from "./apple-touch-icon.png";
