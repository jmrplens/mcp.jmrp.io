/**
 * Inspector page strings: the section copy around the Preact island, and the
 * island's own labels (`insp.*`).
 *
 * Los identificadores del protocolo (`initialize`, `tools/list`,
 * `PRIVATE-TOKEN`, `tools`, `prompts`…) NO están aquí y no se traducen: son
 * exactamente lo que hay que teclear en un cliente MCP de verdad, y
 * traducirlos le enseñaría al visitante un nombre que no existe.
 */
export const inspector = {
  en: {
    /**
     * `<title>` of `/inspector/`.
     *
     * Named `inspectorMetaTitle`, not `metaTitle`: this module is flattened
     * into the merged `ui` object alongside `common`, which already owns
     * `metaTitle` for the home page. An unprefixed name here would collide —
     * silently dropping one of the two under the plain spread in `ui.ts` —
     * which is exactly what `i18n-modules.test.mjs` exists to catch.
     */
    inspectorMetaTitle: "Inspector — try the MCP servers in your browser · jmrp.io",
    /** The page's `<h1>`. Prefixed for the same reason as the keys above. */
    inspectorTitle: "Inspector",
    inspectorEyebrow: "Inspector",
    inspectorIntro:
      "Query the servers straight from your browser. Pick one, call a method and read the raw JSON-RPC response.",
    /** Link from `/inspector/` back to the home page. */
    backToHome: "Back to the servers",
    noticePointer:
      "Before pasting a credential, read the notice on that server's card above: it says exactly where the value goes and what the browser itself prevents.",
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
    /** See `en.inspectorMetaTitle`: document `<title>`, not the H1. */
    inspectorMetaTitle: "Inspector — prueba los servidores MCP en tu navegador · jmrp.io",
    /** The page's `<h1>`. Prefixed for the same reason as the keys above. */
    inspectorTitle: "Inspector",
    inspectorEyebrow: "Inspector",
    inspectorIntro:
      "Consulta los servidores desde tu propio navegador. Elige uno, llama a un método y lee la respuesta JSON-RPC tal cual.",
    /** See `en.backToHome`: link back to the home page. */
    backToHome: "Volver a los servidores",
    noticePointer:
      "Antes de pegar una credencial, lee el aviso en la ficha de ese servidor, arriba: dice exactamente a dónde va el valor y qué impide el propio navegador.",
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
