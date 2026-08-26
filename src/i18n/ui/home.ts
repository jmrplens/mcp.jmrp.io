/**
 * Home page strings: the hero, the comparison table and the server cards
 * (tools, prompts, per-client quick-start).
 *
 * Los nombres de los servidores, sus endpoints y los métodos MCP NO se
 * traducen: solo se traduce el texto que rodea a los datos de
 * `src/data/servers.ts`.
 */
export const home = {
  en: {
    pill: "servers · streamable HTTP",
    /**
     * Una frase que define MCP y nombra el dominio.
     *
     * El lede asume que el lector ya sabe qué es MCP; para el que llega desde
     * una pregunta genérica («¿qué es un servidor MCP?») este es el único
     * bloque autocontenido. Y lleva «mcp.jmrp.io» a propósito: los titulares
     * son genéricos («MCP servers»), así que sin la marca en el primer texto
     * extraíble, una cita de la página no dice de quién es.
     */
    whatIsMcp:
      "The Model Context Protocol (MCP) is an open standard that lets AI assistants use external tools and data sources; mcp.jmrp.io hosts two such servers, libgen and gitlab.",
    /**
     * Anchor text for the one outbound citation on this site that is not the
     * author's own. The sentence above calls MCP "an open standard" and
     * never says whose, or where it is written down — every other outbound
     * link on the home page points at jmrplens repositories.
     *
     * It renders INSIDE the same `<p>` as the definition (see
     * `HomePage.astro`), not in a block of its own, so the claim and its
     * source stay in one extractable chunk;
     * split apart, a retriever can lift the definition without the citation
     * and the citation stops doing its job. `whatIsMcp` itself is left
     * whole — see its own comment for why breaking it into fragments to
     * host an `<a>` would cost more than the link is worth.
     *
     * The href is the UNDATED `/specification`, which 307s to the current
     * revision; a dated one (`/specification/2026-07-28`) rots at the next
     * revision, and nothing in this repo checks outbound links.
     */
    specLink: "Read the specification at modelcontextprotocol.io",
    /**
     * Hero link to `/inspector/`.
     *
     * `common.lede` used to promise "try them right here in the browser"; now
     * that the inspector lives on its own page, the promise is fulfilled with
     * a real link instead of markup forced into the lede string (which is
     * also the meta description, the JSON-LD and llms.txt — see Ruling R6).
     */
    tryInBrowser: "Try them in the browser",
    serversEyebrow: "Servers",
    serversIntro:
      "Both servers speak streamable HTTP: one POST per JSON-RPC 2.0 call, stateless — no session header — answering JSON or an SSE stream depending on your Accept header (application/json, text/event-stream). A GET to an endpoint returns 405 by design.",
    /** The `/internals/` callout. The page it points at is the one that
     * answers "what actually happens to my request, and to my token" — the
     * question a hosted endpoint owes an answer to — and nothing on this
     * page pointed at it: it was reachable only from the header nav. The
     * eyebrow/lead/link split matches the other blocks here rather than
     * inventing a new shape, and the lead names the three things the page
     * proves (encryption, three instances, exit country) instead of saying
     * "learn more", which gives a reader nothing to decide with. */
    internalsEyebrow: "Under the hood",
    internalsTitle: "What happens to your request",
    internalsLead:
      "The whole path, drawn and explained: HTTPS all the way in and out, three instances per server with one always picked for you, and a fixed exit country — plus where a PRIVATE-TOKEN is readable, and where it never is.",
    internalsLink: "See how it works",
    machineIndex: "Machine-readable index",
    /** Same idea as `machineIndex`, for the `/llms.txt` pointer below it. */
    machineLlms: "Context index for AI assistants",

    repository: "Repository",
    documentation: "Documentation",
    credentialsRequired: "Credentials required",
    toolsHead: "Tools",
    promptsHead: "Prompts",
    promptsIntro:
      "Canned plans a client can render, beyond the tools above. Ask your assistant for one by name.",
    /**
     * Título del plegable de configuración por cliente. `{server}` se
     * sustituye por el nombre en ServerCard: las cadenas de este fichero son
     * estáticas y el nombre del servidor no se traduce.
     */
    clientHead: "How do I add {server} to an MCP client?",
    clientEnvHint:
      "In the JSON files the ${…} placeholders read the token from your environment — VS Code prompts for it and stores it itself — so the credential never lives in the file. In the command, replace <your token> by hand.",
    optionalHeaders: "Optional headers",
    noCredentials: "No credentials required",
    /**
     * Link from gitlab's security notice to `/internals/#affinity-h`: how
     * the token becomes a routing decision, with the real nginx directive
     * shown (salt value excluded). Added alongside the internals page
     * (Task 7) so the notice that raises the token question has somewhere
     * to answer it in full, instead of just asserting "it's not stored".
     */
    affinityLink: "How that hash is derived, with the code",
    /**
     * Replaces the old tools/prompts `<details>` folds on this card: they
     * moved to their own page (`/servers/<id>/`), one per server, with a
     * direct link into the inspector for each entry — see
     * `.superpowers/sdd/servers-section-spec.md`. This is the pointer from
     * the (now lighter) home card to that page.
     */
    viewServerCard: "View the full server card",
  },
  es: {
    pill: "servidores · streamable HTTP",
    /** Ver `en.whatIsMcp`: define MCP y ancla la marca al primer texto. */
    whatIsMcp:
      "El Model Context Protocol (MCP) es un estándar abierto que permite a los asistentes de IA usar herramientas y fuentes de datos externas; mcp.jmrp.io aloja dos de esos servidores, libgen y gitlab.",
    /**
     * Ver `en.specLink`: la cita de la especificación, dentro del mismo
     * párrafo que la definición.
     */
    specLink: "Lee la especificación en modelcontextprotocol.io",
    /** See `en.tryInBrowser`: hero link to `/inspector/`. */
    tryInBrowser: "Pruébalos en el navegador",
    serversEyebrow: "Servidores",
    serversIntro:
      "Ambos servidores hablan streamable HTTP: un POST por llamada JSON-RPC 2.0, sin estado — sin cabecera de sesión — respondiendo JSON o un stream SSE según tu cabecera Accept (application/json, text/event-stream). Un GET al endpoint devuelve 405 a propósito.",
    /** Ver `en.internalsEyebrow`. */
    internalsEyebrow: "Por dentro",
    internalsTitle: "Qué le pasa a tu petición",
    internalsLead:
      "El camino entero, dibujado y explicado: HTTPS a la ida y a la vuelta, tres instancias por servidor con una siempre elegida para ti y un país de salida fijo — y dónde se puede leer un PRIVATE-TOKEN y dónde no.",
    internalsLink: "Mira cómo funciona",
    machineIndex: "Índice para máquinas",
    /** Ver `en.machineLlms`: mismo patrón para el puntero a `/llms.txt`. */
    machineLlms: "Índice de contexto para asistentes de IA",
    repository: "Repositorio",
    documentation: "Documentación",
    credentialsRequired: "Requiere credenciales",
    toolsHead: "Herramientas",
    promptsHead: "Prompts",
    promptsIntro:
      "Planes listos que un cliente puede renderizar, además de las herramientas de arriba. Pídeselos a tu asistente por su nombre.",
    /** Ver `en.clientHead`: `{server}` lo sustituye ServerCard. */
    clientHead: "¿Cómo añado {server} a un cliente MCP?",
    clientEnvHint:
      "En los ficheros JSON, los marcadores ${…} leen el token de tu entorno — VS Code lo pide y lo guarda él mismo — así que la credencial nunca vive en el fichero. En el comando, sustituye <your token> a mano.",
    optionalHeaders: "Cabeceras opcionales",
    noCredentials: "No requiere credenciales",
    /** Ver `en.affinityLink`: enlace a `/internals/#affinity-h`. */
    affinityLink: "Cómo se deriva ese hash, con el código a la vista",
    /** Ver `en.viewServerCard`: enlace a la ficha completa del servidor. */
    viewServerCard: "Ver la ficha completa del servidor",
  },
} as const;
