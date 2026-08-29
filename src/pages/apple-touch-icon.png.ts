import { readFileSync } from "node:fs";
import path from "node:path";

import type { APIRoute } from "astro";
import sharp from "sharp";

/**
 * The iOS home-screen icon, 180×180.
 *
 * It is rasterized from the SAME `public/favicon.svg` the tab uses, rather
 * than drawing a separate mark: they are the same site and must look alike. If
 * the mark ever changes, both change at once.
 *
 * iOS does NOT honour transparency — it composites the icon over a white
 * background — so the SVG already carries its own opaque background. It is
 * flattened here over the same colour anyway in case the SVG changes: an icon
 * with white corners on a dark background is very obvious.
 */

const SIZE = 180;
/** The same background the mark's SVG declares. */
const BACKGROUND = "#0a0a0b";

/**
 * Rasterizes the site's mark to 180×180 for iOS.
 *
 * @returns The icon's PNG.
 */
export const GET: APIRoute = async () => {
  // process.cwd() and not import.meta.url: at build time this module is
  // evaluated from inside dist/, so a relative path would point at
  // dist/public/.
  const svg = readFileSync(path.join(process.cwd(), "public", "favicon.svg"));

  const png = await sharp(svg, { density: 384 })
    .resize(SIZE, SIZE, { fit: "contain", background: BACKGROUND })
    .flatten({ background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
