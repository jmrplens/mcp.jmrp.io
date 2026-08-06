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
    optionalHeaders: "Optional headers",
    noCredentials: "No credentials required",
    inspector: "Inspector",
    inspectorIntro:
      "Query the servers straight from your browser. Pick one, call a method and read the raw JSON-RPC response.",
    inspectorCredentials:
      "Servers that need credentials show their header fields once you select them. Whatever you type there stays in this tab: it is sent with the request and never stored. Read the note below before pasting a token.",
    pill: "servers · streamable HTTP",
    lede: "Two Model Context Protocol servers, self-hosted and free to use. Point your MCP client at an endpoint, or try them right here in the browser.",
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
    optionalHeaders: "Cabeceras opcionales",
    noCredentials: "No requiere credenciales",
    inspector: "Inspector",
    inspectorIntro:
      "Consulta los servidores desde tu propio navegador. Elige uno, llama a un método y lee la respuesta JSON-RPC tal cual.",
    inspectorCredentials:
      "Los servidores que piden credenciales muestran sus campos al seleccionarlos. Lo que escribas ahí se queda en esta pestaña: viaja con la petición y no se guarda en ningún sitio. Lee la nota de abajo antes de pegar un token.",
    pill: "servidores · streamable HTTP",
    lede: "Dos servidores Model Context Protocol, self-hosted y de uso libre. Apunta tu cliente MCP a un endpoint, o pruébalos aquí mismo en el navegador.",
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
