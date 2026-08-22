// @ts-check

import preact from "@astrojs/preact";
import sitemap from "@astrojs/sitemap";
import UnoCSS from "@unocss/astro";
import { defineConfig, fontProviders } from "astro/config";

import postBuild from "./src/integrations/post-build.ts";
import { contentDate } from "./src/lib/build-date.ts";

// La fecha del contenido sale del helper compartido con el JSON-LD y el pie:
// tres superficies, una sola verdad. Ver src/lib/build-date.ts para la regla
// (HEAD si el árbol está limpio, ahora si está sucio) y su porqué.
const LASTMOD = contentDate();

export default defineConfig({
  site: "https://mcp.jmrp.io",
  i18n: {
    defaultLocale: "en",
    locales: ["en", "es"],
    routing: { prefixDefaultLocale: false },
  },
  // postBuild va el ÚLTIMO: su hook `astro:build:done` transforma el `dist/`
  // que ya han escrito los demás (nonces, SRI, .conf de nginx, compresión).
  // Fuentes self-hosted por Astro, igual que jmrp.io. NO es opcional: los
  // tokens copiados definen --font-body como `var(--font-ibm-plex-sans), ...`,
  // y si esa variable no existe la declaración entera queda inválida en tiempo
  // de cómputo — el navegador ignora TODA la cadena de fallback y cae a Times
  // New Roman. Además, servirlas nosotros es lo que permite `font-src 'self'`.
  fonts: [
    {
      // Display: titulares.
      name: "Space Grotesk",
      provider: fontProviders.fontsource(),
      cssVariable: "--font-space-grotesk",
      weights: [500, 700],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap",
      fallbacks: ["sans-serif"],
      optimizedFallbacks: true,
    },
    {
      // Cuerpo: párrafos y texto de interfaz.
      name: "IBM Plex Sans",
      provider: fontProviders.fontsource(),
      cssVariable: "--font-ibm-plex-sans",
      weights: [400, 500],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap",
      fallbacks: ["sans-serif"],
      optimizedFallbacks: true,
    },
    {
      // Mono: etiquetas, endpoints, datos y el panel del inspector.
      name: "IBM Plex Mono",
      provider: fontProviders.fontsource(),
      cssVariable: "--font-ibm-plex-mono",
      weights: [400, 500, 600],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap",
      fallbacks: ["monospace"],
      optimizedFallbacks: true,
    },
  ],

  integrations: [
    preact(),
    // `i18n` hace que cada <url> del sitemap lleve sus `xhtml:link` con las dos
    // versiones. Sin ellos el sitemap declaraba el namespace xhtml y no lo
    // usaba, así que las anotaciones hreflang solo vivían en el <head> — y una
    // sola vía es una sola oportunidad de que Google agrupe bien el clúster.
    //
    // `x-default` is added in serialize because `i18n` has NO option for it:
    // it emits one xhtml:link per locale and nothing else. Without this the
    // <head> advertised en/es/x-default and the sitemap only en/es — two
    // channels contradicting each other about where to send a visitor with no
    // language preference. It points at the root, which is the EN version,
    // same as the <link> in the <head>.
    sitemap({
      i18n: { defaultLocale: "en", locales: { en: "en", es: "es" } },
      serialize: (item) => ({
        ...item,
        ...(LASTMOD && { lastmod: LASTMOD }),
        ...(item.links && {
          links: [
            ...item.links,
            { url: "https://mcp.jmrp.io/", lang: "x-default" },
          ],
        }),
      }),
    }),
    UnoCSS(),
    postBuild(),
  ],
  build: { format: "directory" },
});
