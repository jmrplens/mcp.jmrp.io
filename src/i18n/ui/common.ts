/**
 * Site identity strings: shared by more than one page.
 *
 * `title`, `metaTitle` and `lede` are not only the home page's hero text:
 * `seo.ts`, `og-[lang].png.ts`, `llms.ts` and `jsonld.ts` all read them as the
 * SITE's own identity (the OG image caption, the llms.txt index line, the
 * JSON-LD `description`, the 404 page's fallback description), so they live
 * here rather than in `home.ts`. `subtitle` exists purely for those same
 * machine-readable surfaces — it is not rendered on the page itself.
 */
export const common = {
  en: {
    title: "MCP servers",
    /**
     * `<title>` del documento, SEPARADO del `title` visible.
     *
     * El H1 debe seguir siendo corto («MCP servers»); el del documento no: con
     * 21 caracteres se desperdiciaba la mitad del ancho que renderiza Google y
     * —peor— la expresión por la que de verdad se busca esto, «Model Context
     * Protocol», solo aparecía en la description. Los ~60 caracteres son el
     * presupuesto que Google muestra antes de recortar.
     */
    metaTitle: "MCP servers — free Model Context Protocol endpoints · jmrp.io",
    subtitle: "Self-hosted Model Context Protocol servers, free to use.",
    lede: "Two Model Context Protocol servers, self-hosted and free to use. Point your MCP client at an endpoint, or try them right here in the browser.",
    // Chrome strings: header, footer and the skip link. Every page renders
    // them through `Base.astro`.
    skip: "Skip to content",
    source: "Source",
    other: "Español",
    footerBy: "Servers and site by",
    footerUpdated: "Updated",
  },
  es: {
    title: "Servidores MCP",
    /** Ver `en.metaTitle`: título del documento, no el H1. */
    metaTitle:
      "Servidores MCP — Model Context Protocol de uso libre · jmrp.io",
    subtitle: "Servidores Model Context Protocol self-hosted, de uso libre.",
    lede: "Dos servidores Model Context Protocol, self-hosted y de uso libre. Apunta tu cliente MCP a un endpoint, o pruébalos aquí mismo en el navegador.",
    skip: "Saltar al contenido",
    source: "Código",
    other: "English",
    footerBy: "Servidores y sitio de",
    footerUpdated: "Actualizado",
  },
} as const;
