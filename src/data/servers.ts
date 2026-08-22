/**
 * Única fuente de verdad de la lista de servidores MCP.
 *
 * La consumen las páginas (`src/pages/index.astro`, `src/pages/es/index.astro`),
 * el índice para máquinas (`/servers.json`) y el inspector. Añadir un MCP nuevo
 * empieza SIEMPRE por una entrada aquí.
 */

export type McpHeader = {
  name: string;
  description: { en: string; es: string };
  /**
   * La cabecera lleva una credencial. El inspector pinta esos campos como
   * `type="password"` y nunca los persiste. Marcarlo aquí —y no por el nombre
   * de la cabecera— evita que un MCP nuevo se quede con el token a la vista.
   */
  secret?: boolean;
  /** Ejemplo que se muestra en el campo del inspector. Nunca un valor real. */
  placeholder?: string;
};

/** Texto en los dos idiomas del sitio. */
export type Bilingual = { en: string; es: string };

/**
 * Aviso que pertenece a UN servidor concreto.
 *
 * Va aquí y no en un bloque suelto de la página porque cada aviso solo aplica
 * a su servidor: la política del token es de gitlab y el descargo legal es de
 * libgen. Mezclarlos al final obligaba al visitante a averiguar cuál le
 * afectaba, y al añadir un tercer MCP habría empeorado.
 *
 * `kind` decide el tono con que se pinta, no el contenido.
 */
export type McpNotice = {
  kind: "security" | "legal" | "limits";
  title: Bilingual;
  /** Párrafos. Se pintan en orden. */
  body: Bilingual[];
  /** Puntos de una lista, si el aviso los necesita. */
  bullets?: Bilingual[];
};

/** Una herramienta que el servidor expone. */
export type McpToolInfo = {
  name: string;
  what: Bilingual;
};

/**
 * An MCP prompt the server exposes: a canned plan a client can render.
 *
 * Modelled separately from tools because it is a different capability of the
 * protocol. It is documented here because the inspector lists prompts live,
 * but no crawler runs the inspector — before this they appeared nowhere in the
 * static surface (card, /servers.json, llms-full.txt), which the 2026-08-22
 * audit flagged: they are a differentiator against other libgen MCP servers.
 */
export type McpPromptInfo = {
  name: string;
  what: Bilingual;
};

export type McpServer = {
  id: string;
  name: string;
  /**
   * Reverse-DNS identifier, the same one the official MCP registry lists.
   *
   * Not derivable from `repo`: the registry namespaces by the publisher's
   * GitHub identity, so it must match what is published there or a client
   * reconciling the Server Card against the registry sees two servers.
   */
  registryName: string;
  /**
   * FALLBACK version for the Server Card.
   *
   * The card prefers whatever the running server reports on `/health` at build
   * time (see `src/lib/live-version.ts`); this value is what it falls back to
   * when that read fails — an offline build, a stopped container, or a server
   * that does not publish a version.
   *
   * Even the live read cannot make the card authoritative: an update between
   * two site deploys still drifts. That is why the Server Card spec calls
   * cards "advisory rather than binding" and tells clients to prefer the live
   * `initialize` response where the two disagree.
   */
  version: string;
  endpoint: string;
  repo: string;
  docs: string;
  /** Sitio de documentación completo, si lo hay. */
  docsSite?: string;
  /**
   * Fichas de directorios MCP que describen ESTE servidor (Glama,
   * mcpservers.org…). Van al `sameAs` del nodo del endpoint: son los sitios
   * que los modelos ya rastrean, y enlazarlos une la entidad con sus
   * menciones. El repositorio NO va aquí — no es la misma entidad que el
   * endpoint; se enlaza vía `isBasedOn`.
   */
  sameAs?: string[];
  /** Cabeceras que el cliente DEBE enviar. Vacío = sin credenciales. */
  requiredHeaders: McpHeader[];
  optionalHeaders: McpHeader[];
  description: Bilingual;
  /**
   * Las herramientas que expone, con una línea de propósito.
   *
   * Sin esto la página no puede responder "¿sirve para crear un merge
   * request?", que es la pregunta que trae a la gente. `tools/list` lo dice,
   * pero obliga a una llamada en vivo que ningún buscador hace.
   */
  tools: McpToolInfo[];
  /** Prompts que expone, si los hay. */
  prompts?: McpPromptInfo[];
  /**
   * The server publishes its OWN Server Card at
   * `<endpoint>/.well-known/mcp/server-card.json`.
   *
   * That document is the SEP-1649 shape — it mirrors the `initialize`
   * response, so it enumerates every tool, prompt, resource and resource
   * template (41 KB for gitlab). It is NOT the same thing as the card this
   * site publishes at `<endpoint>/server-card`, which is the current SEP-2127
   * shape: small, carrying the reverse-DNS identity and how to connect, and
   * deliberately WITHOUT the primitives.
   *
   * So the two are complementary, not duplicates, and both get announced in
   * the RFC 9727 catalog. Flag per server because libgen does not implement it
   * yet — it answers 405 there.
   */
  nativeCard?: boolean;
  /** Avisos propios de este servidor. */
  notices: McpNotice[];
};

