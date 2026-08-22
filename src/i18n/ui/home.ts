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
    serversEyebrow: "Servers",
    serversIntro:
      "Both servers speak streamable HTTP: one POST per JSON-RPC 2.0 call, stateless — no session header — answering JSON or an SSE stream depending on your Accept header (application/json, text/event-stream). A GET to an endpoint returns 405 by design.",
    machineIndex: "Machine-readable index",
    // Comparison table strings. The table answers the question that actually
    // brings people to a hosted MCP endpoint — "which of these two do I
    // want?" — and it is a table on purpose: AI Overviews extracts tables
    // directly, and this page had none.
    compareHead: "Which of the two do I want?",
    compareIntro:
      "Both speak the same protocol over the same transport. What differs is what they reach and whether they ask you for a credential.",
    compareAttribute: "",
    compareEndpoint: "Endpoint",
    compareCredential: "Credential",
    compareTools: "Tools",
    compareTransport: "Transport",
    compareCovers: "Reaches",
    compareNoCredential: "None — it is public",
    compareTransportValue: "streamable HTTP, stateless",
    compareCoversLibgen: "Books and papers: open-access providers plus shadow-library sources",
    compareCoversGitlab: "Any GitLab instance, over its REST API",
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
  },
  es: {
    pill: "servidores · streamable HTTP",
    /** Ver `en.whatIsMcp`: define MCP y ancla la marca al primer texto. */
    whatIsMcp:
      "El Model Context Protocol (MCP) es un estándar abierto que permite a los asistentes de IA usar herramientas y fuentes de datos externas; mcp.jmrp.io aloja dos de esos servidores, libgen y gitlab.",
    serversEyebrow: "Servidores",
    serversIntro:
      "Ambos servidores hablan streamable HTTP: un POST por llamada JSON-RPC 2.0, sin estado — sin cabecera de sesión — respondiendo JSON o un stream SSE según tu cabecera Accept (application/json, text/event-stream). Un GET al endpoint devuelve 405 a propósito.",
    machineIndex: "Índice para máquinas",
    compareHead: "¿Cuál de los dos quiero?",
    compareIntro:
      "Los dos hablan el mismo protocolo sobre el mismo transporte. Lo que cambia es hasta dónde llegan y si te piden una credencial.",
    compareAttribute: "",
    compareEndpoint: "Endpoint",
    compareCredential: "Credencial",
    compareTools: "Tools",
    compareTransport: "Transporte",
    compareCovers: "Alcance",
    compareNoCredential: "Ninguna — es público",
    compareTransportValue: "streamable HTTP, sin estado",
    compareCoversLibgen: "Libros y artículos: proveedores de acceso abierto y fuentes de bibliotecas en la sombra",
    compareCoversGitlab: "Cualquier instancia de GitLab, por su API REST",
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
  },
} as const;
