/**
 * `/servers/` index and `/servers/<id>/` detail page strings.
 *
 * Kept OUT of the merged `ui` object, like `internals` — see the header
 * comment on `src/i18n/ui.ts` for why. This module needs its own
 * `title`/`metaTitle`-shaped keys for BOTH the index and every server's
 * detail page, and `common` already owns those names for the site's own
 * identity; spreading this in would silently mask one or the other, exactly
 * the bug the `internals` precedent documents.
 *
 * The tool/prompt/resource/resource-template NAMES, TITLES, DESCRIPTIONS and
 * URIs rendered from `src/data/server-cards.ts` are NOT translated here: they
 * are a direct pass-through of what each server's SEP-1649 Server Card
 * publishes, which is English-only and identical in both languages — the
 * same convention `src/data/servers.ts`'s header comment already states for
 * tool names and endpoints ("Los nombres de los servidores, sus endpoints y
 * los métodos MCP NO se traducen"). Only the CHROME around that data — this
 * file — needs EN/ES parity.
 */
export const serversPage = {
  en: {
    metaTitleIndex: "MCP servers — every tool, prompt and resource · mcp.jmrp.io",
    eyebrowIndex: "MCP servers",
    titleIndex: "Server directory",
    ledeIndex:
      "Every tool, prompt, resource and resource template each MCP server publishes, one page per server, with a direct link into the inspector already set to whichever one you clicked.",
    indexEntryCta: "View the full server card",
    /** Link from a server's detail page back to this index. */
    backToServers: "Back to all servers",

    eyebrowServer: "MCP server card",
    /**
     * Appended after the server's own name to build the document `<title>`,
     * e.g. "gitlab — MCP server card · mcp.jmrp.io". The server name itself
     * is data (`McpServer.name`), not translated — see the module doc above.
     */
    metaTitleServerSuffix: "— MCP server card · mcp.jmrp.io",

    overviewHead: "Overview",
    serverInfoLabel: "Server name",
    versionLabel: "Version",
    endpointLabel: "Endpoint",
    authLabel: "Authentication",

    resourcesHead: "Resources",
    templatesHead: "Resource templates",
    templatesIntro:
      "Parameterised resources: the same shape as the resources above, with a placeholder in the URI a client fills in before reading it.",

    /**
     * Link from every tool/prompt/resource entry to the inspector,
     * preconfigured with that entry already selected. Resource templates
     * have no matching inspector tab (the deep link's `tab` is one of
     * tools/prompts/resources), so they render without this link.
     */
    tryInInspector: "Try in the inspector",

    tocLabel: "On this page",
    tocFabLabel: "On this page",
    /**
     * The TOC is rendered TWICE (desktop rail, mobile panel) — see
     * `ServerToc.astro`'s header comment for why. Only ever ONE of the two is
     * visible at any viewport width, but static analysis of the raw HTML
     * cannot know that: two `<nav>` landmarks with the SAME accessible name
     * fail html-validate's `unique-landmark` rule regardless. This gives the
     * panel copy its own label so both pass, without claiming they mean
     * anything different to a person who only ever encounters one of them.
     */
    tocPanelLabel: "On this page — menu",
    tocClose: "Close",

    requiredArg: "required",
    noArguments: "This prompt takes no arguments.",
    mimeTypeLabel: "Type",
    /** aria-label prefix for the compact chip index inside a long family. */
    chipIndexLabel: "Quick index",
  },
  es: {
    /** Ver `en.metaTitleIndex`. */
    metaTitleIndex: "Servidores MCP — cada tool, prompt y resource · mcp.jmrp.io",
    eyebrowIndex: "Servidores MCP",
    titleIndex: "Directorio de servidores",
    /** Ver `en.ledeIndex`. */
    ledeIndex:
      "Todas las tools, prompts, resources y resource templates que publica cada servidor MCP, una página por servidor, con un enlace directo al inspector ya configurado con el que hayas pulsado.",
    indexEntryCta: "Ver la ficha completa",
    /** Ver `en.backToServers`. */
    backToServers: "Volver a todos los servidores",

    eyebrowServer: "Ficha de servidor MCP",
    /** Ver `en.metaTitleServerSuffix`. */
    metaTitleServerSuffix: "— ficha de servidor MCP · mcp.jmrp.io",

    overviewHead: "Resumen",
    serverInfoLabel: "Nombre del servidor",
    versionLabel: "Versión",
    endpointLabel: "Endpoint",
    authLabel: "Autenticación",

    resourcesHead: "Resources",
    templatesHead: "Resource templates",
    /** Ver `en.templatesIntro`. */
    templatesIntro:
      "Resources parametrizados: la misma forma que los de arriba, con un hueco en la URI que rellena el cliente antes de leerlo.",

    /** Ver `en.tryInInspector`. */
    tryInInspector: "Probar en el inspector",

    tocLabel: "En esta página",
    tocFabLabel: "En esta página",
    /** Ver `en.tocPanelLabel`. */
    tocPanelLabel: "En esta página — menú",
    tocClose: "Cerrar",

    requiredArg: "obligatorio",
    noArguments: "Este prompt no lleva argumentos.",
    mimeTypeLabel: "Tipo",
    /** Ver `en.chipIndexLabel`. */
    chipIndexLabel: "Índice rápido",
  },
} as const;
