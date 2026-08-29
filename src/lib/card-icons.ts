/**
 * Safety gate for Server Card icons.
 *
 * Icons in `src/data/cards/*.json` are `data:image/svg+xml;base64,…` URIs
 * copied verbatim from an external JSON snapshot (each server's own
 * `/.well-known/mcp/server-card.json`). They must always be painted as
 * `<img src={icon.src}>`, NEVER inlined as `<svg>` and NEVER through
 * `set:html` — an inline SVG can carry a `<script>` or an event-handler
 * attribute that runs in this origin; loaded as an image instead, the
 * browser does not execute anything inside it. See `src/data/server-cards.ts`'s
 * header doc for the full rationale behind that split.
 *
 * This module is the defense-in-depth half of that rule. Even though today's
 * only source is a committed, human-reviewed snapshot, nothing stops a
 * future card from publishing `src: "javascript:…"` or a remote URL in that
 * field. Only a `data:image/…` value is safe to place in an `<img src>`
 * attribute, so anything else is filtered out here before it can reach a
 * template.
 */

/** The minimal shape every icon-bearing field needs: `src`, and `mimeType` when declared. */
interface IconLike {
  src: string;
  mimeType?: string;
}

/**
 * True if `src` is a `data:image/…` URI — the only shape safe to place in an
 * `<img src>` attribute.
 */
export function isSafeIconSrc(src: string): boolean {
  return src.startsWith("data:image/");
}

/**
 * The icon to paint: the safe SVG if the card publishes one, else the first
 * safe icon of any type.
 *
 * SEP-1649 icon arrays are ordered by the SERVER's preference and a client is
 * meant to take the first entry it supports. Both cards happen to list a
 * `currentColor` SVG first and 16×16 WebP theme variants after it, so taking
 * `icons[0]` worked — but that order is the server's choice, not something
 * this site can hold it to. If a future card led with the WebP, the card
 * would silently start painting a 16px raster into a slot rendered at `1em`
 * (blurry at 2× DPI) AND apply `ServerPage.astro`'s `filter: invert(1)` — a
 * rule that exists to recolor monochrome `currentColor` SVGs — to an image
 * that already ships correct for the theme, inverting it wrongly. Two visible
 * defects, no error, nothing to notice them.
 *
 * Preferring the SVG explicitly makes the choice this site's own: a browser
 * always supports SVG, so the raster fallbacks are for MCP clients that do
 * not, and are never the right pick here. The `find` fallback stays for a
 * card that publishes no SVG at all.
 *
 * Generic over `T` (rather than importing `CardIcon` from `server-cards.ts`)
 * so this module has no compile-time dependency on that one's exact export
 * surface — it only needs `src`, and `mimeType` when the card declares it.
 *
 * @param icons The card's `icons` array for a server/tool/prompt, if it has one.
 * @returns The icon to render, or `undefined` if there is none, or none is safe.
 */
export function safeIcon<T extends IconLike>(
  icons: T[] | undefined,
): T | undefined {
  const safe = icons?.filter((icon) => isSafeIconSrc(icon.src));
  return safe?.find((icon) => icon.mimeType === "image/svg+xml") ?? safe?.[0];
}
