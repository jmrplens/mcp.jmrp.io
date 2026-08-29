/**
 * Each language's social (Open Graph) card: `/og-en.png` and `/og-es.png`.
 *
 * Generated at build time from an SVG rasterized with sharp (librsvg), with no
 * headless browser or header in between. The content comes from the SAME
 * sources as the page — `src/i18n/ui.ts` and `src/data/servers.ts` — so
 * registering a new MCP puts it on the card too.
 *
 * TYPOGRAPHY: librsvg resolves families through fontconfig, that is with the
 * fonts installed on the machine doing the build. The site's own (Space
 * Grotesk / IBM Plex) reach the browser as `woff2` served by Astro, a format
 * fontconfig does not consume, so the card uses the first available family
 * from a fallback list. This is not an oversight: it is the price of not
 * dragging in satori plus an embedded `.ttf` for two static images.
 *
 * If NO family resolves, librsvg draws no glyphs and the card would come out
 * with its background and lines but not a single word. That cannot pass
 * silently, so {@link renderCard} compares the render against the same scene
 * with no text: if they are identical, not one letter was painted and the
 * build stops.
 */
import type { APIRoute, GetStaticPaths } from "astro";
import sharp from "sharp";

import { servers } from "../data/servers";
import type { Lang } from "../i18n/ui";
import { ui } from "../i18n/ui";
import { LANGS, OG_IMAGE_SIZE, SITE_NAME } from "../lib/seo";

/** Families for headlines and body text, in order of preference. */
const FONT_SANS = "Inter, 'Noto Sans', 'DejaVu Sans', sans-serif";
/** Families for endpoints and labels: the equivalent of --font-mono. */
const FONT_MONO = "'IBM Plex Mono', 'DejaVu Sans Mono', monospace";

/** The palette, copied from `src/styles/tokens.css`'s dark theme. */
const COLOR = {
  bg: "#0a0a0b",
  grid: "#141418",
  hair: "#26262c",
  heading: "#f4f2ec",
  text: "#b6b5ae",
  muted: "#8c8a82",
  accent: "#f5a623",
} as const;

/**
 * Escapes text for embedding in an XML node.
 *
 * @param value The text exactly as it comes from `ui.ts` or `servers.ts`.
 * @returns The same text without characters that could open or close tags.
 */
function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** A hairline grid, the same gesture as jmrp.io's background. */
function grid(): string {
  const lines: string[] = [];
  for (let x = 0; x <= OG_IMAGE_SIZE.width; x += 60) {
    lines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${OG_IMAGE_SIZE.height}" />`,
    );
  }
  for (let y = 0; y <= OG_IMAGE_SIZE.height; y += 60) {
    lines.push(
      `<line x1="0" y1="${y}" x2="${OG_IMAGE_SIZE.width}" y2="${y}" />`,
    );
  }
  return `<g stroke="${COLOR.grid}" stroke-width="1">${lines.join("")}</g>`;
}

/**
 * Builds the card's SVG.
 *
 * @param lang The card's language.
 * @returns A complete SVG document, ready to rasterize.
 */
function cardSvg(lang: Lang): string {
  const t = ui[lang];
  const { width, height } = OG_IMAGE_SIZE;

  const endpoints = servers
    .map((server, index) => {
      const y = 430 + index * 52;
      const url = server.endpoint.replace("https://", "");
      const [host, ...rest] = url.split("/");
      const path = rest.join("/");
      return `<text x="88" y="${y}" font-family="${FONT_MONO}" font-size="30" fill="${COLOR.muted}">${xml(host)}<tspan fill="${COLOR.accent}">/${xml(path)}</tspan></text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${COLOR.bg}"/>
  ${grid()}
  <rect x="0" y="0" width="10" height="${height}" fill="${COLOR.accent}"/>
  <text x="88" y="120" font-family="${FONT_MONO}" font-size="30" fill="${COLOR.accent}">~ &#8250;<tspan fill="${COLOR.heading}" dx="14">mcp</tspan></text>
  <text x="88" y="272" font-family="${FONT_SANS}" font-size="84" font-weight="700" fill="${COLOR.heading}">${xml(t.title)}</text>
  <text x="88" y="336" font-family="${FONT_SANS}" font-size="32" fill="${COLOR.text}">${xml(t.subtitle)}</text>
  ${endpoints}
  <line x1="88" y1="528" x2="${width - 88}" y2="528" stroke="${COLOR.hair}" stroke-width="1"/>
  <text x="88" y="576" font-family="${FONT_MONO}" font-size="26" fill="${COLOR.muted}">${xml(SITE_NAME)}</text>
  <text x="${width - 88}" y="576" text-anchor="end" font-family="${FONT_MONO}" font-size="26" fill="${COLOR.muted}">${servers.length} ${xml(t.pill)}</text>
</svg>`;
}

/**
 * Renders the card and checks that glyphs were painted.
 *
 * The check is not idle paranoia: if fontconfig resolves no family, librsvg
 * draws the background and the lines and omits the text WITHOUT an error. The
 * card would sit empty in production and nobody would see it, because no test
 * of the page ever looks at a social image. Comparing against the render of
 * the same scene with no `<text>` nodes turns that failure into a broken
 * build.
 *
 * @param lang The card's language.
 * @returns The PNG's bytes.
 */
async function renderCard(lang: Lang): Promise<Buffer> {
  const svg = cardSvg(lang);
  const withoutText = svg.replaceAll(/<text[\s\S]*?<\/text>/g, "");
  const [png, blank] = await Promise.all([
    sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer(),
    sharp(Buffer.from(withoutText)).png({ compressionLevel: 9 }).toBuffer(),
  ]);
  if (png.equals(blank)) {
    throw new Error(
      `[og] the ${lang} card came out with no text: removing the <text> nodes does not change a single byte of the PNG.\n` +
        `None of the families (${FONT_SANS} / ${FONT_MONO}) resolves through fontconfig on this machine.\n` +
        `Install a sans and a mono font (for instance fonts-dejavu-core) and build again.`,
    );
  }
  return png;
}

/** One route per language: `/og-en.png` and `/og-es.png`. */
export const getStaticPaths = (() =>
  LANGS.map((lang) => ({ params: { lang } }))) satisfies GetStaticPaths;

/**
 * Renders and returns the PNG for the route's language.
 *
 * @param context Astro's context; `params.lang` is the card's language.
 * @returns An `image/png` response carrying the rasterized card.
 */
export const GET: APIRoute = async ({ params }) => {
  const lang = params.lang as Lang;
  const png = await renderCard(lang);
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600",
    },
  });
};
