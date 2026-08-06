import { readFileSync } from "node:fs";
import path from "node:path";

import type { APIRoute } from "astro";
import sharp from "sharp";

/**
 * Icono para la pantalla de inicio de iOS, 180×180.
 *
 * Se rasteriza del MISMO `public/favicon.svg` que usa la pestaña, en vez de
 * dibujar una marca aparte: son el mismo sitio y deben verse igual. Si algún
 * día cambia el sigilo, cambian los dos a la vez.
 *
 * iOS NO respeta la transparencia —compone el icono sobre un fondo blanco—,
 * así que el SVG ya trae fondo opaco propio. Aquí se aplana igualmente sobre
 * el mismo color por si el SVG cambiara: un icono con esquinas blancas sobre
 * un fondo oscuro canta mucho.
 */

const SIZE = 180;
/** Mismo fondo que declara el SVG de la marca. */
const BACKGROUND = "#0a0a0b";

/**
 * Rasteriza la marca del sitio a 180×180 para iOS.
 *
 * @returns El PNG del icono.
 */
export const GET: APIRoute = async () => {
  // process.cwd() y no import.meta.url: en el build este módulo se evalúa ya
  // dentro de dist/, así que una ruta relativa apuntaría a dist/public/.
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
