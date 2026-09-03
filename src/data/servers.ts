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
  /**
   * Prefijo fijo del valor, cuando la cabecera lo lleva (p. ej. `"Bearer "`).
   *
   * Existe porque el valor de la cabecera dejó de ser la credencial a secas:
   * con `Authorization` es el esquema más el token. Lo antepone quien EMITE
   * (los fragmentos por cliente y el inspector); lo que teclea el visitante
   * sigue siendo solo el token, y por eso el `placeholder` no lo repite.
   */
  valuePrefix?: string;
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
  /**
   * What the notice is about, which picks the tone it is painted in.
   *
   * `access` was added last and is the only one that is not a caution. The
   * three before it — token policy, legal footing, limits — are the whole of
   * what the `FAQPage` graph and the `speakable` selectors nominate for
   * quotation, so the only structured answers this site offered an assistant
   * were disclaimers. A live search for the domain came back with the no-SLA
   * paragraph quoted verbatim under the heading "Important Note", which is
   * the investment working exactly as built and aimed entirely at talking a
   * reader out of it. Nothing answered "is it free" or "do I need an
   * account", which is what a reader arrives asking.
   */
  kind: "security" | "legal" | "limits" | "access";
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
 * but no crawler runs the inspector, and the 2026-08-22 audit found prompts
 * reaching no static surface at all: they are a differentiator against other
 * libgen MCP servers and nothing citable said so.
 *
 * They do reach that surface now, but by TWO routes and this type is only one
 * of them — the bilingual copy written by hand below. The other is the
 * committed Server Card snapshot (`src/data/cards/<id>.json`), which the
 * machine emitters fall back to for a server with no `prompts` here. So the
 * absence of this type on a server no longer means its prompts are invisible;
 * see the field's own doc for what it does mean.
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
   * What the Server Card says this server is called and does.
   *
   * Separate from `name`/`description` because the card answers to a schema
   * the site does not: `ServerDetail.description` has `maxLength: 100`, and
   * both cards were failing it (147 and 153 characters) while the site copy
   * they borrowed is fine where it lives. Shortening the page to satisfy a
   * JSON schema would have been the wrong trade.
   *
   * `title` is the running server's own `serverInfo.title`, read from a live
   * `initialize`. The discovery spec asks that the card's descriptive fields
   * "SHOULD NOT contradict" what the server reports, and calls a mismatch a
   * downgrade vector; before this, the card said `gitlab` while the server
   * said `GitLab MCP Server`.
   */
  card: { title: string; description: string };
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
  /**
   * What a plain GET to `endpoint` answers.
   *
   * Per server, because the two binaries disagree: libgen rejects the method
   * (405), while gitlab checks credentials before it checks the method and so
   * answers 401. Neither ever serves a page, which is the point every surface
   * needs to make — but stating one number for both was simply false.
   */
  getStatus: number;
  repo: string;
  /**
   * README del repositorio, y FALLBACK de `docsSite`.
   *
   * NO migrar a `https://jmrp.io/docs/<repo>` pese a la convención: esa URL
   * redirige al SITIO de documentación, que es otro recurso. Colapsar los dos
   * en una sola URL dejaría `docsSite` como campo muerto y el `??` sin
   * sentido. Y como este es el fallback para un MCP que no tenga sitio de
   * documentación, no debe depender del mapa de redirección de jmrp.io: una
   * entrada rota allí se llevaría por delante las dos rutas a la vez.
   */
  docs: string;
  /**
   * Sitio de documentación completo, si lo hay.
   *
   * Se escribe con la forma de convención `https://jmrp.io/docs/<repo>`
   * (decisión del autor, 2026-08-24) y no con la URL de GitHub Pages a la que
   * ese mapa redirige. El card SEP-1649 que sirve el propio libgen ya publica
   * esa forma en `websiteUrl`, así que mantener aquí la otra hacía que la
   * ficha pintara dos enlaces con URLs distintas al mismo destino.
   */
  docsSite?: string;
  /**
   * Listings that describe THIS DEPLOYMENT, not the software. They go in the
   * endpoint node's `sameAs`: these are the sites the models already crawl,
   * and linking them ties the entity to its mentions.
   *
   * THE TEST FOR ENTRY, and it has to be measured rather than assumed: the
   * listing must name `mcp.jmrp.io`. A `sameAs` the linked page does not
   * corroborate is worse than none — it asserts an identity anyone can check
   * is absent. Measure with a BROWSER, never with curl: mcp.so,
   * cursor.directory and mcpservers.org all render client-side, and curl
   * reported 0 for the three when mcpservers.org names the endpoint six times.
   *
   * What does NOT belong here, however well it describes the server: the
   * repository (linked through `isBasedOn`), package registries (npm, Docker
   * Hub, winget, the MCP registry) and listings that only cover the software.
   * Those belong to the `#software` node, which jmrp.io/projects/ defines and
   * which this graph reaches through `targetProduct`. Claiming one URL from
   * two different `@id`s tells a crawler the endpoint and the software are the
   * same thing — the very distinction this file maintains.
   */
  sameAs?: string[];
  /**
   * Cómo se obtiene la credencial cuando el servidor delega en OAuth, y no
   * sólo qué cabecera la transporta.
   *
   * Ausente = no hay flujo que documentar y el visitante aporta su propia
   * credencial (es el caso de libgen, que no pide ninguna). Presente = los
   * fragmentos por cliente emiten PRIMERO el flujo OAuth y dejan el token
   * pegado a mano como alternativa para headless y CI.
   *
   * `clientId` es público POR DISEÑO: viaja en la URL de autorización, a la
   * vista del navegador de cualquiera. Lo que nunca sale de aquí es el secreto
   * de la aplicación, que además esta no usa: es una app pública (PKCE).
   */
  oauth?: {
    /** Application ID de la aplicación OAuth registrada. */
    clientId: string;
    /** Quién emite los tokens. Es el `authorization_servers` del RFC 9728. */
    authorizationServer: string;
    /** Alcances que pide la aplicación. Los fija ella, no quien la usa. */
    scopes: string[];
    /** El documento RFC 9728 del recurso, para quien quiera comprobarlo. */
    metadataUrl: string;
    /**
     * Puerto de callback que hay que fijar en los clientes que lo permiten.
     * No es libre: tiene que coincidir con un redirect URI registrado en la
     * aplicación, y el de Claude Code es `http://localhost:<puerto>/callback`.
     */
    callbackPort: number;
    /**
     * A SECOND OAuth application, used by nothing but the inspector's sign-in
     * button, and registered with a read-only scope.
     *
     * It exists because the two callers want opposite things. An MCP client
     * needs `api`: it is there to do work, including writing. The inspector is
     * a page for looking at an endpoint, and handing a web page a token that
     * can write to someone's whole GitLab is a worse deal than the pasted
     * personal access token it would replace — a visitor can at least scope
     * that one to `read_api` themselves.
     *
     * With its own application the button becomes strictly the better option:
     * read-only, and gone in two hours, with nothing to create by hand.
     *
     * Absent = the button does not render at all. That is deliberate: a
     * half-configured sign-in is worse than none, and this way the feature can
     * ship before the application exists.
     */
    inspector?: {
      /** Application ID of the read-only app. Public, like the other one. */
      clientId: string;
      /** Registered redirect URI, matched character for character. */
      redirectUri: string;
      /** What it asks for. `read_api` — see the note above. */
      scopes: string[];
    };
  };
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
  /**
   * Copia CURADA y bilingüe de los prompts, la que pinta la página.
   *
   * Que falte significa "nadie ha escrito esa copia aquí", NO "este servidor
   * no tiene prompts". Leerlo del segundo modo es lo que dejó los 37 prompts
   * de gitlab fuera de /servers.json y de llms-full.txt mientras su ficha HTML
   * sí los listaba —esa los saca del Server Card, no de aquí—. Poblarlo para
   * gitlab exigiría inventar 74 textos que no existen en ninguna fuente, así
   * que quien emita prompts debe caer al Server Card guardado en
   * `src/data/cards/<id>.json` cuando este campo falte.
   */
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
  /**
   * El límite de peticiones de ESTE servidor, en una frase.
   *
   * No sustituye al aviso `limits` de arriba: ese vive en la ficha de la
   * portada, plegado y con el contexto entero. Esta es la versión corta que
   * pinta `/servers/<id>/`, que es la página a la que se llega desde un
   * resultado de búsqueda y donde no había ni una de las cuatro advertencias
   * que la portada considera imprescindibles. Escrita aparte y no recortando
   * el aviso: dos páginas con el mismo párrafo palabra por palabra le dan a
   * un recuperador dos trozos casi idénticos entre los que elegir, y elige él.
   *
   * Obligatorio, no opcional: un MCP nuevo sin límite declarado es
   * exactamente el que hay que declarar, aunque la respuesta sea "ninguno
   * propio" — como la de gitlab.
   */
  rateLimit: Bilingual;
};

