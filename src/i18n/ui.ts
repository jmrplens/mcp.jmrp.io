/**
 * Cadenas de interfaz del sitio.
 *
 * Los nombres de los servidores, sus endpoints y los métodos MCP NO se
 * traducen: solo se traduce el texto que rodea a los datos de
 * `src/data/servers.ts`.
 */
export const ui = {
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
    repository: "Repository",
    documentation: "Documentation",
    credentialsRequired: "Credentials required",
    toolsHead: "Tools",
    serversIntro:
      "Both servers speak streamable HTTP: one POST per JSON-RPC 2.0 call, stateless — no session header — answering JSON or an SSE stream depending on your Accept header (application/json, text/event-stream). A GET to an endpoint returns 405 by design.",
    privacyEyebrow: "Privacy & data",
    // Visible freshness inside <main>: the footer carries the same date, but
    // readability prunes it and extractors saw the page as undated.
    updatedIn: "This page was last updated on",
    privacyBody: [
      "This service is run by José Manuel Requena Plens (jmrp.io), who is also the author of both servers. The site sets no cookies and runs no analytics scripts: the Content-Security-Policy forbids talking to any third party, and the browser enforces it.",
      "The web server keeps standard access logs — IP address, user agent, request path — for abuse prevention, rotated out after at most a year. Usage metrics record only the JSON-RPC method and tool name, never the arguments: what you search for is not part of any metric.",
      "Credentials you send travel as headers to the server you chose, are used for that request and are not persisted. Details, in the notice on each server's card.",
    ],

    noticePointer:
      "Before pasting a credential, read the notice on that server's card above: it says exactly where the value goes and what the browser itself prevents.",
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
    inspector: "Inspector",
    inspectorIntro:
      "Query the servers straight from your browser. Pick one, call a method and read the raw JSON-RPC response.",
    inspectorCredentials:
      "Servers that need credentials show their header fields once you select them. Whatever you type there stays in this tab: it is sent with the request and never stored. Read the note below before pasting a token.",
    pill: "servers · streamable HTTP",
    lede: "Two Model Context Protocol servers, self-hosted and free to use. Point your MCP client at an endpoint, or try them right here in the browser.",
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
    inspectorEyebrow: "Inspector",
    machineIndex: "Machine-readable index",
    /**
     * Cadenas de la isla del inspector.
     *
     * Los identificadores del protocolo (`initialize`, `tools/list`,
     * `PRIVATE-TOKEN`, `tools`, `prompts`…) NO están aquí y no se traducen:
     * son exactamente lo que hay que teclear en un cliente MCP de verdad, y
     * traducirlos le enseñaría al visitante un nombre que no existe.
     */
    insp: {
      server: "Endpoint",
      needHeader: "Fill in this header before calling the server:",
      noArgs: "This tool takes no arguments.",
      pickOne: "— choose —",
      omit: "— omit —",
      required: "required",
      tabTools: "Tools",
      tabPrompts: "Prompts",
      tabResources: "Resources",
      loadTools: "Load tools",
      loadPrompts: "Load prompts",
      loadResources: "Load resources",
      runTool: "Run tool",
      getPrompt: "Render prompt",
      readResource: "Read resource",
      emptyTools: "No tools loaded yet. Load them to see what this server can do.",
      emptyPrompts: "No prompts loaded yet.",
      emptyResources: "No resources loaded yet.",
      noneHere: "This server declares none.",
      pickTool: "Pick a tool to see what it takes.",
      pickPrompt: "Pick a prompt to fill in its arguments.",
      pickResource: "Pick a resource to read it.",
      argsJson: "Arguments as JSON",
      formMode: "Form",
      jsonMode: "JSON",
      handshake: "Connection",

      tool: "Tool",
      args: "Arguments (JSON)",
      chooseTool: "— pick a tool —",
      toolListHint: "Run tools/list and the server's catalogue fills this list.",
      schemaTitle: "Arguments this tool accepts",
      schemaEmpty: "This tool declares no arguments.",
      colName: "Name",
      colType: "Type",
      colWhat: "What it is",
      optional: "optional",
      missingHeader: "is required by this server",
      copy: "Copy",
      copied: "Response copied.",
      copyFailed: "The browser refused to write to the clipboard.",
      cancel: "Cancel",
      cancelled: "Cancelled by you.",
      timedOut: "No answer in 90 s — the inspector dropped the request.",
      responseLabel: "MCP response",
      statusIdle: "Nothing sent yet.",
      running: "running",
      ok: "OK",
      errTransport: "transport error",
      errRpc: "JSON-RPC error",
      errTool: "tool error",
      errClient: "not sent",
      badJson: "Arguments must be valid JSON",
      networkError: "The request never reached the server",
    },
  },
  es: {
    title: "Servidores MCP",
    /** Ver `en.metaTitle`: título del documento, no el H1. */
    metaTitle:
      "Servidores MCP — Model Context Protocol de uso libre · jmrp.io",
    subtitle: "Servidores Model Context Protocol self-hosted, de uso libre.",
    repository: "Repositorio",
    documentation: "Documentación",
    credentialsRequired: "Requiere credenciales",
    toolsHead: "Herramientas",
    serversIntro:
      "Ambos servidores hablan streamable HTTP: un POST por llamada JSON-RPC 2.0, sin estado — sin cabecera de sesión — respondiendo JSON o un stream SSE según tu cabecera Accept (application/json, text/event-stream). Un GET al endpoint devuelve 405 a propósito.",
    privacyEyebrow: "Privacidad y datos",
    updatedIn: "Esta página se actualizó por última vez el",
    privacyBody: [
      "Este servicio lo opera José Manuel Requena Plens (jmrp.io), autor también de los dos servidores. El sitio no usa cookies ni scripts de analítica: la Content-Security-Policy prohíbe hablar con terceros, y la aplica el navegador.",
      "El servidor web guarda logs de acceso estándar — dirección IP, user agent, ruta — para prevenir abusos, rotados como mucho al año. Las métricas de uso registran solo el método JSON-RPC y el nombre de la herramienta, nunca los argumentos: lo que buscas no forma parte de ninguna métrica.",
      "Las credenciales que envías viajan como cabeceras al servidor que elijas, se usan para esa petición y no se persisten. El detalle, en el aviso de la ficha de cada servidor.",
    ],

    noticePointer:
      "Antes de pegar una credencial, lee el aviso en la ficha de ese servidor, arriba: dice exactamente a dónde va el valor y qué impide el propio navegador.",
    /** Ver `en.clientHead`: `{server}` lo sustituye ServerCard. */
    clientHead: "¿Cómo añado {server} a un cliente MCP?",
    clientEnvHint:
      "En los ficheros JSON, los marcadores ${…} leen el token de tu entorno — VS Code lo pide y lo guarda él mismo — así que la credencial nunca vive en el fichero. En el comando, sustituye <your token> a mano.",
    optionalHeaders: "Cabeceras opcionales",
    noCredentials: "No requiere credenciales",
    inspector: "Inspector",
    inspectorIntro:
      "Consulta los servidores desde tu propio navegador. Elige uno, llama a un método y lee la respuesta JSON-RPC tal cual.",
    inspectorCredentials:
      "Los servidores que piden credenciales muestran sus campos al seleccionarlos. Lo que escribas ahí se queda en esta pestaña: viaja con la petición y no se guarda en ningún sitio. Lee la nota de abajo antes de pegar un token.",
    pill: "servidores · streamable HTTP",
    lede: "Dos servidores Model Context Protocol, self-hosted y de uso libre. Apunta tu cliente MCP a un endpoint, o pruébalos aquí mismo en el navegador.",
    /** Ver `en.whatIsMcp`: define MCP y ancla la marca al primer texto. */
    whatIsMcp:
      "El Model Context Protocol (MCP) es un estándar abierto que permite a los asistentes de IA usar herramientas y fuentes de datos externas; mcp.jmrp.io aloja dos de esos servidores, libgen y gitlab.",
    serversEyebrow: "Servidores",
    inspectorEyebrow: "Inspector",
    machineIndex: "Índice para máquinas",
    /** Ver `en.insp`: los identificadores del protocolo se quedan en inglés. */
    insp: {
      server: "Servidor",
      needHeader: "Rellena esta cabecera antes de llamar al servidor:",
      noArgs: "Esta tool no admite argumentos.",
      pickOne: "— elige —",
      omit: "— omitir —",
      required: "obligatorio",
      tabTools: "Tools",
      tabPrompts: "Prompts",
      tabResources: "Resources",
      loadTools: "Cargar tools",
      loadPrompts: "Cargar prompts",
      loadResources: "Cargar resources",
      runTool: "Ejecutar tool",
      getPrompt: "Renderizar prompt",
      readResource: "Leer resource",
      emptyTools: "Aún no has cargado las tools. Cárgalas para ver qué sabe hacer este servidor.",
      emptyPrompts: "Aún no has cargado los prompts.",
      emptyResources: "Aún no has cargado los resources.",
      noneHere: "Este servidor no declara ninguno.",
      pickTool: "Elige una tool para ver qué admite.",
      pickPrompt: "Elige un prompt para rellenar sus argumentos.",
      pickResource: "Elige un resource para leerlo.",
      argsJson: "Argumentos en JSON",
      formMode: "Formulario",
      jsonMode: "JSON",
      handshake: "Conexión",

      tool: "Tool",
      args: "Argumentos (JSON)",
      chooseTool: "— elige una tool —",
      toolListHint: "Lanza tools/list y el catálogo del servidor llena esta lista.",
      schemaTitle: "Argumentos que acepta esta tool",
      schemaEmpty: "Esta tool no declara argumentos.",
      colName: "Nombre",
      colType: "Tipo",
      colWhat: "Qué es",
      optional: "opcional",
      missingHeader: "es obligatoria en este servidor",
      copy: "Copiar",
      copied: "Respuesta copiada.",
      copyFailed: "El navegador no ha dejado escribir en el portapapeles.",
      cancel: "Cancelar",
      cancelled: "Cancelada por ti.",
      timedOut: "Sin respuesta en 90 s — el inspector ha abandonado la petición.",
      responseLabel: "Respuesta MCP",
      statusIdle: "Todavía no se ha enviado nada.",
      running: "en curso",
      ok: "OK",
      errTransport: "error de transporte",
      errRpc: "error JSON-RPC",
      errTool: "error de la tool",
      errClient: "no se ha enviado",
      badJson: "Los argumentos tienen que ser JSON válido",
      networkError: "La petición no llegó al servidor",
    },
  },
} as const;

export type Lang = keyof typeof ui;
