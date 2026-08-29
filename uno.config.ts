/**
 * UnoCSS Configuration — mcp.jmrp.io
 *
 * A trimmed copy of jmrp.io's. The changes from the original:
 *
 * - `iconCollections` is reduced to the collections this site could use. The
 *   original listed eight because the main site uses them; here every extra
 *   collection only adds false positives to the extractor.
 * - `safelist` is emptied: its entries were icons belonging to jmrp.io
 *   components (Footer, Timeline, BrowserSupport, FileDownload…) that do not
 *   exist in this repo. The safelist IS resolved at build time as well, so
 *   keeping it would force installing the matching `@iconify-json/*` packages
 *   for nothing.
 *
 * When the first icon is used, install its collection:
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
