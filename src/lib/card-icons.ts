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

/** The minimal shape every icon-bearing field needs: just `src`. */
interface IconLike {
  src: string;
}

/**
 * True if `src` is a `data:image/…` URI — the only shape safe to place in an
 * `<img src>` attribute.
 */
export function isSafeIconSrc(src: string): boolean {
  return src.startsWith("data:image/");
}

/**
 * The first icon in `icons` whose `src` passes {@link isSafeIconSrc}.
 *
 * Generic over `T` (rather than importing `CardIcon` from `server-cards.ts`)
 * so this module has no compile-time dependency on that one's exact export
 * surface — it only needs `src` to exist.
 *
 * @param icons The card's `icons` array for a server/tool/prompt, if it has one.
 * @returns The icon to render, or `undefined` if there is none, or none is safe.
 */
export function safeIcon<T extends IconLike>(icons: T[] | undefined): T | undefined {
  return icons?.find((icon) => isSafeIconSrc(icon.src));
}
