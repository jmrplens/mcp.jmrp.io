/**
 * UnoCSS Configuration — mcp.jmrp.io
 *
 * Copia recortada de la de jmrp.io. Los cambios respecto al original:
 *
 * - `iconCollections` se reduce a las colecciones que este sitio podría usar.
 *   El original listaba ocho porque el sitio principal las usa; aquí cada
 *   colección extra sólo añade falsos positivos al extractor.
 * - `safelist` se vacía: sus entradas eran iconos de componentes de jmrp.io
 *   (Footer, Timeline, BrowserSupport, FileDownload…) que no existen en este
 *   repo. Además la safelist SÍ se resuelve en build, así que mantenerla
 *   obligaría a instalar los `@iconify-json/*` correspondientes para nada.
 *
 * Cuando se use el primer icono, instalar su colección:
 *   pnpm add -D @iconify-json/<collection>
 */
import { defineConfig, presetIcons, presetWind4 } from "unocss";

const iconCollections = ["mdi", "simple-icons"];

export default defineConfig({
  content: {
    filesystem: [
      "src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue,yaml,yml}",
    ],
  },
  extractors: [
    {
      name: "icon-extractor",
      extract(context) {
        const content = context.code;
        const icons = new Set<string>();
        const collectionsPattern = iconCollections.join("|");
        // Regex to find "collection:name" or i-collection:name
        const regex = new RegExp(
          String.raw`\b(${collectionsPattern}):([a-z0-9-]+)\b`,
          "gi",
        );

        let match;
        while ((match = regex.exec(content)) !== null) {
          icons.add(`i-${match[1].toLowerCase()}:${match[2].toLowerCase()}`);
        }
        return icons;
      },
    },
  ],
  safelist: [],
  presets: [
    presetWind4({
      // Disable built-in reset styles that override our custom typography in global.css
      preflights: {
        reset: false,
      },
    }),
    presetIcons({
      prefix: "i-",
      extraProperties: {
        display: "inline-block",
        "vertical-align": "middle",
      },
    }),
  ],
});
