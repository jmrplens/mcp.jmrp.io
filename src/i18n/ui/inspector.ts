/**
 * Inspector page strings: the section copy around the Preact island, and the
 * island's own labels (`insp.*`).
 *
 * Los identificadores del protocolo (`initialize`, `tools/list`,
 * `Authorization`, `tools`, `prompts`…) NO están aquí y no se traducen: son
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
    inspectorMetaTitle:
      "Inspector — try the MCP servers in your browser · jmrp.io",
    /** The page's `<h1>`. Prefixed for the same reason as the keys above. */
    inspectorTitle: "Inspector",
    inspectorEyebrow: "Inspector",
    inspectorIntro:
      "Query the servers straight from your browser. Pick one, call a method and read the raw JSON-RPC response.",
    /** Link from `/inspector/` back to the home page. */
    /**
     * The notice it points at lives on the home page's server cards, not
     * here, so this has to be a link: saying "above" was leftover from when
     * the inspector shared a page with the cards.
     */
    noticePointer:
      "Before pasting a credential, read the notice on that server's card: it says exactly where the value goes and what the browser itself prevents.",
    noticePointerLink: "Read the gitlab notice",
    /**
     * The `<noscript>` fallback on `/inspector/`.
     *
     * Its own key, not part of `insp`: `insp` is handed to the Preact island,
     * and every string in there only ever reaches a browser that already ran
     * the JavaScript this block exists to replace. Shipping these six strings
     * inside the island's bundle would mean the one visitor who needs them is
     * the one visitor who never receives them.
     *
     * The copy NAMES libgen on purpose — `InspectorPage.astro` looks the
     * server up by that id, so the prose and the curl command below it cannot
     * drift apart without the page dropping the block entirely.
     */
    noscript: {
      title: "No JavaScript? Call a server directly",
      lead: "The inspector above needs JavaScript to talk to the servers. Without it, the same conversation fits in one command: this asks libgen — the server that requires no headers — for its catalogue of tools.",
      requestLabel: "Request",
      response:
        "The server answers with a JSON-RPC result whose tools array holds every tool it exposes, each with its name, its description and the JSON Schema of the arguments it accepts.",
      /**
       * Names only what libgen actually publishes. Its Server Card carries 4
       * tools and 4 prompts and ZERO resources or resource templates, and
       * `ServerPage.astro` renders a family only when it has entries — so
       * promising resources sent a visitor without JavaScript to a page that
       * has no such section. If libgen ever publishes them, this sentence
       * grows back.
       */
      more: "The same tools and prompts are written out in prose, no request needed, on",
      moreLink: "the libgen server page",
    },
    insp: {
      server: "Endpoint",
      needHeader: "Paste your credential before calling the server:",
      /**
       * The sign-in button and the note beside it. The note is not decoration:
       * this is the moment a visitor decides whether to hand a token to a web
       * page, so it says where the token goes, what it can do, and how to
       * check the claim rather than take it.
       */
      signInWith: "Sign in with GitLab",
      signInBusy: "Waiting for GitLab…",
      signInDenied: "GitLab refused the sign-in. Nothing was stored.",
      signInFailed: "The sign-in did not complete. Nothing was stored.",
      signInOr: "or paste one:",
      signInNote:
        "The token is read-only, expires in two hours, and lives in this tab's memory alone — no localStorage, no cookies, never in the address bar, gone on reload. It travels to gitlab.com to be issued and to this site's own endpoint to be used, nowhere else.",
      signInVerify: "How to check that yourself",
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
      emptyTools:
        "No tools loaded yet. Load them to see what this server can do.",
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
      toolListHint:
        "Run tools/list and the server's catalogue fills this list.",
      schemaTitle: "Arguments this tool accepts",
      schemaEmpty: "This tool declares no arguments.",
      /**
       * Identifier-group line (libgen 1.7.1 encodes "at least/exactly one
       * of" as anyOf/oneOf of required-branches — see requirementGroups).
       */
      groupAnyOf: "At least one of",
      groupOneOf: "Exactly one of",
      groupJoiner: "or",
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
      // `{s}` is the whole seconds left. Both say what to do next rather
      // than only what went wrong, and neither blames the reader: hitting
      // this is what anyone does when a call looks stuck.
      tooFast: "Slow down — one call every half second. Try again in {s}s.",
      cooling:
        "Paused for {s}s: too many calls in a row. Nothing was sent, and the servers are fine — this brake lives in your browser.",
      viewLabel: "Response view",
      viewFormatted: "Reader",
      viewRaw: "JSON",
      viewFormattedHint: "The response text, laid out.",
      viewRawHint: "The exact JSON-RPC body, as it arrived.",
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
    inspectorMetaTitle:
      "Inspector — prueba los servidores MCP en tu navegador · jmrp.io",
    /** The page's `<h1>`. Prefixed for the same reason as the keys above. */
    inspectorTitle: "Inspector",
    inspectorEyebrow: "Inspector",
    inspectorIntro:
      "Consulta los servidores desde tu propio navegador. Elige uno, llama a un método y lee la respuesta JSON-RPC tal cual.",
    /** Ver `en.noticePointer`: el aviso vive en la portada, así que va enlazado. */
    noticePointer:
      "Antes de pegar una credencial, lee el aviso en la ficha de ese servidor: dice exactamente a dónde va el valor y qué impide el propio navegador.",
    noticePointerLink: "Leer el aviso de gitlab",
    /** Ver `en.noscript`: el bloque que lee quien no ejecuta JavaScript. */
    noscript: {
      title: "¿Sin JavaScript? Llama al servidor directamente",
      lead: "El inspector de arriba necesita JavaScript para hablar con los servidores. Sin él, la misma conversación cabe en un solo comando: este le pide a libgen —el servidor que no exige cabeceras— su catálogo de tools.",
      requestLabel: "Petición",
      response:
        "El servidor responde con un resultado JSON-RPC cuyo array tools contiene todas las tools que expone, cada una con su nombre, su descripción y el JSON Schema de los argumentos que acepta.",
      /** Ver `en.noscript.more`: sin `resources`, que libgen no publica. */
      more: "Esas mismas tools y prompts están escritas en prosa, sin necesidad de lanzar ninguna petición, en",
      moreLink: "la página del servidor libgen",
    },
    /** Ver `en.insp`: los identificadores del protocolo se quedan en inglés. */
    insp: {
      server: "Servidor",
      needHeader: "Pega tu credencial antes de llamar al servidor:",
      /** Ver `en.signInWith`: el momento en que alguien decide entregar un token. */
      signInWith: "Entrar con GitLab",
      signInBusy: "Esperando a GitLab…",
      signInDenied: "GitLab rechazó el acceso. No se ha guardado nada.",
      signInFailed: "El acceso no se completó. No se ha guardado nada.",
      signInOr: "o pega uno:",
      signInNote:
        "El token es de solo lectura, caduca a las dos horas y vive únicamente en la memoria de esta pestaña — sin localStorage, sin cookies, nunca en la barra de direcciones, y desaparece al recargar. Viaja a gitlab.com para que lo emitan y al endpoint de este sitio para usarlo, a ningún otro sitio.",
      signInVerify: "Cómo comprobarlo tú mismo",
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
      emptyTools:
        "Aún no has cargado las tools. Cárgalas para ver qué sabe hacer este servidor.",
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
      toolListHint:
        "Lanza tools/list y el catálogo del servidor llena esta lista.",
      schemaTitle: "Argumentos que acepta esta tool",
      schemaEmpty: "Esta tool no declara argumentos.",
      /** Ver `en.groupAnyOf`. */
      groupAnyOf: "Al menos uno de",
      groupOneOf: "Exactamente uno de",
      groupJoiner: "o",
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
      /** See `en.tooFast`. */
      tooFast:
        "Más despacio — una llamada cada medio segundo. Reintenta en {s} s.",
      /** See `en.cooling`. */
      cooling:
        "En pausa {s} s: demasiadas llamadas seguidas. No se ha enviado nada y los servidores están bien — este freno vive en tu navegador.",
      /** See `en.viewLabel`. */
      viewLabel: "Vista de la respuesta",
      /** See `en.viewFormatted`. */
      viewFormatted: "Lectura",
      /** See `en.viewRaw`. */
      viewRaw: "JSON",
      /** See `en.viewFormattedHint`. */
      viewFormattedHint: "El texto de la respuesta, maquetado.",
      /** See `en.viewRawHint`. */
      viewRawHint: "El cuerpo JSON-RPC exacto, tal y como llegó.",
      timedOut:
        "Sin respuesta en 90 s — el inspector ha abandonado la petición.",
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