export const servers: McpServer[] = [
  {
    id: "libgen",
    getStatus: 405,
    name: "libgen",
    registryName: "io.github.jmrplens/libgen-mcp",
    card: {
      title: "Books & Papers MCP Server",
      description:
        "Federated search of books and papers, BibTeX/RIS citations, open-access retrieval and reading.",
    },
    // libgen-mcp 1.6.3 (2026-08-22) started serving its own SEP-1649 Server
    // Card at `<endpoint>/.well-known/mcp/server-card.json`, same as gitlab —
    // verified live then: 200, application/json, ~33 KB, serverInfo
    // {"name":"libgen-mcp","version":"1.6.3"}. See `nativeCard` on `McpServer`
    // for what that flag actually does (announces it in the RFC 9727 catalog).
    nativeCard: true,
    version: "1.7.2",
    endpoint: "https://mcp.jmrp.io/libgen",
    repo: "https://github.com/jmrplens/libgen-mcp",
    docs: "https://github.com/jmrplens/libgen-mcp#readme",
    docsSite: "https://jmrp.io/docs/libgen-mcp",
    sameAs: [
      "https://glama.ai/mcp/servers/jmrplens/libgen-mcp",
      // Checked, not assumed: its listing names mcp.jmrp.io 21 times, so it
      // describes THIS deployment and not only the software.
      //
      // RE-MEASURED 2026-09-03 and it no longer holds: the URL now redirects
      // cross-host to market.lobehub.com, and that page — server-rendered, it
      // names the repository — mentions mcp.jmrp.io zero times. By the bar
      // this comment itself sets, the listing has become one about the
      // software rather than about this endpoint. Left in place pending the
      // author's call, since jmrp.io asserts the same URL on the `#software`
      // node, where it is unambiguously right.
      "https://lobehub.com/mcp/jmrplens-libgen-mcp",
      // Verified the same way, 2026-09-03: 30 mentions of mcp.jmrp.io, and
      // its <title> is "Books & Papers MCP Server · mcp.jmrp.io". It audits
      // the live endpoint rather than the repository.
      "https://verifymcp.io/servers/jmrplens-libgen-mcp/libgen",
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
        kind: "access",
        title: {
          en: "Does libgen cost anything, and do I need an account?",
          es: "¿libgen cuesta algo, y hace falta cuenta?",
        },
        body: [
          {
            en: "Neither. libgen takes no credential at all: no account here, no API key, no per-source registration. Every source it queries is open or public, and none of them asks you to sign up first, which is why the endpoint accepts a call from anyone who can reach it.",
            es: "Ninguna de las dos. libgen no pide credencial alguna: ni cuenta aquí, ni clave de API, ni registro por fuente. Todas las que consulta son abiertas o públicas y ninguna exige alta previa, y por eso el endpoint acepta una llamada de cualquiera que pueda alcanzarlo.",
          },
          {
            en: "The only ceiling is the rate limit described below, which is there to spend third-party capacity slowly rather than to ration yours.",
            es: "El único techo es el límite de peticiones descrito abajo, que existe para gastar despacio la capacidad de terceros, no para ponerte un cupo.",
          },
        ],
      },
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
            en: "libgen is a client of third-party public indexes: it queries open-access providers (arXiv, Crossref, OpenLibrary, Project Gutenberg, dblp, PubMed, ERIC, OpenAlex, Europe PMC, bioRxiv, the RFC Editor, NIST, Dagstuhl, the ACL Anthology, Zenodo, SciELO, FAO, Fatcat, OAPEN and the Internet Archive) and shadow-library sources — a Library Genesis mirror, Anna's Archive, Sci-Hub, SciDB and randombook.org. It hosts no catalogue and stores or redistributes no content of its own — `download` returns a link to the source, it does not serve the file.",
            es: "libgen es un cliente de índices públicos de terceros: consulta proveedores de acceso abierto (arXiv, Crossref, OpenLibrary, Project Gutenberg, dblp, PubMed, ERIC, OpenAlex, Europe PMC, bioRxiv, el RFC Editor, NIST, Dagstuhl, la ACL Anthology, Zenodo, SciELO, la FAO, Fatcat, OAPEN e Internet Archive) y fuentes de bibliotecas en la sombra — un mirror de Library Genesis, Anna's Archive, Sci-Hub, SciDB y randombook.org. No aloja catálogo alguno ni almacena o redistribuye contenido propio — `download` devuelve un enlace a la fuente, no sirve el fichero.",
          },
          {
            en: "What you do with those links is your responsibility, and the rules that apply depend on where you are.",
            es: "Lo que hagas con esos enlaces es responsabilidad tuya, y las normas aplicables dependen de dónde estés.",
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
            en: "Its outbound requests are rate-limited to about 2 per second per instance (3 instances, so roughly 6 per second in total) — one limiter for the whole process, covering catalogue queries and downloads alike, whichever source they reach. That ceiling is deliberately low: it points at third-party mirrors, and going faster would spend their capacity, not ours.",
            es: "Sus peticiones salientes están limitadas a unas 2 por segundo por instancia (hay 3 instancias, así que unas 6 por segundo en total) — un único limitador para todo el proceso, que cubre igual las consultas al catálogo y las descargas, sea cual sea la fuente a la que lleguen. Ese techo es deliberadamente bajo: apunta a servicios de terceros, y correr más gastaría su capacidad, no la nuestra.",
          },
        ],
      },
    ],
    // Concuerda con el aviso `limits` de arriba (2/s por instancia, 3
    // instancias): si cambia el techo, cambian los dos.
    rateLimit: {
      en: "Its outbound calls are capped at about 2 per second per instance, three instances in all — a single limiter per process, spanning catalogue queries and downloads whichever source they reach. The ceiling is deliberately low: the capacity it spends there belongs to a third party, not to this site.",
      es: "Sus llamadas salientes están limitadas a unas 2 por segundo por instancia, tres instancias en total — un solo limitador por proceso, que abarca las consultas al catálogo y las descargas sea cual sea la fuente. El techo es deliberadamente bajo: la capacidad que gastan ahí es de un tercero, no de este sitio.",
    },
    requiredHeaders: [],
    optionalHeaders: [],
    // El acceso abierto va PRIMERO por decisión de posicionamiento
    // (2026-08-08): la mitad open-access es la que cualquier asistente puede
    // citar y recomendar sin reparos, y liderar con Library Genesis hacía que
    // esa cautela se contagiara al servidor entero.
    //
    // Este texto es además la META DESCRIPTION de la ficha, y de ahí pasa a la
    // card, a /servers.json, al JSON-LD y a llms.txt: el techo duro son 155
    // caracteres, porque por encima Google lo trunca y el recorte cae donde él
    // decida. El ajuste de 2026-08-24 (219 → 153) sacrificó dblp, ERIC y los
    // cómics —que siguen nombrados en el aviso legal y en el `what` de
    // `search`— y subió "No account required" al frente, la única posición que
    // ningún truncado alcanza. Library Genesis sigue detrás de las fuentes
    // abiertas, que es lo que pide el párrafo de arriba. Al reescribirlo,
    // vuelve a contar los caracteres.
    description: {
      en: "No account required. Search, read and get download links for books and papers across arXiv, Crossref, OpenLibrary, Gutenberg, PubMed and Library Genesis.",
      es: "No requiere cuenta. Búsqueda, lectura y enlaces de descarga de libros y artículos en arXiv, Crossref, OpenLibrary, Gutenberg, PubMed y Library Genesis.",
    },
  },
  {
    id: "gitlab",
    getStatus: 401,
    name: "gitlab",
    registryName: "io.github.jmrplens/gitlab-mcp-server",
    card: {
      title: "GitLab MCP Server",
      description:
        "Free hosted GitLab MCP: 700+ operations with your own gitlab.com token, never written to disk.",
    },
    nativeCard: true,
    version: "2.7.5",
    endpoint: "https://mcp.jmrp.io/gitlab",
    repo: "https://github.com/jmrplens/gitlab-mcp-server",
    docs: "https://github.com/jmrplens/gitlab-mcp-server#readme",
    docsSite: "https://jmrp.io/docs/gitlab-mcp-server",
    sameAs: [
      "https://glama.ai/mcp/servers/jmrplens/gitlab-mcp-server",
      "https://mcpservers.org/servers/jmrplens/gitlab-mcp-server",
      // Same: 26 mentions of mcp.jmrp.io on its listing. See libgen's entry —
      // re-measured 2026-09-03, this one now names mcp.jmrp.io zero times too.
      "https://lobehub.com/mcp/jmrplens-gitlab-mcp-server",
      // 35 mentions of mcp.jmrp.io, <title> "GitLab MCP Server ·
      // mcp.jmrp.io", and it quotes this deployment's RFC 9728 document. It
      // is the listing that describes the endpoint most directly of any here.
      "https://verifymcp.io/servers/jmrplens-gitlab-mcp-server/gitlab",
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
        kind: "access",
        title: {
          en: "Does gitlab cost anything, and do I need an account?",
          es: "¿gitlab cuesta algo, y hace falta cuenta?",
        },
        body: [
          {
            en: "The endpoint is free and there is nothing here to sign up for. What it needs is a gitlab.com account you already have, because the server acts as you: it holds no account of its own and issues no credential, so there is no key to request and no plan to pick.",
            es: "El endpoint es gratuito y aquí no hay nada a lo que darse de alta. Lo que necesita es una cuenta de gitlab.com que ya tengas, porque el servidor actúa en tu nombre: no tiene cuenta propia ni emite credencial alguna, así que no hay clave que pedir ni plan que elegir.",
          },
          {
            en: "Whatever quota you spend is your own on gitlab.com, and what you can reach is whatever that token can reach — this server adds no tier of its own.",
            es: "La cuota que gastes es la tuya en gitlab.com, y lo que alcances es lo que alcance ese token: este servidor no añade ningún tier propio.",
          },
        ],
      },
      {
        kind: "security",
        title: {
          en: "Where does your GitLab token go?",
          es: "¿A dónde va tu token de GitLab?",
        },
        body: [
          {
            en: "Your token stays in your browser's memory only. It is not written to localStorage or cookies, never travels in the URL, and is gone on reload. It is sent solely as an Authorization: Bearer header to mcp.jmrp.io/gitlab, which never writes it to disk or logs it: the server keeps it in memory only while you keep using it — up to an hour after your last call — and then drops it.",
            es: "Tu token se queda solo en la memoria de tu navegador. No se guarda en localStorage ni en cookies, no viaja en la URL y desaparece al recargar. Se envía únicamente como cabecera Authorization: Bearer a mcp.jmrp.io/gitlab, que nunca lo escribe en disco ni lo registra: el servidor lo conserva en memoria solo mientras lo sigas usando —hasta una hora después de tu última llamada— y después lo descarta.",
          },
          // Cada afirmación con su respaldo real: la CSP prueba el DESTINO
          // (el navegador la aplica); lo que el servidor haga después no lo
          // prueba ninguna cabecera — se remite al código fuente, que es lo
          // único verificable. La versión anterior presentaba las dos cosas
          // bajo el mismo "no hace falta que te fíes", y eso sobre-vendía.
          {
            en: "The destination is not a matter of trust: this page's Content-Security-Policy declares connect-src 'self' https://gitlab.com and form-action 'self', so the browser itself refuses to send the token anywhere but this domain and the one that issues it. gitlab.com is on that list for exactly one reason — a sign-in button exchanging an authorization code for a token, currently disabled — and for nothing else. What the server then does with it — keep it in memory while you use it, re-check it with gitlab.com every fifteen minutes, and drop it — you can verify in its source code, which is public.",
            es: "El destino no es cuestión de confianza: la Content-Security-Policy de esta página declara connect-src 'self' https://gitlab.com y form-action 'self', así que es el propio navegador el que impide enviar el token a ningún sitio que no sea este dominio y el que lo emite. gitlab.com está en esa lista por una única razón —un botón de acceso canjeando un código de autorización por un token, ahora mismo desactivado— y por ninguna otra. Lo que el servidor haga después con él —conservarlo en memoria mientras lo uses, volver a comprobarlo con gitlab.com cada quince minutos y descartarlo—, puedes comprobarlo en su código fuente, que es público.",
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
            en: "Use the narrowest credential that does what you need. A token scoped to read_api is admitted and gets the read-only part of the surface: it cannot break anything, and it is the right one for trying the server out. api is only needed to reach the actions that write. The server decides per action, not once at the door, so asking for less is served less rather than refused.",
            es: "Usar la credencial más estrecha que te sirva. Un token con alcance read_api se admite y obtiene la parte de sólo lectura de la superficie: no puede romper nada, y es el adecuado para probar el servidor. api sólo hace falta para llegar a las acciones que escriben. El servidor decide acción por acción, no una vez en la puerta, así que pedir menos te sirve menos en lugar de rechazarte.",
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
            en: "Whatever quota applies is gitlab.com's, spent with your own token: this server adds no limit of its own beyond the site-wide one.",
            es: "La cuota que rige es la de gitlab.com, gastada con tu propio token: este servidor no añade más límite que el general del sitio.",
          },
        ],
      },
    ],
    // Concuerda con el aviso `limits` de arriba: el techo que aplica es el de
    // gitlab.com, que desde --auth-mode=oauth es la única instancia posible.
    rateLimit: {
      en: "It adds no quota of its own beyond the site-wide one: every call is spent against gitlab.com's limits, under your own token.",
      es: "No añade cuota propia más allá de la general del sitio: cada llamada se descuenta de los límites de gitlab.com, con tu propio token.",
    },
    oauth: {
      clientId:
        "c9431f281376dab9390349f60bed0503285786e19577df14a9c291c588b85941",
      authorizationServer: "https://gitlab.com",
      scopes: ["api"],
      metadataUrl:
        "https://mcp.jmrp.io/.well-known/oauth-protected-resource/gitlab",
      callbackPort: 8090,
      // DISABLED, not removed. The read-only application exists and is
      // registered correctly — the sign-in flow itself works end to end, and
      // GitLab issues the token — but this deployment refuses it at the door:
      //
      //   -40300  "This token does not carry the api scope that this
      //            deployment requires. Reauthorize the application
      //            requesting it."
      //
      // The scope the server demands is a property of the DEPLOYMENT, not of
      // the call. Its own guide says so: it asks for `read_api` "whenever
      // --read-only or --safe-mode is set", and this one is neither, because
      // MCP clients need to write. So a read-only token is refused even for
      // `initialize`, let alone `tools/list`.
      //
      // The three ways out, none of them ours alone:
      //   1. The server accepts `read_api` and gates per action — it already
      //      knows which ones are destructive, it publishes that flag for all
      //      747. Requested in the handoff to that repo.
      //   2. Give this application `api`, which is exactly the read/write
      //      token in a web page that the second application existed to avoid.
      //   3. A second, read-only deployment on its own path, just for the
      //      inspector. More moving parts than the feature is worth today.
      //
      // Uncommenting this line is all it takes once (1) ships.
      //
      // inspector: {
      //   clientId: "94649066fed1c053ad503a1addd3a86150e8f5eeb917965e713bcd2d662ace47",
      //   redirectUri: "https://mcp.jmrp.io/inspector/callback/",
      //   scopes: ["read_api"],
      // },
    },
    requiredHeaders: [
      {
        name: "Authorization",
        secret: true,
        valuePrefix: "Bearer ",
        placeholder: "glpat-…",
        description: {
          en: "Your gitlab.com credential, sent as Bearer: an OAuth access token, or a personal access token used the same way. Never written to disk or logged on the server.",
          es: "Tu credencial de gitlab.com, enviada como Bearer: un token de acceso OAuth, o un personal access token usado igual. Nunca se escribe en disco ni se registra en el servidor.",
        },
      },
    ],
    // Vacío desde que el despliegue pasó a --auth-mode=oauth: ese modo exige
    // una instancia FIJA (el documento RFC 9728 nombra un único servidor de
    // autorización), así que la cabecera `GITLAB-URL` por petición dejó de
    // honrarse. Anunciarla sería peor que no tenerla: quien la mandara no
    // recibiría error, simplemente se ignoraría.
    optionalHeaders: [],
    // Coverage goes in the description on purpose: "which GitLab MCP server
    // should I use?" is answered by comparing coverage, and it is the citable
    // fact that sets this one apart. From here the description reaches the
    // card, servers.json, the JSON-LD and llms.txt in one go.
    //
    // It says "over 700" rather than an exact figure, and the number moved
    // DOWN from "over 1,000" when the endpoint went OAuth-only. The reason is
    // not that the server lost anything: the catalog is scoped to the token
    // that asks, and this deployment now publishes what a gitlab.com token
    // sees. Measured on the day of the switch, the manifest went from 851
    // actions to 747 — the 104 that vanished are the administration domains a
    // gitlab.com account without admin rights simply cannot call.
    //
    // So 700 is a FLOOR that holds for every reader, where "over 1,000" was
    // only true on Ultimate and was contradicted by this site's own published
    // manifest (`/servers/gitlab/`, 747). A citable figure that the same site
    // refutes two clicks away is worse than a smaller one that never does —
    // and it is precisely the figure assistants repeat.
    //
    // It is also the page's META DESCRIPTION, so the hard ceiling is 155
    // characters — past that Google truncates and picks the cut itself. The
    // 2026-08-24 trim (191 → 139) dropped "releases" and "and more" from the
    // list of examples, releases being still named in `gitlab_execute_action`'s
    // `what`, so that EN and ES could carry the SAME four. Re-count the
    // characters on any rewrite: Spanish is the one that runs out of room.
    // It leads with the price and the account because that is the question a
    // reader arrives with and the one this string never answered. The single
    // occurrence of "free" on this page used to be "Counted with a Free-tier
    // GitLab token" — a fact about GitLab's pricing, which an extractor can
    // read as "you need a GitLab Free tier". libgen's description opens with
    // "No account required" and surfaces for the category query; this one
    // opened with the operation count and did not. The example list is down
    // to two abbreviated entries to pay for it, which is the trade: the count
    // and the domains are on the page and in the catalog, the price and the
    // signup are not stated anywhere else this string reaches.
    description: {
      en: "Free hosted GitLab MCP endpoint, no account beyond your own gitlab.com token, never written to disk. Over 700 operations: projects, MRs, pipelines.",
      es: "Endpoint MCP de GitLab alojado y gratuito, sin más cuenta que tu propio token de gitlab.com, que nunca se escribe en disco. Más de 700 operaciones.",
    },
  },
];
