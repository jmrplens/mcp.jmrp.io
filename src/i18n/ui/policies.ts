/**
 * Policies page strings: privacy, logging, availability, egress and the
 * legal position — everything the home page used to fold into one "Privacy
 * & data" section, now split into the subsections a visitor actually asks
 * about.
 *
 * Audited sentence by sentence against the running system on 2026-09-01
 * (the vhost and every `log_format`, logrotate, the Telegraf inputs, the
 * edge worker's config, the live server card of libgen, the compose env of
 * the instances). Every number and every named source in here comes from
 * that pass; the comments on each key say what was checked.
 *
 * Bodies are printed as plain text, so every link lives in its own key —
 * `credentialNotice`/`credentialNoticeLink`, `egressPointer`/
 * `egressPointerLink`, `legalContact`/`legalContactLink`,
 * `legalLicenseNote`/`legalLicenseLink`.
 */
export const policies = {
  en: {
    policiesMetaTitle:
      "Policies — privacy, logging and legal position · jmrp.io",
    /**
     * The page's `<h1>`. Prefixed like the rest of this module: these keys are
     * flattened into the shared `ui` object, where a bare `title` would
     * collide with the site identity one in `common.ts`.
     */
    policiesTitle: "Policies",
    /**
     * Kicker above the h1 (`.section-title`, "// POLICIES"), like jmrp.io's
     * PrivacyPage.astro/AboutPage.astro put one above every content page's
     * h1. Inspector already had `inspectorEyebrow` for the same slot; this
     * page had none, so its h1 sat with nothing above it.
     */
    policiesEyebrow: "Policies",
    /**
     * Meta description AND the page's opening paragraph — same reasoning as
     * `inspector.inspectorIntro`: one string serving both roles can't drift
     * out of sync with itself.
     */
    policiesIntro:
      "What these servers see and keep, what happens if the service goes down, where a request appears to come from, and the legal footing under all of it.",
    privacyEyebrow: "Privacy & data",
    /**
     * Three paragraphs: the operator and what the browser is allowed to do;
     * the one party in front of everything (Cloudflare — it decrypts every
     * request, as any CDN does, and the page said nothing about it while
     * /internals did); and how a credential travels. "Never written to disk
     * or logged", not "not stored": gitlab's hosted mode pools a per-token
     * entry in memory for up to an hour after the last call and re-validates
     * it against gitlab.com every fifteen minutes (its own PRIVACY.md and
     * `docker logs` say so), so "not stored" was the stdio-mode truth, not
     * this deployment's.
     *
     * The localStorage clause is there because "no cookies" alone was short
     * of the truth: the theme switch writes one value, first-party and never
     * sent. The Workers Logs sentence comes from the worker's own config
     * (`observability.enabled = true`, full sampling); the network-error
     * report is the `report-to`/`nel` pair Cloudflare adds at the edge for
     * the whole zone — the origin emits neither.
     */
    privacyBody: [
      "This service is run by José Manuel Requena Plens (jmrp.io), who is also the author of both servers. The site sets no cookies and runs no analytics scripts; the only thing it stores in your browser is the theme you pick, in localStorage, and that never leaves it. The Content-Security-Policy names exactly one third party — gitlab.com, and only so the inspector's sign-in flow can exchange an authorization code for a token, which is disabled right now — and the browser refuses every other destination.",
      "One party sits in front of all of it: Cloudflare, which fronts mcp.jmrp.io and decrypts and re-encrypts every request it forwards — page views and MCP calls alike — as any CDN does. It sees what this server sees, including an Authorization header on its way through. The edge script that mints this site's nonces only ever handles page reads — MCP calls bypass it entirely — and keeps no copy of any request, but Cloudflare's own logs of that script record the URL, method, status and request headers of each page request for a few days. The one report your browser may still send is a Cloudflare network-error report — only when a request to this site fails, with a connection error or a 4xx or 5xx response, only from Chromium browsers, and to Cloudflare, not to this server. Internals describes that hop.",
      "A credential you send travels as a request header to the server you chose and is never written to disk or logged. gitlab keeps it in memory while you keep using it — for up to an hour after your last call, checking every fifteen minutes with gitlab.com that it is still valid — and then drops it.",
    ],
    /**
     * The sentence this replaces ended "Details, in the notice on each
     * server's card" and pointed nowhere: that notice lives on the home
     * page's server cards, not on `/servers/<id>/`, and "card" is a term of
     * art on this site (`serversPage.eyebrowServer` is literally "MCP server
     * card"), so a reader following the site's own vocabulary was sent to
     * the one page that does not render it. `/inspector/` already hit this
     * and already solved it by linking — see `inspector.noticePointer`;
     * solving the same sentence two different ways would be the
     * inconsistency, not the fix.
     *
     * Split across two keys because `privacyBody` is printed as plain text
     * (`{paragraph}`), so an `<a>` cannot live inside the string. The prose
     * says "on the home page" out loud so the sentence stays true for anyone
     * who never clicks. It names the one case where libgen does ask for a
     * value: `download` with `annas_member` set asks the client for an
     * Anna's Archive membership key, because this deployment configures
     * none — the tool's own description says it is used for that request
     * only and never stored.
     */
    credentialNotice:
      "libgen needs none to be used at all; the one exception is opt-in: a download that sets annas_member asks your client for an Anna's Archive membership key, uses it for that request and never stores it. gitlab is the server that asks for a credential. Where that value goes, what the browser itself prevents, and how to scope and revoke it are set out in full in its security notice on the home page:",
    /**
     * Verbatim the `<h4>` of the notice it lands on, so the link text names
     * the question the anchor answers rather than describing it.
     */
    credentialNoticeLink: "Where does your GitLab token go?",
    logsEyebrow: "Logs and retention",
    /**
     * Fields as the vhost's `combined_enriched` format actually writes them
     * (the whole request line, so the query string too; the response size;
     * GeoIP looked up in a local MaxMind database). Purpose as it is: the
     * daily traffic report reads jmrp.io's log only, not this one; what reads
     * this one is CrowdSec and the Telegraf → InfluxDB → Grafana path. The
     * copy in the metrics database is named but given no retention period on
     * purpose (the owner's call, 2026-09-02): it varies, and a number here
     * would be the first thing to go stale. The third paragraph is gitlab's
     * own OpenTelemetry export (`GITLAB_MCP_TELEMETRY=true`, identity policy
     * `pseudonymous` under a key, endpoint on the LAN — `docker inspect` of
     * any gitlab instance); what it never records is its telemetry guide's
     * own list.
     */
    logsBody: [
      "The web server keeps standard access logs — IP address, user agent, the request line (method, path and query string), status code, response size, referrer, and the country, city and network operator that IP resolves to, looked up locally in a MaxMind database rather than by asking anyone — for abuse prevention (CrowdSec reads them) and for the author's own usage dashboards. The files are rotated daily and deleted after a year; the copy that feeds the dashboards lives on the author's own network and is kept no longer than that.",
      "The body of a call is never logged: it carries the arguments, which is to say whatever you actually searched for or asked — nginx inspects it only to pull out two names. Usage metrics record the JSON-RPC method, the tool name, the call's status, timing and response size, which instance and exit served it, and the caller's IP address — which is there so the author can tell their own test traffic from real use — but never the arguments, and never the content of the response. Those metrics feed the same dashboards.",
      "gitlab additionally exports OpenTelemetry traces and metrics to a collector on the author's network: the method, the tool and the catalogue action (issue.list, say), success or the error code, timings, and a keyed pseudonym of the caller and of any resource read — stable across restarts, readable by no one — but never the arguments, the results, the token or any GitLab response.",
    ],
    slaEyebrow: "No SLA",
    slaBody: [
      "This is a personal service, offered as-is with no service-level agreement: no uptime guarantee, no support channel, and no commitment that either endpoint stays online — or unchanged — from one day to the next. Do not build anything critical on top of it; both servers are open source, and running your own instance is one static binary away.",
    ],
    egressEyebrow: "Where a request appears to come from",
    /**
     * This page owns the consequence — what a third party sees, and in which
     * country — and /internals owns the mechanism and the count of nodes,
     * which is why "three" is no longer said here: /internals' header comment
     * lists the places that must move with that number, and this file was
     * not one of them. "Spain or the United Kingdom" is what stays true
     * through a failover; the node does not.
     *
     * The link-handed-back exception is real: over HTTP `download` always
     * returns a direct link, and fetching it is the caller's own connection.
     * Read on its own — and extractors read it on its own — the paragraph
     * used to claim the opposite.
     */
    egressBody: [
      "Calls the servers make outward — to a Library Genesis mirror, the open-access providers, or gitlab.com — leave through an exit node in Spain or the United Kingdom, not from wherever you or this site happen to be. What that third party sees as the source of the request is the exit node's address: neither your own IP address nor this server's ever reaches it. The one transfer that does not go this way is the one behind a link handed back to you — download's above all: fetching it is your own client's connection, from your own address.",
    ],
    /** Pointer to the section of /internals that owns the mechanism; the link text is that section's h2, verbatim. */
    egressPointer:
      "Which nodes there are, which instance leaves through which, and what happens when one fails are described under Internals:",
    egressPointerLink: "Egress: which exit a request leaves from",
    legalEyebrow: "Legal position",
    /**
     * Five paragraphs — scope, order, mechanism, responsibility, operator —
     * each written to survive being extracted on its own: a retriever that
     * lifts only the middle one should still come away with the whole
     * mechanism.
     *
     * Naming less surface than you actually touch is not the cautious
     * position, it is the weak one. The scope paragraph therefore names every
     * source the live server card of libgen-mcp 1.7.2 declares — twenty open
     * ones and five shadow-library ones — where the text used to name nine
     * and three; `download`'s DOI chain alone reaches thirteen open sources
     * before Sci-Hub.
     *
     * The ORDER belongs to the tool and not to the server, and to THIS
     * deployment: the instances run with `LIBGEN_MCP_EXTRA_SOURCES=always`,
     * so `search` reaches Anna's Archive and the seven open providers on
     * every call unless the caller says `never` — the text used to describe
     * the binary's default (`auto`), which is not what runs here.
     *
     * The mechanism paragraph distinguishes `download` from `read` on
     * purpose, and says that `read` keeps what it fetched in a cache on the
     * instance: that cache holds the file itself, and a legal position that
     * kept quiet about it said less than what happens. The defensible claim,
     * and the one that carries the legal weight, is that this host publishes
     * no catalogue and offers no file to anyone else.
     */
    legalBody: [
      "libgen runs no catalogue and hosts nothing of its own: it is a client of indexes and libraries other people operate. On the open side those are arXiv, Crossref, OpenLibrary, Project Gutenberg, dblp, PubMed, ERIC, OpenAlex, Europe PMC, bioRxiv, the RFC Editor, NIST, Dagstuhl, the ACL Anthology, Zenodo, SciELO, FAO, Fatcat, OAPEN and the Internet Archive; on the shadow-library side, a Library Genesis mirror, randombook.org, Anna's Archive, Sci-Hub, and the SciDB article viewer Anna's Archive runs. Which of them a call reaches, and in what order, is a property of the tool you call rather than of the service as a whole.",
      "search starts from the Library Genesis catalogue; on this deployment the operator's default is extra_sources=always, so a call that does not say otherwise also reaches Anna's Archive and seven open providers — arXiv, Crossref, OpenLibrary, Project Gutenberg, dblp, PubMed and ERIC — on every call, and a call that sets extra_sources=never keeps to the catalogue alone.",
      "download and read go by identifier instead, and read takes a hash or a DOI only. Which sources an identifier reaches, and in what order, follows from which identifier it is:",
    ],
    /**
     * The resolution order of `download`/`read`, by identifier.
     *
     * It used to be one 115-word sentence inside `legalBody` that chained the
     * three cases together — the least readable passage on the site, on the
     * page that most needs to be clear. Same facts, same sources, same order;
     * only the shape changed, to the labelled-steps pattern /internals/
     * already uses for its failure ladders.
     */
    legalResolution: [
      {
        label: "An article asked for by DOI",
        steps: [
          "Thirteen open sources first: OpenAlex, Europe PMC, bioRxiv, the RFC Editor, NIST, Dagstuhl, the ACL Anthology, Zenodo, SciELO, FAO, Fatcat, Crossref and OAPEN.",
          "Sci-Hub, only when none of those serves it.",
          "SciDB, only when Sci-Hub does not either.",
        ],
      },
      {
        label: "A book asked for by ISBN",
        steps: [
          "OAPEN and the Internet Archive, and nowhere else: both serve openly licensed copies and nothing more.",
        ],
      },
      {
        label: "A book asked for by its catalogue hash",
        steps: [
          "The Library Genesis mirror first. A catalogue hash is the shadow libraries' own identifier, so a request carrying one goes straight to them.",
          "randombook.org, when the mirror does not serve it.",
          "Anna's Archive, when neither of those does.",
        ],
      },
    ],
    /** Closes the block above: where each tool states this order itself. */
    legalResolutionTail:
      "get_details adds Crossref and OpenLibrary metadata on request, and falls back to Anna's Archive for a hash the catalogue does not carry. download states that order in its own description, and read lists its sources in its source parameter, on libgen's server card.",
    /** The rest of the legal position, after the resolution block. */
    legalBodyTail: [
      "libgen's download tool never delivers a file over HTTP, which is the only way this endpoint is reached: it resolves the identifier you gave it and hands back a link to whichever source holds the item, for your own client to fetch. Its read tool does fetch the file, to return the slice of text you asked for, and keeps what it fetched in a cache on the instance that served you. Either way, mcp.jmrp.io publishes no catalogue and offers no file for anyone else to fetch: the transfer, if you make it, is between you and that third party.",
      "What you do with the links libgen returns is your responsibility, under whichever law applies to you. gitlab does nothing more than relay calls to gitlab.com with the credential you supply, and grants no right beyond what gitlab.com already grants you.",
      "This service is operated from Spain by a private individual, not a company, and is not affiliated with any of the sources named above: it only queries them, and their names belong to their owners.",
    ],
    /**
     * The address is the one security.txt and every footer already print in
     * clear. Naming it HERE matters because `slaBody` says "no support
     * channel": a takedown request or a question about this page is not
     * support, and a reader should not conclude the footer address is not
     * for that.
     */
    legalContact:
      "Questions about this page, and requests that this host stop resolving a given item or source, go to the address in the site's security.txt:",
    legalContactLink: "mail@jmrp.io",
    /** Cross-link to /license/, which links back to this section. Ends in a colon so the link completes the sentence. */
    legalLicenseNote:
      "None of this is a license over anything: what this site itself lets you reuse — its text, its code and the two servers — is stated on its own page:",
    legalLicenseLink: "License",
  },
  es: {
    policiesMetaTitle: "Políticas — privacidad, logs y postura legal · jmrp.io",
    /** Ver `en.policiesTitle`: el `<h1>` de la página. */
    policiesTitle: "Políticas",
    /** Ver `en.policiesEyebrow`: kicker encima del h1. */
    policiesEyebrow: "Políticas",
    /** Ver `en.policiesIntro`: sirve de meta description y de párrafo inicial. */
    policiesIntro:
      "Qué datos ven y guardan estos servidores, qué pasa si el servicio se cae, de dónde parece venir una petición, y la postura legal de todo ello.",
    privacyEyebrow: "Privacidad y datos",
    /** Ver `en.privacyBody`: operador y navegador; Cloudflare; la credencial. */
    privacyBody: [
      "Este servicio lo opera José Manuel Requena Plens (jmrp.io), autor también de los dos servidores. El sitio no usa cookies ni scripts de analítica; lo único que guarda en tu navegador es el tema que elijas, en localStorage, y de ahí no sale. La Content-Security-Policy nombra exactamente un tercero —gitlab.com, y solo para que el flujo de acceso del inspector pueda canjear un código de autorización por un token, que ahora mismo está desactivado— y el navegador rechaza cualquier otro destino.",
      "Delante de todo ello hay un tercero: Cloudflare, que da la cara por mcp.jmrp.io y descifra y vuelve a cifrar cada petición que reenvía —páginas y llamadas MCP por igual—, como cualquier CDN. Ve lo mismo que ve este servidor, incluida una cabecera Authorization de paso. El script de borde que acuña los nonces de este sitio solo atiende lecturas de páginas —las llamadas MCP no pasan por él— y no guarda copia de ninguna petición, pero los logs que Cloudflare lleva de ese script registran la URL, el método, el estado y las cabeceras de cada petición de página durante unos días. El único informe que tu navegador aún puede enviar es un aviso de error de red de Cloudflare: solo cuando falla una petición a este sitio, con un error de conexión o una respuesta 4xx o 5xx, solo desde navegadores Chromium, y a Cloudflare, no a este servidor. Funcionamiento interno describe ese salto.",
      "Una credencial que envíes viaja como cabecera al servidor que elijas y nunca se escribe en disco ni se registra. gitlab la conserva en memoria mientras la sigas usando —hasta una hora después de tu última llamada, comprobando cada quince minutos con gitlab.com que sigue siendo válida— y después la descarta.",
    ],
    /**
     * Ver `en.credentialNotice`: el aviso vive en la portada, no en la ficha
     * del servidor, así que va enlazado — y en dos claves porque el párrafo
     * se pinta como texto plano.
     */
    credentialNotice:
      "libgen no necesita ninguna para usarse; la única excepción es voluntaria: una descarga con annas_member pide a tu cliente una clave de socio de Anna's Archive, la usa para esa petición y no la guarda. gitlab es el servidor que pide una credencial. A dónde va ese valor, qué impide el propio navegador y cómo acotarlo y revocarlo se explican por extenso en su aviso de seguridad, en la portada:",
    /** Ver `en.credentialNoticeLink`: literal el `<h4>` del aviso destino. */
    credentialNoticeLink: "¿A dónde va tu token de GitLab?",
    logsEyebrow: "Logs y retención",
    /** Ver `en.logsBody`: campos reales, quién los lee, y la copia de métricas acotada por el mismo año. */
    logsBody: [
      "El servidor web guarda logs de acceso estándar —dirección IP, user agent, la línea de petición (método, ruta y query string), código de estado, tamaño de la respuesta, referente, y el país, la ciudad y el operador de red a los que resuelve esa IP, consultados en local en una base de datos de MaxMind y no preguntando a nadie— para prevenir abusos (los lee CrowdSec) y para los paneles de uso del propio autor. Los ficheros rotan a diario y se borran al año; la copia que alimenta los paneles vive en la red del propio autor y no se conserva más tiempo que eso.",
      "El cuerpo de una llamada nunca se registra: lleva los argumentos, es decir, lo que de verdad buscas o preguntas —nginx lo mira solo para extraer dos nombres—. Las métricas de uso registran el método JSON-RPC, el nombre de la herramienta, el estado, los tiempos y el tamaño de la respuesta, qué instancia y qué salida la sirvieron, y la IP de quien llama —que está ahí para que el autor pueda separar su propio tráfico de pruebas del real—, pero nunca los argumentos ni el contenido de la respuesta. Esas métricas alimentan los mismos paneles.",
      "gitlab exporta además trazas y métricas OpenTelemetry a un colector en la red del autor: el método, la herramienta y la acción de catálogo (issue.list, por ejemplo), el éxito o el código de error, los tiempos y un seudónimo con clave de quien llama y del recurso leído —estable entre reinicios, que nadie puede leer—, pero nunca los argumentos, los resultados, el token ni respuesta alguna de GitLab.",
    ],
    slaEyebrow: "Sin SLA",
    slaBody: [
      "Este es un servicio personal, ofrecido tal cual y sin acuerdo de nivel de servicio: sin garantía de disponibilidad, sin canal de soporte y sin compromiso de que ninguno de los dos endpoints siga en pie —o igual— de un día para otro. No montes nada crítico encima: los dos servidores son open source y cada uno es un único binario estático, así que para levantar tu propia instancia basta con ese binario.",
    ],
    egressEyebrow: "De dónde parece venir una petición",
    /** Ver `en.egressBody`: la consecuencia y los países; el recuento de nodos vive en Funcionamiento interno. */
    egressBody: [
      "Las llamadas que los servidores hacen hacia fuera —a un mirror de Library Genesis, a los proveedores de acceso abierto o a gitlab.com— salen por un nodo de salida en España o en Reino Unido, no desde donde estés tú ni desde donde esté este sitio. Lo que ese tercero ve como origen de la petición es la dirección del nodo de salida: ni tu propia IP ni la de este servidor le llegan nunca. La única transferencia que no va por aquí es la que hay detrás de un enlace que se te devuelve —el de download ante todo—: descargarlo es una conexión de tu propio cliente, desde tu propia dirección.",
    ],
    /** Ver `en.egressPointer`: el texto del enlace es el h2 destino, literal. */
    egressPointer:
      "Qué nodos hay, qué instancia sale por cuál y qué pasa cuando uno falla se describen en Funcionamiento interno:",
    egressPointerLink: "Salida: por dónde sale una petición",
    legalEyebrow: "Postura legal",
    /**
     * Ver `en.legalBody`: alcance, orden, mecanismo, responsabilidad y
     * operador, un párrafo cada uno, con todas las fuentes de la ficha real
     * nombradas y el orden atribuido a cada tool — y a este despliegue.
     */
    legalBody: [
      "libgen no opera catálogo alguno ni aloja nada propio: es un cliente de índices y bibliotecas que gestionan otros. Del lado abierto son arXiv, Crossref, OpenLibrary, Project Gutenberg, dblp, PubMed, ERIC, OpenAlex, Europe PMC, bioRxiv, el RFC Editor, NIST, Dagstuhl, la ACL Anthology, Zenodo, SciELO, la FAO, Fatcat, OAPEN e Internet Archive; del lado de las bibliotecas en la sombra, un mirror de Library Genesis, randombook.org, Anna's Archive, Sci-Hub y el visor de artículos SciDB de Anna's Archive. A cuáles llega una llamada, y en qué orden, lo decide la herramienta que llamas y no el servicio entero.",
      "search parte del catálogo de Library Genesis; en este despliegue el valor por defecto del operador es extra_sources=always, así que una llamada que no diga otra cosa llega además a Anna's Archive y a siete proveedores abiertos —arXiv, Crossref, OpenLibrary, Project Gutenberg, dblp, PubMed y ERIC— en todas las llamadas, y una que fije extra_sources=never se queda solo en el catálogo.",
      "download y read van por identificador, y read solo admite hash o DOI. A qué fuentes llega un identificador, y en qué orden, depende de cuál sea:",
    ],
    /** Ver `en.legalResolution`: los tres casos, antes una frase de 115 palabras. */
    legalResolution: [
      {
        label: "Un artículo pedido por DOI",
        steps: [
          "Primero trece fuentes abiertas: OpenAlex, Europe PMC, bioRxiv, el RFC Editor, NIST, Dagstuhl, la ACL Anthology, Zenodo, SciELO, la FAO, Fatcat, Crossref y OAPEN.",
          "Sci-Hub, solo cuando ninguna de ellas lo sirve.",
          "SciDB, solo cuando Sci-Hub tampoco.",
        ],
      },
      {
        label: "Un libro pedido por ISBN",
        steps: [
          "OAPEN e Internet Archive, y en ningún otro sitio: ambos sirven copias con licencia abierta y nada más.",
        ],
      },
      {
        label: "Un libro pedido por su hash de catálogo",
        steps: [
          "Primero el mirror de Library Genesis. Un hash de catálogo es el identificador propio de esas bibliotecas, así que una petición que lo lleve va directa a ellas.",
          "randombook.org, cuando el mirror no lo sirve.",
          "Anna's Archive, cuando ninguno de los dos lo hace.",
        ],
      },
    ],
    /** Ver `en.legalResolutionTail`: cierra el bloque de arriba. */
    legalResolutionTail:
      "get_details añade metadatos de Crossref y OpenLibrary si se le pide, y recurre a Anna's Archive para un hash que el catálogo no tenga. download declara ese orden en su propia descripción, y read lista sus fuentes en su parámetro source, en la ficha de libgen.",
    /** Ver `en.legalBodyTail`: el resto de la postura legal. */
    legalBodyTail: [
      "La herramienta download de libgen nunca entrega un fichero por HTTP, que es la única forma de llegar a este endpoint: resuelve el identificador que le des y devuelve un enlace a la fuente que tenga el ítem, para que lo descargue tu propio cliente. Su herramienta read sí descarga el fichero, para devolverte el fragmento de texto que pediste, y guarda lo descargado en una caché de la instancia que te atendió. En ambos casos, mcp.jmrp.io no publica catálogo alguno ni pone ningún fichero a disposición de nadie: la transferencia, si la haces, es entre ese tercero y tú.",
      "Lo que hagas con los enlaces que devuelve libgen es responsabilidad tuya, bajo la ley que te sea aplicable. gitlab no hace más que retransmitir llamadas a gitlab.com con la credencial que le des, y no concede ningún derecho más allá del que ya te concede gitlab.com.",
      "Este servicio lo opera desde España una persona física, no una empresa, y no está vinculado a ninguna de las fuentes citadas: solo las consulta, y sus nombres pertenecen a sus dueños.",
    ],
    /** Ver `en.legalContact`: la dirección del security.txt, nombrada aquí como canal para retiradas y preguntas. */
    legalContact:
      "Las preguntas sobre esta página, y las peticiones de que este host deje de resolver un ítem o una fuente concretos, van a la dirección del security.txt del sitio:",
    legalContactLink: "mail@jmrp.io",
    /** Ver `en.legalLicenseNote`: cruce hacia /license/, que enlaza de vuelta a esta sección. */
    legalLicenseNote:
      "Nada de esto es una licencia sobre nada: lo que este sitio sí te deja reutilizar —sus textos, su código y los dos servidores— se dice en su propia página:",
    legalLicenseLink: "Licencia",
  },
} as const;
