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
    /**
     * Also the index's meta description (`src/pages/servers/index.astro`
     * hands it to `Base` verbatim), so it is kept inside the ~155-character
     * snippet window. What survives is what distinguishes this index from
     * any other list of servers — all four primitive kinds named, one page
     * per server, and the inspector link. What was cut is that the link
     * arrives preconfigured with the entry you clicked: that is a property
     * of the deep link a visitor discovers by using it, and spending
     * characters on it pushed the primitive names toward the cut.
     */
    ledeIndex:
      "Every tool, prompt, resource and resource template each MCP server publishes, one page per server, each entry linking straight into the inspector.",
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

    /**
     * "Service context" — the block a server card had none of.
     *
     * `/servers/libgen/` is 1,300 words of tools, prompts and arguments, and
     * carried not one of the four things this site treats as non-negotiable
     * about these endpoints: the rate limit, the legal position, the absence
     * of an SLA, and how many nodes sit behind them. All four are on the home
     * page — and a visitor arriving from a search result lands HERE, on the
     * page that answers "what can it do?" without ever answering "what
     * happens when I lean on it?".
     *
     * Three sentences and two links, not a second copy of `/policies/`: the
     * full statements have a page of their own, and repeating them verbatim
     * would hand a retriever two near-identical chunks and let it pick. The
     * rate-limit sentence is the one piece that differs per server, so it
     * comes from the data (`McpServer.rateLimit`) rather than from here.
     */
    contextHead: "Before you rely on this",
    contextService:
      "This endpoint is a personal service, run by one person and offered as-is: no SLA, no support channel, and no promise it is still here — or unchanged — next week. Both servers are open source and ship as a single static binary, so anything you cannot afford to lose is better run on your own instance.",
    contextRouting:
      "Behind the endpoint are three instances of this server. A consistent hash keeps sending the same client back to the same one, and each instance leaves for the outside world through a fixed country, Spain or the United Kingdom:",
    contextRoutingLink: "How a request is routed, hop by hop",
    contextPolicies:
      "What is logged and for how long, where a request appears to come from, and the legal footing under all of it are set out in full:",
    contextPoliciesLink: "Privacy, logging and legal position",

    /**
     * Label introducing the card's own `serverInfo.description`, shown
     * alongside — never replacing — this page's own bilingual intro
     * (`serverMeta.description`, which also feeds the meta description and
     * carries citable facts this site controls the wording of). The card's
     * description is SEP-1649 data the server itself publishes, English
     * only, so it is quoted as-is rather than translated.
     */
    cardDescriptionLabel: "In the server's own words",
    /** Link label for `serverInfo.websiteUrl`, alongside Repository/Documentation. */
    websiteLabel: "Official website",

    /** aria-label on a tool's behavioural-hint chip row (see the four `annotation*` labels below). */
    toolBehaviorLabel: "Behavior",
    /** `annotations.readOnlyHint` — does not modify anything outside the call. */
    annotationReadOnly: "read-only",
    /** `annotations.destructiveHint` — may perform destructive changes. The one chip that must stand out. */
    annotationDestructive: "destructive",
    /** `annotations.idempotentHint` — repeat calls with the same input have no extra effect. */
    annotationIdempotent: "idempotent",
    /** `annotations.openWorldHint` — talks to something outside this server (the network, another API). */
    annotationExternalNetwork: "external network",
  },
  es: {
    /** Ver `en.metaTitleIndex`. */
    metaTitleIndex: "Servidores MCP — cada tool, prompt y resource · mcp.jmrp.io",
    eyebrowIndex: "Servidores MCP",
    titleIndex: "Directorio de servidores",
    /** Ver `en.ledeIndex`: es también la meta description, de ahí la brevedad. */
    ledeIndex:
      "Todas las tools, prompts, resources y resource templates que publica cada servidor MCP, una página por servidor, con enlace directo al inspector.",
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

    /** Ver `en.contextHead`: las cuatro advertencias que la ficha no daba. */
    contextHead: "Antes de apoyarte en esto",
    contextService:
      "Este endpoint es un servicio personal, operado por una sola persona y ofrecido tal cual: sin SLA, sin canal de soporte y sin promesa de que siga en pie —o igual— la semana que viene. Los dos servidores son open source y son un único binario estático, así que lo que no puedas permitirte perder es mejor levantarlo en tu propia instancia.",
    contextRouting:
      "Detrás del endpoint hay tres instancias de este servidor. Un hash consistente hace que el mismo cliente vuelva siempre a la misma, y cada instancia sale hacia fuera por un país fijo, España o Reino Unido:",
    contextRoutingLink: "Cómo se enruta una petición, salto a salto",
    contextPolicies:
      "Qué se registra y durante cuánto tiempo, de dónde parece venir una petición y la base legal de todo ello están escritos enteros en:",
    contextPoliciesLink: "Privacidad, logs y postura legal",

    /** Ver `en.cardDescriptionLabel`. Va "(en inglés)" porque la card no se traduce. */
    cardDescriptionLabel: "En palabras del propio servidor (en inglés)",
    /** Ver `en.websiteLabel`. */
    websiteLabel: "Sitio web oficial",

    /** Ver `en.toolBehaviorLabel`. */
    toolBehaviorLabel: "Comportamiento",
    /** Ver `en.annotationReadOnly`. */
    annotationReadOnly: "solo lectura",
    /** Ver `en.annotationDestructive`. */
    annotationDestructive: "destructiva",
    /** Ver `en.annotationIdempotent`. */
    annotationIdempotent: "idempotente",
    /** Ver `en.annotationExternalNetwork`. */
    annotationExternalNetwork: "red externa",
  },
} as const;
