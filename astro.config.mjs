// @ts-check
import { execFileSync } from "node:child_process";

import preact from "@astrojs/preact";
import sitemap from "@astrojs/sitemap";
import UnoCSS from "@unocss/astro";
import { defineConfig, fontProviders } from "astro/config";

import postBuild from "./src/integrations/post-build.ts";

/**
 * Fecha del último commit, en ISO-8601, para el `lastmod` del sitemap.
 *
 * Se usa la fecha del commit y NO `new Date()` ni el mtime de los ficheros: con
 * la hora del build, cada despliegue —aunque no cambie una coma— anunciaría a
 * los buscadores que el contenido es nuevo, que es exactamente la señal que
 * hace que dejen de fiarse del campo. El mtime tampoco vale: un `git clone`
 * lo pone a la hora del checkout.
 *
 * Si no hay git (tarball, contenedor sin `.git`), se devuelve `undefined` y el
 * sitemap sale SIN `lastmod`. Un sitemap sin fecha es correcto; uno con una
 * fecha inventada, no.
 *
 * @returns {string | undefined} Fecha ISO del commit de HEAD, si se puede leer.
 */
function lastCommitDate() {
  try {
    return execFileSync("git", ["log", "-1", "--format=%cI"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return;
  }
}

const LASTMOD = lastCommitDate();

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
    sitemap({
      i18n: { defaultLocale: "en", locales: { en: "en", es: "es" } },
      serialize: (item) => (LASTMOD ? { ...item, lastmod: LASTMOD } : item),
    }),
    UnoCSS(),
    postBuild(),
  ],
  build: { format: "directory" },
});
