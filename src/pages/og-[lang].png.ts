/**
 * Tarjeta social (Open Graph) de cada idioma: `/og-en.png` y `/og-es.png`.
 *
 * Se genera en tiempo de build a partir de un SVG que se rasteriza con sharp
 * (librsvg), sin cabecera ni navegador headless de por medio. El contenido sale
 * de las MISMAS fuentes que la página —`src/i18n/ui.ts` y `src/data/servers.ts`—
 * así que dar de alta un MCP nuevo lo mete también en la tarjeta.
 *
 * TIPOGRAFÍA: librsvg resuelve las familias por fontconfig, o sea con las
 * fuentes instaladas en la máquina que compila. Las del sitio (Space Grotesk /
 * IBM Plex) llegan al navegador como `woff2` servidos por Astro, un formato que
 * fontconfig no consume, así que la tarjeta usa la primera familia disponible
 * de una lista con fallbacks. No es un descuido: es el precio de no arrastrar
 * satori + un `.ttf` embebido solo para dos imágenes estáticas.
 *
 * Si NINGUNA familia resuelve, librsvg no dibuja glifos y saldría una tarjeta
 * con el fondo y las líneas pero sin una palabra. Eso no se puede quedar
 * silencioso, así que {@link renderCard} compara el render con el de la misma
 * escena sin textos: si son idénticos, no se ha pintado ni una letra y el build
 * se para.
 */
import type { APIRoute, GetStaticPaths } from "astro";
import sharp from "sharp";

import { servers } from "../data/servers";
import type { Lang } from "../i18n/ui";
import { ui } from "../i18n/ui";
import { LANGS, OG_IMAGE_SIZE, SITE_NAME } from "../lib/seo";

/** Familias para titulares y cuerpo, en orden de preferencia. */
const FONT_SANS = "Inter, 'Noto Sans', 'DejaVu Sans', sans-serif";
/** Familias para endpoints y etiquetas: el equivalente a --font-mono. */
const FONT_MONO = "'IBM Plex Mono', 'DejaVu Sans Mono', monospace";

/** Paleta, copiada del tema oscuro de `src/styles/tokens.css`. */
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
 * Escapa texto para incrustarlo en un nodo XML.
 *
 * @param value Texto tal cual viene de `ui.ts` o de `servers.ts`.
 * @returns El mismo texto sin caracteres que puedan cerrar o abrir etiquetas.
 */
function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Rejilla de líneas de pelo, el mismo gesto que el fondo de jmrp.io. */
function grid(): string {
  const lines: string[] = [];
  for (let x = 0; x <= OG_IMAGE_SIZE.width; x += 60) {
    lines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${OG_IMAGE_SIZE.height}" />`,
    );
  }
  for (let y = 0; y <= OG_IMAGE_SIZE.height; y += 60) {
    lines.push(`<line x1="0" y1="${y}" x2="${OG_IMAGE_SIZE.width}" y2="${y}" />`);
  }
  return `<g stroke="${COLOR.grid}" stroke-width="1">${lines.join("")}</g>`;
}

/**
 * Construye el SVG de la tarjeta.
 *
 * @param lang Idioma de la tarjeta.
 * @returns Documento SVG completo, listo para rasterizar.
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
 * Rasteriza la tarjeta y comprueba que se han pintado glifos.
 *
 * La comprobación no es paranoia gratuita: si fontconfig no resuelve ninguna
 * familia, librsvg dibuja el fondo y las líneas y omite los textos SIN error.
 * La tarjeta quedaría en producción vacía y nadie lo vería, porque una imagen
 * social no la mira ningún test de la página. Comparar con el render de la
 * misma escena sin nodos `<text>` convierte ese fallo en un build roto.
 *
 * @param lang Idioma de la tarjeta.
 * @returns Bytes del PNG.
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
      `[og] la tarjeta ${lang} ha salido sin texto: quitar los <text> no cambia ni un byte del PNG.\n` +
        `Ninguna de las familias (${FONT_SANS} / ${FONT_MONO}) resuelve por fontconfig en esta máquina.\n` +
        `Instala una fuente sans y una mono (p. ej. fonts-dejavu-core) y vuelve a construir.`,
    );
  }
  return png;
}

/** Una ruta por idioma: `/og-en.png` y `/og-es.png`. */
export const getStaticPaths = (() =>
  LANGS.map((lang) => ({ params: { lang } }))) satisfies GetStaticPaths;

/**
 * Rasteriza y devuelve el PNG del idioma de la ruta.
 *
 * @param context Contexto de Astro; `params.lang` es el idioma de la tarjeta.
 * @returns Respuesta `image/png` con la tarjeta ya rasterizada.
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