export const servers: McpServer[] = [
  {
    id: "libgen",
    name: "libgen",
    registryName: "io.github.jmrplens/libgen-mcp",
    version: "1.6.2",
    endpoint: "https://mcp.jmrp.io/libgen",
    repo: "https://github.com/jmrplens/libgen-mcp",
    docs: "https://github.com/jmrplens/libgen-mcp#readme",
    docsSite: "https://jmrplens.github.io/libgen-mcp/",
    sameAs: [
      "https://glama.ai/mcp/servers/jmrplens/libgen-mcp",
      "https://cursor.directory/plugins/libgen-mcp",
    ],
    tools: [
      {
        name: "search",
        what: {
          en: "Find books, papers, comics, magazines and standards, with metadata and download links.",
          es: "Busca libros, artículos, cómics, revistas y normas, con metadatos y enlaces de descarga.",
        },
      },
      {
        name: "get_details",
        what: {
          en: "Full metadata for one record: description, identifiers, DOI, cover, other editions.",
          es: "Metadatos completos de un registro: descripción, identificadores, DOI, portada y otras ediciones.",
        },
      },
      {
        name: "read",
        what: {
          en: "Extract and paginate the text of a book or paper, so a model can read it without downloading it whole.",
          es: "Extrae y pagina el texto de un libro o artículo, para que un modelo pueda leerlo sin descargarlo entero.",
        },
      },
      {
        name: "download",
        what: {
          en: "Resolve a download link from an md5, ISBN or DOI. Over HTTP it returns the link, it does not write files.",
          es: "Resuelve un enlace de descarga a partir de un md5, ISBN o DOI. Por HTTP devuelve el enlace, no escribe ficheros.",
        },
      },
    ],
    prompts: [
      {
        name: "acquire_book",
        what: {
          en: "Find a book across the catalogs and open-access sources, then generate step-by-step instructions to confirm and download the best matching edition.",
          es: "Busca un libro en los catálogos y las fuentes de acceso abierto, y genera instrucciones paso a paso para confirmar y descargar la mejor edición.",
        },
      },
      {
        name: "research_topic",
        what: {
          en: "Survey papers and books on a topic across the catalogs and open-access sources, then build a reading list with instructions to download and produce an annotated bibliography.",
          es: "Revisa artículos y libros sobre un tema en los catálogos y las fuentes de acceso abierto, y arma una lista de lectura con instrucciones para descargarlos y producir una bibliografía anotada.",
        },
      },
      {
        name: "get_paper",
        what: {
          en: "Resolve a specific paper by DOI or by a free-text citation and generate instructions to download it.",
          es: "Resuelve un artículo concreto por DOI o por una cita en texto libre y genera instrucciones para descargarlo.",
        },
      },
      {
        name: "download_troubleshoot",
        what: {
          en: "Diagnose a failed or stuck download and produce a step-by-step recovery plan tailored to the identifier, the enabled providers, and any error message.",
          es: "Diagnostica una descarga fallida o atascada y produce un plan de recuperación paso a paso según el identificador, los proveedores habilitados y el mensaje de error.",
        },
      },
    ],
    notices: [
      {
        kind: "legal",
        // Títulos únicos y con las palabras que la gente busca: se pintan como
        // <h3> dentro del <summary>, así que son las anclas por las que un
        // recuperador trocea la página. "Limits and availability" repetido
        // dos veces era ruido, no señal. Y en forma de PREGUNTA literal: el
        // primer párrafo es su respuesta directa, que es el par que los
        // motores de respuestas extraen — y el mismo que emite el FAQPage
        // del JSON-LD, que nace de estos avisos.
        title: {
          en: "Where does libgen search, and what is its legal position?",
          es: "¿Dónde busca libgen y cuál es su postura legal?",
        },
        body: [
          {
            en: "libgen is a client of third-party public indexes: it queries open-access providers (arXiv, Crossref, OpenLibrary, Gutenberg, dblp, PubMed, ERIC) and shadow-library sources — Library Genesis mirrors, Anna's Archive, Sci-Hub, SciDB and randombook.org. It hosts no catalogue and stores or redistributes no content of its own — `download` returns a link to the source, it does not serve the file.",
            es: "libgen es un cliente de índices públicos de terceros: consulta proveedores de acceso abierto (arXiv, Crossref, OpenLibrary, Gutenberg, dblp, PubMed, ERIC) y fuentes de bibliotecas en la sombra — mirrors de Library Genesis, Anna's Archive, Sci-Hub, SciDB y randombook.org. No aloja catálogo alguno ni almacena o redistribuye contenido propio — `download` devuelve un enlace a la fuente, no sirve el fichero.",
          },
          {
            en: "What you do with those links is your responsibility, and the rules that apply depend on where you are.",
            es: "Lo que hagas con esos enlaces es responsabilidad tuya, y las normas que apliquen dependen de dónde estés.",
          },
        ],
      },
      {
        kind: "limits",
        title: {
          en: "What are libgen's rate limits and availability?",
          es: "¿Qué límites de peticiones y disponibilidad tiene libgen?",
        },
        // El primer párrafo se parece al de gitlab a propósito solo en el
        // fondo, no en la letra: los recuperadores deduplican chunks casi
        // idénticos y descartan uno sin que controles cuál.
        body: [
          {
            en: "libgen at mcp.jmrp.io is a personal service, offered as-is and with no SLA. It may change or go away without notice, so do not build anything critical on top of it — run your own instance instead: the server is open source and a single static binary.",
            es: "libgen en mcp.jmrp.io es un servicio personal, ofrecido tal cual y sin SLA. Puede cambiar o desaparecer sin aviso, así que no montes nada crítico encima — levanta tu propia instancia: el servidor es open source y un único binario estático.",
          },
          {
            en: "Requests towards the Library Genesis mirrors are rate-limited to about 2 per second per instance (3 instances, so roughly 6 per second in total). That ceiling is deliberately low: it points at third-party mirrors, and going faster would spend their capacity, not ours.",
            es: "Las peticiones hacia los mirrors de Library Genesis están limitadas a unas 2 por segundo por instancia (hay 3 instancias, así que unas 6 por segundo en total). Ese techo es deliberadamente bajo: apunta a mirrors de terceros, y correr más gastaría su capacidad, no la nuestra.",
          },
        ],
      },
    ],
    requiredHeaders: [],
    optionalHeaders: [],
    // El acceso abierto va PRIMERO por decisión de posicionamiento
    // (2026-08-08): la mitad open-access es la que cualquier asistente puede
    // citar y recomendar sin reparos, y liderar con Library Genesis hacía que
    // esa cautela se contagiara al servidor entero.
    description: {
      en: "Keyless discovery across open-access sources — arXiv, Crossref, OpenLibrary, Gutenberg, dblp, PubMed, ERIC — plus search, reading and download links for books, papers and comics via Library Genesis. No account required.",
      es: "Descubrimiento sin claves en fuentes de acceso abierto — arXiv, Crossref, OpenLibrary, Gutenberg, dblp, PubMed, ERIC — más búsqueda, lectura y enlaces de descarga de libros, artículos y cómics vía Library Genesis. No requiere cuenta.",
    },
  },
  {
    id: "gitlab",
    name: "gitlab",
    registryName: "io.github.jmrplens/gitlab-mcp-server",
    nativeCard: true,
    version: "2.6.5",
    endpoint: "https://mcp.jmrp.io/gitlab",
    repo: "https://github.com/jmrplens/gitlab-mcp-server",
    docs: "https://github.com/jmrplens/gitlab-mcp-server#readme",
    docsSite: "https://jmrplens.github.io/gitlab-mcp-server/",
    sameAs: [
      "https://glama.ai/mcp/servers/jmrplens/gitlab-mcp-server",
      "https://mcpservers.org/servers/jmrplens/gitlab-mcp-server",
      "https://mcp.so/server/gitlab-mcp-server/jmrplens",
      "https://cursor.directory/plugins/gitlab-mcp-server",
    ],
    tools: [
      {
        name: "gitlab_find_action",
        what: {
          en: "Search the action catalogue by what you want to do. Read-only: it does not call GitLab.",
          es: "Busca en el catálogo de acciones por lo que quieres hacer. Solo lectura: no llama a GitLab.",
        },
      },
      {
        name: "gitlab_execute_action",
        what: {
          en: "Run one catalogue action: projects, merge requests, issues, pipelines, releases, runners, wikis and more.",
          es: "Ejecuta una acción del catálogo: proyectos, merge requests, incidencias, pipelines, releases, runners, wikis y más.",
        },
      },
    ],
    notices: [
      {
        kind: "security",
        title: {
          en: "Where does your GitLab token go?",
          es: "¿A dónde va tu token de GitLab?",
        },
        body: [
          {
            en: "Your token stays in your browser's memory only. It is not written to localStorage or cookies, never travels in the URL, and is gone on reload. It is sent solely as a PRIVATE-TOKEN header to mcp.jmrp.io/gitlab, which neither stores nor logs it: the server uses it for that request and forgets it.",
            es: "Tu token se queda solo en la memoria de tu navegador. No se guarda en localStorage ni en cookies, no viaja en la URL y desaparece al recargar. Se envía únicamente como cabecera PRIVATE-TOKEN a mcp.jmrp.io/gitlab, que no lo almacena ni lo registra: el servidor lo usa para esa petición y lo olvida.",
          },
          // Cada afirmación con su respaldo real: la CSP prueba el DESTINO
          // (el navegador la aplica); lo que el servidor haga después no lo
          // prueba ninguna cabecera — se remite al código fuente, que es lo
          // único verificable. La versión anterior presentaba las dos cosas
          // bajo el mismo "no hace falta que te fíes", y eso sobre-vendía.
          {
            en: "The destination is not a matter of trust: this page's Content-Security-Policy declares connect-src 'self' and form-action 'self', so the browser itself refuses to send the token anywhere but this domain. What the server then does — use it for that request and discard it — you can verify in its source code, which is public.",
            es: "El destino no es cuestión de confianza: la Content-Security-Policy de esta página declara connect-src 'self' y form-action 'self', así que es el propio navegador el que impide enviar el token a ningún sitio que no sea este dominio. Lo que el servidor haga después — usarlo para esa petición y descartarlo — puedes comprobarlo en su código fuente, que es público.",
          },
          {
            en: "Even so, be suspicious of any site asking for a token — this one included. The sensible habits are:",
            es: "Aun así, desconfía por norma de cualquier web que te pida un token, incluida esta. Lo razonable es:",
          },
        ],
        bullets: [
          {
            en: "Verify it yourself: this page's source is public, and so is the server's.",
            es: "Comprobarlo tú mismo: el código de esta página es público, y el del servidor también.",
          },
          {
            en: "Use the narrowest scope possible (read_api is enough to try it) and a short expiry.",
            es: "Usar un token con el mínimo alcance posible (read_api basta para probar) y caducidad corta.",
          },
          {
            en: "Revoke it when you are done testing.",
            es: "Revocarlo cuando termines de probar.",
          },
          {
            en: "Never reuse a token you rely on in production.",
            es: "No reutilizar nunca un token que uses en producción.",
          },
        ],
      },
      {
        kind: "limits",
        title: {
          en: "What are gitlab's rate limits and availability?",
          es: "¿Qué límites de peticiones y disponibilidad tiene gitlab?",
        },
        body: [
          {
            en: "The gitlab endpoint at mcp.jmrp.io is likewise personal, with no SLA and no continuity guarantee. For anything critical, run your own instance — the server is open source and ships as one static binary.",
            es: "El endpoint gitlab de mcp.jmrp.io es igualmente personal, sin SLA ni garantía de continuidad. Para algo crítico, levanta tu propia instancia — el servidor es open source y un único binario estático.",
          },
          {
            en: "Whatever quota applies is your GitLab instance's, spent with your own token: this server adds no limit of its own beyond the site-wide one.",
            es: "La cuota que aplique es la de tu instancia de GitLab, gastada con tu propio token: este servidor no añade más límite que el general del sitio.",
          },
        ],
      },
    ],
    requiredHeaders: [
      {
        name: "PRIVATE-TOKEN",
        secret: true,
        description: {
          en: "Your GitLab Personal Access Token. Never stored on the server.",
          es: "Tu Personal Access Token de GitLab. Nunca se guarda en el servidor.",
        },
      },
    ],
    optionalHeaders: [
      {
        name: "GITLAB-URL",
        placeholder: "https://gitlab.com",
        description: {
          en: "Another GitLab instance. Defaults to https://gitlab.com.",
          es: "Otra instancia de GitLab. Por defecto https://gitlab.com.",
        },
      },
    ],
    // Coverage goes in the description on purpose: "which GitLab MCP server
    // should I use?" is answered by comparing coverage, and it is the citable
    // fact that sets this one apart. From here the description reaches the
    // card, servers.json, the JSON-LD and llms.txt in one go.
    //
    // It says "over 1,000" rather than an exact figure for two reasons the
    // 2026-08-22 audit caught: the real number DEPENDS ON THE TIER (~847 on
    // Community Edition, up to 1071 on Ultimate), so a fixed one is false for
    // the "against any GitLab instance" this very sentence promises; and the
    // 1006 that used to be here came from the v1.0.x description in the MCP
    // registry, which upstream no longer publishes — its README and docs site
    // now say "1000+". A wrong citable figure is worse than none, because it
    // is precisely the one assistants repeat.
    description: {
      en: "A catalogue of over 1,000 GitLab operations — projects, merge requests, issues, pipelines, releases and more — against any GitLab instance. Your token travels per request and is never stored.",
      es: "Un catálogo de más de 1.000 operaciones de GitLab — proyectos, merge requests, incidencias, pipelines, releases y más — contra cualquier instancia de GitLab. Tu token viaja en cada petición y nunca se guarda.",
    },
  },
];
