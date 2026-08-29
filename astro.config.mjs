// @ts-check

import preact from "@astrojs/preact";
import sitemap from "@astrojs/sitemap";
import UnoCSS from "@unocss/astro";
import { defineConfig, fontProviders } from "astro/config";

import postBuild from "./src/integrations/post-build.ts";
import { contentDate } from "./src/lib/build-date.ts";
import { DEFAULT_LANG } from "./src/lib/seo.ts";

// The content date comes from the helper shared with the JSON-LD and the
// footer: three surfaces, one single truth. See src/lib/build-date.ts for the
// rule (HEAD when the tree is clean, now when it is dirty) and its reasoning.
const LASTMOD = contentDate();

export default defineConfig({
  site: "https://mcp.jmrp.io",
  i18n: {
    defaultLocale: "en",
    locales: ["en", "es"],
    routing: { prefixDefaultLocale: false },
  },
  // postBuild goes LAST: its `astro:build:done` hook transforms the `dist/`
  // the others have already written (nonces, SRI, nginx .conf, compression).
  // Fonts self-hosted by Astro, the same as jmrp.io. It is NOT optional: the
  // copied tokens define --font-body as `var(--font-ibm-plex-sans), ...`, and
  // if that variable does not exist the whole declaration is invalid at compute
  // time — the browser ignores the ENTIRE fallback chain and drops to Times New
  // Roman. Serving them ourselves is also what allows `font-src 'self'`.
  fonts: [
    {
      // Display: headings.
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
      // Body: paragraphs and interface text.
      // `styles` includes "italic" so it matches jmrp.io (BaseHead.astro
      // there): without the real italic face, any future <em> or
      // font-style:italic would fall back to the browser's SYNTHETIC italic
      // (an oblique, not the real font) instead of being quietly correct —
      // there is no <em> in the content today, but declaring the complete
      // family closes the gap before it is needed.
      name: "IBM Plex Sans",
      provider: fontProviders.fontsource(),
      cssVariable: "--font-ibm-plex-sans",
      weights: [400, 500],
      styles: ["normal", "italic"],
      subsets: ["latin"],
      display: "swap",
      fallbacks: ["sans-serif"],
      optimizedFallbacks: true,
    },
    {
      // Mono: labels, endpoints, data and the inspector's panel.
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
    // `i18n` makes every sitemap <url> carry its `xhtml:link` entries with both
    // versions. Without them the sitemap declared the xhtml namespace and never
    // used it, so the hreflang annotations lived only in the <head> — and one
    // single channel is one single chance for Google to group the cluster.
    //
    // `x-default` is added in serialize because `i18n` has NO option for it:
    // it emits one xhtml:link per locale and nothing else. Without this the
    // <head> advertised en/es/x-default and the sitemap only en/es — two
    // channels contradicting each other about where to send a visitor with no
    // language preference.
    //
    // It must point at THIS ENTRY's own page in the default language, exactly
    // like `alternates()` does for the <head> — NOT at the site root for
    // every entry. Pointing everything at the root was fine while there was
    // only one page (root WAS the EN version of the only page), but that
    // premise is false now: the sitemap entry for `/inspector/` was still
    // declaring `x-default` → `/`, contradicting `/inspector/`'s own <head>,
    // which correctly self-references `/inspector/`.
    //
    // `item.links` already groups this entry with its sibling in the OTHER
    // language (see @astrojs/sitemap's `createGetI18nLinks`), so the entry
    // whose `lang` is the site's default IS the right x-default target — no
    // need to reconstruct the URL by hand.
    sitemap({
      i18n: { defaultLocale: "en", locales: { en: "en", es: "es" } },
      serialize: (item) => ({
        ...item,
        ...(LASTMOD && { lastmod: LASTMOD }),
        ...(item.links && {
          links: [
            ...item.links,
            {
              url:
                item.links.find((link) => link.lang === DEFAULT_LANG)?.url ??
                item.url,
              lang: "x-default",
            },
          ],
        }),
      }),
    }),
    UnoCSS(),
    postBuild(),
  ],
  build: { format: "directory" },
});
