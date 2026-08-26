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

    /**
     * ---- `server/discover` instructions ----------------------------------
     * The connect-time text the server hands every client, quoted verbatim
     * on its page from the committed surface snapshot (`src/data/surface.ts`).
     * It is DATA, not chrome, so it is never translated — the ES intro
     * carries "(en inglés)" for the same reason `cardDescriptionLabel` does.
     */
    instructionsHead: "Usage instructions",
    instructionsIntro:
      "What the server itself tells every client on connect (server/discover), quoted verbatim.",

    /**
     * ---- Subscriptions (gitlab) ------------------------------------------
     * Availability is per METHOD and per DEPLOYMENT: the page reads it from
     * the card's `subscriptions.methods` instead of asserting it here, and
     * the `requires`/`since_protocol` values it appends are verbatim server
     * data (English, like every other protocol identifier on these pages).
     */
    subscriptionsHead: "Subscriptions",
    subscriptionsIntro:
      "Whether a client can watch a resource for changes instead of polling it, and which of the URI templates above accept a subscription — those carry a chip.",
    subscriptionAvailable: "Available on this deployment",
    subscriptionUnavailable: "Not available on this deployment",
    subscriptionSinceProtocol: "since protocol",
    subscriptionRequiresLabel: "requires",
    subscribableTemplatesLabel: "Subscribable URI templates",
    subscribableChip: "subscribable",

    /**
     * ---- Action catalog (gitlab) -----------------------------------------
     * The by-domain count table plus the progressive search island over the
     * `gitlab://tools` manifest snapshot. `catalogTokenNote` is the caveat
     * that must stay ALWAYS visible: the manifest is scoped to the token
     * that asks (`cacheScope: "private"`), so every count on the page is the
     * Free tier's surface, not a universal one.
     */
    catalogHead: "Action catalog",
    catalogIntro:
      "Behind the tools above sits a catalog of fine-grained actions, invoked through gitlab_execute_action and published as the gitlab://tools resource. This table only counts it, by domain — the full list is the resource itself.",
    catalogTokenNote:
      "Counted with a Free-tier GitLab token. The catalog is scoped to the token that asks, so the count moves with both its tier and its permissions: higher tiers expose more actions, and administration domains only appear to tokens allowed to use them.",
    catalogTableCaption: "Actions by domain",
    catalogColDomain: "Domain",
    catalogColTotal: "Actions",
    catalogColDestructive: "Destructive",
    catalogColReadOnly: "Read-only",
    /** Row label for manifest entries that carry no `domain` field. */
    searchLabel: "Search the catalog",
    searchPlaceholder: "Filter by id, title or domain…",
    searchLoading: "Loading index…",
    searchError:
      "Could not load the index. The table above still counts every domain.",
    searchNoResults: "No actions match.",
    /** Rendered after the overflow count: `{n} more matches — …`. */
    searchMoreResults: "more matches — refine the query",
    /** aria-label of the search island's live results region. */
    searchResultsLabel: "Search results",
    /**
     * ---- Action-domain pages (/servers/<id>/actions/<domain>/) ------------
     * One page per manifest domain: the full reference list, one collapsed
     * `<details>` per action, with a progressive filter on top. Domain names
     * and action ids are protocol DATA and are never translated.
     */
    domainPageTitleSuffix: "actions · mcp.jmrp.io",
    domainPageKicker: "Action domain",
    /**
     * Meta description template; `{count}`/`{domain}` filled by the route.
     * Budgeted for the 155-char snippet ceiling at the longest domain name.
     */
    domainMetaDescription:
      "The {count} {domain} actions gitlab exposes via gitlab_execute_action, each with its full description and required parameters.",
    domainPageIntro:
      "Every action this domain exposes through gitlab_execute_action, from the gitlab://tools manifest. Each entry folds out to its full upstream description and required parameters.",
    domainBackToCard: "Back to the server card",
    domainFilterLabel: "Filter this domain's actions",
    domainFilterPlaceholder: "Type to filter by id, title or description…",
    domainFilterCount: "{shown} of {total} actions",
    domainFilterNoMatch: "No action matches. Clear the filter to see the full list.",
    domainChipDestructive: "destructive",
    domainChipReadOnly: "read-only",
    domainToggleDestructive: "Destructive only",
    domainToggleReadOnly: "Read-only only",
    domainParamsLabel: "Required parameters",
    domainNoParams: "No required parameters",
    /** Prefix of the alternative-requirements line (2.7.2's any_of groups). */
    domainAnyOfLabel: "At least one of",
    /** Joiner between alternative groups: "…, or …". */
    domainAnyOfJoiner: "or",
    /** Label of the alias marker; the target id follows as a link. */
    domainAliasOf: "alias of",
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

    /** Ver `en.instructionsHead`. */
    instructionsHead: "Instrucciones de uso",
    /** Ver `en.instructionsIntro`. Va "(en inglés)" porque la prosa es dato del servidor. */
    instructionsIntro:
      "Lo que el propio servidor le dice a cada cliente al conectar (server/discover), citado tal cual (en inglés).",

    /** Ver `en.subscriptionsHead`. */
    subscriptionsHead: "Suscripciones",
    /** Ver `en.subscriptionsIntro`. */
    subscriptionsIntro:
      "Si un cliente puede vigilar un resource en vez de sondearlo, y cuáles de las URI templates de arriba aceptan suscripción — esas llevan un chip.",
    /** Ver `en.subscriptionAvailable`. */
    subscriptionAvailable: "Disponible en este despliegue",
    /** Ver `en.subscriptionUnavailable`. */
    subscriptionUnavailable: "No disponible en este despliegue",
    /** Ver `en.subscriptionSinceProtocol`. */
    subscriptionSinceProtocol: "desde el protocolo",
    /** Ver `en.subscriptionRequiresLabel`. */
    subscriptionRequiresLabel: "requiere",
    /** Ver `en.subscribableTemplatesLabel`. */
    subscribableTemplatesLabel: "URI templates suscribibles",
    /** Ver `en.subscribableChip`. */
    subscribableChip: "suscribible",

    /** Ver `en.catalogHead`. */
    catalogHead: "Catálogo de acciones",
    /** Ver `en.catalogIntro`. */
    catalogIntro:
      "Detrás de las tools de arriba hay un catálogo de acciones de grano fino, invocadas vía gitlab_execute_action y publicadas como el resource gitlab://tools. Esta tabla solo lo cuenta, por dominio — la lista completa es el propio resource.",
    /** Ver `en.catalogTokenNote`. */
    catalogTokenNote:
      "Contado con un token Free de GitLab. El catálogo depende del token que pregunta, así que el recuento se mueve con su tier y con sus permisos: los tiers superiores exponen más acciones, y los dominios de administración solo aparecen a tokens autorizados a usarlos.",
    /** Ver `en.catalogTableCaption`. */
    catalogTableCaption: "Acciones por dominio",
    /** Ver `en.catalogColDomain`. */
    catalogColDomain: "Dominio",
    /** Ver `en.catalogColTotal`. */
    catalogColTotal: "Acciones",
    /** Ver `en.catalogColDestructive`. */
    catalogColDestructive: "Destructivas",
    /** Ver `en.catalogColReadOnly`. */
    catalogColReadOnly: "Solo lectura",
    /** Ver `en.searchLabel`. */
    searchLabel: "Buscar en el catálogo",
    /** Ver `en.searchPlaceholder`. */
    searchPlaceholder: "Filtra por id, título o dominio…",
    /** Ver `en.searchLoading`. */
    searchLoading: "Cargando índice…",
    /** Ver `en.searchError`. */
    searchError:
      "No se pudo cargar el índice. La tabla de arriba sigue contando todos los dominios.",
    /** Ver `en.searchNoResults`. */
    searchNoResults: "Ninguna acción coincide.",
    /** Ver `en.searchMoreResults`. */
    searchMoreResults: "coincidencias más — afina la búsqueda",
    /** Ver `en.searchResultsLabel`. */
    searchResultsLabel: "Resultados de la búsqueda",
    /** Ver el bloque `en.domainPage*`. */
    domainPageTitleSuffix: "acciones · mcp.jmrp.io",
    domainPageKicker: "Dominio de acciones",
    /** Ver `en.domainMetaDescription`. */
    domainMetaDescription:
      "Las {count} acciones {domain} que gitlab expone vía gitlab_execute_action, cada una con su descripción completa y sus parámetros.",
    domainPageIntro:
      "Todas las acciones que este dominio expone vía gitlab_execute_action, del manifiesto gitlab://tools. Cada entrada se despliega a su descripción completa y sus parámetros obligatorios.",
    domainBackToCard: "Volver a la ficha del servidor",
    domainFilterLabel: "Filtrar las acciones de este dominio",
    domainFilterPlaceholder: "Escribe para filtrar por id, título o descripción…",
    domainFilterCount: "{shown} de {total} acciones",
    domainFilterNoMatch: "Ninguna acción coincide. Borra el filtro para ver la lista completa.",
    domainChipDestructive: "destructiva",
    domainChipReadOnly: "solo lectura",
    domainToggleDestructive: "Solo destructivas",
    domainToggleReadOnly: "Solo de lectura",
    domainParamsLabel: "Parámetros obligatorios",
    domainNoParams: "Sin parámetros obligatorios",
    /** Ver `en.domainAnyOfLabel`. */
    domainAnyOfLabel: "Al menos uno de",
    domainAnyOfJoiner: "o",
    domainAliasOf: "alias de",
  },
} as const;
